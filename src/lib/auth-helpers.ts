/**
 * Auth & Redirect Security Helpers
 * Protects against open-redirect vulnerabilities and normalizes OAuth errors.
 */

/**
 * Validates that a redirect path is strictly a relative, same-site path.
 * Blocks protocol-relative URLs (//evil.com), backslash evasion (/\\evil.com),
 * and URLs with embedded protocols (javascript:, https:).
 */
export function getSafeRedirectPath(
  rawPath: string | null | undefined,
  fallback = "/app"
): string {
  if (!rawPath) return fallback;

  const trimmed = rawPath.trim();

  // Must begin with a single '/' and NOT '//' or '/\'
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    trimmed.includes("\r") ||
    trimmed.includes("\n")
  ) {
    return fallback;
  }

  // Ensure no protocol prefix before any query string or hash
  const pathPart = trimmed.split(/[?#]/)[0];
  if (pathPart.includes(":")) {
    return fallback;
  }

  return trimmed;
}

export interface FriendlyAuthError {
  title: string;
  message: string;
}

/**
 * Translates OAuth errors into clear, friendly English messages.
 */
export function formatOAuthError(
  error: string | null | undefined,
  errorDescription?: string | null | undefined
): FriendlyAuthError | null {
  if (!error) return null;

  const lower = (error + " " + (errorDescription || "")).toLowerCase();

  if (
    lower.includes("access_denied") ||
    lower.includes("cancelled") ||
    lower.includes("canceled") ||
    lower.includes("user_denied")
  ) {
    return {
      title: "Sign-In Cancelled",
      message:
        "Google sign-in was cancelled. You can try again anytime or explore the instant demo.",
    };
  }

  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return {
      title: "Connection Error",
      message:
        "Unable to reach authentication server. Please check your internet connection and try again.",
    };
  }

  if (lower.includes("exchange_failed") || lower.includes("code_exchange")) {
    return {
      title: "Authentication Failed",
      message:
        "Could not establish session from OAuth code. Please try signing in again.",
    };
  }

  return {
    title: "Sign-In Issue",
    message:
      errorDescription ||
      "Unable to complete Google sign-in. Please try again.",
  };
}
