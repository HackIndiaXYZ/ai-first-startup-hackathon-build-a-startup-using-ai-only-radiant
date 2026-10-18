"use client";

import { useEffect, useState, use, useCallback, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface CustomerDetail {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  balance: number;
}

interface TransactionRecord {
  id: string;
  type: "sale" | "payment";
  total_amount: number;
  paid_amount: number;
  raw_input: string | null;
  created_at: string;
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 px-4 py-5 animate-in fade-in">
          <div className="h-8 w-36 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-48 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      }
    >
      <CustomerDetailLoader params={params} />
    </Suspense>
  );
}

function CustomerDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = use(params);
  return <CustomerDetailView customerId={customerId} />;
}

function CustomerDetailView({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCustomerData = useCallback(async (showLoading = false) => {
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
  }, [customerId]);

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

  return (
    <main className="flex flex-col gap-5 px-4 py-4 animate-in fade-in duration-200">
      {/* ── Back Navigation ── */}
      <Link
        href="/app/ledger"
        id="btn-back-ledger"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline min-h-[48px] py-2"
      >
        <span>←</span>
        <span>वापस खाता बही (Back to Ledger)</span>
      </Link>

      {/* ── Error Banner ── */}
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

      {/* ── Customer Header & Balance Card ── */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-14 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      ) : customer ? (
        <>
          <div className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">
                  {customer.name}
                </h1>
                {customer.phone && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📞 <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
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
                  className={`text-2xl font-extrabold tracking-tight ${
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

            {/* Quick Action Button */}
            <Link
              href="/app"
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-xs hover:bg-primary/95 min-h-[48px] active:scale-[0.98] transition-all"
            >
              <span>+</span>
              <span>नया हिसाब दर्ज करें (Record New Entry)</span>
            </Link>
          </div>

          {/* ── Transaction History Header ── */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-base font-bold text-foreground">
              लेन-देन इतिहास (Transaction History)
            </h2>
            <span className="text-xs text-muted-foreground">
              ({transactions.length} entries)
            </span>
          </div>

          {/* ── Transaction History List ── */}
          {transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground bg-card/40">
              कोई लेन-देन दर्ज नहीं है (No transaction history recorded).
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {transactions.map((tx) => {
                const isSale = tx.type === "sale";
                const udharDelta = isSale ? tx.total_amount - tx.paid_amount : 0;
                const formattedDate = new Date(tx.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-2 p-3.5 rounded-xl bg-card border border-border shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                            isSale
                              ? "bg-primary/10 text-primary"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {isSale ? "🛒 बिक्री (Sale)" : "💵 भुगतान (Payment)"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formattedDate}
                        </span>
                      </div>

                      {/* Main Financial Figure */}
                      <span className="text-sm font-extrabold text-foreground">
                        {isSale
                          ? `₹${tx.total_amount.toLocaleString("en-IN")}`
                          : `₹${tx.paid_amount.toLocaleString("en-IN")}`}
                      </span>
                    </div>

                    {/* Breakdown for Sale */}
                    {isSale && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-1.5">
                        <span>
                          नकद: <strong className="text-emerald-600">₹{tx.paid_amount}</strong>
                        </span>
                        {udharDelta > 0 ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            उधार जुड़ा: +₹{udharDelta.toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium">पूरा नकद (Full Cash)</span>
                        )}
                      </div>
                    )}

                    {/* Breakdown for Payment */}
                    {!isSale && (
                      <div className="flex items-center justify-between text-xs border-t border-border/40 pt-1.5">
                        <span className="text-muted-foreground">जमा राशि</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
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
      ) : null}
    </main>
  );
}
