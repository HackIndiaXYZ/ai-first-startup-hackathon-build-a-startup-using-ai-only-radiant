/**
 * Pure helper functions for DukaanAI Confirmation Flow, Idempotency, and API Error Formatting.
 */

export interface ConfirmPayloadInput {
  action: "add_sale" | "record_payment" | "adjust_stock" | "add_customer";
  idempotencyKey: string;
  rawInput: string;
  summary: string;
  confidence: number;
  customerName?: string | null;
  total?: number;
  paid?: number;
  amount?: number;
  product?: string;
  qtyChange?: number;
  unit?: string;
  phone?: string | null;
  notes?: string | null;
  items?: Array<{
    product: string;
    qty: number;
    unit?: string;
    unit_price?: number;
    total?: number;
  }>;
  createCustomer?: boolean;
}

export interface ParseApiResponse {
  success: boolean;
  parsed: {
    action: "add_sale" | "record_payment" | "adjust_stock" | "add_customer";
    data: {
      customer?: string | null;
      items?: Array<{ product: string; qty: number; unit?: string; unit_price?: number; total?: number }>;
      total?: number;
      paid?: number;
      amount?: number;
      product?: string;
      qty_change?: number;
      unit?: string;
      name?: string;
      phone?: string | null;
      notes?: string | null;
    };
    confidence: number;
    summary: string;
    raw_input?: string;
  };
  customer_match?: {
    status: "matched" | "ambiguous" | "new";
    matched: { id: string; name: string; phone?: string | null } | null;
    candidates: Array<{ customer: { id: string; name: string; phone?: string | null }; score: number }>;
    score: number;
    originalQuery: string;
    normalizedQuery: string;
    proposedName?: string;
  } | null;
}

export interface ParseSession {
  idempotencyKey: string;
  parseResult: ParseApiResponse;
  rawInput: string;
}

/**
 * Generates a clean UUID idempotency key for client-side confirmation requests.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Standard RFC4122 v4 UUID fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a fresh ParseSession with its own unique idempotency key.
 * Every parse result gets a fresh UUID so sequential entries never collide.
 */
export function createParseSession(parseResult: ParseApiResponse, rawInput: string): ParseSession {
  return {
    idempotencyKey: generateIdempotencyKey(),
    parseResult,
    rawInput: rawInput || parseResult.parsed?.raw_input || "",
  };
}

/**
 * Prepares payload for a retry of an existing parse session, preserving the exact same idempotencyKey.
 */
export function prepareRetryPayload(
  session: ParseSession,
  overrides?: Partial<ConfirmPayloadInput>
): Record<string, unknown> {
  const p = session.parseResult.parsed;
  return buildConfirmPayload({
    action: overrides?.action || p.action,
    idempotencyKey: session.idempotencyKey,
    rawInput: session.rawInput,
    summary: p.summary,
    confidence: p.confidence,
    customerName: overrides?.customerName !== undefined ? overrides.customerName : p.data.customer || p.data.name,
    total: overrides?.total !== undefined ? overrides.total : p.data.total,
    paid: overrides?.paid !== undefined ? overrides.paid : p.data.paid,
    amount: overrides?.amount !== undefined ? overrides.amount : p.data.amount,
    product: overrides?.product !== undefined ? overrides.product : p.data.product,
    qtyChange: overrides?.qtyChange !== undefined ? overrides.qtyChange : p.data.qty_change,
    unit: overrides?.unit !== undefined ? overrides.unit : p.data.unit,
    phone: overrides?.phone !== undefined ? overrides.phone : p.data.phone,
    notes: overrides?.notes !== undefined ? overrides.notes : p.data.notes,
    items: overrides?.items !== undefined ? overrides.items : p.data.items,
    createCustomer: overrides?.createCustomer,
    ...overrides,
  });
}

/**
 * Resets a parse session to null.
 */
export function resetParseSession(): null {
  return null;
}

/**
 * Determines whether a confidence score falls below the accepted reliability threshold.
 * Default threshold is 0.70 (70%).
 */
export function isLowConfidence(confidence: number, threshold = 0.7): boolean {
  if (typeof confidence !== "number" || isNaN(confidence)) return true;
  return confidence < threshold;
}

/**
 * Builds the typed JSON payload expected by POST /api/confirm.
 */
export function buildConfirmPayload(input: ConfirmPayloadInput): Record<string, unknown> {
  const base: Record<string, unknown> = {
    idempotency_key: input.idempotencyKey,
    raw_input: input.rawInput || "",
    action: input.action,
    summary: input.summary || "",
    confidence: typeof input.confidence === "number" ? input.confidence : 1.0,
  };

  switch (input.action) {
    case "add_sale": {
      const salePayload: Record<string, unknown> = {
        ...base,
        customer: input.customerName?.trim() || null,
        total: Number(input.total ?? 0),
        paid: Number(input.paid ?? 0),
        items: Array.isArray(input.items) ? input.items : [],
        create_customer: Boolean(input.createCustomer),
      };
      if (input.phone?.trim()) {
        salePayload.customer_phone = input.phone.trim();
      }
      return salePayload;
    }

    case "record_payment":
      return {
        ...base,
        customer: input.customerName?.trim() || "",
        amount: Number(input.amount ?? 0),
      };

    case "adjust_stock":
      return {
        ...base,
        product: input.product?.trim() || "",
        qty_change: Number(input.qtyChange ?? 0),
        unit: input.unit || undefined,
      };

    case "add_customer":
      return {
        ...base,
        name: input.customerName?.trim() || "",
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
      };

    default:
      return base;
  }
}

/**
 * Formats API errors from server endpoints into friendly, actionable English messages.
 */
export function formatApiError(err: unknown): string {
  if (!err) return "Unknown error occurred.";

  if (typeof err === "string") {
    return cleanErrorMessage(err);
  }

  if (err instanceof Error) {
    return cleanErrorMessage(err.message);
  }

  if (typeof err === "object" && err !== null && "error" in err) {
    const errorProp = (err as { error: unknown }).error;
    if (typeof errorProp === "string") return cleanErrorMessage(errorProp);
  }

  return "Server error. Please try again.";
}

function cleanErrorMessage(msg: string): string {
  const m = msg.toLowerCase();

  if (m.includes("overpayment") || m.includes("cannot exceed customer's current udhar balance")) {
    return msg; // Already contains specific current udhar amount
  }

  if (m.includes("cannot exceed total sale amount")) {
    return msg; // Paid amount exceeds total sale amount
  }

  if (m.includes("demo limit reached") || m.includes("daily_limit_exceeded")) {
    return "Demo limit reached: Daily limit has been reached. Please try again tomorrow.";
  }

  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Too many requests: Please wait a moment.";
  }

  if (m.includes("abort") || m.includes("timeout")) {
    return "Request timeout (30s). The server did not respond.";
  }

  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
    return "Network connection error.";
  }

  return msg;
}
