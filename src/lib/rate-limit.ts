import { NextRequest } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Extracts client IP from standard proxy headers
 */
export function extractClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return "127.0.0.1";
}

/**
 * DB-backed rate limiting & quota enforcement.
 * Inserts hit record into public.rate_limit_hits via server-side procedure BEFORE calling Gemini.
 * Evaluates:
 * - Per-user: max 10/min
 * - Per-IP: max 15/min
 * - Global Daily Cap: AI_DAILY_CAP (defaults to 200) for the current UTC day
 */
export async function recordAndCheckDbRateLimit(
  supabase: SupabaseClient,
  userId: string,
  ip: string
): Promise<{
  allowed: boolean;
  code?: string;
  error?: string;
  count?: number;
  cap?: number;
}> {
  const cap = parseInt(process.env.AI_DAILY_CAP || "200", 10);

  // Call the database procedure
  const { data, error } = await supabase.rpc("record_and_check_rate_limit", {
    p_user_id: userId,
    p_ip: ip,
    p_daily_cap: cap,
  });

  if (error) {
    // If migration 002 is not yet applied, fallback to direct query or non-blocking pass-through
    console.error("DB rate limit RPC error:", error.message);
    if (error.message.includes("does not exist") || error.message.includes("could not find function")) {
      return { allowed: true, cap };
    }
    return {
      allowed: false,
      code: "RATE_LIMIT_CHECK_FAILED",
      error: `Rate limit check failed: ${error.message}`,
    };
  }

  if (data && typeof data === "object") {
    const res = data as {
      allowed: boolean;
      code?: string;
      error?: string;
      count?: number;
      cap?: number;
    };
    return {
      allowed: Boolean(res.allowed),
      code: res.code,
      error: res.error,
      count: res.count,
      cap: res.cap || cap,
    };
  }

  return { allowed: true, cap };
}
