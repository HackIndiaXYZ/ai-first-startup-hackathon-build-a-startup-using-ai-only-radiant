"use client";

import { useState } from "react";
import { MicButton } from "@/components/mic-button";

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

/* ────────────────────────────────────────────
   Home Page
   ──────────────────────────────────────────── */
export default function Home() {
  const [isListening, setIsListening] = useState(false);

  return (
    <div className="flex flex-1 flex-col min-h-[100dvh]">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-5 py-4">
        <h1 className="text-xl font-bold tracking-tight text-primary">
          DukaanAI
        </h1>
        <span className="text-xs font-medium text-muted-foreground rounded-full bg-secondary px-2.5 py-1">
          Beta
        </span>
      </header>

      {/* ── Main content ── */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-24">
        {/* Subtle tagline */}
        <p className="text-sm text-muted-foreground text-center max-w-[260px]">
          अपनी दुकान से बात करें
          <br />
          <span className="text-xs">Talk to your shop</span>
        </p>

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

        {/* Quick info cards */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-2">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border p-4 shadow-sm">
            <span className="text-2xl font-bold text-primary">₹0</span>
            <span className="text-xs text-muted-foreground">
              आज की बिक्री
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border p-4 shadow-sm">
            <span className="text-2xl font-bold text-udhar">₹0</span>
            <span className="text-xs text-muted-foreground">कुल उधार</span>
          </div>
        </div>
      </main>

      {/* ── Bottom navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-border bg-card/95 backdrop-blur-sm px-4 py-2 safe-bottom"
        aria-label="Main navigation"
      >
        <button
          id="nav-home"
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center text-primary"
          type="button"
          aria-current="page"
        >
          <HomeIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">होम</span>
        </button>
        <button
          id="nav-ledger"
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center text-muted-foreground hover:text-foreground"
          type="button"
        >
          <BookOpenIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">खाता</span>
        </button>
        <button
          id="nav-settings"
          className="flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center text-muted-foreground hover:text-foreground"
          type="button"
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">सेटिंग्स</span>
        </button>
      </nav>
    </div>
  );
}
