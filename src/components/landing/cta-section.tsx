"use client";

import { Suspense } from "react";
import { DemoAuthButton, DemoButtonSkeleton } from "./demo-auth-button";

export function CtaSection() {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden w-full">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[400px] bg-gradient-to-r from-violet-600/25 via-indigo-600/20 to-amber-500/15 blur-[160px] pointer-events-none -z-10" />

      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div data-reveal-header className="rounded-[36px] bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-white/[0.01] border border-white/15 p-6 sm:p-10 lg:p-14 backdrop-blur-2xl shadow-2xl shadow-black/80 flex flex-col items-center text-center gap-6 relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <span>🇮🇳</span>
            <span>Instant access with sample data, no setup required</span>
          </div>

          {/* Heading with clamp() fluid scaling */}
          <h2 className="text-[clamp(1.65rem,3.2vw+0.6rem,2.75rem)] font-black text-white tracking-tight max-w-2xl">
            Make your store{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-200 to-amber-300">
              AI-smart and stress-free
            </span>
          </h2>

          <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70 max-w-xl">
            Skip lost paper notebooks and untracked credit. Try the live interactive demo to see how voice-first bookkeeping keeps your ledger accurate.
          </p>

          {/* Primary CTA */}
          <div className="pt-2">
            <Suspense fallback={<DemoButtonSkeleton size="lg" />}>
              <DemoAuthButton size="lg" />
            </Suspense>
          </div>

          {/* Trust Guarantees */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> No signup form required (Instant Demo)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Works directly in your mobile browser
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span> Private store data (Row-Level Security)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
