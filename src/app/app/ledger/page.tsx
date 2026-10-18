"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface CustomerBalance {
  customer_id: string;
  name: string;
  phone: string | null;
  balance: number;
  last_transaction_at: string | null;
}

export default function LedgerPage() {
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLedger = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMsg("लॉगिन आवश्यक है (Sign in required).");
        setIsLoading(false);
        return;
      }

      const { data: shop } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!shop) {
        setErrorMsg("दुकान नहीं मिली (Shop profile not found).");
        setIsLoading(false);
        return;
      }

      // Query customer_balances view
      const { data, error } = await supabase
        .from("customer_balances")
        .select("customer_id, name, phone, balance, last_transaction_at")
        .eq("shop_id", shop.id)
        .order("name", { ascending: true });

      if (error) throw error;

      const list: CustomerBalance[] = (data || []).map((row) => ({
        customer_id: row.customer_id,
        name: row.name,
        phone: row.phone,
        balance: Number(row.balance || 0),
        last_transaction_at: row.last_transaction_at,
      }));

      setCustomers(list);
    } catch (err: unknown) {
      console.error("Ledger load error:", err);
      setErrorMsg("खाता सूची लोड करने में विफल (Failed to load ledger).");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!ignore) {
        await loadLedger(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [loadLedger]);

  // Filtered customers by name or phone
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, searchQuery]);

  // Aggregate stats
  const totalUdhar = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
  }, [customers]);

  const debtorsCount = useMemo(() => {
    return customers.filter((c) => c.balance > 0).length;
  }, [customers]);

  return (
    <main className="flex flex-col gap-4 px-4 py-5 animate-in fade-in duration-200">
      {/* ── Page Title & Stats Summary ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          खाता बही (Customer Ledger)
        </h1>
        <p className="text-xs text-muted-foreground">
          सभी ग्राहकों का बकाया हिसाब और लेन-देन
        </p>
      </div>

      {/* Aggregate overview badges */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-card border border-border p-3 flex flex-col items-center">
          <span className="text-[11px] text-muted-foreground">बकाया ग्राहक (Debtors)</span>
          <span className="text-lg font-bold text-foreground">
            {debtorsCount} / {customers.length}
          </span>
        </div>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 flex flex-col items-center">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            कुल बकाया (Total Udhar)
          </span>
          <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
            ₹{totalUdhar.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* ── Search Filter ── */}
      <div className="relative w-full">
        <input
          type="search"
          id="search-customer"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ग्राहक का नाम या फोन नंबर खोजें..."
          className="w-full px-4 py-3 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none transition-shadow min-h-[48px]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-1 py-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Error Banner with Retry ── */}
      {errorMsg && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => loadLedger(true)}
            className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
          >
            पुनः प्रयास (Retry)
          </button>
        </div>
      )}

      {/* ── Customer List / Skeletons / Empty States ── */}
      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-18 rounded-xl bg-muted/40 animate-pulse border border-border/40"
            />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground bg-card/40 flex flex-col items-center gap-2">
          <span className="text-2xl">🔍</span>
          <p className="font-semibold text-foreground text-sm">
            कोई ग्राहक नहीं मिला (No Customers Found)
          </p>
          <p className="text-[11px] max-w-[220px]">
            {searchQuery
              ? `"${searchQuery}" से मेल खाता कोई ग्राहक नहीं है।`
              : "दुकान में अभी कोई ग्राहक नहीं है।"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredCustomers.map((customer) => {
            const hasUdhar = customer.balance > 0;
            return (
              <Link
                key={customer.customer_id}
                href={`/app/ledger/${customer.customer_id}`}
                className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border hover:border-primary/40 active:scale-[0.99] transition-all shadow-xs min-h-[56px]"
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-base font-bold text-foreground truncate">
                    {customer.name}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {customer.phone && <span>📞 {customer.phone}</span>}
                    {customer.last_transaction_at && (
                      <span className="text-[10px] opacity-75">
                        • {new Date(customer.last_transaction_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-base font-extrabold px-2.5 py-0.5 rounded-lg ${
                        hasUdhar
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold"
                      }`}
                    >
                      {hasUdhar
                        ? `₹${customer.balance.toLocaleString("en-IN")}`
                        : "₹0 चुकता"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {hasUdhar ? "उधार बकाया" : "हिसाब साफ"}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-sm">›</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
