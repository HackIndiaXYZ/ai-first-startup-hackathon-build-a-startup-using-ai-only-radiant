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
 * Translates OAuth errors into clear, friendly Hindi + English messages.
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
      title: "साइन-इन रद्द किया गया (Sign-In Cancelled)",
      message:
        "Google साइन-इन प्रक्रिया रद्द कर दी गई। आप जब चाहें दोबारा कोशिश कर सकते हैं या डेमो देख सकते हैं। (Google sign-in was cancelled. You can try again anytime or explore the instant demo.)",
    };
  }

  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return {
      title: "कनेक्शन त्रुटि (Connection Error)",
      message:
        "सर्वर से संपर्क नहीं हो सका। कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें। (Unable to reach authentication server. Please check your internet connection.)",
    };
  }

  if (lower.includes("exchange_failed") || lower.includes("code_exchange")) {
    return {
      title: "प्रमाणीकरण विफल (Authentication Failed)",
      message:
        "सत्र स्थापित नहीं हो सका। कृपया दोबारा लॉगिन करें। (Could not establish session from OAuth code. Please try signing in again.)",
    };
  }

  return {
    title: "साइन-इन में समस्या (Sign-In Issue)",
    message:
      errorDescription ||
      "Google साइन-इन पूरा नहीं हो सका। कृपया पुनः प्रयास करें। (Unable to complete Google sign-in. Please try again.)",
  };
}
