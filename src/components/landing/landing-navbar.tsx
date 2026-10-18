"use client";

import { Suspense } from "react";
import Link from "next/link";
import { DemoAuthButton, DemoButtonSkeleton } from "./demo-auth-button";

export function LandingNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#070611]/80 backdrop-blur-xl transition-all">
      <div className="max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group min-h-[48px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-500 p-0.5 shadow-md shadow-violet-900/40 group-hover:shadow-violet-600/50 transition-shadow">
            <div className="w-full h-full bg-[#0b091a] rounded-[10px] flex items-center justify-center text-lg sm:text-xl font-black text-white">
              द
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-violet-200 transition-colors">
                Dukaan<span className="text-violet-400">AI</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 tracking-wide uppercase">
                AI Co-pilot
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Nav Anchors */}
        <nav
          className="hidden md:flex items-center gap-2 lg:gap-4 text-sm font-medium text-white/70"
          aria-label="Landing page sections"
        >
          <a
            href="#problem"
            className="hover:text-white transition-colors cursor-pointer py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
          >
            समस्या (Problem)
          </a>
          <a
            href="#workflow"
            className="hover:text-white transition-colors cursor-pointer py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
          >
            कैसे काम करता है (How it works)
          </a>
          <a
            href="#preview"
            className="hover:text-white transition-colors cursor-pointer py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
          >
            लाइव प्रिव्यू (Preview)
          </a>
          <a
            href="#features"
            className="hover:text-white transition-colors cursor-pointer py-3 px-2.5 inline-flex items-center min-h-[48px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
          >
            सुविधाएं (Features)
          </a>
        </nav>

        {/* Demo Auth Action wrapped in Suspense */}
        <div className="flex items-center gap-3">
          <Suspense fallback={<DemoButtonSkeleton size="sm" />}>
            <DemoAuthButton size="sm" />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
