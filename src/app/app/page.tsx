"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MicButton } from "@/components/mic-button";
import { AnimatedNumber } from "@/components/animated-number";
import { ConfirmationCard, ParseApiResponse } from "@/components/confirmation-card";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { createClient } from "@/lib/supabase/client";
import { getIstDayRange } from "@/lib/date-utils";
import { generateIdempotencyKey, formatApiError } from "@/lib/confirm-helpers";
import { Customer } from "@/lib/agents/types";

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

export default function AppPage() {
  // Dashboard Data states
  const [todaySales, setTodaySales] = useState<number>(0);
  const [totalUdhar, setTotalUdhar] = useState<number>(0);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Input & Parse states
  const [typedInput, setTypedInput] = useState<string>("");
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseTimerMessage, setParseTimerMessage] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseApiResponse | null>(null);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string | null>(null);
  const [lastRawInput, setLastRawInput] = useState<string>("");

  // Abort and timer refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const timer15sRef = useRef<NodeJS.Timeout | null>(null);
  const timer30sRef = useRef<NodeJS.Timeout | null>(null);

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
        setDashboardError("उपयोगकर्ता प्रमाणीकरण आवश्यक है (User authentication required).");
        setIsLoadingDashboard(false);
        return;
      }

      const { data: shop, error: shopErr } = await supabase
        .from("shops")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (shopErr || !shop) {
        setDashboardError("दुकान नहीं मिली (Shop profile not found).");
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

      // 4. Fetch Low Stock Items (stock_qty <= reorder_level)
      const { data: products, error: productErr } = await supabase
        .from("products")
        .select("id, name, unit, stock_qty, reorder_level")
        .eq("shop_id", shop.id);

      if (productErr) throw productErr;

      const lowStock = (products || [])
        .filter((p) => Number(p.stock_qty) <= Number(p.reorder_level))
        .sort((a, b) => Number(a.stock_qty) - Number(b.stock_qty))
        .slice(0, 5);

      setLowStockItems(lowStock);

      // 5. Fetch shop customers for client-side customer matching in edit mode
      const { data: custs } = await supabase
        .from("customers")
        .select("id, shop_id, name, phone, notes, created_at")
        .eq("shop_id", shop.id);

      if (custs) {
        setCustomers(custs as Customer[]);
      }
    } catch (err: unknown) {
      console.error("Dashboard fetch error:", err);
      setDashboardError("डैशबोर्ड डेटा लोड करने में त्रुटि (Failed to load dashboard data).");
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
      setParseTimerMessage("Taking longer than usual… (सामान्य से अधिक समय लग रहा है…)");
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
        setParseError(formatApiError(data.error || "पार्स करने में त्रुटि हुई (Parsing failed)."));
      } else {
        const newKey = generateIdempotencyKey();
        setActiveIdempotencyKey(newKey);
        setParseResult(data);

        // Clear input boxes once successfully parsed into confirmation card
        setTypedInput("");
        resetTranscript();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setParseError("अनुरोध समय समाप्त (30s timeout). सर्वर से उत्तर नहीं मिला। कृपया पुनः प्रयास करें।");
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
      // On stop, useEffect transfers transcript to typedInput. Do NOT auto-send.
    } else {
      resetTranscript();
      setParseError(null);
      startListening();
    }
  };

  const handleCancelConfirmation = () => {
    setParseResult(null);
    setActiveIdempotencyKey(null);
    setParseError(null);
  };

  const handleConfirmationSuccess = () => {
    // Reload dashboard to reflect new sales, udhar, and stock values
    loadDashboardData();
  };

  return (
    <main className="flex flex-col gap-6 px-4 py-5 animate-in fade-in duration-200">
      {/* ── Today's Sales & Total Udhar Overview ── */}
      <section aria-label="Business overview" className="grid grid-cols-2 gap-3 w-full">
        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-card border border-border p-4 shadow-sm">
          <span className="text-xs font-semibold text-muted-foreground">
            आज की बिक्री (Today&apos;s Sales)
          </span>
          {isLoadingDashboard ? (
            <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-md mt-1" />
          ) : (
            <AnimatedNumber
              value={todaySales}
              className="text-2xl font-extrabold text-primary tracking-tight"
            />
          )}
        </div>

        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-card border border-border p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            कुल उधार (Total Udhar)
          </span>
          {isLoadingDashboard ? (
            <div className="h-8 w-24 bg-muted/60 animate-pulse rounded-md mt-1" />
          ) : (
            <AnimatedNumber
              value={totalUdhar}
              className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 tracking-tight"
            />
          )}
        </div>
      </section>

      {/* ── Voice & Text Entry Section ── */}
      <section
        aria-label="Voice and text entry"
        className="flex flex-col items-center gap-4 rounded-2xl bg-card/60 border border-border/70 p-5 shadow-sm"
      >
        {/* Browser Voice Compatibility Notice */}
        {!isSpeechSupported && (
          <div className="w-full text-center text-xs py-1.5 px-3 rounded-xl bg-muted/60 text-muted-foreground border border-border/50">
            ℹ️ आवाज़ इनपुट Chrome या Edge में सबसे अच्छा काम करता है। नीचे लिखकर भी दर्ज कर सकते हैं।
            <div className="text-[10px] opacity-75">Voice input requires Chrome/Edge. Typed entry works everywhere.</div>
          </div>
        )}

        {/* Big Centered Mic Button */}
        <div className="flex flex-col items-center gap-2 py-2">
          <MicButton
            listening={isListening}
            onClick={handleToggleMic}
          />
          <div className="text-center">
            <p
              className={`text-base font-bold transition-colors ${
                isListening ? "text-primary animate-pulse" : "text-foreground"
              }`}
            >
              {isListening ? "सुन रहा है... बोलिए (Listening...)" : "बोलने के लिए टैप करें"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isListening
                ? "रोकने के लिए दोबारा टैप करें (Tap again to finish)"
                : "Tap to speak (उदा: रमेश ने 500 का सामान लिया, 200 नकद दिए)"}
            </p>
          </div>
        </div>

        {/* Live Transcript Typing Indicator */}
        {(isListening || interimTranscript) && (
          <div className="w-full rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-primary font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                लाइव आवाज़ (Live Voice):
              </span>
              <span className="text-[10px] text-muted-foreground">
                बोलना समाप्त करने के लिए माइक दबाएँ (Tap mic when done)
              </span>
            </div>
            <p className="font-medium text-base text-foreground/90 min-h-[28px]">
              {transcript}{" "}
              <span className="text-muted-foreground italic">{interimTranscript}</span>
            </p>
          </div>
        )}

        {speechError && (
          <div className="w-full text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl text-center">
            {speechError}
          </div>
        )}

        {/* Divider with 'या' (Or) */}
        <div className="flex items-center gap-3 w-full my-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            या लिखकर दर्ज करें (Or Type)
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Prominent Typed-Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleParseText(typedInput);
          }}
          className="flex flex-col gap-2 w-full"
        >
          <div className="relative flex items-center w-full">
            <input
              type="text"
              id="typed-input-box"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="उदा: रमेश ने 300 रुपये जमा किए..."
              disabled={isParsing}
              className="w-full px-4 py-3 text-base rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary outline-none transition-shadow min-h-[50px] pr-20"
            />
            <button
              type="submit"
              id="btn-submit-typed"
              disabled={!typedInput.trim() || isParsing}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-primary text-primary-foreground font-bold text-xs rounded-lg shadow hover:bg-primary/95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center min-h-[40px] cursor-pointer"
            >
              {isParsing ? "..." : "दर्ज करें"}
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground text-center">
            हिंदी या हिंग्लिश में कोई भी लेन-देन लिखें (e.g. &quot;Anita didi 2 packet doodh 60 rs udhar&quot;)
          </span>
        </form>

        {/* Parsing Activity Indicator with 15s message */}
        {isParsing && (
          <div className="flex flex-col items-center gap-1.5 text-xs font-semibold text-primary py-2 text-center">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>समझ रहा हूँ… / Understanding…</span>
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
          <div className="w-full rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive text-center font-medium flex flex-col items-center gap-2">
            <span>{parseError}</span>
            {lastRawInput && (
              <button
                type="button"
                onClick={() => handleParseText(lastRawInput)}
                className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
              >
                पुनः प्रयास करें (Retry)
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Confirmation Card Section ── */}
      {parseResult && activeIdempotencyKey && (
        <section aria-label="Transaction confirmation" className="w-full">
          <ConfirmationCard
            parseResult={parseResult}
            idempotencyKey={activeIdempotencyKey}
            rawInput={lastRawInput}
            customers={customers}
            onCancel={handleCancelConfirmation}
            onSuccess={handleConfirmationSuccess}
          />
        </section>
      )}

      {/* ── Top 5 Debtors (बड़े बकायेदार) ── */}
      <section aria-label="Top debtors" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-foreground">
              शीर्ष बकायेदार (Top Debtors)
            </h2>
            <span className="text-xs text-muted-foreground">({debtors.length})</span>
          </div>
          <Link
            href="/app/ledger"
            className="text-xs font-semibold text-primary hover:underline min-h-[36px] flex items-center"
          >
            पूरा खाता देखें (View All) →
          </Link>
        </div>

        {isLoadingDashboard ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse border border-border/40" />
            ))}
          </div>
        ) : debtors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-card/40">
            🎉 कोई बकाया नहीं है! सभी खाते चुकता हैं।
            <div className="text-[10px] opacity-75 mt-0.5">No pending customer udhar.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {debtors.map((debtor) => (
              <Link
                key={debtor.customer_id}
                href={`/app/ledger/${debtor.customer_id}`}
                className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors shadow-xs active:scale-[0.99] min-h-[48px]"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">
                    {debtor.name}
                  </span>
                  {debtor.phone && (
                    <span className="text-xs text-muted-foreground">
                      📞 {debtor.phone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                    ₹{debtor.balance.toLocaleString("en-IN")}
                  </span>
                  <span className="text-muted-foreground text-xs">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Low-Stock Alerts (कम स्टॉक चेतावनी) ── */}
      <section aria-label="Low stock items" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-foreground">
              कम स्टॉक चेतावनी (Low Stock)
            </h2>
            <span className="text-xs text-destructive font-semibold">
              ({lowStockItems.length})
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
          <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground bg-card/40">
            ✓ सभी सामान पर्याप्त मात्रा में उपलब्ध हैं।
            <div className="text-[10px] opacity-75 mt-0.5">All products have healthy stock levels.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20 text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-bold text-foreground text-sm">{item.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    री-ऑर्डर स्तर: {item.reorder_level} {item.unit}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-extrabold text-destructive text-sm">
                    {item.stock_qty} {item.unit}
                  </span>
                  <span className="text-[10px] text-destructive/80 font-medium">स्टॉक कम है</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dashboard Error Alert with Retry */}
      {dashboardError && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{dashboardError}</span>
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            className="underline font-bold text-xs hover:text-destructive/80 cursor-pointer min-h-[36px] flex items-center"
          >
            पुनः प्रयास करें (Retry)
          </button>
        </div>
      )}
    </main>
  );
}
