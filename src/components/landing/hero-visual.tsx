"use client";

import { useSyncExternalStore, useState, Component, ErrorInfo, ReactNode } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";

// Dynamically import Spline scene with SSR disabled
const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
});

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function get3DCapableSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const splineSceneUrl = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL;
  if (!splineSceneUrl) return false;

  // Check prefers-reduced-motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  // Skip on low-power devices (concurrency <= 4 or deviceMemory <= 4)
  const concurrency = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 8;

  if (concurrency <= 4 || memory <= 4) {
    return false;
  }

  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

class SplineErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Spline 3D failed to load, falling back to CSS visual:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function HeroVisual() {
  const canRender3D = useSyncExternalStore(subscribe, get3DCapableSnapshot, getServerSnapshot);
  const [splineLoaded, setSplineLoaded] = useState<boolean>(false);
  const splineSceneUrl = process.env.NEXT_PUBLIC_SPLINE_SCENE_URL;

  return (
    <div className="relative w-full max-w-[320px] sm:max-w-md lg:max-w-lg mx-auto aspect-square flex items-center justify-center">
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/25 via-indigo-500/20 to-amber-500/10 blur-[90px] rounded-full pointer-events-none -z-10" />

      {/* 3D Spline Scene if supported and URL configured */}
      {canRender3D && splineSceneUrl ? (
        <SplineErrorBoundary fallback={<CssHeroVisual />}>
          <div className="relative w-full h-full flex items-center justify-center">
            <Spline
              scene={splineSceneUrl}
              onLoad={() => setSplineLoaded(true)}
              className={`w-full h-full transition-opacity duration-700 ${
                splineLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
            {!splineLoaded && <CssHeroVisual />}
          </div>
        </SplineErrorBoundary>
      ) : (
        <CssHeroVisual />
      )}
    </div>
  );
}

/**
 * Pure CSS/SVG + Motion Voice Orb & Floating Glass Ledger Cards
 */
function CssHeroVisual() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none">
      {/* ── Central Voice Orb with Waveform ── */}
      <div className="relative flex items-center justify-center">
        {/* Pulsating outer halos */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.45, 0.15] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-violet-600/20 blur-xl"
            />
            <motion.div
              animate={{ scale: [1, 1.45, 1], opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-indigo-500/15 blur-2xl"
            />
          </>
        )}

        {/* Orbit ring with saffron accent point */}
        <div className="absolute w-48 h-48 sm:w-60 sm:h-60 rounded-full border border-violet-500/30 flex items-center justify-center animate-spin-slow">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_#fbbf24] -translate-x-24 sm:-translate-x-30" />
        </div>

        {/* Main glowing glass mic orb */}
        <div className="relative w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gradient-to-b from-violet-500/30 via-indigo-900/60 to-[#070611]/90 border border-violet-400/40 backdrop-blur-2xl shadow-[0_0_50px_rgba(139,92,246,0.35)] flex flex-col items-center justify-center gap-1.5 sm:gap-2 z-10">
          {/* Mic Icon */}
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-950/60 border border-white/20">
            <svg
              className="w-5 h-5 sm:w-7 sm:h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z" />
            </svg>
          </div>

          {/* Animated audio frequency waveform bars */}
          <div className="flex items-center gap-1 h-5 px-3">
            {[14, 22, 10, 26, 18, 24, 12].map((height, i) => (
              <motion.span
                key={i}
                animate={shouldReduceMotion ? { height: 8 } : { height: [4, height, 4] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.15,
                }}
                className="w-1 bg-gradient-to-t from-violet-400 via-indigo-300 to-amber-300 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating Glass Ledger Card 1: Sale & Udhar (Top Right) ── */}
      <motion.div
        animate={shouldReduceMotion ? {} : { y: [-6, 6, -6] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-1 sm:-top-2 right-0 sm:right-2 z-20 w-[230px] sm:w-68 max-w-[85%] p-2.5 sm:p-3 rounded-2xl bg-white/[0.05] border border-white/15 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <span className="p-1 rounded-md bg-violet-500/20 text-violet-300">🛒</span>
            <span>Ramesh Kumar</span>
          </div>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            ✓ Confirmed
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/10">
          <span className="text-white/60">Total: ₹500 · Cash: ₹200</span>
          <span className="font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
            Udhar ₹300
          </span>
        </div>
      </motion.div>

      {/* ── Floating Glass Ledger Card 2: Stock Update (Bottom Left) ── */}
      <motion.div
        animate={shouldReduceMotion ? {} : { y: [6, -6, 6] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -bottom-2 sm:-bottom-4 left-0 sm:left-2 z-20 w-[220px] sm:w-64 max-w-[85%] p-2.5 sm:p-3 rounded-2xl bg-white/[0.05] border border-white/15 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col gap-1.5"
      >
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-300">📦</span>
            <span>Aashirvaad Atta 5kg</span>
          </div>
          <span className="text-[10px] font-semibold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
            +10 packets
          </span>
        </div>
        <div className="text-[11px] text-white/60 flex items-center justify-between pt-1 border-t border-white/10">
          <span>New Stock: 34 packets</span>
          <span className="text-emerald-400 font-medium">In Stock</span>
        </div>
      </motion.div>

      {/* ── Floating WhatsApp Reminder Pill (Top Left) ── */}
      <motion.div
        animate={shouldReduceMotion ? {} : { y: [-4, 5, -4] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-10 sm:top-12 left-0 sm:-left-4 z-20 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-xl text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 shadow-lg shadow-black/60 max-w-[80%]"
      >
        <span>💬</span>
        <span className="truncate">1-Tap WhatsApp Reminder</span>
      </motion.div>
    </div>
  );
}
