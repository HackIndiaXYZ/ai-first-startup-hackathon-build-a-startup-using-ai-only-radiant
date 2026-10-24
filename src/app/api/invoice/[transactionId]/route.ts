import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePdf, formatInvoiceNumber } from "@/lib/invoice";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;
    if (!transactionId) {
      return NextResponse.json(
        { error: "Transaction ID is required." },
        { status: 400 }
      );
    }

    // 1. Verify Authentication (RLS-safe, no service role key)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in or use demo account to access invoices." },
        { status: 401 }
      );
    }

    // 2. Derive shop for the authenticated user
    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, name, gstin")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (shopError || !shop) {
      return NextResponse.json(
        { error: "Shop profile not found for this user." },
        { status: 404 }
      );
    }

    // 3. Query transaction strictly scoped to shop_id
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select(
        `
        id,
        shop_id,
        customer_id,
        type,
        total_amount,
        paid_amount,
        raw_input,
        created_at,
        customer:customers(id, name, phone)
      `
      )
      .eq("id", transactionId)
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (txError || !tx) {
      return NextResponse.json(
        { error: "Transaction not found or does not belong to your shop." },
        { status: 404 }
      );
    }

    // 4. Query line items with product names
    const { data: itemsData } = await supabase
      .from("transaction_items")
      .select(
        `
        id,
        qty,
        unit_price,
        product:products(name, unit)
      `
      )
      .eq("transaction_id", transactionId);

    const items = (itemsData || []).map((it) => {
      const prod = Array.isArray(it.product) ? it.product[0] : it.product;
      return {
        name: prod?.name || "Kirana Item",
        qty: Number(it.qty || 1),
        unit: prod?.unit || "unit",
        unit_price: Number(it.unit_price || 0),
        total: Number(it.qty || 1) * Number(it.unit_price || 0),
      };
    });

    // 5. Format IST Date
    let dateIst: string;
    try {
      dateIst = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(tx.created_at));
    } catch {
      dateIst = tx.created_at;
    }

    const customerObj = Array.isArray(tx.customer) ? tx.customer[0] : tx.customer;
    const customerName = customerObj?.name || null;
    const customerPhone = customerObj?.phone || null;

    // 6. Generate GST-style PDF bytes
    const pdfBytes = await generateInvoicePdf({
      transactionId: tx.id,
      dateIst,
      shopName: shop.name,
      shopGstin: shop.gstin,
      customerName,
      customerPhone,
      rawInput: tx.raw_input,
      items,
      totalAmount: Number(tx.total_amount),
      paidAmount: Number(tx.paid_amount),
    });

    const filename = `invoice-${formatInvoiceNumber(tx.id)}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/invoice error:", err);
    const msg = err instanceof Error ? err.message : "Internal invoice generation error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
