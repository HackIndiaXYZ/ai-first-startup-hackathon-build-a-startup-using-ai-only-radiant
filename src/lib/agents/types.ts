// Types for DukaanAI Parser and Ledger Agents

export interface SaleItem {
  product: string;
  qty: number;
  unit?: string;
  unit_price?: number;
  total?: number;
}

export interface AddSaleAction {
  action: "add_sale";
  customer?: string | null;
  items?: SaleItem[];
  total: number;
  paid: number;
  confidence: number;
  summary: string;
  create_customer?: boolean;
}

export interface RecordPaymentAction {
  action: "record_payment";
  customer: string;
  amount: number;
  confidence: number;
  summary: string;
}

export interface AdjustStockAction {
  action: "adjust_stock";
  product: string;
  qty_change: number;
  unit?: string;
  confidence: number;
  summary: string;
}

export interface AddCustomerAction {
  action: "add_customer";
  name: string;
  phone?: string | null;
  notes?: string | null;
  confidence: number;
  summary: string;
}

export type LedgerAction =
  | AddSaleAction
  | RecordPaymentAction
  | AdjustStockAction
  | AddCustomerAction;

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
  created_at?: string;
}

export type CustomerMatchStatus = "matched" | "ambiguous" | "new";

export interface CustomerCandidate {
  customer: Customer;
  score: number;
}

export interface CustomerMatchResult {
  status: CustomerMatchStatus;
  matched: Customer | null;
  candidates: CustomerCandidate[];
  score: number;
  originalQuery: string;
  normalizedQuery: string;
  proposedName?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface LedgerExecutionResult {
  success: boolean;
  action: string;
  transaction_id?: string;
  idempotent?: boolean;
  customer?: {
    id: string;
    name: string;
    balance?: number;
  };
  stock_updates?: Array<{
    product_id: string;
    name: string;
    old_stock: number;
    new_stock: number;
    reorder_level?: number;
    is_low_stock?: boolean;
    unit?: string;
  }>;
  low_stock_products?: Array<{
    product_id: string;
    name: string;
    current_stock: number;
    reorder_level: number;
    unit?: string;
  }>;
  unmatched_items?: Array<{
    product: string;
    qty: number;
  }>;
  summary: string;
}

export interface ParsedActionResult {
  action: "add_sale" | "record_payment" | "adjust_stock" | "add_customer";
  data:
    | Omit<AddSaleAction, "action">
    | Omit<RecordPaymentAction, "action">
    | Omit<AdjustStockAction, "action">
    | Omit<AddCustomerAction, "action">;
  confidence: number;
  summary: string;
  raw_input: string;
  model_used: string;
}
