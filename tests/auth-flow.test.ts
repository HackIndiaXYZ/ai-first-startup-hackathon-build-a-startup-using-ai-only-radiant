import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSafeRedirectPath, formatOAuthError } from "../src/lib/auth-helpers";

describe("Phase 4: Google Sign-In & Auth Flow Architecture", () => {
  const rootDir = process.cwd();

  const loginPagePath = path.join(rootDir, "src/app/login/page.tsx");
  const authCallbackPath = path.join(rootDir, "src/app/auth/callback/route.ts");
  const migration003Path = path.join(
    rootDir,
    "supabase/migrations/003_new_user_shop.sql"
  );
  const homePagePath = path.join(rootDir, "src/app/app/page.tsx");
  const ledgerPagePath = path.join(rootDir, "src/app/app/ledger/page.tsx");
  const stockPagePath = path.join(rootDir, "src/app/app/stock/page.tsx");
  const settingsPagePath = path.join(rootDir, "src/app/app/settings/page.tsx");
  const demoAuthBtnPath = path.join(
    rootDir,
    "src/components/landing/demo-auth-button.tsx"
  );

  const loginSrc = fs.readFileSync(loginPagePath, "utf-8");
  const callbackSrc = fs.readFileSync(authCallbackPath, "utf-8");
  const migration003Src = fs.readFileSync(migration003Path, "utf-8");
  const homePageSrc = fs.readFileSync(homePagePath, "utf-8");
  const ledgerPageSrc = fs.readFileSync(ledgerPagePath, "utf-8");
  const stockPageSrc = fs.readFileSync(stockPagePath, "utf-8");
  const settingsPageSrc = fs.readFileSync(settingsPagePath, "utf-8");
  const demoAuthBtnSrc = fs.readFileSync(demoAuthBtnPath, "utf-8");

  describe("1. Open Redirect Protection (getSafeRedirectPath)", () => {
    it("allows valid relative same-site paths", () => {
      assert.equal(getSafeRedirectPath("/app"), "/app");
      assert.equal(getSafeRedirectPath("/app/ledger"), "/app/ledger");
      assert.equal(getSafeRedirectPath("/app/stock"), "/app/stock");
      assert.equal(getSafeRedirectPath("/app/settings"), "/app/settings");
      assert.equal(getSafeRedirectPath("/app?tab=recent"), "/app?tab=recent");
    });

    it("blocks protocol-relative URLs (//evil.com)", () => {
      assert.equal(getSafeRedirectPath("//evil.com"), "/app");
      assert.equal(getSafeRedirectPath("//google.com/login"), "/app");
    });

    it("blocks backslash evasion (/\\evil.com)", () => {
      assert.equal(getSafeRedirectPath("/\\evil.com"), "/app");
      assert.equal(getSafeRedirectPath("/test\\evil.com"), "/app");
    });

    it("blocks absolute URLs and foreign schemes (http:, https:, javascript:)", () => {
      assert.equal(getSafeRedirectPath("https://attacker.com/app"), "/app");
      assert.equal(getSafeRedirectPath("http://evil.org"), "/app");
      assert.equal(getSafeRedirectPath("javascript:alert(1)"), "/app");
      assert.equal(getSafeRedirectPath("data:text/html,..."), "/app");
    });

    it("falls back safely to default when input is null, undefined, or empty", () => {
      assert.equal(getSafeRedirectPath(null), "/app");
      assert.equal(getSafeRedirectPath(undefined), "/app");
      assert.equal(getSafeRedirectPath(""), "/app");
      assert.equal(getSafeRedirectPath("   "), "/app");
    });
  });

  describe("2. Friendly OAuth Error Formatter (formatOAuthError)", () => {
    it("formats user cancellation and access_denied into reassuring message", () => {
      const err = formatOAuthError("access_denied", "User cancelled consent");
      assert.ok(err);
      assert.match(err.title, /Sign-In Cancelled/i);
      assert.match(err.message, /cancelled/i);
    });

    it("formats connection and network timeouts cleanly", () => {
      const err = formatOAuthError("network_error", "Failed to fetch");
      assert.ok(err);
      assert.match(err.title, /Connection Error/i);
      assert.match(err.message, /connection/i);
    });

    it("formats code exchange failures cleanly", () => {
      const err = formatOAuthError("exchange_failed", "Auth code expired");
      assert.ok(err);
      assert.match(err.title, /Authentication Failed/i);
    });

    it("returns null when no error is present", () => {
      assert.equal(formatOAuthError(null), null);
      assert.equal(formatOAuthError(undefined), null);
    });
  });

  describe("3. /login Page Structure & Security Guards", () => {
    it("renders large Google sign-in button with required copy", () => {
      assert.ok(
        loginSrc.includes("btn-google-signin"),
        "Google sign in button with id btn-google-signin must exist"
      );
      assert.ok(
        loginSrc.includes("Continue with Google"),
        "Must contain Google CTA copy"
      );
      assert.ok(
        loginSrc.includes("min-h-[54px]") || loginSrc.includes("min-h-[48px]"),
        "Google button must have large tap target >= 48px"
      );
    });

    it("renders existing Try Demo button with no-signup access", () => {
      assert.ok(
        loginSrc.includes("btn-demo-signin"),
        "Try demo button with id btn-demo-signin must exist"
      );
      assert.ok(
        loginSrc.includes("Try Demo"),
        "Demo CTA must be present"
      );
      assert.ok(
        loginSrc.includes("/api/auth/demo"),
        "Demo button must call /api/auth/demo"
      );
    });

    it("wraps request-time searchParams reading in <Suspense>", () => {
      assert.ok(
        loginSrc.includes("<Suspense"),
        "LoginPage must wrap data-reading components in <Suspense> for Next.js 16 Cache Components"
      );
      assert.ok(
        loginSrc.includes("useSearchParams()"),
        "useSearchParams must be used inside the Suspense boundary"
      );
    });

    it("strictly excludes email/password, Facebook, and Apple authentication", () => {
      assert.doesNotMatch(
        loginSrc,
        /type=["']password["']/i,
        "No password input allowed on login page"
      );
      assert.doesNotMatch(
        loginSrc,
        /facebook/i,
        "No Facebook login allowed on login page"
      );
      assert.doesNotMatch(
        loginSrc,
        /apple/i,
        "No Apple sign-in allowed on login page"
      );
    });

    it("displays honest, dismissible error banner when sign-in fails or is cancelled", () => {
      assert.ok(
        loginSrc.includes("alert-auth-error"),
        "Error alert container must exist"
      );
      assert.ok(
        loginSrc.includes("localError"),
        "Local error state should govern error rendering"
      );
    });
  });

  describe("4. /auth/callback Route Handler", () => {
    it("exchanges OAuth code for session using @supabase/ssr", () => {
      assert.ok(
        callbackSrc.includes("supabase.auth.exchangeCodeForSession(code)"),
        "Must exchange OAuth code using exchangeCodeForSession"
      );
      assert.ok(
        callbackSrc.includes("createClient"),
        "Must instantiate server client via createClient"
      );
    });

    it("enforces relative same-site redirect only (blocks open redirects)", () => {
      assert.ok(
        callbackSrc.includes("getSafeRedirectPath"),
        "Must sanitize redirect path using getSafeRedirectPath"
      );
    });

    it("redirects OAuth errors back to /login with error query params", () => {
      assert.ok(
        callbackSrc.includes('loginUrl.searchParams.set("error"'),
        "Must preserve error param when redirecting to /login"
      );
    });
  });

  describe("5. Migration 003_new_user_shop.sql", () => {
    it("creates trigger on auth.users AFTER INSERT", () => {
      assert.ok(
        migration003Src.includes("create trigger on_auth_user_created"),
        "Must declare trigger on_auth_user_created"
      );
      assert.ok(
        migration003Src.includes("after insert on auth.users"),
        "Trigger must be AFTER INSERT on auth.users"
      );
    });

    it("creates handle_new_user function as SECURITY DEFINER with search_path = public", () => {
      assert.ok(
        migration003Src.includes("create or replace function public.handle_new_user()"),
        "Must define handle_new_user function"
      );
      assert.ok(
        migration003Src.includes("security definer"),
        "Function must be SECURITY DEFINER"
      );
      assert.ok(
        migration003Src.includes("set search_path = public"),
        "Function must enforce set search_path = public"
      );
    });

    it("sets default shop name to 'मेरी दुकान / My Dukaan' and handles duplicates safely", () => {
      assert.ok(
        migration003Src.includes("मेरी दुकान / My Dukaan"),
        "Must set default shop name to 'मेरी दुकान / My Dukaan'"
      );
      assert.ok(
        migration003Src.includes("if not exists"),
        "Must check if not exists to handle duplicates safely"
      );
    });

    it("revokes execute from public, anon, and authenticated", () => {
      assert.ok(
        migration003Src.includes(
          "revoke all on function public.handle_new_user() from public, anon, authenticated"
        ),
        "Must revoke execute on handle_new_user from anon/authenticated"
      );
    });

    it("defines load_sample_data RPC as SECURITY INVOKER", () => {
      assert.ok(
        migration003Src.includes(
          "create or replace function public.load_sample_data()"
        ),
        "Must define load_sample_data RPC"
      );
      assert.ok(
        migration003Src.includes("security invoker"),
        "load_sample_data must be SECURITY INVOKER"
      );
      assert.ok(
        migration003Src.includes("grant execute on function public.load_sample_data() to authenticated"),
        "Must grant execute on load_sample_data to authenticated users"
      );
    });

    it("ends with notify pgrst, 'reload schema'", () => {
      assert.ok(
        migration003Src.trim().endsWith("notify pgrst, 'reload schema';"),
        "Migration must end with notify pgrst, 'reload schema';"
      );
    });
  });

  describe("6. Empty States & Sample Data Loader on Screens", () => {
    it("Dashboard (/app) contains hint 'Say your first sale to get started' and Load sample data button", () => {
      assert.ok(
        homePageSrc.includes("Say your first sale to get started"),
        "Home page must display 'Say your first sale to get started' hint"
      );
      assert.ok(
        homePageSrc.includes("btn-load-sample-data"),
        "Home page must include btn-load-sample-data button"
      );
      assert.ok(
        homePageSrc.includes("load_sample_data"),
        "Home page must call load_sample_data RPC"
      );
    });

    it("Ledger (/app/ledger) contains hint 'Say your first sale to get started' and Load sample data button", () => {
      assert.ok(
        ledgerPageSrc.includes("Say your first sale to get started"),
        "Ledger page must display 'Say your first sale to get started' hint"
      );
      assert.ok(
        ledgerPageSrc.includes("btn-load-sample-data-ledger"),
        "Ledger page must include btn-load-sample-data-ledger button"
      );
    });

    it("Stock (/app/stock) contains hint 'Say your first sale to get started' and Load sample data button", () => {
      assert.ok(
        stockPageSrc.includes("Say your first sale to get started"),
        "Stock page must display 'Say your first sale to get started' hint"
      );
      assert.ok(
        stockPageSrc.includes("btn-load-sample-data-stock"),
        "Stock page must include btn-load-sample-data-stock button"
      );
      assert.ok(
        stockPageSrc.includes("<Suspense"),
        "Stock page must wrap content in <Suspense>"
      );
    });
  });

  describe("7. Dual Sign Out & Account Provider Awareness", () => {
    it("Settings sign-out triggers both client Supabase and server /api/auth/signout", () => {
      assert.ok(
        settingsPageSrc.includes("supabase.auth.signOut()"),
        "Must invoke supabase.auth.signOut() on client"
      );
      assert.ok(
        settingsPageSrc.includes("/api/auth/signout"),
        "Must invoke /api/auth/signout route handler"
      );
    });

    it("Settings displays Google Account for Google users and Demo Account for demo users", () => {
      assert.ok(
        settingsPageSrc.includes("Google Account"),
        "Must show Google Account for Google users"
      );
      assert.ok(
        settingsPageSrc.includes("Demo Account"),
        "Must show Demo Account for demo users"
      );
    });
  });

  describe("8. Landing Page Buttons Link to /login", () => {
    it("landing page demo button links to /login when unauthenticated", () => {
      assert.ok(
        demoAuthBtnSrc.includes('href="/login"'),
        "Unauthenticated button must link to /login"
      );
      assert.ok(
        demoAuthBtnSrc.includes("id=\"btn-try-demo\""),
        "Landing button maintains id btn-try-demo"
      );
    });
  });
});
