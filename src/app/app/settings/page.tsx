"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ShopInfo {
  name: string;
  gstin: string | null;
  language: string;
}

export default function SettingsPage() {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email ?? null);

          const { data: shopRecord } = await supabase
            .from("shops")
            .select("name, gstin, language")
            .eq("owner_id", user.id)
            .maybeSingle();

          if (shopRecord) {
            setShop(shopRecord);
          }
        }
      } catch (err) {
        console.error("Settings load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/");
        router.refresh();
      } catch {
        router.push("/");
      }
    });
  };

  const isDemo = userEmail === "demo@dukaanai.in";

  return (
    <main className="flex flex-col gap-5 px-4 py-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground">
          Shop profile and account management
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="h-32 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          <div className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
        </div>
      ) : (
        <>
          {/* ── Shop Info Card ── */}
          <section className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground">
              Shop Profile
            </h2>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Shop Name:</span>
                <span className="font-bold text-foreground">
                  {shop?.name || "My Dukaan"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">GSTIN:</span>
                <span className="font-mono text-foreground">
                  {shop?.gstin || "07AAAAA0000A1Z5"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Primary Language:</span>
                <span className="font-medium text-foreground">Hindi / Hinglish (Roman)</span>
              </div>
            </div>
          </section>

          {/* ── Account Card ── */}
          <section className="flex flex-col gap-3 rounded-2xl bg-card border border-border p-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground">
              Account Details
            </h2>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Sign-in Email:</span>
                <span className="font-semibold text-foreground">
                  {userEmail || "demo@dukaanai.in"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Account Type:</span>
                <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full text-[11px]">
                  {isDemo ? "Demo Account" : "Google Account"}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-settings-signout"
              onClick={handleSignOut}
              disabled={isPending}
              className="mt-2 w-full flex items-center justify-center py-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-bold transition-all min-h-[48px] cursor-pointer disabled:opacity-50"
            >
              {isPending ? "Signing out..." : "Sign Out"}
            </button>
          </section>

          {/* ── App Version & Tagline ── */}
          <div className="text-center text-xs text-muted-foreground pt-4 flex flex-col gap-1">
            <p className="font-bold text-foreground">DukaanAI v0.1.0 Beta</p>
            <p className="italic">
              &quot;Talk to your shop. DukaanAI keeps the books.&quot;
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              Built for HackIndia 2026 AI-First Startup Hackathon
            </p>
          </div>
        </>
      )}
    </main>
  );
}
