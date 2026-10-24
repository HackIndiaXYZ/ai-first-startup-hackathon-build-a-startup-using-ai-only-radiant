import { SupabaseClient } from "@supabase/supabase-js";
import {
  LedgerAction,
  ValidationResult,
  LedgerExecutionResult,
  Customer,
} from "./types";
import { findBestCustomerMatch } from "./customer-matcher";

// Ensure this module is never bundled or executed on the client
if (typeof window !== "undefined") {
  throw new Error("Ledger agent must only be used on the server.");
}

/**
 * Validates a ledger action before executing the transaction.
 * Enforces business rules:
 * 1. paid <= total (sales cannot have paid > total)
 * 2. payment amount > 0, and payment CANNOT exceed current udhar balance
 * 3. stock not negative (applies strictly to matched products; unmatched items create no stock changes)
 */
export function validateLedgerAction(
  action: LedgerAction,
  context?: {
    customerBalance?: number;
    productStock?: Record<string, number>;
  }
): ValidationResult {
  switch (action.action) {
    case "add_sale": {
      if (
        typeof action.total !== "number" ||
        !Number.isFinite(action.total) ||
        action.total < 0
      ) {
        return { valid: false, error: "Total sale amount must be a finite, non-negative number." };
      }
      if (
        typeof action.paid !== "number" ||
        !Number.isFinite(action.paid) ||
        action.paid < 0
      ) {
        return { valid: false, error: "Paid amount must be a finite, non-negative number." };
      }
      if (action.paid > action.total) {
        return {
          valid: false,
          error: `Paid amount (₹${action.paid}) cannot exceed total sale amount (₹${action.total}).`,
        };
      }

      // Stock validation applies ONLY to matched products
      if (action.items && context?.productStock) {
        for (const item of action.items) {
          const currentStock = context.productStock[item.product.toLowerCase()];
          if (currentStock !== undefined && currentStock - item.qty < 0) {
            return {
              valid: false,
              error: `Insufficient stock for product "${item.product}". Available: ${currentStock}, requested: ${item.qty}.`,
            };
          }
        }
      }
      return { valid: true };
    }

    case "record_payment": {
      if (
        typeof action.amount !== "number" ||
        !Number.isFinite(action.amount) ||
        action.amount <= 0
      ) {
        return {
          valid: false,
          error: `Payment amount must be greater than zero. Received: ₹${action.amount}.`,
        };
      }
      if (!action.customer || !action.customer.trim()) {
        return { valid: false, error: "Customer name is required to record a payment." };
      }

      // Reject payment if greater than customer's current udhar balance
      if (context?.customerBalance !== undefined) {
        const curUdhar = context.customerBalance > 0 ? context.customerBalance : 0;
        if (action.amount > curUdhar) {
          return {
            valid: false,
            error: `Payment amount (₹${action.amount}) cannot exceed customer's current udhar balance of ₹${curUdhar}.`,
          };
        }
      }
      return { valid: true };
    }

    case "adjust_stock": {
      if (!action.product || !action.product.trim()) {
        return { valid: false, error: "Product name is required for stock adjustment." };
      }
      if (typeof action.qty_change !== "number" || !Number.isFinite(action.qty_change)) {
        return { valid: false, error: "Quantity change must be a valid finite number." };
      }

      if (context?.productStock) {
        const currentStock = context.productStock[action.product.toLowerCase()];
        if (currentStock === undefined) {
          return {
            valid: false,
            error: `Product "${action.product}" does not exist in inventory. Cannot adjust stock.`,
          };
        }
        if (currentStock + action.qty_change < 0) {
          return {
            valid: false,
            error: `Stock cannot be negative. Product "${action.product}" currently has ${currentStock}, cannot reduce by ${Math.abs(
              action.qty_change
            )}.`,
          };
        }
      }
      return { valid: true };
    }

    case "add_customer": {
      if (!action.name || !action.name.trim()) {
        return { valid: false, error: "Customer name cannot be empty." };
      }
      return { valid: true };
    }

    default:
      return { valid: false, error: `Unsupported ledger action type: ${(action as { action: string }).action}` };
  }
}

/**
 * Executes a confirmed ledger entry exclusively via the atomic Postgres RPC procedure.
 * No client-side or TypeScript multi-statement fallback is permitted.
 */
export async function executeLedgerEntry(
  supabase: SupabaseClient,
  shopId: string,
  action: LedgerAction,
  idempotencyKey: string,
  rawInput?: string
): Promise<LedgerExecutionResult> {
  // 1. Fetch shop customers for matching
  const { data: customersData, error: custFetchErr } = await supabase
    .from("customers")
    .select("id, shop_id, name, phone, notes")
    .eq("shop_id", shopId);

  if (custFetchErr) {
    throw new Error(`Failed to query shop customers: ${custFetchErr.message}`);
  }

  const existingCustomers: Customer[] = (customersData || []) as Customer[];

  // 2. Resolve customer matching
  let resolvedCustomer: Customer | null = null;
  let targetCustomerName = "";

  if (action.action === "add_sale" && action.customer) {
    targetCustomerName = action.customer;
  } else if (action.action === "record_payment" && action.customer) {
    targetCustomerName = action.customer;
  } else if (action.action === "add_customer" && action.name) {
    targetCustomerName = action.name;
  }

  if (targetCustomerName) {
    const match = findBestCustomerMatch(targetCustomerName, existingCustomers);
    if (match.status === "matched" && match.matched) {
      resolvedCustomer = match.matched;
    } else if (match.status === "ambiguous") {
      const candidateNames = match.candidates.map((c) => c.customer.name).join(", ");
      throw new Error(
        `Ambiguous customer match for "${targetCustomerName}". Possible matches: ${candidateNames}. Please select the exact customer.`
      );
    }
  }

  // 3. For payments, customer must exist
  if (action.action === "record_payment" && !resolvedCustomer) {
    throw new Error(
      `Customer "${action.customer}" was not found in your ledger. Please add the customer first.`
    );
  }

  // 4. Fetch customer balance if resolved
  let currentBalance = 0;
  if (resolvedCustomer) {
    const { data: balData } = await supabase
      .from("customer_balances")
      .select("balance")
      .eq("customer_id", resolvedCustomer.id)
      .maybeSingle();

    if (balData) {
      currentBalance = Number(balData.balance || 0);
    }
  }

  // 5. Fetch product inventory for matching and stock validation
  const productStockMap: Record<string, number> = {};
  const productEntityMap: Record<
    string,
    { id: string; name: string; stock_qty: number; price: number; unit: string; reorder_level: number }
  > = {};

  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, stock_qty, price, unit, reorder_level")
    .eq("shop_id", shopId);

  if (productsData) {
    for (const p of productsData) {
      productStockMap[p.name.toLowerCase()] = Number(p.stock_qty);
      productEntityMap[p.name.toLowerCase()] = {
        id: p.id,
        name: p.name,
        stock_qty: Number(p.stock_qty),
        price: Number(p.price),
        unit: p.unit,
        reorder_level: Number(p.reorder_level || 5),
      };
    }
  }

  // 6. Pre-validate in TypeScript for immediate feedback
  const validation = validateLedgerAction(action, {
    customerBalance: currentBalance,
    productStock: productStockMap,
  });

  if (!validation.valid) {
    throw new Error(validation.error || "Ledger validation failed.");
  }

  // 7. Prepare RPC payload
  const rpcPayload: Record<string, unknown> = {
    action: action.action,
    raw_input: rawInput || "",
    summary: action.summary,
  };

  if (action.action === "add_sale") {
    rpcPayload.total = action.total;
    rpcPayload.paid = action.paid;
    rpcPayload.customer = resolvedCustomer ? resolvedCustomer.name : action.customer;
    rpcPayload.customer_id = resolvedCustomer ? resolvedCustomer.id : undefined;
    rpcPayload.create_customer = Boolean(action.create_customer);

    if (action.items && action.items.length > 0) {
      rpcPayload.items = action.items.map((it) => {
        const itemObj = it as { product: string; product_id?: string; qty: number; unit_price?: number };
        const matchedProd = itemObj.product_id
          ? productsData?.find((p) => p.id === itemObj.product_id)
          : productEntityMap[it.product.toLowerCase()];

        return {
          product: it.product,
          product_id: matchedProd?.id,
          qty: it.qty,
          unit_price: it.unit_price ?? matchedProd?.price ?? 0,
        };
      });
    }
  } else if (action.action === "record_payment") {
    rpcPayload.amount = action.amount;
    rpcPayload.customer = resolvedCustomer?.name || action.customer;
    rpcPayload.customer_id = resolvedCustomer?.id;
  } else if (action.action === "adjust_stock") {
    const matchedProd = productEntityMap[action.product.toLowerCase()];
    rpcPayload.product = action.product;
    rpcPayload.product_id = matchedProd?.id;
    rpcPayload.qty_change = action.qty_change;
    rpcPayload.unit = action.unit || matchedProd?.unit || "packet";
  } else if (action.action === "add_customer") {
    rpcPayload.name = action.name;
    rpcPayload.phone = action.phone;
    rpcPayload.notes = action.notes;
  }

  // 8. Execute via the atomic Postgres RPC procedure ONLY
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "process_ledger_entry",
    {
      p_shop_id: shopId,
      p_action: rpcPayload,
      p_idempotency_key: idempotencyKey,
    }
  );

  if (rpcError) {
    const errMsg = rpcError.message || "";
    if (
      errMsg.includes("could not find function") ||
      errMsg.includes("function public.process_ledger_entry") ||
      errMsg.includes("schema cache")
    ) {
      throw new Error(
        "Database procedure 'process_ledger_entry' is not installed or schema is reloading. Please paste supabase/migrations/002_ledger.sql into your Supabase SQL Editor and run it."
      );
    }
    throw new Error(errMsg);
  }

  if (!rpcResult || !rpcResult.success) {
    throw new Error("Ledger transaction failed to process.");
  }

    // Extract or compute stock updates and identify low stock products
    const stockUpdates: Array<{
      product_id: string;
      name: string;
      old_stock: number;
      new_stock: number;
      reorder_level?: number;
      is_low_stock?: boolean;
    }> = [];

    const lowStockProducts: Array<{
      product_id: string;
      name: string;
      current_stock: number;
      reorder_level: number;
    }> = [];

    if (Array.isArray(rpcResult.stock_updates) && rpcResult.stock_updates.length > 0) {
      for (const su of rpcResult.stock_updates) {
        const oldStock = Number(su.old_stock);
        const newStock = Number(su.new_stock);
        const reorderLevel = Number(su.reorder_level || 5);
        const isLow = Boolean(su.is_low_stock) || newStock <= reorderLevel;

        stockUpdates.push({
          product_id: su.product_id,
          name: su.name,
          old_stock: oldStock,
          new_stock: newStock,
          reorder_level: reorderLevel,
          is_low_stock: isLow,
        });

        if (isLow) {
          lowStockProducts.push({
            product_id: su.product_id,
            name: su.name,
            current_stock: newStock,
            reorder_level: reorderLevel,
          });
        }
      }
    } else if (action.action === "add_sale" && action.items) {
      // Local fallback calculation when RPC does not return stock_updates array
      for (const item of action.items) {
        const itemObj = item as { product: string; product_id?: string; qty: number };
        const matchedProd = itemObj.product_id
          ? productsData?.find((p) => p.id === itemObj.product_id)
          : productEntityMap[item.product.toLowerCase()];

        if (matchedProd) {
          const oldStock = Number(matchedProd.stock_qty);
          const newStock = oldStock - item.qty;
          const reorderLevel = Number(matchedProd.reorder_level || 5);
          const isLow = newStock <= reorderLevel;

          stockUpdates.push({
            product_id: matchedProd.id,
            name: matchedProd.name,
            old_stock: oldStock,
            new_stock: newStock,
            reorder_level: reorderLevel,
            is_low_stock: isLow,
          });

          if (isLow) {
            lowStockProducts.push({
              product_id: matchedProd.id,
              name: matchedProd.name,
              current_stock: newStock,
              reorder_level: reorderLevel,
            });
          }
        }
      }
    }

    return {
      success: true,
      action: action.action,
      transaction_id: rpcResult.transaction_id,
      idempotent: Boolean(rpcResult.idempotent),
      customer: rpcResult.customer_id
        ? {
            id: rpcResult.customer_id,
            name: resolvedCustomer?.name || targetCustomerName,
            balance: Number(rpcResult.customer_balance || 0),
          }
        : undefined,
      stock_updates: stockUpdates.length > 0 ? stockUpdates : undefined,
      low_stock_products: lowStockProducts.length > 0 ? lowStockProducts : undefined,
      unmatched_items: Array.isArray(rpcResult.unmatched_items) && rpcResult.unmatched_items.length > 0
        ? rpcResult.unmatched_items
        : undefined,
      summary: action.summary,
    };
  }
