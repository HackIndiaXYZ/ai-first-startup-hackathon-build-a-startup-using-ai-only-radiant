import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const rawNext = requestUrl.searchParams.get("next");

  // Enforce same-site relative redirect only (blocks open redirects)
  const next = getSafeRedirectPath(rawNext, "/app");

  // Determine correct base URL across local dev and Vercel deployments
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : requestUrl.origin;

  // Handle OAuth provider error (e.g. user cancelled Google consent)
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Handle authorization code exchange
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(new URL(next, origin));
    }

    // Exchange failed (code expired, invalid, or already used)
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "exchange_failed");
    loginUrl.searchParams.set(
      "error_description",
      exchangeError.message ||
        "कोड विनिमय विफल रहा (Failed to exchange authorization code for session)"
    );
    return NextResponse.redirect(loginUrl);
  }

  // Fallback: No code or error query param
  return NextResponse.redirect(new URL("/login", origin));
}
