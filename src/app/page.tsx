"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MicButton } from "@/components/mic-button";
import { createClient } from "@/lib/supabase/client";

/* ────────────────────────────────────────────
   Inline SVG icons (no heavy icon bundle)
   ──────────────────────────────────────────── */

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

/* ────────────────────────────────────────────
   Home Page
   ──────────────────────────────────────────── */
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState<number>(0);
  const [totalUdhar, setTotalUdhar] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const demoErr = params.get("demo_error");
      if (demoErr) return decodeURIComponent(demoErr);
    }
    return null;
  });
  const [isPending, startTransition] = useTransition();

  // Load session on mount
  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user && !ignore) {
          setUserEmail(user.email ?? null);

          // Fetch shop
          const { data: shop } = await supabase
            .from("shops")
            .select("id, name")
            .eq("owner_id", user.id)
            .maybeSingle();

          if (shop && !ignore) {
            setShopName(shop.name);

            // Fetch total udhar from customer_balances view
            const { data: balances } = await supabase
              .from("customer_balances")
              .select("balance")
              .eq("shop_id", shop.id);

            if (balances && !ignore) {
              const udharSum = balances.reduce(
                (acc, b) => acc + (Number(b.balance) > 0 ? Number(b.balance) : 0),
                0
              );
              setTotalUdhar(Math.round(udharSum));
            }

            // Fetch today's sales
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const { data: sales } = await supabase
              .from("transactions")
              .select("total_amount")
              .eq("shop_id", shop.id)
              .eq("type", "sale")
              .gte("created_at", startOfToday.toISOString());

            if (sales && !ignore) {
              const salesSum = sales.reduce(
                (acc, s) => acc + Number(s.total_amount),
                0
              );
              setTodaySales(Math.round(salesSum));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load user session:", err);
      }
    }

    loadSession();
    return () => {
      ignore = true;
    };
  }, []);

  const handleTryDemo = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Demo login failed");
        } else {
          router.push("/app");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setErrorMsg(`Failed to connect to demo auth: ${msg}`);
      }
    });
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.reload();
    });
  };

  return (
    <div className="flex flex-1 flex-col min-h-[100dvh]">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-primary">
              DukaanAI
            </h1>
            <span className="text-xs font-medium text-muted-foreground rounded-full bg-secondary px-2.5 py-0.5">
              Beta
            </span>
          </div>
          {shopName ? (
            <span className="text-xs font-medium text-foreground/80 mt-0.5">
              {shopName}
            </span>
          ) : null}
        </div>

        <div>
          {userEmail ? (
            <div className="flex items-center gap-2">
              <Link
                href="/app"
                className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-colors min-h-[36px] flex items-center"
              >
                दुकान खोलें →
              </Link>
              <button
                onClick={handleSignOut}
                disabled={isPending}
                className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border transition-colors min-h-[36px]"
              >
                लॉग आउट
              </button>
            </div>
          ) : (
            <button
              onClick={handleTryDemo}
              disabled={isPending}
              id="try-demo-btn"
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-2 rounded-xl shadow-sm transition-all min-h-[44px] active:scale-95 cursor-pointer"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-300" />
              <span>{isPending ? "लॉगिन हो रहा है..." : "Try demo"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Specific honest error message banner */}
      {errorMsg && (
        <div className="mx-4 mt-3 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive text-center font-medium">
          {errorMsg}
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24">
        {/* Subtle tagline */}
        <p className="text-sm text-muted-foreground text-center max-w-[260px]">
          अपनी दुकान से बात करें
          <br />
          <span className="text-xs">Talk to your shop</span>
        </p>

        {userEmail ? (
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/app"
              id="btn-open-app"
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/95 min-h-[48px] active:scale-95 transition-all"
            >
              <span>दुकान ऐप खोलें (Open Shop) →</span>
            </Link>
            <span className="text-xs text-muted-foreground">
              वॉयस और टाइपिंग से हिसाब दर्ज करें
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Mic button: static when idle, animates pulse only when listening */}
            <MicButton
              listening={isListening}
              onClick={() => setIsListening((prev) => !prev)}
            />

            {/* Instruction text with active listening state */}
            <div className="flex flex-col items-center gap-1 text-center">
              <p
                className={`text-base font-semibold transition-colors ${
                  isListening ? "text-primary animate-pulse" : "text-foreground/80"
                }`}
              >
                {isListening ? "सुन रहा है... बोलिए" : "बोलने के लिए टैप करें"}
              </p>
              <p className="text-sm text-muted-foreground">
                {isListening ? "Listening... speak now" : "Tap to speak"}
              </p>
            </div>
          </div>
        )}

        {/* Quick info cards */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-2">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border p-4 shadow-sm">
            <span className="text-2xl font-bold text-primary">
              ₹{todaySales.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-muted-foreground">
              आज की बिक्री
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border p-4 shadow-sm">
            <span className="text-2xl font-bold text-udhar">
              ₹{totalUdhar.toLocaleString("en-IN")}
            </span>
            <span className="text-xs text-muted-foreground">कुल उधार</span>
          </div>
        </div>
      </main>

      {/* ── Bottom navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-sm px-4 py-2 safe-bottom"
        aria-label="Main navigation"
      >
        <Link
          href="/app"
          id="nav-home"
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center text-primary"
        >
          <HomeIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">होम</span>
        </Link>
        <Link
          href="/app/ledger"
          id="nav-ledger"
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center text-muted-foreground hover:text-foreground"
        >
          <BookOpenIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">खाता</span>
        </Link>
        <Link
          href="/app/settings"
          id="nav-settings"
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center text-muted-foreground hover:text-foreground"
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">सेटिंग्स</span>
        </Link>
      </nav>
    </div>
  );
}
