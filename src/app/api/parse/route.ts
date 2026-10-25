import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseShopkeeperInput } from "@/lib/agents/parser";
import { findBestCustomerMatch } from "@/lib/agents/customer-matcher";
import { recordAndCheckDbRateLimit, extractClientIp } from "@/lib/rate-limit";
import { Customer } from "@/lib/agents/types";

// Strict Zod schema for /api/parse input
const parseSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Input text cannot be empty.")
    .max(1000, "Input text cannot exceed 1000 characters."),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authentication (demo user or standard user)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please sign in or use 'Try demo' to continue.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Derive shop_id strictly from the authenticated user's shop
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (shopError || !shop) {
      return NextResponse.json(
        {
          error: "No shop found for this account. Run 'npm run seed' to initialize demo data.",
          code: "SHOP_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // 3. Zod-validate the request body
    const rawBody = await req.json().catch(() => null);
    const parsedInput = parseSchema.safeParse(rawBody);

    if (!parsedInput.success) {
      const firstError = parsedInput.error.issues[0]?.message || "Invalid input";
      return NextResponse.json(
        {
          error: firstError,
          code: "VALIDATION_FAILED",
          details: parsedInput.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { text } = parsedInput.data;

    // 4. DB-backed rate limiting: record attempt BEFORE calling Gemini so failed calls count too
    const clientIp = extractClientIp(req);
    const rateCheck = await recordAndCheckDbRateLimit(supabase, user.id, clientIp);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.error || "demo limit reached, try again tomorrow",
          code: rateCheck.code || "RATE_LIMIT_EXCEEDED",
        },
        { status: 429 }
      );
    }

    // 5. Invoke Parser Agent with Gemini
    const parseResult = await parseShopkeeperInput(text);

    // 6. Preview customer matching (matched, ambiguous, or new)
    let customerMatch = null;
    let targetName = "";
    if ("customer" in parseResult.data && parseResult.data.customer) {
      targetName = parseResult.data.customer;
    } else if ("name" in parseResult.data && parseResult.data.name) {
      targetName = parseResult.data.name;
    }

    if (targetName) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, shop_id, name, phone, notes")
        .eq("shop_id", shop.id);

      if (customers) {
        customerMatch = findBestCustomerMatch(targetName, customers as Customer[]);
      }
    }

    // 7. Preview product matching and compute total if items provided
    let productMatches = null;
    let totalMismatchWarning: string | null = null;

    if (
      parseResult.action === "add_sale" &&
      "items" in parseResult.data &&
      Array.isArray(parseResult.data.items) &&
      parseResult.data.items.length > 0
    ) {
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, unit, price, stock_qty, reorder_level")
        .eq("shop_id", shop.id);

      const productsList = (productsData || []) as Array<{
        id: string;
        name: string;
        unit: string;
        price: number;
        stock_qty: number;
        reorder_level: number;
      }>;

      const { findBestProductMatch, resolveEffectiveItemQty } = await import("@/lib/product-matcher");

      productMatches = parseResult.data.items.map((it) => {
        const match = findBestProductMatch(it.product, productsList, it.unit);
        return {
          item: it,
          match,
        };
      });

      // Compute from prices ONLY when EVERY item is matched, units agree, and no unit mismatch exists
      const allItemsMatchedWithoutMismatch =
        productMatches.length > 0 &&
        productMatches.every(
          (pm) =>
            pm.match.status === "matched" &&
            pm.match.matched !== null &&
            !pm.match.unitMismatch &&
            Number(pm.match.matched.price || 0) > 0
        );

      let computedTotal = 0;
      if (allItemsMatchedWithoutMismatch) {
        computedTotal = productMatches.reduce((sum, pm) => {
          const unitPrice = Number(pm.match.matched?.price || 0);
          const effectiveQty = resolveEffectiveItemQty(pm.item.qty, pm.item.unit, pm.match.matched?.unit);
          return sum + (effectiveQty * unitPrice);
        }, 0);
      }

      const spokenTotal = Number(parseResult.data.total || 0);

      if (spokenTotal === 0) {
        if (allItemsMatchedWithoutMismatch && computedTotal > 0) {
          parseResult.data.total = computedTotal;
        } else {
          // Never save a guessed total: require user to enter total
          parseResult.data.total = 0;
        }
      } else if (
        spokenTotal > 0 &&
        allItemsMatchedWithoutMismatch &&
        computedTotal > 0 &&
        spokenTotal !== computedTotal
      ) {
        totalMismatchWarning = `Spoken total (Rs ${spokenTotal}) differs from computed items total (Rs ${computedTotal}).`;
      }
    }

    // 8. Log call to agent_logs
    await supabase.from("agent_logs").insert({
      shop_id: shop.id,
      agent: "parser",
      input: text,
      output_json: parseResult as unknown as Record<string, unknown>,
      confidence: parseResult.confidence,
    });

    return NextResponse.json({
      success: true,
      parsed: parseResult,
      customer_match: customerMatch,
      product_matches: productMatches,
      total_mismatch_warning: totalMismatchWarning,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error occurred.";
    console.error("POST /api/parse error:", err);

    return NextResponse.json(
      {
        error: message,
        code: "PARSE_ERROR",
      },
      { status: 500 }
    );
  }
}
