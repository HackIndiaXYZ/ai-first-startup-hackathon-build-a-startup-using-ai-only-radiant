"use client";

import { Suspense, useEffect, useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectPath, formatOAuthError } from "@/lib/auth-helpers";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawNext = searchParams.get("next");
  const safeNext = getSafeRedirectPath(rawNext, "/app");

  // Derive URL error without setting state in useEffect
  const urlError = useMemo(() => {
    const errorParam = searchParams.get("error");
    const errorDescParam = searchParams.get("error_description");
    return errorParam ? formatOAuthError(errorParam, errorDescParam) : null;
  }, [searchParams]);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [dismissedUrlError, setDismissedUrlError] = useState(false);
  const [localError, setLocalError] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [isDemoPending, startDemoTransition] = useTransition();

  const activeError = localError || (dismissedUrlError ? null : urlError);

  // If already authenticated, redirect straight to target destination
  useEffect(() => {
    let ignore = false;
    async function checkExistingAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && !ignore) {
          router.replace(safeNext);
        }
      } catch {
        // Not authenticated, stay on login page
      }
    }
    checkExistingAuth();
    return () => {
      ignore = true;
    };
  }, [router, safeNext]);

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
        },
      });

      if (error) {
        setIsGoogleLoading(false);
        setLocalError(formatOAuthError(error.message));
      }
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      const msg = err instanceof Error ? err.message : "Network error";
      setLocalError({
        title: "कनेक्शन त्रुटि (Connection Error)",
        message: `लॉगिन सेवा से संपर्क नहीं हो सका: ${msg}`,
      });
    }
  };

  const handleDemoSignIn = () => {
    setLocalError(null);
    startDemoTransition(async () => {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();

        if (!res.ok) {
          setLocalError({
            title: "डेमो त्रुटि (Demo Unavailable)",
            message:
              data.error ||
              "डेमो खाता इस समय अनुपलब्ध है। कृपया कुछ देर बाद पुनः प्रयास करें।",
          });
        } else {
          router.push(safeNext);
          router.refresh();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error";
        setLocalError({
          title: "कनेक्शन त्रुटि (Connection Error)",
          message: `डेमो लॉगिन विफल रहा: ${msg}`,
        });
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <Link
          href="/"
          className="flex items-center gap-3 mb-4 group min-h-[48px] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611]"
          aria-label="DukaanAI Home"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-amber-500 p-0.5 shadow-lg shadow-violet-900/50 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0b091a] rounded-[14px] flex items-center justify-center text-2xl font-black text-white">
              द
            </div>
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            Dukaan<span className="text-violet-400">AI</span>
          </span>
        </Link>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          दुकान में लॉगिन करें
        </h1>
        <p className="text-sm text-white/70 mt-1.5 max-w-xs">
          अपनी दुकान से बात करें। DukaanAI रखेगा पूरा हिसाब।
        </p>
      </div>

      {/* Main Glassmorphic Auth Card */}
      <div className="rounded-3xl bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-white/[0.01] border border-white/15 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/80 flex flex-col gap-5">
        {/* Friendly Honest Error Banner */}
        {activeError && (
          <div
            id="alert-auth-error"
            role="alert"
            className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex flex-col gap-1.5 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between font-bold text-rose-300">
              <div className="flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{activeError.title}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  setDismissedUrlError(true);
                }}
                className="text-rose-300 hover:text-white text-sm font-bold px-1.5 py-0.5 cursor-pointer rounded"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
            <p className="leading-relaxed opacity-90">{activeError.message}</p>
          </div>
        )}

        {/* Primary Action: Large Continue with Google Button */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            id="btn-google-signin"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isDemoPending}
            className="w-full inline-flex items-center justify-center gap-3 px-5 py-4 text-base font-bold text-gray-900 bg-white hover:bg-gray-100 active:bg-gray-200 rounded-2xl shadow-lg shadow-white/10 hover:shadow-white/20 active:scale-[0.98] transition-all min-h-[54px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611] disabled:opacity-60 disabled:pointer-events-none"
          >
            {isGoogleLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-gray-800"
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
                <span>Google से जुड़ रहे हैं... (Connecting...)</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Continue with Google / Google से जारी रखें</span>
              </>
            )}
          </button>
          <span className="text-[11px] text-center text-white/50">
            सुरक्षित एवं त्वरित • पासवर्ड की आवश्यकता नहीं
          </span>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-1">
          <div className="w-full border-t border-white/10" />
          <span className="absolute bg-[#0b091a] px-3 text-xs text-white/50 uppercase tracking-widest font-semibold">
            या (or)
          </span>
        </div>

        {/* Secondary Action: 1-Click Instant Demo Access */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            id="btn-demo-signin"
            onClick={handleDemoSignIn}
            disabled={isGoogleLoading || isDemoPending}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] rounded-2xl border border-violet-400/30 shadow-lg shadow-violet-900/30 hover:shadow-violet-700/50 transition-all min-h-[50px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070611] disabled:opacity-60 disabled:pointer-events-none group"
          >
            {isDemoPending ? (
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
                <span>डेमो खाता शुरू हो रहा है...</span>
              </>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="text-amber-400 group-hover:scale-110 transition-transform"
                >
                  ✨
                </span>
                <span>डेमो आज़माएँ (बिना साइनअप) / Try Demo</span>
                <span
                  aria-hidden="true"
                  className="text-white/60 group-hover:translate-x-0.5 transition-transform"
                >
                  →
                </span>
              </>
            )}
          </button>
          <span className="text-[11px] text-center text-white/50">
            हैकथॉन जजों के लिए तैयार नमूना डेटा के साथ सीधा प्रवेश
          </span>
        </div>

        {/* Security & Isolation Footnote */}
        <div className="pt-2 border-t border-white/10 flex flex-col gap-1 text-[11px] text-white/60 text-center">
          <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-medium">
            <span>🔒</span>
            <span>100% सुरक्षित • RLS डेटा सुरक्षा</span>
          </div>
          <p>
            कोई ईमेल/पासवर्ड या अन्य सोशल लॉगिन नहीं। केवल आधिकारिक Google साइन-इन या डेमो।
          </p>
        </div>
      </div>

      {/* Return to Landing */}
      <div className="text-center mt-6">
        <Link
          href="/"
          id="link-back-home"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors min-h-[44px] px-3 py-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span>← वापस मुख्य पृष्ठ (Home)</span>
        </Link>
      </div>
    </div>
  );
}

function LoginLoadingSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 animate-pulse">
      <div className="flex flex-col items-center mb-8 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/10" />
        <div className="w-48 h-8 rounded-xl bg-white/10" />
        <div className="w-64 h-4 rounded-lg bg-white/10" />
      </div>
      <div className="rounded-3xl bg-white/5 border border-white/10 p-8 flex flex-col gap-4">
        <div className="w-full h-14 rounded-2xl bg-white/10" />
        <div className="w-full h-12 rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full bg-[#070611] text-white flex items-center justify-center px-4 py-12 relative overflow-hidden selection:bg-violet-500/30 selection:text-white font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-violet-600/20 via-indigo-600/15 to-amber-500/10 blur-[140px] pointer-events-none -z-10" />

      {/* Suspense boundary wrapping request-time searchParams reading */}
      <Suspense fallback={<LoginLoadingSkeleton />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
