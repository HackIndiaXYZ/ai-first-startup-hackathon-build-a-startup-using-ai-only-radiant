"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MicButton } from "@/components/mic-button";
import { AnimatedNumber } from "@/components/animated-number";
import { ConfirmationCard } from "@/components/confirmation-card";
import { ReminderDialog } from "@/components/reminder-dialog";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { createClient } from "@/lib/supabase/client";
import { getIstDayRange } from "@/lib/date-utils";
import {
  generateIdempotencyKey,
  formatApiError,
  ParseSession,
  createParseSession,
  resetParseSession,
} from "@/lib/confirm-helpers";
import { Customer } from "@/lib/agents/types";
import { STRINGS } from "@/lib/strings";

interface Debtor {
  customer_id: string;
  name: string;
  phone: string | null;
  balance: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  unit: string;
  stock_qty: number;
  reorder_level: number;
}

interface RecentTransaction {
  id: string;
  type: "sale" | "payment";
  total_amount: number;
  paid_amount: number;
  raw_input: string | null;
  created_at: string;
  customer_id: string | null;
  customer_name?: string | null;
}

interface ProductItem {
  id: string;
  name: string;
  unit: string;
  price?: number;
  stock_qty: number;
  reorder_level: number;
}

function formatIstDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}

function DashboardContent() {
  // Dashboard Data states
  const [todaySales, setTodaySales] = useState<number>(0);
  const [totalUdhar, setTotalUdhar] = useState<number>(0);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentTransaction[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);
  const [sampleSuccessMsg, setSampleSuccessMsg] = useState<string | null>(null);

  // Reminder Dialog state
  const [reminderCustomer, setReminderCustomer] = useState<{
    name: string;
    phone: string | null;
    balance: number;
  } | null>(null);
  const [shopName, setShopName] = useState<string>("Kirana Store");

  // Input & Parse states
  const [typedInput, setTypedInput] = useState<string>("");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseTimerMessage, setParseTimerMessage] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSession, setParseSession] = useState<ParseSession | null>(null);
  const [lastRawInput, setLastRawInput] = useState<string>("");

  // Quick Action states
  const [activeQuickAction, setActiveQuickAction] = useState<"add_customer" | "record_payment" | "adjust_stock" | null>(null);
  const [quickActionNotice, setQuickActionNotice] = useState<string | null>(null);
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const [isSubmittingQuickAction, setIsSubmittingQuickAction] = useState<boolean>(false);

  // Quick Action form inputs
  const [newCustName, setNewCustName] = useState<string>("");
  const [newCustPhone, setNewCustPhone] = useState<string>("");
  const [newCustNotes, setNewCustNotes] = useState<string>("");

  const [paymentCustomerId, setPaymentCustomerId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  const [stockProductId, setStockProductId] = useState<string>("");
  const [stockQtyChange, setStockQtyChange] = useState<string>("");

  // Refs for abort, timers, and confirmation card keyboard focus
  const abortControllerRef = useRef<AbortController | null>(null);
  const timer15sRef = useRef<NodeJS.Timeout | null>(null);
  const timer30sRef = useRef<NodeJS.Timeout | null>(null);
  const confirmationCardRef = useRef<HTMLElement | null>(null);

  // Speech Recognition hook: when recognition ends, put transcript in text box so user reviews/fixes before sending. Do NOT auto-send.
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    onEnd: (spokenText) => {
      setTypedInput((prev) => (prev ? `${prev.trim()} ${spokenText.trim()}` : spokenText.trim()));
      resetTranscript();
    },
  });

  // Cleanup abort and timers on unmount
  useEffect(() => {
    return () => {
      if (timer15sRef.current) clearTimeout(timer15sRef.current);
      if (timer30sRef.current) clearTimeout(timer30sRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Keyboard: Focus moves to confirmation card when it appears
  useEffect(() => {
    if (parseSession && confirmationCardRef.current) {
      confirmationCardRef.current.focus();
    }
  }, [parseSession]);

  // Keyboard: Escape cancels confirmation card or active quick action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (parseSession) {
          e.preventDefault();
          setParseSession(resetParseSession());
          setParseError(null);
        } else if (activeQuickAction) {
          e.preventDefault();
          setActiveQuickAction(null);
          setQuickActionError(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [parseSession, activeQuickAction]);

  // Load dashboard data via RLS-safe client queries
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsLoadingDashboard(true);
    }
    setDashboardError(null);

    try {
      const supabase = createClient();

      // 1. Get current authenticated user's shop
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setDashboardError("User authentication required.");
        setIsLoadingDashboard(false);
        return;
      }

      const { data: initialShop, error: shopErr } = await supabase
        .from("shops")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();

      let shop = initialShop;
      if (shop?.name) {
        setShopName(shop.name);
      }
      if (!shop && !shopErr) {
        // Safe fallback: auto-create shop for new user if trigger hasn't run yet
        const { data: newShop } = await supabase
          .from("shops")
          .insert({
            owner_id: user.id,
            name: "My Dukaan",
            language: "en",
          })
          .select("id, name")
          .single();
        if (newShop) {
          shop = newShop;
          if (newShop.name) setShopName(newShop.name);
        }
      }

      if (shopErr || !shop) {
        setDashboardError("Shop profile not found.");
        setIsLoadingDashboard(false);
        return;
      }

      // 2. Fetch Today's Sales strictly in Asia/Kolkata (IST) day range
      const { startIso, endIso } = getIstDayRange();

      const { data: sales, error: salesErr } = await supabase
        .from("transactions")
        .select("total_amount")
        .eq("shop_id", shop.id)
        .eq("type", "sale")
        .gte("created_at", startIso)
        .lte("created_at", endIso);

      if (salesErr) throw salesErr;

      const salesSum = (sales || []).reduce(
        (acc, s) => acc + Number(s.total_amount || 0),
        0
      );
      setTodaySales(Math.round(salesSum));

      // 3. Fetch Total Udhar & Top 5 Debtors from customer_balances view
      const { data: balances, error: balanceErr } = await supabase
        .from("customer_balances")
        .select("customer_id, name, phone, balance")
        .eq("shop_id", shop.id);

      if (balanceErr) throw balanceErr;

      const positiveBalances = (balances || [])
        .map((b) => ({
          customer_id: b.customer_id,
          name: b.name,
          phone: b.phone,
          balance: Number(b.balance || 0),
        }))
        .filter((b) => b.balance > 0);

      const udharSum = positiveBalances.reduce((acc, b) => acc + b.balance, 0);
      setTotalUdhar(Math.round(udharSum));

      // Top 5 debtors sorted descending
      const top5 = [...positiveBalances]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5);
      setDebtors(top5);

      // 4. Fetch Products (for stock alerts & adjust stock dropdown)
      const { data: products, error: productErr } = await supabase
        .from("products")
        .select("id, name, unit, price, stock_qty, reorder_level")
        .eq("shop_id", shop.id);

      if (productErr) throw productErr;

      const prodList = (products || []).map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: Number(p.price || 0),
        stock_qty: Number(p.stock_qty || 0),
        reorder_level: Number(p.reorder_level || 0),
      }));
      setAllProducts(prodList);

      const lowStock = prodList
        .filter((p) => p.stock_qty <= p.reorder_level)
        .sort((a, b) => a.stock_qty - b.stock_qty)
        .slice(0, 5);

      setLowStockItems(lowStock);

      // 5. Fetch shop customers for client matching and quick actions
      const { data: custs } = await supabase
        .from("customers")
        .select("id, shop_id, name, phone, notes, created_at")
        .eq("shop_id", shop.id);

      const custList = (custs as Customer[]) || [];
      if (custs) {
        setCustomers(custList);
      }

      // 6. Fetch Recent Entries (last 5 transactions: customer, type, amount, time in IST)
      const { data: recent, error: recentErr } = await supabase
        .from("transactions")
        .select("id, type, total_amount, paid_amount, raw_input, created_at, customer_id")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentErr) {
        console.error("Recent transactions fetch error:", recentErr);
      } else if (recent) {
        const custMap = new Map(custList.map((c) => [c.id, c.name]));
        setRecentEntries(
          recent.map((r) => ({
            id: r.id,
            type: r.type as "sale" | "payment",
            total_amount: Number(r.total_amount || 0),
            paid_amount: Number(r.paid_amount || 0),
            raw_input: r.raw_input,
            created_at: r.created_at,
            customer_id: r.customer_id,
            customer_name: r.customer_id ? custMap.get(r.customer_id) || "Customer" : "Walk-in Cash Customer",
          }))
        );
      }
    } catch (err: unknown) {
      console.error("Dashboard fetch error:", err);
      setDashboardError("Failed to load dashboard data.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!ignore) {
        await loadDashboardData(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [loadDashboardData]);

  // Load sample data RPC for brand-new users / judges
  const handleLoadSampleData = async () => {
    setIsLoadingSample(true);
    setDashboardError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("load_sample_data");

      if (error) {
        setDashboardError(`Sample data error: ${error.message}`);
      } else {
        setSampleSuccessMsg("Sample kirana data (customers & inventory) loaded successfully!");
        await loadDashboardData(true);
        setTimeout(() => setSampleSuccessMsg(null), 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setDashboardError(`Error: ${msg}`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Execute parse request with user text
  const handleParseText = async (textToParse: string) => {
    const text = textToParse.trim();
    if (!text || isParsing) return;

    // Reset old abort and timers
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timer15sRef.current) clearTimeout(timer15sRef.current);
    if (timer30sRef.current) clearTimeout(timer30sRef.current);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsParsing(true);
    setParseError(null);
    setParseTimerMessage(null);
    setLastRawInput(text);

    // Stop recording if active
    if (isListening) {
      stopListening();
    }

    // Set 15s notice timer
    timer15sRef.current = setTimeout(() => {
      setParseTimerMessage("Taking longer than usual… please wait a moment…");
    }, 15000);

    // Set 30s abort timer
    timer30sRef.current = setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setParseError(formatApiError(data.error || "Parsing failed. Please try again."));
      } else {
        const session = createParseSession(data, text);
        setParseSession(session);

        // Clear input boxes once successfully parsed into confirmation card
        setTypedInput("");
        resetTranscript();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setParseError("Request timed out (30s). The server did not respond in time. Please try again.");
      } else {
        setParseError(formatApiError(err));
      }
    } finally {
      if (timer15sRef.current) clearTimeout(timer15sRef.current);
      if (timer30sRef.current) clearTimeout(timer30sRef.current);
      setIsParsing(false);
      setParseTimerMessage(null);
    }
  };

  // Toggle listening handler
  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setParseError(null);
      startListening();
    }
  };

  const handleCancelConfirmation = () => {
    setParseSession(resetParseSession());
    setParseError(null);
  };

  const handleDismissConfirmation = () => {
    setParseSession(resetParseSession());
    setTypedInput("");
    resetTranscript();
  };

  const handleConfirmationSuccess = () => {
    // Reload dashboard to reflect new sales, udhar, and stock values
    loadDashboardData();
  };

  // Quick Action Handler 1: Add Customer
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustName.trim();
    if (!name) {
      setQuickActionError("Customer name is required.");
      return;
    }
    const phone = newCustPhone.trim() || null;
    if (phone && !/^\+?[0-9\s-]{8,15}$/.test(phone)) {
      setQuickActionError("Please enter a valid phone number.");
      return;
    }

    setIsSubmittingQuickAction(true);
    setQuickActionError(null);
    setQuickActionNotice(null);

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
          summary: `New customer "${name}" added`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickActionError(formatApiError(data.error || "Failed to add customer."));
      } else {
        setQuickActionNotice(`✓ New customer "${name}" added successfully!`);
        setNewCustName("");
        setNewCustPhone("");
        setNewCustNotes("");
        setActiveQuickAction(null);
        await loadDashboardData();
      }
    } catch (err) {
      setQuickActionError(formatApiError(err));
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  // Quick Action Handler 2: Record Payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCust = customers.find((c) => c.id === paymentCustomerId);
    if (!targetCust) {
      setQuickActionError("Please select a customer.");
      return;
    }
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setQuickActionError("Valid positive payment amount required.");
      return;
    }

    setIsSubmittingQuickAction(true);
    setQuickActionError(null);
    setQuickActionNotice(null);

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_payment",
          customer: targetCust.name,
          amount: amt,
          idempotency_key: generateIdempotencyKey(),
          summary: `${targetCust.name} paid Rs ${amt}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickActionError(formatApiError(data.error || "Failed to record payment."));
      } else {
        const newBal = data.new_balance !== undefined ? ` New balance: Rs ${Number(data.new_balance).toLocaleString("en-IN")}` : "";
        setQuickActionNotice(`✓ Payment of Rs ${amt.toLocaleString("en-IN")} recorded for ${targetCust.name}!${newBal}`);
        setPaymentCustomerId("");
        setPaymentAmount("");
        setActiveQuickAction(null);
        await loadDashboardData();
      }
    } catch (err) {
      setQuickActionError(formatApiError(err));
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  // Quick Action Handler 3: Adjust Stock
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = allProducts.find((p) => p.id === stockProductId);
    if (!targetProd) {
      setQuickActionError("Please select a product.");
      return;
    }
    const qty = Number(stockQtyChange);
    if (isNaN(qty) || qty === 0) {
      setQuickActionError("Non-zero quantity change required.");
      return;
    }

    setIsSubmittingQuickAction(true);
    setQuickActionError(null);
    setQuickActionNotice(null);

    try {
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_stock",
          product: targetProd.name,
          qty_change: qty,
          unit: targetProd.unit,
          idempotency_key: generateIdempotencyKey(),
          summary: `${targetProd.name} stock ${qty > 0 ? "+" : ""}${qty} ${targetProd.unit} updated`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickActionError(formatApiError(data.error || "Failed to adjust stock."));
      } else {
        const newQty = data.new_stock !== undefined ? ` New stock: ${data.new_stock} ${targetProd.unit}` : "";
        setQuickActionNotice(`✓ ${targetProd.name} stock updated!${newQty}`);
        setStockProductId("");
        setStockQtyChange("");
        setActiveQuickAction(null);
        await loadDashboardData();
      }
    } catch (err) {
      setQuickActionError(formatApiError(err));
    } finally {
      setIsSubmittingQuickAction(false);
    }
  };

  return (
    <main className="w-full px-4 py-5 animate-in fade-in duration-200">
      {/* 
        Parent layout:
        - Mobile (< 1024px): Standard column with order-1..6 preserving exact mobile structure
        - Desktop (>= 1024px): Two-column grid (Left: mic, typed, confirm, recent entries, quick actions; Right: sales, udhar, debtors, stock)
      */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start w-full">
        {/* ── Left Column (Desktop >= 1024px): Mic + Typed Input + Confirmation Card + Desktop Quick Actions & Recent Entries ── */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:col-span-7">
          {/* Sample Data Load Success Banner */}
          {sampleSuccessMsg && (
            <div className="order-1 lg:order-none p-3.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
              <span>{sampleSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setSampleSuccessMsg(null)}
                className="text-green-800 dark:text-green-300 hover:opacity-75 font-bold ml-2 text-sm cursor-pointer"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          )}

          {/* Brand-new User Empty State & Sample Data Loader Banner */}
          {!isLoadingDashboard &&
            customers.length === 0 &&
            allProducts.length === 0 &&
            recentEntries.length === 0 && (
              <div className="order-1 lg:order-none p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-violet-500/10 via-primary/10 to-amber-500/10 border border-primary/20 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👋</span>
                    <h2 className="text-sm sm:text-base font-bold text-foreground">
                      Welcome to DukaanAI!
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">
                      Say your first sale to get started:
                    </strong>{" "}
                    Press the mic and say e.g. <em>&ldquo;Ramesh ne 500 ka saaman liya, 200 abhi diye&rdquo;</em>, or load sample data for an instant walkthrough.
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-load-sample-data"
                  onClick={handleLoadSampleData}
                  disabled={isLoadingSample}
                  className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px] shrink-0 cursor-pointer active:scale-[0.98] transition-all"
                >
                  {isLoadingSample ? (
                    <span>Loading sample data...</span>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>Load sample data</span>
                    </>
                  )}
                </button>
              </div>
            )}

          {/* Voice & Text Entry Section */}
          <section
            aria-label="Voice and text entry"
            className="order-2 lg:order-none flex flex-col gap-4 rounded-2xl bg-card border border-border/80 p-4 sm:p-5 shadow-xs w-full transition-all duration-150"
          >
            {/* Browser Voice Compatibility Notice */}
            {!isSpeechSupported && (
              <div className="w-full text-center text-xs py-1.5 px-3 rounded-xl bg-muted/60 text-muted-foreground border border-border/50">
                ℹ️ Voice input works best in Chrome or Edge. You can also type below.
              </div>
            )}

            {/* Layout: Desktop puts primary action (Mic) with Typed Input beside it; Mobile stacks them cleanly */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:gap-6 w-full">
              {/* Primary Action: Big Centered Mic Button */}
              <div className="flex flex-col items-center gap-2 py-1 shrink-0 lg:w-44 text-center">
                <MicButton
                  listening={isListening}
                  onClick={handleToggleMic}
                />
                <div>
                  <p
                    className={`text-sm font-bold transition-colors ${
                      isListening ? "text-primary animate-pulse" : "text-foreground"
                    }`}
                  >
                    {isListening ? "Listening... speak now" : "Tap to speak"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isListening ? "Tap again to stop" : "Tap to speak"}
                  </p>
                </div>
              </div>

              {/* Divider on mobile only */}
              <div className="flex items-center gap-3 w-full lg:hidden my-0.5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Or type an entry
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Typed Input Column */}
              <div className="flex flex-col gap-2.5 flex-1 w-full min-w-0">
                {/* Live Transcript Typing Indicator */}
                {(isListening || interimTranscript) && (
                  <div className="w-full rounded-xl bg-primary/5 border border-primary/20 p-2.5 text-sm text-foreground flex flex-col gap-1 animate-in fade-in duration-150 motion-reduce:animate-none">
                    <div className="flex items-center justify-between text-[11px] text-primary font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        Live Voice:
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Tap mic when finished speaking
                      </span>
                    </div>
                    <p className="font-medium text-sm text-foreground/90 min-h-[24px]">
                      {transcript}{" "}
                      <span className="text-muted-foreground italic">{interimTranscript}</span>
                    </p>
                  </div>
                )}

                {speechError && (
                  <div className="w-full text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2 rounded-xl text-center">
                    {speechError}
                  </div>
                )}

                {/* Prominent Typed-Input Box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (typedInput.trim() && !isParsing) {
                      handleParseText(typedInput);
                    }
                  }}
                  className="flex flex-col gap-1.5 w-full"
                >
                  <div className="relative flex items-center w-full">
                    <input
                      type="text"
                      id="typed-input-box"
                      value={typedInput}
                      onChange={(e) => setTypedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (typedInput.trim() && !isParsing) {
                            handleParseText(typedInput);
                          }
                        }
                      }}
                      placeholder="e.g. Ramesh ne 500 ka saaman liya, 200 abhi diye"
                      disabled={isParsing}
                      className="w-full px-4 py-3 text-sm rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none transition-shadow min-h-[48px] pr-28"
                    />
                    <button
                      type="submit"
                      id="btn-submit-typed"
                      disabled={!typedInput.trim() || isParsing}
                      title={!typedInput.trim() ? "Type or speak an entry first" : "Record Entry"}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg shadow hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 min-h-[40px] cursor-pointer"
                    >
                      {isParsing ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Recording...</span>
                        </>
                      ) : (
                        "Record Entry"
                      )}
                    </button>
                  </div>

                  {!typedInput.trim() && !isParsing ? (
                    <span className="text-[11px] text-amber-800 dark:text-amber-400/90 text-center font-medium">
                      💡 Type or speak an entry first
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground text-center">
                      Type any transaction in Hinglish or English (e.g. &quot;Ramesh ne 500 ka saaman liya, 200 abhi diye&quot;)
                    </span>
                  )}
                </form>

                {/* Parsing Activity Indicator with 15s message */}
                {isParsing && (
                  <div className="flex flex-col items-center gap-1.5 text-xs font-semibold text-primary py-1 text-center">
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Understanding entry…</span>
                    </div>
                    {parseTimerMessage && (
                      <span className="text-amber-700 dark:text-amber-400 text-[11px] font-medium animate-pulse">
                        {parseTimerMessage}
                      </span>
                    )}
                  </div>
                )}

                {/* Parse Error Display with Retry */}
                {parseError && (
                  <div className="w-full rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive text-center font-medium flex flex-col items-center gap-1.5">
                    <span>{parseError}</span>
                    {lastRawInput && (
                      <button
                        type="button"
                        onClick={() => handleParseText(lastRawInput)}
                        className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[32px] flex items-center"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Confirmation Card Section (Focus moves to card when it appears; Escape cancels) */}
          {parseSession && (
            <section
              ref={confirmationCardRef}
              tabIndex={-1}
              id="confirmation-card-section"
              aria-label="Transaction confirmation"
              className="order-3 lg:order-none w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
            >
              <ConfirmationCard
                key={parseSession.idempotencyKey}
                parseResult={parseSession.parseResult}
                idempotencyKey={parseSession.idempotencyKey}
                rawInput={parseSession.rawInput}
                customers={customers}
                products={allProducts}
                onCancel={handleCancelConfirmation}
                onSuccess={handleConfirmationSuccess}
                onDismiss={handleDismissConfirmation}
                onOpenQuickAddCustomer={(prefillName) => {
                  setNewCustName(prefillName);
                  setActiveQuickAction("add_customer");
                }}
                onOpenQuickAddProduct={() => {
                  loadDashboardData();
                }}
              />
            </section>
          )}

          {/* Desktop-Only Left Column Extension (>= 1024px): Quick Actions + Recent Entries */}
          <div className="hidden lg:flex lg:flex-col lg:gap-6">
            {/* Quick Actions Row */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground leading-tight">
                    Quick actions
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Common shop tasks
                  </span>
                </div>
                {activeQuickAction && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuickAction(null);
                      setQuickActionError(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-md hover:bg-muted/60 cursor-pointer"
                    aria-label="Close active quick action"
                  >
                    ✕ Close
                  </button>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  id="btn-quick-add-customer"
                  onClick={() => {
                    setActiveQuickAction(activeQuickAction === "add_customer" ? null : "add_customer");
                    setQuickActionError(null);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activeQuickAction === "add_customer"
                      ? "bg-primary/10 border-primary text-primary shadow-xs font-bold"
                      : "border-border bg-background hover:bg-muted/60 hover:border-primary/40 text-foreground"
                  }`}
                >
                  <span className="text-xs font-bold">👤 Add Customer</span>
                  <span className="text-[10px] text-muted-foreground">New customer</span>
                </button>

                <button
                  type="button"
                  id="btn-quick-record-payment"
                  onClick={() => {
                    setActiveQuickAction(activeQuickAction === "record_payment" ? null : "record_payment");
                    setQuickActionError(null);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activeQuickAction === "record_payment"
                      ? "bg-green-500/10 border-green-600 text-green-700 dark:text-green-400 shadow-xs font-bold"
                      : "border-border bg-background hover:bg-muted/60 hover:border-green-600/40 text-foreground"
                  }`}
                >
                  <span className="text-xs font-bold text-green-700 dark:text-green-400">💰 Record Payment</span>
                  <span className="text-[10px] text-muted-foreground">Receive payment</span>
                </button>

                <button
                  type="button"
                  id="btn-quick-adjust-stock"
                  onClick={() => {
                    setActiveQuickAction(activeQuickAction === "adjust_stock" ? null : "adjust_stock");
                    setQuickActionError(null);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activeQuickAction === "adjust_stock"
                      ? "bg-amber-500/10 border-amber-600 text-amber-700 dark:text-amber-400 shadow-xs font-bold"
                      : "border-border bg-background hover:bg-muted/60 hover:border-amber-600/40 text-foreground"
                  }`}
                >
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">📦 Adjust Stock</span>
                  <span className="text-[10px] text-muted-foreground">Inventory count</span>
                </button>
              </div>

              {/* Visible Success Banner */}
              {quickActionNotice && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-800 dark:text-green-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
                  <span>{quickActionNotice}</span>
                  <button
                    type="button"
                    onClick={() => setQuickActionNotice(null)}
                    className="text-green-800 dark:text-green-300 hover:opacity-75 font-bold ml-2 text-sm cursor-pointer"
                    aria-label="Close notification"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Visible Error Banner */}
              {quickActionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                  {quickActionError}
                </div>
              )}

              {/* Active Quick Action Forms */}
              {/* Form 1: Add Customer */}
              {activeQuickAction === "add_customer" && (
                <form
                  onSubmit={handleAddCustomerSubmit}
                  className="flex flex-col gap-3 p-4 rounded-xl bg-muted/30 border border-border animate-in fade-in duration-150 motion-reduce:animate-none"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">New Customer Details</span>
                    <span className="text-[10px] text-muted-foreground">Enter customer information</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Notes / Address
                    </label>
                    <input
                      type="text"
                      value={newCustNotes}
                      onChange={(e) => setNewCustNotes(e.target.value)}
                      placeholder="e.g. Near Shiv Temple"
                      className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveQuickAction(null)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[38px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuickAction}
                      className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 min-h-[38px] cursor-pointer shadow-xs"
                    >
                      {isSubmittingQuickAction ? "Adding..." : "Add Customer"}
                    </button>
                  </div>
                </form>
              )}

              {/* Form 2: Record Payment */}
              {activeQuickAction === "record_payment" && (
                <form
                  onSubmit={handleRecordPaymentSubmit}
                  className="flex flex-col gap-3 p-4 rounded-xl bg-muted/30 border border-border animate-in fade-in duration-150 motion-reduce:animate-none"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Record Payment</span>
                    <span className="text-[10px] text-muted-foreground">Record payment against pending balance</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Select Customer *
                      </label>
                      <select
                        required
                        value={paymentCustomerId}
                        onChange={(e) => setPaymentCustomerId(e.target.value)}
                        className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                      >
                        <option value="">-- Select Customer --</option>
                        {customers.map((c) => {
                          const debtor = debtors.find((d) => d.customer_id === c.id);
                          const bal = debtor ? ` (Udhar: Rs ${debtor.balance.toLocaleString("en-IN")})` : "";
                          return (
                            <option key={c.id} value={c.id}>
                              {c.name}{bal}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Amount (Rs) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="e.g. 500"
                        className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-bold tabular-nums min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveQuickAction(null)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[38px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuickAction}
                      className="px-4 py-1.5 rounded-lg bg-green-700 text-white text-xs font-bold hover:bg-green-800 disabled:opacity-50 flex items-center gap-1.5 min-h-[38px] cursor-pointer shadow-xs"
                    >
                      {isSubmittingQuickAction ? "Recording..." : "Record Payment"}
                    </button>
                  </div>
                </form>
              )}

              {/* Form 3: Adjust Stock */}
              {activeQuickAction === "adjust_stock" && (
                <form
                  onSubmit={handleAdjustStockSubmit}
                  className="flex flex-col gap-3 p-4 rounded-xl bg-muted/30 border border-border animate-in fade-in duration-150 motion-reduce:animate-none"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground">Adjust Product Stock</span>
                    <span className="text-[10px] text-muted-foreground">Update product inventory quantity</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Select Product *
                      </label>
                      <select
                        required
                        value={stockProductId}
                        onChange={(e) => setStockProductId(e.target.value)}
                        className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none min-h-[44px]"
                      >
                        <option value="">-- Select Product --</option>
                        {allProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.stock_qty} {p.unit})
                          </option>
                        ))}
                      </select>
                      <Link
                        href="/app/stock?add=true"
                        className="text-[10px] text-primary hover:underline font-semibold mt-1 inline-flex items-center gap-1"
                      >
                        <span>+ Add new item to stock</span>
                      </Link>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Quantity Change (+ or -) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        required
                        value={stockQtyChange}
                        onChange={(e) => setStockQtyChange(e.target.value)}
                        placeholder="e.g. +10 or -5"
                        className="px-3 py-2 text-xs rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary outline-none font-bold tabular-nums min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveQuickAction(null)}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted min-h-[38px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingQuickAction}
                      className="px-4 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 disabled:opacity-50 flex items-center gap-1.5 min-h-[38px] cursor-pointer shadow-xs"
                    >
                      {isSubmittingQuickAction ? "Updating..." : "Update Stock"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Recent Entries Card */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-base font-bold text-foreground leading-tight">
                    Recent Transactions
                  </h2>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Recent entries (last 5)
                  </span>
                </div>
                <Link
                  href="/app/ledger"
                  className="text-xs font-semibold text-primary hover:underline whitespace-nowrap min-h-[32px] flex items-center"
                >
                  View All →
                </Link>
              </div>

              {isLoadingDashboard ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse border border-border/40" />
                  ))}
                </div>
              ) : recentEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-card/40 flex flex-col items-center gap-1">
                  <div>🎉 No recent transactions recorded yet.</div>
                  <div className="text-[11px] font-medium text-primary mt-0.5">
                    Say your first sale to get started!
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">
                    Speak or type an entry above to record your first transaction!
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentEntries.map((tx) => {
                    const isPayment = tx.type === "payment";
                    const isCreditSale = tx.type === "sale" && tx.total_amount > tx.paid_amount;
                    const udharAmt = tx.total_amount - tx.paid_amount;

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 hover:border-border transition-colors duration-150 text-xs"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm truncate">
                              {tx.customer_name || "Walk-in Cash Customer"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isPayment
                                  ? "bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30"
                                  : isCreditSale
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  : "bg-primary/15 text-primary border border-primary/30"
                              }`}
                            >
                              {isPayment
                                ? "Payment"
                                : isCreditSale
                                ? "Udhar Sale"
                                : "Cash Sale"}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            🕒 {formatIstDateTime(tx.created_at)}
                            {tx.raw_input ? ` • "${tx.raw_input}"` : ""}
                          </span>
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                          {isPayment ? (
                            <span className="text-sm font-extrabold text-green-700 dark:text-green-400 tabular-nums">
                              +₹{tx.paid_amount.toLocaleString("en-IN")}
                            </span>
                          ) : isCreditSale ? (
                            <>
                              <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
                                ₹{udharAmt.toLocaleString("en-IN")} udhar
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                Total ₹{tx.total_amount.toLocaleString("en-IN")}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-extrabold text-primary tabular-nums">
                              ₹{tx.total_amount.toLocaleString("en-IN")}
                            </span>
                          )}

                          {tx.type === "sale" && (
                            <a
                              id={`btn-recent-invoice-${tx.id}`}
                              href={`/api/invoice/${tx.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline mt-0.5"
                            >
                              <span>📄</span>
                              <span>{STRINGS.invoice.viewInvoice}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column (Desktop >= 1024px): Sales, Udhar, Debtors, Low Stock ── */}
        <div className="contents lg:flex lg:flex-col lg:gap-6 lg:col-span-5">
          {/* Today's Sales & Total Udhar Overview (Equal height min-h-[110px], tabular numbers, stacked bilingual labels) */}
          <section
            aria-label="Business overview"
            className="order-1 lg:order-none grid grid-cols-2 gap-3 w-full"
          >
            <div className="flex flex-col justify-between items-center text-center gap-2 rounded-2xl bg-card border border-border/80 p-4 shadow-xs h-full min-h-[110px]">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-foreground leading-tight">
                  Today&apos;s Sales
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Cash &amp; Credit
                </span>
              </div>
              {isLoadingDashboard ? (
                <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-md my-auto" />
              ) : (
                <AnimatedNumber
                  value={todaySales}
                  className="text-2xl font-extrabold text-primary tracking-tight tabular-nums"
                />
              )}
            </div>

            <div className="flex flex-col justify-between items-center text-center gap-2 rounded-2xl bg-card border border-border/80 p-4 shadow-xs h-full min-h-[110px]">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 leading-tight">
                  Total Pending Udhar
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Customer Balance
                </span>
              </div>
              {isLoadingDashboard ? (
                <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-md my-auto" />
              ) : (
                <AnimatedNumber
                  value={totalUdhar}
                  className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tracking-tight tabular-nums"
                />
              )}
            </div>
          </section>

          {/* Top 5 Debtors — Title stays on one line at 1280px, count in badge, proper empty state ("No udhar yet") */}
          <section
            aria-label="Top debtors"
            className="order-4 lg:order-none flex flex-col gap-3 w-full"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col min-w-0">
                  <h2 className="text-base font-bold text-foreground leading-tight whitespace-nowrap">
                    Top Debtors
                  </h2>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Customers with balance
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  {debtors.length}
                </span>
              </div>
              <Link
                href="/app/ledger"
                className="text-xs font-semibold text-primary hover:underline whitespace-nowrap shrink-0 min-h-[36px] flex items-center"
              >
                View All →
              </Link>
            </div>

            {isLoadingDashboard ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse border border-border/40" />
                ))}
              </div>
            ) : debtors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-card/40 flex flex-col items-center gap-1.5">
                {customers.length === 0 ? (
                  <>
                    <span className="font-semibold text-foreground">
                      No customers or pending udhar in store yet
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Say your first sale to get started.
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadSampleData}
                      disabled={isLoadingSample}
                      className="text-xs font-bold text-primary underline cursor-pointer mt-1"
                    >
                      Load sample data
                    </button>
                  </>
                ) : (
                  <>
                    <div>🎉 No pending udhar. All customer accounts are settled!</div>
                    <div className="text-[10px] opacity-75 mt-0.5">All customer accounts are settled.</div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {debtors.map((debtor) => (
                  <div
                    key={debtor.customer_id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border/80 hover:border-primary/40 transition-all duration-150 shadow-xs min-h-[48px]"
                  >
                    <Link
                      href={`/app/ledger/${debtor.customer_id}`}
                      className="flex flex-col min-w-0 pr-2 flex-1 focus-visible:outline-none"
                    >
                      <span className="text-sm font-bold text-foreground truncate">
                        {debtor.name}
                      </span>
                      {debtor.phone && (
                        <span className="text-xs text-muted-foreground">
                          📞 {debtor.phone}
                        </span>
                      )}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg tabular-nums border border-amber-500/20">
                        ₹{debtor.balance.toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        id={`btn-remind-${debtor.customer_id}`}
                        onClick={() =>
                          setReminderCustomer({
                            name: debtor.name,
                            phone: debtor.phone,
                            balance: debtor.balance,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold transition-all min-h-[36px] flex items-center gap-1 cursor-pointer"
                        title="Send WhatsApp payment reminder"
                      >
                        <span>💬</span>
                        <span>{STRINGS.reminders.remindButton}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Low-Stock Alerts — Title stays on one line at 1280px, count in badge, clean empty state */}
          <section
            aria-label="Low stock items"
            className="order-5 lg:order-none flex flex-col gap-3 w-full"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col min-w-0">
                  <h2 className="text-base font-bold text-foreground leading-tight whitespace-nowrap">
                    Low Stock Alerts
                  </h2>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Needs reordering
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                  {lowStockItems.length}
                </span>
              </div>
            </div>

            {isLoadingDashboard ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse border border-border/40" />
                ))}
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground bg-card/40 flex flex-col items-center gap-1.5">
                {allProducts.length === 0 ? (
                  <>
                    <span className="font-semibold text-foreground">
                      No inventory items recorded yet
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Say your first sale to get started.
                    </span>
                    <button
                      type="button"
                      onClick={handleLoadSampleData}
                      disabled={isLoadingSample}
                      className="text-xs font-bold text-primary underline cursor-pointer mt-0.5"
                    >
                      Load sample data
                    </button>
                  </>
                ) : (
                  <>
                    <div>✓ All items in stock. Healthy inventory levels.</div>
                    <div className="text-[10px] opacity-75 mt-0.5">All products have healthy inventory levels.</div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-xs transition-colors duration-150"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-bold text-foreground text-sm truncate">{item.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        Reorder level: {item.reorder_level} {item.unit}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-extrabold text-destructive text-sm tabular-nums">
                        {item.stock_qty} {item.unit}
                      </span>
                      <span className="text-[10px] text-destructive/80 font-medium">Low Stock</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dashboard Error Alert with Retry */}
          {dashboardError && (
            <div className="order-6 lg:order-none rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
              <span>{dashboardError}</span>
              <button
                type="button"
                onClick={() => loadDashboardData(true)}
                className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment Reminder Dialog */}
      <ReminderDialog
        isOpen={Boolean(reminderCustomer)}
        onClose={() => setReminderCustomer(null)}
        customer={reminderCustomer}
        shopName={shopName}
      />
    </main>
  );
}

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[1200px] mx-auto p-4 flex flex-col gap-4">
          <div className="h-14 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-44 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
