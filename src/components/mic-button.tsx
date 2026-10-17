"use client";

import { motion, useReducedMotion } from "motion/react";

export interface MicButtonProps {
  listening?: boolean;
  onClick?: () => void;
  className?: string;
  size?: "default" | "large";
}

function MicIcon({ className }: { className?: string }) {
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
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function MicButton({
  listening = false,
  onClick,
  className = "",
}: MicButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse ring: ONLY renders and animates when listening is true and reduced motion is disabled */}
      {listening && !shouldReduceMotion && (
        <>
          <motion.div
            className="absolute -inset-3 rounded-full bg-primary/20 pointer-events-none"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.15, 0.6] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute -inset-6 rounded-full bg-primary/10 pointer-events-none"
            initial={{ scale: 1, opacity: 0.4 }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.4, 0.05, 0.4] }}
            transition={{
              duration: 2,
              delay: 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Main button: static when idle */}
      <motion.button
        id="mic-button"
        type="button"
        onClick={onClick}
        aria-pressed={listening}
        aria-label={
          listening
            ? "सुन रहा है... रोकने के लिए टैप करें (Listening... tap to stop)"
            : "बोलने के लिए टैप करें (Tap to speak)"
        }
        whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full text-primary-foreground shadow-lg transition-colors duration-200 cursor-pointer focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none ${
          listening
            ? "bg-primary shadow-primary/40 ring-4 ring-primary/30"
            : "bg-primary shadow-primary/25 hover:bg-primary/95"
        } ${className}`}
      >
        <MicIcon className="w-10 h-10" />
      </motion.button>
    </div>
  );
}
