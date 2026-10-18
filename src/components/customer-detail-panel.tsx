"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateIdempotencyKey, formatApiError } from "@/lib/confirm-helpers";

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  balance: number;
}

export interface TransactionRecord {
  id: string;
  type: "sale" | "payment";
  total_amount: number;
  paid_amount: number;
  raw_input: string | null;
  created_at: string;
}

interface CustomerDetailPanelProps {
  customerId: string;
  showBackNav?: boolean;
}

export function CustomerDetailPanel({
  customerId,
  showBackNav = false,
}: CustomerDetailPanelProps) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Payment form inside customer panel
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);

  const loadCustomerData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setIsLoading(true);
      setErrorMsg(null);

      try {
        const supabase = createClient();

        // 1. Fetch Customer info and current balance from customer_balances view
        const { data: balanceData, error: balanceErr } = await supabase
          .from("customer_balances")
          .select("customer_id, name, phone, balance")
          .eq("customer_id", customerId)
          .maybeSingle();

        if (balanceErr) throw balanceErr;

        if (!balanceData) {
          // Fallback to customers table if not in view
          const { data: custData, error: custErr } = await supabase
            .from("customers")
            .select("id, name, phone, notes")
            .eq("id", customerId)
            .maybeSingle();

          if (custErr || !custData) {
            setErrorMsg("ग्राहक नहीं मिला (Customer not found).");
            setIsLoading(false);
            return;
          }

          setCustomer({
            id: custData.id,
            name: custData.name,
            phone: custData.phone,
            notes: custData.notes,
            balance: 0,
          });
        } else {
          // Fetch notes from customer table
          const { data: custRecord } = await supabase
            .from("customers")
            .select("notes")
            .eq("id", customerId)
            .maybeSingle();

          setCustomer({
            id: balanceData.customer_id,
            name: balanceData.name,
            phone: balanceData.phone,
            notes: custRecord?.notes || null,
            balance: Number(balanceData.balance || 0),
          });
        }

        // 2. Fetch Transaction history
        const { data: txData, error: txErr } = await supabase
          .from("transactions")
          .select("id, type, total_amount, paid_amount, raw_input, created_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (txErr) throw txErr;

        const records: TransactionRecord[] = (txData || []).map((t) => ({
          id: t.id,
          type: t.type as "sale" | "payment",
          total_amount: Number(t.total_amount || 0),
          paid_amount: Number(t.paid_amount || 0),
          raw_input: t.raw_input,
          created_at: t.created_at,
        }));

        setTransactions(records);
      } catch (err: unknown) {
        console.error("Customer detail error:", err);
        setErrorMsg("ग्राहक विवरण लोड करने में विफल (Failed to load customer details).");
      } finally {
        setIsLoading(false);
      }
    },
    [customerId]
  );

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!ignore) {
        await loadCustomerData(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [loadCustomerData]);

  // Handle recording payment directly from the detail panel
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentErrorMsg("कृपया सही भुगतान राशि लिखें (Valid positive amount required).");
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentErrorMsg(null);
    setPaymentSuccessMsg(null);

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payment",
          customer: customer.name,
          amount: amt,
          idempotency_key: generateIdempotencyKey(),
          summary: `${customer.name} ने ₹${amt} जमा किए`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPaymentErrorMsg(formatApiError(data.error || "भुगतान दर्ज करने में विफल (Payment failed)."));
      } else {
        const newBal = data.new_balance !== undefined ? ` नया बकाया: ₹${Number(data.new_balance).toLocaleString("en-IN")}` : "";
        setPaymentSuccessMsg(`✓ ₹${amt.toLocaleString("en-IN")} भुगतान दर्ज हुआ!${newBal}`);
        setPaymentAmount("");
        setIsPaymentOpen(false);
        await loadCustomerData(false);
      }
    } catch (err) {
      setPaymentErrorMsg(formatApiError(err));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        <div className="h-14 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
      </div>
    );
  }

  // Generate WhatsApp reminder link
  const cleanPhone = customer?.phone ? customer.phone.replace(/[^0-9]/g, "") : null;
  const whatsappUrl =
    cleanPhone && customer && customer.balance > 0
      ? `https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(
          `नमस्ते ${customer.name} जी, आपकी दुकान का बकाया ₹${customer.balance.toLocaleString("en-IN")} है। कृपया समय पर भुगतान करें। धन्यवाद।`
        )}`
      : null;

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
      {/* Optional Back Navigation for standalone mobile page */}
      {showBackNav && (
        <Link
          href="/app/ledger"
          id="btn-back-ledger"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline min-h-[48px] py-2"
        >
          <span>←</span>
          <span>वापस खाता बही (Back to Ledger)</span>
        </Link>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => loadCustomerData(true)}
            className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
          >
            पुनः प्रयास (Retry)
          </button>
        </div>
      )}

      {customer && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  {customer.name}
                </h2>
                {customer.phone && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📞{" "}
                    <a href={`tel:${customer.phone}`} className="hover:underline">
                      {customer.phone}
                    </a>
                  </p>
                )}
                {customer.notes && (
                  <p className="text-xs text-muted-foreground/80 mt-1 italic">
                    &quot;{customer.notes}&quot;
                  </p>
                )}
              </div>
            </div>

            {/* Current Balance Showcase */}
            <div
              className={`flex items-center justify-between p-3.5 rounded-xl border ${
                customer.balance > 0
                  ? "bg-amber-500/10 border-amber-500/25"
                  : "bg-emerald-500/10 border-emerald-500/25"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-muted-foreground">
                  वर्तमान बकाया (Current Udhar Balance)
                </span>
                <span
                  className={`text-2xl font-extrabold tracking-tight tabular-nums ${
                    customer.balance > 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  ₹{customer.balance.toLocaleString("en-IN")}
                </span>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  customer.balance > 0
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                    : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {customer.balance > 0 ? "उधार शेष" : "चुकता"}
              </span>
            </div>

            {/* Payment Success Notification */}
            {paymentSuccessMsg && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
                <span>{paymentSuccessMsg}</span>
                <button
                  type="button"
                  onClick={() => setPaymentSuccessMsg(null)}
                  className="text-green-800 dark:text-green-300 hover:opacity-75 font-bold ml-2 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Inline Quick Payment Form */}
            {isPaymentOpen && (
              <form
                onSubmit={handleRecordPayment}
                className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-green-600/30 animate-in slide-in-from-top-2 fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    भुगतान राशि दर्ज करें (Record Payment)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPaymentOpen(false)}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-0.5"
                  >
                    ✕
                  </button>
                </div>

                {paymentErrorMsg && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                    {paymentErrorMsg}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="₹ जमा राशि लिखें"
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-bold tabular-nums min-h-[44px]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="px-4 py-2 bg-green-700 text-white font-bold text-xs rounded-lg hover:bg-green-800 disabled:opacity-50 min-h-[44px] cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingPayment ? "दर्ज हो रहा…" : "जमा करें (Save)"}
                  </button>
                </div>
              </form>
            )}

            {/* Quick Action Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {/* Record Entry */}
              <Link
                href="/app"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-xs hover:bg-primary/95 min-h-[48px] active:scale-[0.98] transition-all text-center"
              >
                <span>➕ नया हिसाब दर्ज करें</span>
              </Link>

              {/* Record Payment */}
              <button
                type="button"
                id="btn-customer-record-payment"
                onClick={() => {
                  setIsPaymentOpen(!isPaymentOpen);
                  setPaymentErrorMsg(null);
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-green-700/10 border border-green-700/25 text-green-800 dark:text-green-300 font-bold text-xs hover:bg-green-700/20 min-h-[48px] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>💰 भुगतान लें</span>
              </button>
            </div>

            {/* WhatsApp Reminder Button (If phone & positive balance) */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold min-h-[44px] transition-colors"
              >
                <span>💬 WhatsApp रिमाइंडर भेजें</span>
              </a>
            )}
          </div>

          {/* Transaction History Header */}
          <div className="flex items-center justify-between pt-1">
            <h3 className="text-base font-bold text-foreground">
              लेन-देन इतिहास (Transaction History)
            </h3>
            <span className="text-xs text-muted-foreground">
              ({transactions.length} entries)
            </span>
          </div>

          {/* Transaction History List */}
          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground bg-card/40">
              🎉 कोई लेन-देन दर्ज नहीं है (No transaction history yet).
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[600px] overflow-y-auto pr-1">
              {transactions.map((tx) => {
                const isSale = tx.type === "sale";
                const udharDelta = isSale ? tx.total_amount - tx.paid_amount : 0;
                const formattedDate = new Date(tx.created_at).toLocaleDateString(
                  "en-IN",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                );

                return (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-2 p-3.5 rounded-xl bg-card border border-border shadow-2xs hover:border-border/90 transition-all duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            isSale
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isSale ? "🛒 बिक्री" : "💵 भुगतान"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formattedDate}
                        </span>
                      </div>

                      {/* Main Financial Figure */}
                      <span className="text-sm font-extrabold text-foreground tabular-nums">
                        {isSale
                          ? `₹${tx.total_amount.toLocaleString("en-IN")}`
                          : `₹${tx.paid_amount.toLocaleString("en-IN")}`}
                      </span>
                    </div>

                    {/* Breakdown for Sale */}
                    {isSale && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-1.5">
                        <span>
                          नकद: <strong className="text-emerald-600 tabular-nums">₹{tx.paid_amount.toLocaleString("en-IN")}</strong>
                        </span>
                        {udharDelta > 0 ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                            उधार जुड़ा: +₹{udharDelta.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">
                            पूरा नकद (Full Cash)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Breakdown for Payment */}
                    {!isSale && (
                      <div className="flex items-center justify-between text-xs border-t border-border/40 pt-1.5">
                        <span className="text-muted-foreground">जमा राशि</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          -₹{tx.paid_amount.toLocaleString("en-IN")} (उधार घटा)
                        </span>
                      </div>
                    )}

                    {/* Raw Voice Transcript if present */}
                    {tx.raw_input && (
                      <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg italic">
                        &quot;{tx.raw_input}&quot;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
