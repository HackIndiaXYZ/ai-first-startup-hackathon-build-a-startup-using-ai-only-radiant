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
    case "add_sale":
      return {
        ...base,
        customer: input.customerName?.trim() || null,
        total: Number(input.total ?? 0),
        paid: Number(input.paid ?? 0),
        items: Array.isArray(input.items) ? input.items : [],
        create_customer: Boolean(input.createCustomer),
      };

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
 * Formats API errors from server endpoints into friendly, actionable Hindi/English messages.
 */
export function formatApiError(err: unknown): string {
  if (!err) return "अज्ञात त्रुटि हुई (Unknown error occurred).";

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

  return "सर्वर त्रुटि (Server error). कृपया पुनः प्रयास करें।";
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
    return "डेमो सीमा समाप्त: आज की दैनिक सीमा पूरी हो चुकी है। कल पुनः प्रयास करें। (Demo limit reached, please try again tomorrow).";
  }

  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "बहुत अधिक अनुरोध: कृपया कुछ सेकंड प्रतीक्षा करें। (Rate limit reached. Please wait a moment).";
  }

  if (m.includes("abort") || m.includes("timeout")) {
    return "अनुरोध समय समाप्त (30s timeout). सर्वर से उत्तर नहीं मिला।";
  }

  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch")) {
    return "इंटरनेट/नेटवर्क कनेक्शन त्रुटि (Network connection error).";
  }

  return msg;
}
