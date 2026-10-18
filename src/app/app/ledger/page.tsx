"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CustomerDetailPanel } from "@/components/customer-detail-panel";
import { generateIdempotencyKey, formatApiError } from "@/lib/confirm-helpers";

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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add Customer modal/inline form state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);
  const [custSuccessMsg, setCustSuccessMsg] = useState<string | null>(null);
  const [custFormError, setCustFormError] = useState<string | null>(null);

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

      // Default select the first customer for desktop master-detail
      if (list.length > 0) {
        setSelectedCustomerId((prev) => prev ?? list[0].customer_id);
      }
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

  // Handle Add Customer submission
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustName.trim();
    if (!name) {
      setCustFormError("कृपया ग्राहक का नाम लिखें (Customer name required).");
      return;
    }
    const phone = newCustPhone.trim() || null;
    if (phone && !/^\+?[0-9\s-]{8,15}$/.test(phone)) {
      setCustFormError("कृपया सही 10-अंकीय फ़ोन नंबर दर्ज करें (Invalid phone number).");
      return;
    }

    setIsSubmittingCustomer(true);
    setCustFormError(null);
    setCustSuccessMsg(null);

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_customer",
          name,
          phone,
          notes: newCustNotes.trim() || null,
          idempotency_key: generateIdempotencyKey(),
          summary: `नया ग्राहक "${name}" खाता बही में जोड़ा गया`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCustFormError(formatApiError(data.error || "ग्राहक जोड़ने में विफल (Failed to add customer)."));
      } else {
        setCustSuccessMsg(`✓ ग्राहक "${name}" खाता बही में जुड़ गया! (Customer added)`);
        setNewCustName("");
        setNewCustPhone("");
        setNewCustNotes("");
        setIsAddCustomerOpen(false);
        await loadLedger(false);
      }
    } catch (err) {
      setCustFormError(formatApiError(err));
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

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

  // Active customer id for detail panel (defaults to selected or first in filtered list)
  const activeCustomerId = useMemo(() => {
    if (selectedCustomerId && filteredCustomers.some((c) => c.customer_id === selectedCustomerId)) {
      return selectedCustomerId;
    }
    return filteredCustomers[0]?.customer_id || null;
  }, [selectedCustomerId, filteredCustomers]);

  // Aggregate stats
  const totalUdhar = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.balance > 0 ? c.balance : 0), 0);
  }, [customers]);

  const debtorsCount = useMemo(() => {
    return customers.filter((c) => c.balance > 0).length;
  }, [customers]);

  return (
    <main className="w-full px-4 py-5 animate-in fade-in duration-200">
      {/* Container: Single column on mobile, Two-column master-detail on >= 1024px */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start w-full">
        {/* ── Left Column: Master List ── */}
        <section
          aria-label="Customer list"
          className="flex flex-col gap-4 lg:col-span-5 w-full"
        >
          {/* Page Title & Add Customer Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-tight">
                खाता बही
              </h1>
              <span className="text-xs text-muted-foreground leading-tight">
                Customer Ledger • ग्राहकों का बकाया व वसूली
              </span>
            </div>

            <button
              type="button"
              id="btn-add-customer-ledger"
              onClick={() => {
                setIsAddCustomerOpen(!isAddCustomerOpen);
                setCustFormError(null);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/95 transition-all flex items-center gap-1.5 min-h-[48px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shrink-0 active:scale-[0.98]"
            >
              <span>➕ नया ग्राहक</span>
              <span className="hidden sm:inline">(Add)</span>
            </button>
          </div>

          {/* Success Banner */}
          {custSuccessMsg && (
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
              <span>{custSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setCustSuccessMsg(null)}
                className="text-green-800 dark:text-green-300 hover:opacity-75 font-bold ml-2 text-sm cursor-pointer"
                aria-label="Close success notice"
              >
                ✕
              </button>
            </div>
          )}

          {/* Add Customer Form (Inline) */}
          {isAddCustomerOpen && (
            <form
              onSubmit={handleAddCustomer}
              className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-primary/40 shadow-sm animate-in slide-in-from-top-2 fade-in duration-150 motion-reduce:animate-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">नया ग्राहक जोड़ें</span>
                  <span className="text-[10px] text-muted-foreground">Add new customer to ledger</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-md hover:bg-muted/60 cursor-pointer"
                  aria-label="Close add customer form"
                >
                  ✕ बंद करें
                </button>
              </div>

              {custFormError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                  {custFormError}
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">
                    ग्राहक का नाम (Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="उदा: सुनील कुमार"
                    className="px-3.5 py-2.5 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">
                    फ़ोन नंबर (Phone)
                  </label>
                  <input
                    type="tel"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="उदा: 9876543210"
                    className="px-3.5 py-2.5 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-foreground">
                    टिप्पणी / पता (Notes)
                  </label>
                  <input
                    type="text"
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    placeholder="उदा: शर्मा जी के पास वाली गली"
                    className="px-3.5 py-2.5 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[40px] cursor-pointer"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustomer}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 disabled:opacity-50 min-h-[40px] flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isSubmittingCustomer ? "जोड़ रहा है…" : "ग्राहक जोड़ें (Save)"}
                </button>
              </div>
            </form>
          )}

          {/* Aggregate overview badges */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-card border border-border p-3 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-foreground">बकाया ग्राहक</span>
              <span className="text-[10px] text-muted-foreground">Active Debtors</span>
              <span className="text-lg font-extrabold text-foreground tabular-nums mt-0.5">
                {debtorsCount} / {customers.length}
              </span>
            </div>
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-3 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">कुल बकाया</span>
              <span className="text-[10px] text-muted-foreground">Total Pending Udhar</span>
              <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                ₹{totalUdhar.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Search Filter */}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Error Banner with Retry */}
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

          {/* Customer List / Skeletons / Empty States */}
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
                  : "दुकान में अभी कोई ग्राहक नहीं है। ऊपर बटन से नया ग्राहक जोड़ें।"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[calc(100vh-18rem)] lg:overflow-y-auto lg:pr-1">
              {filteredCustomers.map((customer) => {
                const hasUdhar = customer.balance > 0;
                const isSelected = activeCustomerId === customer.customer_id;

                return (
                  <Link
                    key={customer.customer_id}
                    href={`/app/ledger/${customer.customer_id}`}
                    onClick={(e) => {
                      // On desktop (>= 1024px), switch panel without full-page navigation
                      if (window.innerWidth >= 1024) {
                        e.preventDefault();
                        setSelectedCustomerId(customer.customer_id);
                      }
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 shadow-xs min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isSelected
                        ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm"
                        : "bg-card border-border hover:border-primary/40 active:scale-[0.99]"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-base font-bold text-foreground truncate">
                        {customer.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {customer.phone && <span>📞 {customer.phone}</span>}
                        {customer.last_transaction_at && (
                          <span className="text-[10px] opacity-75">
                            •{" "}
                            {new Date(
                              customer.last_transaction_at
                            ).toLocaleDateString("en-IN", {
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
                          className={`text-base font-extrabold px-2.5 py-0.5 rounded-lg tabular-nums ${
                            hasUdhar
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20"
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
        </section>

        {/* ── Right Column: Detail Panel (Visible on >= 1024px) ── */}
        <section
          aria-label="Customer statement details"
          className="hidden lg:block lg:col-span-7 w-full sticky top-20 bg-card/60 border border-border/80 rounded-2xl p-5 shadow-xs max-h-[calc(100vh-6rem)] overflow-y-auto"
        >
          {activeCustomerId ? (
            <CustomerDetailPanel customerId={activeCustomerId} />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-2">
              <span className="text-3xl">👈</span>
              <p className="font-semibold text-foreground text-sm">
                विवरण देखने के लिए किसी ग्राहक को चुनें
              </p>
              <p className="text-xs">
                Select a customer from the list to view their ledger statement and history.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
