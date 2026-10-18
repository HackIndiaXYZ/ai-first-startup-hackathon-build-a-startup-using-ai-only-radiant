"use client";

import { useState, useMemo } from "react";
import { LedgerExecutionResult, Customer } from "@/lib/agents/types";
import { findBestCustomerMatch } from "@/lib/agents/customer-matcher";
import { buildConfirmPayload, formatApiError, isLowConfidence } from "@/lib/confirm-helpers";

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

interface ConfirmationCardProps {
  parseResult: ParseApiResponse;
  idempotencyKey: string;
  rawInput: string;
  customers?: Customer[];
  onCancel: () => void;
  onSuccess: (result: LedgerExecutionResult) => void;
}

export function ConfirmationCard({
  parseResult,
  idempotencyKey,
  rawInput,
  customers = [],
  onCancel,
  onSuccess,
}: ConfirmationCardProps) {
  const { parsed, customer_match: initialCustomerMatch } = parseResult;
  const initialAction = parsed.action;
  const initialData = parsed.data;

  // Initial customer name from parser/matcher
  const initialCustomerName =
    initialCustomerMatch?.matched?.name || initialData.customer || initialData.name || "";

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [customerName, setCustomerName] = useState<string>(initialCustomerName);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerMatch?.matched?.id || null
  );
  const [createCustomer, setCreateCustomer] = useState<boolean>(
    initialCustomerMatch?.status === "new"
  );

  const [total, setTotal] = useState<number>(Number(initialData.total ?? 0));
  const [paid, setPaid] = useState<number>(Number(initialData.paid ?? 0));
  const [amount, setAmount] = useState<number>(Number(initialData.amount ?? 0));
  const [product, setProduct] = useState<string>(initialData.product || "");
  const [qtyChange, setQtyChange] = useState<number>(Number(initialData.qty_change ?? 0));

  // Request & Execution states
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<LedgerExecutionResult | null>(null);

  const confidenceScore = Math.round((parsed.confidence ?? 1) * 100);
  const lowConfidence = isLowConfidence(parsed.confidence ?? 1);

  // Re-run customer matching if user changed the customer name
  const isCustomerNameEdited =
    customerName.trim().toLowerCase() !== initialCustomerName.trim().toLowerCase();

  const activeCustomerMatch = useMemo(() => {
    if (!isCustomerNameEdited) {
      return initialCustomerMatch || null;
    }
    const trimmed = customerName.trim();
    if (!trimmed) {
      return null;
    }
    return findBestCustomerMatch(trimmed, customers);
  }, [isCustomerNameEdited, customerName, initialCustomerMatch, customers]);

  // Determine effective customer name and match status
  const currentMatchStatus = activeCustomerMatch?.status || (customerName.trim() ? "new" : null);

  // Validation: Never send an unmatched edited name
  const isCustomerMatchValid = useMemo(() => {
    // Stock adjustment doesn't need customer
    if (initialAction === "adjust_stock") return true;

    // Add sale with empty customer is anonymous walk-in sale
    if (initialAction === "add_sale" && !customerName.trim()) {
      return true;
    }

    // Payment or Add Customer requires a customer name
    if ((initialAction === "record_payment" || initialAction === "add_customer") && !customerName.trim()) {
      return false;
    }

    // If customer name was edited:
    if (isCustomerNameEdited) {
      if (!customerName.trim()) return initialAction === "add_sale";

      // If matched, valid!
      if (activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched) {
        return true;
      }

      // If ambiguous, user must select candidate or create new
      if (activeCustomerMatch?.status === "ambiguous") {
        return Boolean(selectedCustomerId) || createCustomer;
      }

      // If status is new (unmatched name):
      // Must explicitly check "createCustomer" so it's not sent as an unmatched name
      if (activeCustomerMatch?.status === "new") {
        // record_payment CANNOT create a new customer
        if (initialAction === "record_payment") return false;
        return createCustomer;
      }

      return false;
    }

    // If not edited, check if ambiguous requires selection
    if (initialCustomerMatch?.status === "ambiguous") {
      return Boolean(selectedCustomerId) || createCustomer;
    }

    return true;
  }, [
    initialAction,
    customerName,
    isCustomerNameEdited,
    activeCustomerMatch,
    selectedCustomerId,
    createCustomer,
    initialCustomerMatch,
  ]);

  // Calculate udhar for sale
  const udharAmount = Math.max(0, total - paid);

  const handleConfirm = async () => {
    if (!isCustomerMatchValid || isSaving) return;

    setIsSaving(true);
    setApiError(null);

    try {
      // Determine effective final customer name to send
      let effectiveCustomerName: string | null = null;
      if (selectedCustomerId) {
        const found =
          customers.find((c) => c.id === selectedCustomerId) ||
          activeCustomerMatch?.candidates.find((c) => c.customer.id === selectedCustomerId)?.customer;
        effectiveCustomerName = found?.name || customerName.trim();
      } else if (activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched) {
        effectiveCustomerName = activeCustomerMatch.matched.name;
      } else {
        effectiveCustomerName = customerName.trim() || null;
      }

      const payload = buildConfirmPayload({
        action: initialAction,
        idempotencyKey,
        rawInput: rawInput || parsed.raw_input || "",
        summary: parsed.summary,
        confidence: parsed.confidence,
        customerName: effectiveCustomerName,
        total,
        paid,
        amount,
        product,
        qtyChange,
        unit: initialData.unit,
        phone: initialData.phone,
        notes: initialData.notes,
        items: initialData.items,
        createCustomer: createCustomer || (!selectedCustomerId && activeCustomerMatch?.status === "new"),
      });

      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(formatApiError(data.error || "पुष्टि विफल हुई (Confirmation failed)."));
      } else {
        const result = data.result as LedgerExecutionResult;
        setConfirmedResult(result);
        onSuccess(result);
      }
    } catch (err: unknown) {
      setApiError(formatApiError(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="confirmation-card"
      className="w-full max-w-md mx-auto rounded-2xl bg-card border border-border/80 shadow-md p-4 sm:p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* ── Top Badge & Action Title ── */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
            {initialAction === "add_sale" && "🛒"}
            {initialAction === "record_payment" && "💵"}
            {initialAction === "adjust_stock" && "📦"}
            {initialAction === "add_customer" && "👤"}
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {initialAction === "add_sale" && "सामान बिक्री (Sale)"}
              {initialAction === "record_payment" && "उधार भुगतान (Payment)"}
              {initialAction === "adjust_stock" && "स्टॉक परिवर्तन (Stock Change)"}
              {initialAction === "add_customer" && "नया ग्राहक (Add Customer)"}
            </h3>
            <p className="text-xs text-muted-foreground">
              कृपया विवरण जांचें (Please review details)
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              lowConfidence
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/10 text-primary"
            }`}
          >
            {confidenceScore}% विश्वास
          </span>
          <span className="text-[10px] text-muted-foreground">Confidence</span>
        </div>
      </div>

      {/* ── Low Confidence Warning ── */}
      {lowConfidence && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <span className="font-semibold">कृपया विवरण जांचें:</span> AI आत्मविश्वास कम है ({confidenceScore}%).
            आगे बढ़ने से पहले कृपया नीचे सही मान सत्यापित करें।
            <div className="text-[10px] opacity-80">Low confidence score. Please verify all fields before confirming.</div>
          </div>
        </div>
      )}

      {/* ── Customer Matching Section ── */}
      {(initialAction === "add_sale" ||
        initialAction === "record_payment" ||
        initialAction === "add_customer") && (
        <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground/90">
              ग्राहक (Customer):
            </span>
            {currentMatchStatus === "matched" && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                ✓ सही पहचान (Matched)
              </span>
            )}
            {currentMatchStatus === "ambiguous" && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                ⚠️ संदिग्ध (Ambiguous)
              </span>
            )}
            {currentMatchStatus === "new" && (
              <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                + नया (New Customer)
              </span>
            )}
          </div>

          {/* Ambiguous candidates picker (shows candidates from active match) */}
          {currentMatchStatus === "ambiguous" && activeCustomerMatch && activeCustomerMatch.candidates.length > 0 && (
            <div className="flex flex-col gap-1.5 my-1 bg-background/80 rounded-lg p-2.5 border border-border/80">
              <span className="text-xs text-foreground/80 font-medium">
                समान नाम वाले ग्राहक मिले। सही ग्राहक चुनें:
              </span>
              <div className="flex flex-col gap-1">
                {activeCustomerMatch.candidates.map(({ customer }) => (
                  <label
                    key={customer.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedCustomerId === customer.id
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="candidate"
                        value={customer.id}
                        checked={selectedCustomerId === customer.id}
                        onChange={() => {
                          setSelectedCustomerId(customer.id);
                          setCustomerName(customer.name);
                          setCreateCustomer(false);
                        }}
                        className="text-primary focus:ring-primary"
                      />
                      <span>{customer.name}</span>
                    </div>
                    {customer.phone && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {customer.phone}
                      </span>
                    )}
                  </label>
                ))}

                {initialAction !== "record_payment" && (
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                      createCustomer
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      value="new"
                      checked={createCustomer}
                      onChange={() => {
                        setCreateCustomer(true);
                        setSelectedCustomerId(null);
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <span>कोई अन्य नया ग्राहक है (Create as separate new customer)</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Customer Name Display or Edit input */}
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">ग्राहक का नाम (Customer Name)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId(null);
                }}
                placeholder="ग्राहक का नाम दर्ज करें"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
              />
              {isCustomerNameEdited && activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ मौजूदा ग्राहक से मिला: {activeCustomerMatch.matched.name}
                </div>
              )}
              {isCustomerNameEdited && currentMatchStatus === "new" && customerName.trim() && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠️ यह नाम किसी मौजूदा ग्राहक से मेल नहीं खाता। पुष्टि करने के लिए नीचे &apos;नया जोड़ें&apos; चुनें।
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">
                {activeCustomerMatch?.matched?.name || customerName || "(अनाम ग्राहक / Anonymous)"}
              </span>
              {activeCustomerMatch?.matched?.phone && (
                <span className="text-xs text-muted-foreground">
                  📞 {activeCustomerMatch.matched.phone}
                </span>
              )}
            </div>
          )}

          {/* New customer creation checkbox if unmatched and not record_payment */}
          {initialAction !== "record_payment" && !selectedCustomerId && currentMatchStatus === "new" && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={createCustomer}
                onChange={(e) => setCreateCustomer(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>इस ग्राहक को खाता बही में नया जोड़ें (Save customer in directory)</span>
            </label>
          )}

          {/* Validation warning if unmatched and cannot confirm */}
          {!isCustomerMatchValid && (
            <p className="text-[11px] text-destructive font-medium">
              {initialAction === "record_payment"
                ? "उधार भुगतान केवल मौजूदा ग्राहक के लिए दर्ज हो सकता है। (Payment requires an existing customer)."
                : "अमान्य नाम: कृपया सही ग्राहक चुनें या 'नया जोड़ें' पर टिक करें। (Please match customer or mark as new)."}
            </p>
          )}
        </div>
      )}

      {/* ── Financial Breakdown for Sale ── */}
      {initialAction === "add_sale" && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-card border border-border">
            <span className="text-[11px] text-muted-foreground">कुल (Total)</span>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={total}
                onChange={(e) => setTotal(Math.max(0, Number(e.target.value)))}
                className="w-full text-center font-bold text-base bg-muted/30 border border-border rounded p-1 mt-1 outline-none min-h-[40px]"
              />
            ) : (
              <span className="text-lg font-bold text-foreground">
                ₹{total.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-card border border-border">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              नकद दिया (Paid)
            </span>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={paid}
                onChange={(e) => setPaid(Math.max(0, Number(e.target.value)))}
                className="w-full text-center font-bold text-base bg-muted/30 border border-border rounded p-1 mt-1 outline-none min-h-[40px]"
              />
            ) : (
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                ₹{paid.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              उधार (Udhar)
            </span>
            <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
              ₹{udharAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      {/* ── Financial Details for Payment ── */}
      {initialAction === "record_payment" && (
        <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-card border border-border gap-1">
          <span className="text-xs text-muted-foreground">
            जमा की गई राशि (Payment Received)
          </span>
          {isEditing ? (
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
              className="text-center font-bold text-xl bg-muted/30 border border-border rounded p-1 outline-none min-h-[44px] w-36"
            />
          ) : (
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              ₹{amount.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      )}

      {/* ── Stock Adjustment Details ── */}
      {initialAction === "adjust_stock" && (
        <div className="flex flex-col p-3 rounded-xl bg-card border border-border gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">सामग्री (Product):</span>
            {isEditing ? (
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="px-2 py-1 text-sm bg-muted/30 border border-border rounded min-h-[36px]"
              />
            ) : (
              <span className="font-bold text-foreground text-sm">{product}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">मात्रा में बदलाव (Qty Change):</span>
            {isEditing ? (
              <input
                type="number"
                value={qtyChange}
                onChange={(e) => setQtyChange(Number(e.target.value))}
                className="w-24 text-right px-2 py-1 text-sm bg-muted/30 border border-border rounded min-h-[36px]"
              />
            ) : (
              <span className={`font-bold text-sm ${qtyChange >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {qtyChange >= 0 ? `+${qtyChange}` : qtyChange} {initialData.unit || "unit"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Plain-language Summary ── */}
      <div className="rounded-xl bg-muted/40 p-3 text-xs text-foreground/90 leading-relaxed border border-border/40">
        <span className="font-semibold">सारांश: </span>
        {parsed.summary}
      </div>

      {/* ── Real API Error Message Banner ── */}
      {apiError && (
        <div
          id="api-error-banner"
          className="rounded-xl bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive font-medium leading-normal flex items-start gap-2"
        >
          <span className="text-base leading-none">❌</span>
          <div className="flex-1">
            <p className="font-semibold">त्रुटि (Error):</p>
            <p>{apiError}</p>
          </div>
        </div>
      )}

      {/* ── Success Banner with Updated Udhar Balance ── */}
      {confirmedResult && (
        <div
          id="confirmation-success-banner"
          className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>✅</span>
            <span>लेन-देन सफलतापूर्वक दर्ज हुआ!</span>
          </div>
          <p className="text-[11px] opacity-90">
            {confirmedResult.summary || "खाता बही अपडेट हो गई है।"}
          </p>
          {confirmedResult.customer?.balance !== undefined && (
            <div className="mt-1 pt-2 border-t border-emerald-500/20 flex items-center justify-between font-semibold text-xs">
              <span>{confirmedResult.customer.name} का नया बकाया:</span>
              <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                ₹{confirmedResult.customer.balance.toLocaleString("en-IN")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons (all min-height >= 48px) ── */}
      {!confirmedResult && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <button
            type="button"
            id="btn-confirm-entry"
            onClick={handleConfirm}
            disabled={isSaving || !isCustomerMatchValid}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:bg-primary/95 active:scale-[0.98] transition-all min-h-[48px] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>सहेज रहा है... (Saving)</span>
              </>
            ) : (
              <span>पुष्टि करें (Confirm)</span>
            )}
          </button>

          <button
            type="button"
            id="btn-edit-entry"
            onClick={() => setIsEditing((prev) => !prev)}
            disabled={isSaving}
            className="flex items-center justify-center px-4 py-3 rounded-xl border border-border bg-background text-foreground font-semibold text-xs hover:bg-muted/50 active:scale-[0.98] transition-all min-h-[48px] cursor-pointer"
          >
            {isEditing ? "हो गया (Done)" : "बदलें (Edit)"}
          </button>

          <button
            type="button"
            id="btn-cancel-entry"
            onClick={onCancel}
            disabled={isSaving}
            className="flex items-center justify-center px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs font-semibold min-h-[48px] cursor-pointer"
          >
            रद्द करें (Cancel)
          </button>
        </div>
      )}
    </div>
  );
}
