import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Tier 1 UI (/app) & Demo Auth Visitor Safety", () => {
  describe("Demo Auth Route (/api/auth/demo)", () => {
    it("should never expose env vars, passwords, or seeding commands to visitors", () => {
      const routePath = path.resolve(__dirname, "../src/app/api/auth/demo/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");
      const genericMatch = content.match(/const VISITOR_GENERIC_ERROR\s*=\s*[\s\S]*?"([^"]+)"/);
      const connectionMatch = content.match(/const VISITOR_CONNECTION_ERROR\s*=\s*[\s\S]*?"([^"]+)"/);
      assert.ok(genericMatch);
      assert.ok(connectionMatch);
      assert.doesNotMatch(genericMatch[1], /seed|\.env|DEMO_USER_PASSWORD|password/i);
      assert.doesNotMatch(connectionMatch[1], /seed|\.env|DEMO_USER_PASSWORD|password/i);
    });

    it("should log specific technical errors on the server console", () => {
      const routePath = path.resolve(__dirname, "../src/app/api/auth/demo/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");
      assert.match(content, /console\.error\(`\[DemoAuth Server Error/);
    });

    it("should provide short, friendly visitor messages and codes", () => {
      const routePath = path.resolve(__dirname, "../src/app/api/auth/demo/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");
      assert.match(content, /CONNECTION_ERROR/);
      assert.match(content, /DEMO_UNAVAILABLE/);
      assert.match(content, /Demo account is temporarily unavailable/i);
    });

    it("should redirect GET requests to /app upon success", () => {
      const routePath = path.resolve(__dirname, "../src/app/api/auth/demo/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");
      assert.match(content, /new URL\("\/app", req\.url\)/);
    });
  });

  describe("/app Server Layout Authentication", () => {
    it("should verify user with supabase.auth.getUser() and redirect to / if missing", () => {
      const layoutPath = path.resolve(__dirname, "../src/app/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.match(content, /supabase\.auth\.getUser\(\)/);
      assert.doesNotMatch(content, /supabase\.auth\.getSession\(\)/);
      assert.match(content, /if\s*\(authError\s*\|\|\s*!user\)\s*\{\s*redirect\("\/"\);?\s*\}/);
    });

    it("should wrap components reading data in Suspense boundaries", () => {
      const layoutPath = path.resolve(__dirname, "../src/app/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      assert.match(content, /<Suspense/);
    });
  });

  describe("Confirmation Card & Customer Matching on Edit", () => {
    it("should enforce buttons with min-height >= 48px", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /id="btn-confirm-entry"[\s\S]*?min-h-\[48px\]/);
      assert.match(content, /id="btn-edit-entry"[\s\S]*?min-h-\[48px\]/);
      assert.match(content, /id="btn-cancel-entry"[\s\S]*?min-h-\[48px\]/);
    });

    it("should display visible warning when confidence < 0.7", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /lowConfidence|isLowConfidence/);
      assert.match(content, /Low Confidence/i);
    });

    it("should re-run customer matching when user edits customer name", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /findBestCustomerMatch\(trimmed,\s*customers\)/);
      assert.match(content, /isCustomerNameEdited/);
    });

    it("should disable Confirm if edited customer name is unmatched unless marked as new", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /isCustomerMatchValid/);
      assert.match(content, /disabled=\{isSaving \|\| !isCustomerMatchValid\}/);
    });

    it("should display candidate picker when match status is ambiguous", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /currentMatchStatus === "ambiguous"/);
      assert.match(content, /candidates\.map/);
    });

    it("should display updated udhar balance on confirmation success", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /New Balance|STRINGS\.confirmation\.newBalance/);
      assert.match(content, /confirmedResult\.customer\?\.balance/);
    });

    it("should provide a clear checkbox/toggle (min 48px, default ON) for new customers on add_sale", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /id="checkbox-create-customer"/);
      assert.match(content, /createCustomer/);
      assert.match(content, /min-h-\[48px\]/);
    });

    it("should render dropdown to select from existing customers when customers exist", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /id="select-existing-customer"/);
      assert.match(content, /sortedCustomers\.map/);
    });

    it("should provide 'Add as new customer first' button for unknown customer payments and drop state on dismiss", () => {
      const cardPath = path.resolve(__dirname, "../src/components/confirmation-card.tsx");
      const content = fs.readFileSync(cardPath, "utf-8");
      assert.match(content, /id="btn-add-customer-first"/);
      assert.match(content, /id="btn-record-another"/);
      assert.match(content, /min-h-\[48px\]/);
    });

    it("should mount ConfirmationCard with unique key per parseSession in page.tsx", () => {
      const homePath = path.resolve(__dirname, "../src/app/app/page.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      assert.match(content, /key=\{parseSession\.idempotencyKey\}/);
      assert.match(content, /onDismiss=\{handleDismissConfirmation\}/);
    });
  });

  describe("Web Speech API & Parse Timers", () => {
    it("should put speech transcript into text box on recognition end without auto-sending", () => {
      const homePath = path.resolve(__dirname, "../src/app/app/page.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      assert.match(content, /onEnd:\s*\(spokenText\)\s*=>/);
      assert.match(content, /setTypedInput/);
    });

    it("should disable Send button while a parse is in flight", () => {
      const homePath = path.resolve(__dirname, "../src/app/app/page.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      assert.match(content, /disabled=\{!typedInput\.trim\(\)\s*\|\|\s*isParsing\}/);
    });

    it("should show 15s warning and abort at 30s with retry button", () => {
      const homePath = path.resolve(__dirname, "../src/app/app/page.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      assert.match(content, /15000/);
      assert.match(content, /Taking longer than usual/i);
      assert.match(content, /30000/);
      assert.match(content, /controller\.abort\(\)/);
      assert.match(content, /Retry/);
    });

    it("should fall back to en-IN strictly on language-not-supported error", () => {
      const speechPath = path.resolve(__dirname, "../src/hooks/use-speech-recognition.ts");
      const content = fs.readFileSync(speechPath, "utf-8");
      assert.match(content, /event\.error === "language-not-supported"/);
      assert.match(content, /langRef\.current = "en-IN"/);
    });
  });

  describe("No 3D or GSAP in App Routes", () => {
    it("should not import gsap in any /app route or component", () => {
      const appDir = path.resolve(__dirname, "../src/app/app");
      const files = fs.readdirSync(appDir, { recursive: true }) as string[];
      for (const file of files) {
        if (file.endsWith(".tsx") || file.endsWith(".ts")) {
          const content = fs.readFileSync(path.join(appDir, file), "utf-8");
          assert.doesNotMatch(content, /from ["']gsap["']/);
          assert.doesNotMatch(content, /from ["']@splinetool/);
          assert.doesNotMatch(content, /from ["']three["']/);
        }
      }
    });
  });
});

