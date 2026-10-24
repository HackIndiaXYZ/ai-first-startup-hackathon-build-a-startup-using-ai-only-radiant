"use client";

import { useState, useMemo } from "react";
import { LedgerExecutionResult, Customer } from "@/lib/agents/types";
import { findBestCustomerMatch } from "@/lib/agents/customer-matcher";
import { buildConfirmPayload, formatApiError, isLowConfidence } from "@/lib/confirm-helpers";
import { STRINGS } from "@/lib/strings";

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
  onDismiss?: () => void;
  onOpenQuickAddCustomer?: (name: string) => void;
}

export function ConfirmationCard({
  parseResult,
  idempotencyKey,
  rawInput,
  customers = [],
  onCancel,
  onSuccess,
  onDismiss,
  onOpenQuickAddCustomer,
}: ConfirmationCardProps) {
  const { parsed, customer_match: initialCustomerMatch } = parseResult;
  const initialAction = parsed.action;
  const initialData = parsed.data;

  // Initial customer name from parser/matcher
  const initialCustomerName =
    initialCustomerMatch?.matched?.name || initialData.customer || initialData.name || "";

  // Action state (allows user to switch action, e.g. Payment -> Cash Sale or Add Customer)
  const currentAction = initialAction;

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [customerName, setCustomerName] = useState<string>(initialCustomerName);
  const customerPhone = initialData.phone || "";
  const customerNotes = initialData.notes || "";
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerMatch?.matched?.id || null
  );
  // Default createCustomer is true for new customers on sale, false for payment
  const [createCustomer, setCreateCustomer] = useState<boolean>(
    initialAction === "add_sale" && initialCustomerMatch?.status === "new"
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

  // Sort existing customers alphabetically for the picker
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

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
  const currentMatchStatus = useMemo(() => {
    if (selectedCustomerId) return "matched";
    if (activeCustomerMatch?.status) return activeCustomerMatch.status;
    return customerName.trim() ? "new" : null;
  }, [selectedCustomerId, activeCustomerMatch, customerName]);

  // Validation: Never send an unmatched edited name
  const isCustomerMatchValid = useMemo(() => {
    // Stock adjustment doesn't need customer
    if (currentAction === "adjust_stock") return true;

    // Add sale with empty customer is anonymous walk-in sale
    if (currentAction === "add_sale" && !customerName.trim()) {
      return true;
    }

    // Payment requires a customer name AND must be an existing customer
    if (currentAction === "record_payment") {
      if (!customerName.trim()) return false;
      // Must be picked from existing customer list or matched to existing customer
      if (selectedCustomerId) return true;
      if (activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched) {
        return true;
      }
      return false; // Never create customer from payment
    }

    // If add_customer action: valid if name is non-empty
    if (currentAction === "add_customer") {
      return Boolean(customerName.trim());
    }

    // If an existing customer is selected from shop list
    if (selectedCustomerId) {
      return true;
    }

    // If customer name was edited:
    if (isCustomerNameEdited) {
      if (!customerName.trim()) return currentAction === "add_sale";

      // If matched, valid!
      if (activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched) {
        return true;
      }

      // If ambiguous, user must select candidate or create new (only for add_sale)
      if (activeCustomerMatch?.status === "ambiguous") {
        return Boolean(selectedCustomerId) || createCustomer;
      }

      // If status is new (unmatched name):
      if (activeCustomerMatch?.status === "new") {
        return createCustomer;
      }

      return false;
    }

    // If not edited, check if matched
    if (activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched) {
      return true;
    }

    // If not edited, check if ambiguous requires selection
    if (initialCustomerMatch?.status === "ambiguous") {
      return Boolean(selectedCustomerId) || createCustomer;
    }

    // If not edited and status is new:
    if (currentMatchStatus === "new") {
      return createCustomer;
    }

    return true;
  }, [
    currentAction,
    customerName,
    selectedCustomerId,
    isCustomerNameEdited,
    activeCustomerMatch,
    createCustomer,
    initialCustomerMatch,
    currentMatchStatus,
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
        action: currentAction,
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
        phone: customerPhone || initialData.phone,
        notes: customerNotes || initialData.notes,
        items: initialData.items,
        createCustomer: currentAction === "add_sale" && (createCustomer || (!selectedCustomerId && currentMatchStatus === "new")),
      });

      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setApiError(formatApiError(data.error || "Confirmation failed."));
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
      className="w-full max-w-md mx-auto rounded-2xl bg-card border border-border/80 shadow-md p-4 sm:p-5 flex flex-col gap-4 animate-in slide-in-from-bottom-3 fade-in duration-200 motion-reduce:animate-none"
    >
      {/* ── Top Badge & Action Title ── */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
            {currentAction === "add_sale" && "🛒"}
            {currentAction === "record_payment" && "💵"}
            {currentAction === "adjust_stock" && "📦"}
            {currentAction === "add_customer" && "👤"}
          </span>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {currentAction === "add_sale" && "Sale"}
              {currentAction === "record_payment" && "Payment"}
              {currentAction === "adjust_stock" && "Stock Change"}
              {currentAction === "add_customer" && "Add Customer"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {STRINGS.confirmation.reviewDetails}
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
            {confidenceScore}%
          </span>
          <span className="text-[10px] text-muted-foreground">{STRINGS.confirmation.confidence}</span>
        </div>
      </div>

      {/* ── Low Confidence Warning ── */}
      {lowConfidence && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 p-2.5 text-xs text-amber-900 dark:text-amber-200">
          <span className="text-base leading-none">⚠️</span>
          <div>
            <span className="font-semibold">Please review details:</span> AI confidence is low ({confidenceScore}%).
            Please verify all values below before confirming.
          </div>
        </div>
      )}

      {/* ── Customer Matching Section ── */}
      {(currentAction === "add_sale" ||
        currentAction === "record_payment" ||
        currentAction === "add_customer") && (
        <div className="rounded-xl bg-secondary/50 border border-border/50 p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground/90">
              {STRINGS.confirmation.customerLabel}
            </span>
            <div className="flex items-center gap-1.5">
              {/* Status styled as NON-CLICKABLE CHIPS */}
              {currentMatchStatus === "matched" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 select-none cursor-default">
                  {STRINGS.confirmation.matched}
                </span>
              )}
              {currentMatchStatus === "ambiguous" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 select-none cursor-default">
                  {STRINGS.confirmation.ambiguous}
                </span>
              )}
              {currentMatchStatus === "new" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-muted-foreground border border-border/60 select-none cursor-default">
                  {STRINGS.confirmation.newCustomerChip}
                </span>
              )}
            </div>
          </div>

          {/* Ambiguous candidates picker (shows candidates from active match) */}
          {currentMatchStatus === "ambiguous" && activeCustomerMatch && activeCustomerMatch.candidates.length > 0 && (
            <div className="flex flex-col gap-1.5 my-1 bg-background/80 rounded-lg p-2.5 border border-border/80">
              <span className="text-xs text-foreground/80 font-medium">
                {STRINGS.confirmation.ambiguousNotice}
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

                {currentAction !== "record_payment" && (
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
                    <span>{STRINGS.confirmation.createAsSeparate}</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Customer Name Display or Edit input */}
          {isEditing ? (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">{STRINGS.confirmation.customerName}</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setSelectedCustomerId(null);
                }}
                placeholder={STRINGS.confirmation.customerNamePlaceholder}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
              />
              {isCustomerNameEdited && activeCustomerMatch?.status === "matched" && activeCustomerMatch.matched && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Matched existing customer: {activeCustomerMatch.matched.name}
                </div>
              )}
              {isCustomerNameEdited && currentMatchStatus === "new" && customerName.trim() && (
                <div className="text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠️ Name does not match any existing customer. Check below to create or pick from directory.
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-foreground">
                {activeCustomerMatch?.matched?.name || customerName || STRINGS.confirmation.anonymousCustomer}
              </span>
              {activeCustomerMatch?.matched?.phone && (
                <span className="text-xs text-muted-foreground">
                  📞 {activeCustomerMatch.matched.phone}
                </span>
              )}
            </div>
          )}

          {/* BUG B: add_sale with unknown name: clear notice with real checkbox toggle (min-h >= 48px, default ON) */}
          {currentAction === "add_sale" && !selectedCustomerId && currentMatchStatus === "new" && Boolean(customerName.trim()) && (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                New customer: <span className="font-bold underline underline-offset-2">{customerName}</span>
              </span>
              <label
                htmlFor="checkbox-create-customer"
                className="flex items-center gap-3 p-2 rounded-lg bg-background/80 border border-border/60 text-xs text-foreground cursor-pointer min-h-[48px] select-none hover:bg-background transition-colors"
              >
                <input
                  type="checkbox"
                  id="checkbox-create-customer"
                  checked={createCustomer}
                  onChange={(e) => setCreateCustomer(e.target.checked)}
                  className="w-5 h-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <span className="font-medium text-xs">
                  Create &quot;{customerName}&quot; as a new customer
                </span>
              </label>
            </div>
          )}

          {/* BUG B: record_payment with unknown name: payments need an existing customer with udhar */}
          {currentAction === "record_payment" && !selectedCustomerId && currentMatchStatus === "new" && (
            <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                <span>⚠️</span>
                <span>No customer named &quot;{customerName}&quot; found.</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {STRINGS.confirmation.paymentCustomerHint}
              </p>
              <button
                type="button"
                id="btn-add-customer-first"
                onClick={() => {
                  onOpenQuickAddCustomer?.(customerName);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/20 active:scale-98 transition-all min-h-[48px] cursor-pointer"
              >
                <span>👤 Add &quot;{customerName}&quot; as new customer first</span>
              </button>
            </div>
          )}

          {/* Searchable / dropdown picker of existing customers */}
          {customers && customers.length > 0 && (!selectedCustomerId || isEditing || currentMatchStatus === "new") && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-border/40 mt-1">
              <label htmlFor="select-existing-customer" className="text-[11px] text-muted-foreground font-medium">
                {STRINGS.confirmation.existingCustomerPicker}
              </label>
              <select
                id="select-existing-customer"
                value={selectedCustomerId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setSelectedCustomerId(null);
                  } else {
                    const found = customers.find((c) => c.id === val);
                    if (found) {
                      setSelectedCustomerId(found.id);
                      setCustomerName(found.name);
                      setCreateCustomer(false);
                    }
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px] text-foreground cursor-pointer"
              >
                <option value="">{STRINGS.confirmation.selectPlaceholder}</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Validation warning if unmatched and cannot confirm */}
          {!isCustomerMatchValid && currentAction !== "record_payment" && (
            <p className="text-[11px] text-destructive font-medium">
              Please select a matching customer or mark as new.
            </p>
          )}
        </div>
      )}

      {/* ── Financial Breakdown for Sale ── */}
      {currentAction === "add_sale" && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-card border border-border">
            <span className="text-[11px] text-muted-foreground">Total</span>
            {isEditing ? (
              <input
                type="number"
                min="0"
                value={total}
                onChange={(e) => setTotal(Math.max(0, Number(e.target.value)))}
                className="w-full text-center font-bold text-base bg-muted/30 border border-border rounded p-1 mt-1 outline-none min-h-[40px]"
              />
            ) : (
              <span className="text-lg font-bold text-foreground tabular-nums">
                ₹{total.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-card border border-border">
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              Paid
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
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                ₹{paid.toLocaleString("en-IN")}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Udhar
            </span>
            <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
              ₹{udharAmount.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}

      {/* ── Financial Details for Payment ── */}
      {currentAction === "record_payment" && (
        <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-card border border-border gap-1">
          <span className="text-xs text-muted-foreground">
            Payment Received
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
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
              ₹{amount.toLocaleString("en-IN")}
            </span>
          )}
        </div>
      )}

      {/* ── Stock Adjustment Details ── */}
      {currentAction === "adjust_stock" && (
        <div className="flex flex-col p-3 rounded-xl bg-card border border-border gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Product:</span>
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
            <span className="text-muted-foreground">Qty Change:</span>
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

      {/* ── Add Customer Details ── */}
      {currentAction === "add_customer" && (
        <div className="flex flex-col p-3 rounded-xl bg-card border border-border gap-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Action:</span>
            <span className="font-semibold text-primary">New Customer Registration</span>
          </div>
          {customerPhone && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-bold text-foreground">{customerPhone}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Plain-language Summary ── */}
      <div className="rounded-xl bg-muted/40 p-3 text-xs text-foreground/90 leading-relaxed border border-border/40">
        <span className="font-semibold">{STRINGS.confirmation.summaryLabel} </span>
        {currentAction === "add_sale" && total === paid && paid > 0
          ? `${customerName || "Customer"}: Cash purchase of Rs ${total} (Paid in full)`
          : parsed.summary}
      </div>

      {/* ── Real API Error Message Banner ── */}
      {apiError && (
        <div
          id="api-error-banner"
          className="rounded-xl bg-destructive/10 border border-destructive/25 p-3 text-xs text-destructive font-medium leading-normal flex items-start gap-2"
        >
          <span className="text-base leading-none">❌</span>
          <div className="flex-1">
            <p className="font-semibold">Error:</p>
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
            <span>{STRINGS.confirmation.successTitle}</span>
          </div>
          <p className="text-[11px] opacity-90">
            {confirmedResult.summary || "Ledger updated successfully."}
          </p>
          {confirmedResult.customer?.balance !== undefined && (
            <div className="mt-1 pt-2 border-t border-emerald-500/20 flex items-center justify-between font-semibold text-xs">
              <span>{confirmedResult.customer.name}&apos;s {STRINGS.confirmation.newBalance}</span>
              <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                ₹{confirmedResult.customer.balance.toLocaleString("en-IN")}
              </span>
            </div>
          )}
          {confirmedResult.transaction_id && (confirmedResult.action === "add_sale" || currentAction === "add_sale") && (
            <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">GST-style invoice:</span>
              <a
                id="btn-view-invoice"
                href={`/api/invoice/${confirmedResult.transaction_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-all min-h-[38px]"
              >
                <span>📄</span>
                <span>{STRINGS.invoice.viewInvoice}</span>
              </a>
            </div>
          )}
          <div className="mt-3 pt-2.5 border-t border-emerald-500/20">
            <button
              type="button"
              id="btn-record-another"
              onClick={() => onDismiss?.()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:bg-primary/95 active:scale-[0.98] transition-all min-h-[48px] cursor-pointer"
            >
              <span>➕</span>
              <span>{STRINGS.confirmation.recordAnother}</span>
            </button>
          </div>
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
                <span>Saving...</span>
              </>
            ) : (
              <span>Confirm</span>
            )}
          </button>

          <button
            type="button"
            id="btn-edit-entry"
            onClick={() => setIsEditing((prev) => !prev)}
            disabled={isSaving}
            className="flex items-center justify-center px-4 py-3 rounded-xl border border-border bg-background text-foreground font-semibold text-xs hover:bg-muted/50 active:scale-[0.98] transition-all min-h-[48px] cursor-pointer"
          >
            {isEditing ? "Done" : "Edit"}
          </button>

          <button
            type="button"
            id="btn-cancel-entry"
            onClick={onCancel}
            disabled={isSaving}
            className="flex items-center justify-center px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-xs font-semibold min-h-[48px] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
