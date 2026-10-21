"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface DemoAuthButtonProps {
  className?: string;
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  directDemo?: boolean;
}

export function DemoAuthButton({
  className = "",
  size = "default",
  showIcon = true,
  directDemo = false,
}: DemoAuthButtonProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;
    async function checkAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!ignore) {
          setIsAuthenticated(Boolean(user));
        }
      } catch {
        if (!ignore) {
          setIsAuthenticated(false);
        }
      }
    }
    checkAuth();
    return () => {
      ignore = true;
    };
  }, []);

  const handleDirectDemoSignIn = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "डेमो लॉगिन विफल रहा (Demo login failed)");
        } else {
          router.push("/app");
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setErrorMsg(`कनेक्शन त्रुटि: ${msg}`);
      }
    });
  };

  const sizeClasses = {
    sm: "px-4 py-2.5 text-xs rounded-xl min-h-[48px] min-w-[48px]",
    default: "px-5 py-3 text-sm rounded-xl min-h-[48px] min-w-[48px]",
    lg: "px-7 py-3.5 text-base rounded-2xl min-h-[52px] min-w-[48px]",
  }[size];

  const focusClasses =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]";

  // While checking auth status
  if (isAuthenticated === null) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center justify-center font-bold bg-violet-600/60 text-white/80 opacity-70 cursor-wait transition-all shadow-lg shadow-violet-950/40 ${focusClasses} ${sizeClasses} ${className}`}
      >
        <span>लोड हो रहा है...</span>
      </button>
    );
  }

  // When already authenticated, go directly to shop
  if (isAuthenticated) {
    return (
      <Link
        href="/app"
        id="btn-go-to-shop"
        className={`inline-flex items-center justify-center gap-2 font-bold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 active:scale-[0.98] transition-all cursor-pointer border border-white/10 ${focusClasses} ${sizeClasses} ${className}`}
      >
        <span>दुकान में जाएं / Go to Shop</span>
        <span aria-hidden="true" className="text-amber-400">
          →
        </span>
      </Link>
    );
  }

  // If direct demo requested
  if (directDemo) {
    return (
      <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
        <button
          type="button"
          id="btn-try-demo-direct"
          onClick={handleDirectDemoSignIn}
          disabled={isPending}
          className={`inline-flex items-center justify-center gap-2 font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-700/30 hover:shadow-violet-600/50 active:scale-[0.98] transition-all cursor-pointer border border-violet-400/30 disabled:opacity-60 disabled:pointer-events-none group ${focusClasses} ${sizeClasses} ${className}`}
        >
          {isPending ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>लॉगिन हो रहा है... (Starting demo...)</span>
            </>
          ) : (
            <>
              {showIcon && (
                <span
                  aria-hidden="true"
                  className="text-amber-400 group-hover:scale-110 transition-transform duration-200"
                >
                  ✨
                </span>
              )}
              <span>डेमो आज़माएँ / Try demo</span>
              <span
                aria-hidden="true"
                className="group-hover:translate-x-0.5 transition-transform text-white/70"
              >
                →
              </span>
            </>
          )}
        </button>

        {errorMsg && (
          <span className="text-xs text-rose-400 font-medium px-2 py-0.5 bg-rose-500/10 rounded-md border border-rose-500/20">
            {errorMsg}
          </span>
        )}
      </div>
    );
  }

  // Standard landing page action: Links to /login where Google sign-in and Try demo are available
  return (
    <div className="flex flex-col items-center gap-1 w-full sm:w-auto">
      <Link
        href="/login"
        id="btn-try-demo"
        className={`inline-flex items-center justify-center gap-2 font-bold bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-xl shadow-violet-700/30 hover:shadow-violet-600/50 active:scale-[0.98] transition-all cursor-pointer border border-violet-400/30 group ${focusClasses} ${sizeClasses} ${className}`}
      >
        {showIcon && (
          <span
            aria-hidden="true"
            className="text-amber-400 group-hover:scale-110 transition-transform duration-200"
          >
            ✨
          </span>
        )}
        <span>डेमो आज़माएँ / Try demo</span>
        <span
          aria-hidden="true"
          className="group-hover:translate-x-0.5 transition-transform text-white/70"
        >
          →
        </span>
      </Link>
    </div>
  );
}

export function DemoButtonSkeleton({
  size = "default",
}: {
  size?: "sm" | "default" | "lg";
}) {
  const sizeClasses = {
    sm: "w-32 h-[48px] rounded-xl",
    default: "w-44 h-[48px] rounded-xl",
    lg: "w-56 h-[52px] rounded-2xl",
  }[size];

  return (
    <div
      className={`bg-white/10 animate-pulse border border-white/10 ${sizeClasses}`}
    />
  );
}
