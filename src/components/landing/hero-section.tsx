"use client";

import { Suspense } from "react";
import { DemoAuthButton, DemoButtonSkeleton } from "./demo-auth-button";
import { HeroVisual } from "./hero-visual";

export function HeroSection() {
  return (
    <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 overflow-hidden w-full">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] h-[400px] bg-violet-600/15 blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 items-center">
          {/* Left Column: Headlines & CTA (single col mobile, 7 cols md+) */}
          <div className="md:col-span-7 flex flex-col items-center md:items-start text-center md:text-left gap-6">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">
                Voice-first AI Co-Pilot for Indian Kirana Stores
              </span>
            </div>

            {/* Main Headline with clamp() fluid scaling */}
            <h1 className="text-[clamp(1.85rem,4.5vw+0.75rem,3.75rem)] font-black tracking-tight text-white leading-[1.15]">
              Talk to your shop,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-amber-300">
                DukaanAI
              </span>{" "}
              keeps the books.
            </h1>

            {/* Official Tagline & English description */}
            <div className="flex flex-col gap-2 max-w-xl">
              <p className="text-[clamp(1.05rem,1.4vw+0.65rem,1.35rem)] font-bold text-amber-300/90 tracking-wide">
                &ldquo;Talk to your shop. DukaanAI keeps the books.&rdquo;
              </p>
              <p className="text-[clamp(0.95rem,1vw+0.65rem,1.125rem)] text-white/70 leading-relaxed">
                Skip paper notebooks and complex forms. Speak naturally in Hindi, Hinglish, or English —
                AI records purchases, udhar balances, and stock changes automatically.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-2">
              <Suspense fallback={<DemoButtonSkeleton size="lg" />}>
                <DemoAuthButton size="lg" />
              </Suspense>

              <a
                href="#workflow"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-2xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] text-white text-sm font-semibold transition-all hover:border-white/30 min-h-[48px] sm:min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
              >
                <span>See workflow</span>
                <span className="ml-1.5 text-white/60">↓</span>
              </a>
            </div>

            {/* Feature trust chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-4 border-t border-white/10 text-xs text-white/70">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="text-amber-400">⚡</span>
                <span>Usually a few seconds to parse</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="text-violet-400">🇮🇳</span>
                <span>Understands Hindi, Hinglish &amp; English</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="text-emerald-400">🔒</span>
                <span>0 entries saved without your confirmation</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual with Voice Orb & Glass Cards */}
          <div className="md:col-span-5 w-full flex items-center justify-center">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
