import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { executeLedgerEntry } from "@/lib/agents/ledger";
import { LedgerAction } from "@/lib/agents/types";

// Schema for sale line items
const itemSchema = z.object({
  product: z.string().trim().min(1).max(100),
  qty: z.number().finite().positive("Item quantity must be a positive number."),
  unit: z.string().trim().max(30).optional(),
  unit_price: z.number().finite().nonnegative().optional(),
  total: z.number().finite().nonnegative().optional(),
});

// Zod schema for /api/confirm
const confirmRequestSchema = z.object({
  idempotency_key: z.string().uuid("idempotency_key must be a valid UUID."),
  raw_input: z.string().max(1000).optional(),
  action: z.enum(["add_sale", "record_payment", "adjust_stock", "add_customer"]),
  data: z.record(z.string(), z.unknown()).optional(),
  // Flat properties support
  customer: z.string().trim().max(100).nullable().optional(),
  total: z.number().finite("Total must be a finite number.").nonnegative("Total must be non-negative.").optional(),
  paid: z.number().finite("Paid must be a finite number.").nonnegative("Paid must be non-negative.").optional(),
  amount: z.number().finite("Payment amount must be a finite number.").positive("Payment amount must be positive.").optional(),
  product: z.string().trim().max(100).optional(),
  qty_change: z.number().finite("Quantity change must be a finite number.").optional(),
  unit: z.string().trim().max(30).optional(),
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(25).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  summary: z.string().trim().max(500).optional(),
  confidence: z.number().finite().optional(),
  items: z.array(itemSchema).optional(),
  create_customer: z.boolean().optional(),
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

    // 2. Derive shop_id strictly from the authenticated user's shop (never from request body!)
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

    // 3. Zod-validate the confirmation request body
    const rawBody = await req.json().catch(() => null);
    const parsedBody = confirmRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      const firstError = parsedBody.error.issues[0]?.message || "Validation failed";
      return NextResponse.json(
        {
          error: firstError,
          code: "VALIDATION_FAILED",
          details: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const validData = parsedBody.data;
    const idempotencyKey = validData.idempotency_key;
    const rawInput = validData.raw_input || "";

    // Merge flat fields and nested data object if provided
    const mergedData = {
      ...(validData.data || {}),
      ...validData,
    } as Record<string, unknown>;

    let actionPayload: LedgerAction;

    switch (validData.action) {
      case "add_sale": {
        const total = Number(mergedData.total);
        const paid = Number(mergedData.paid ?? 0);
        if (isNaN(total) || total < 0) {
          return NextResponse.json(
            { error: "Total sale amount is required and must be non-negative.", code: "INVALID_SALE" },
            { status: 400 }
          );
        }
        actionPayload = {
          action: "add_sale",
          customer: mergedData.customer ? String(mergedData.customer).trim() : null,
          total,
          paid,
          items: Array.isArray(mergedData.items) ? mergedData.items : [],
          summary: mergedData.summary ? String(mergedData.summary) : "बिक्री",
          confidence: typeof mergedData.confidence === "number" ? mergedData.confidence : 1.0,
          create_customer: Boolean(mergedData.create_customer),
        };
        break;
      }

      case "record_payment": {
        const amount = Number(mergedData.amount);
        const customer = String(mergedData.customer || "").trim();
        if (isNaN(amount) || amount <= 0) {
          return NextResponse.json(
            { error: "Payment amount must be greater than zero.", code: "INVALID_PAYMENT" },
            { status: 400 }
          );
        }
        if (!customer) {
          return NextResponse.json(
            { error: "Customer name is required for payment.", code: "INVALID_CUSTOMER" },
            { status: 400 }
          );
        }
        actionPayload = {
          action: "record_payment",
          customer,
          amount,
          summary: mergedData.summary ? String(mergedData.summary) : `${customer} ने ₹${amount} जमा किए`,
          confidence: 1.0,
        };
        break;
      }

      case "adjust_stock": {
        const product = String(mergedData.product || "").trim();
        const qty_change = Number(mergedData.qty_change);
        if (!product) {
          return NextResponse.json(
            { error: "Product name is required for stock adjustment.", code: "INVALID_PRODUCT" },
            { status: 400 }
          );
        }
        if (isNaN(qty_change) || !Number.isFinite(qty_change)) {
          return NextResponse.json(
            { error: "Quantity change must be a valid number.", code: "INVALID_QTY" },
            { status: 400 }
          );
        }
        actionPayload = {
          action: "adjust_stock",
          product,
          qty_change,
          unit: mergedData.unit ? String(mergedData.unit) : undefined,
          summary: mergedData.summary ? String(mergedData.summary) : `${product}: स्टॉक अपडेट`,
          confidence: 1.0,
        };
        break;
      }

      case "add_customer": {
        const name = String(mergedData.name || mergedData.customer || "").trim();
        if (!name) {
          return NextResponse.json(
            { error: "Customer name is required.", code: "INVALID_CUSTOMER_NAME" },
            { status: 400 }
          );
        }
        actionPayload = {
          action: "add_customer",
          name,
          phone: mergedData.phone ? String(mergedData.phone).trim() : null,
          notes: mergedData.notes ? String(mergedData.notes).trim() : null,
          summary: mergedData.summary ? String(mergedData.summary) : `नया ग्राहक: ${name}`,
          confidence: 1.0,
        };
        break;
      }
    }

    // 4. Execute atomic single transaction via Ledger agent RPC
    const result = await executeLedgerEntry(
      supabase,
      shop.id,
      actionPayload,
      idempotencyKey,
      rawInput
    );

    // 5. Log confirmed transaction to agent_logs
    await supabase.from("agent_logs").insert({
      shop_id: shop.id,
      agent: "ledger",
      input: rawInput || JSON.stringify(actionPayload),
      output_json: result as unknown as Record<string, unknown>,
      confidence: 1.0,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error occurred.";
    console.error("POST /api/confirm error:", err);

    const isValidationErr =
      message.includes("Paid amount") ||
      message.includes("Payment amount") ||
      message.includes("Stock cannot be negative") ||
      message.includes("Insufficient stock") ||
      message.includes("not found") ||
      message.includes("Ambiguous");

    return NextResponse.json(
      {
        error: message,
        code: isValidationErr ? "VALIDATION_FAILED" : "EXECUTION_ERROR",
      },
      { status: isValidationErr ? 400 : 500 }
    );
  }
}
