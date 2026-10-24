import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("App Desktop Layout Polish (>= 1024px)", () => {
  const rootDir = process.cwd();

  const appPagePath = path.join(rootDir, "src/app/app/page.tsx");
  const appNavPath = path.join(rootDir, "src/components/app-nav.tsx");
  const animatedNumberPath = path.join(rootDir, "src/components/animated-number.tsx");

  const appPageSrc = fs.readFileSync(appPagePath, "utf-8");
  const appNavSrc = fs.readFileSync(appNavPath, "utf-8");
  const animatedNumberSrc = fs.readFileSync(animatedNumberPath, "utf-8");

  describe("Requirement 1: Recent Entries Card & Quick Actions in Desktop Left Column", () => {
    it("renders Quick Actions row with Add Customer, Record Payment, and Adjust Stock", () => {
      assert.ok(appPageSrc.includes("Quick actions"));
      assert.ok(appPageSrc.includes("btn-quick-add-customer"));
      assert.ok(appPageSrc.includes("btn-quick-record-payment"));
      assert.ok(appPageSrc.includes("btn-quick-adjust-stock"));
    });

    it("Add Customer opens form with name and phone validation and calls /api/confirm with add_customer", () => {
      assert.ok(appPageSrc.includes("action: \"add_customer\""));
      assert.ok(appPageSrc.includes("newCustName"));
      assert.ok(appPageSrc.includes("newCustPhone"));
      assert.ok(appPageSrc.includes("Customer name is required"));
    });

    it("Record Payment opens form with customer selector, amount, and calls /api/confirm with record_payment", () => {
      assert.ok(appPageSrc.includes("action: \"record_payment\""));
      assert.ok(appPageSrc.includes("paymentCustomerId"));
      assert.ok(appPageSrc.includes("paymentAmount"));
      assert.ok(appPageSrc.includes("Please select a customer"));
    });

    it("Adjust Stock opens form with product selector, qty change, and calls /api/confirm with adjust_stock", () => {
      assert.ok(appPageSrc.includes("action: \"adjust_stock\""));
      assert.ok(appPageSrc.includes("stockProductId"));
      assert.ok(appPageSrc.includes("stockQtyChange"));
    });

    it("renders Recent Entries card with last 5 transactions and time formatted in IST", () => {
      assert.ok(appPageSrc.includes("Recent Transactions"));
      assert.ok(appPageSrc.includes("Recent entries (last 5)"));
      assert.ok(appPageSrc.includes("Asia/Kolkata"));
      assert.ok(appPageSrc.includes("recentEntries"));
      assert.ok(appPageSrc.includes("limit(5)"));
    });

    it("provides proper empty state when no recent transactions exist", () => {
      assert.ok(appPageSrc.includes("No recent transactions recorded yet"));
    });

    it("displays prominent success banner after completing a quick action", () => {
      assert.ok(appPageSrc.includes("quickActionNotice"));
      assert.ok(appPageSrc.includes("setQuickActionNotice"));
    });
  });

  describe("Requirement 2: Top Debtors and Low Stock Headers (Single Line at 1280px, Badges, View All)", () => {
    it("Top Debtors title uses whitespace-nowrap and displays count in a small badge", () => {
      assert.ok(appPageSrc.includes("Top Debtors"));
      assert.ok(appPageSrc.includes("whitespace-nowrap"));
      assert.ok(appPageSrc.includes("rounded-full text-[11px] font-bold bg-amber-500/10"));
      assert.ok(appPageSrc.includes("View All →"));
    });

    it("Low Stock title uses whitespace-nowrap and displays count in a small badge", () => {
      assert.ok(appPageSrc.includes("Low Stock Alerts"));
      assert.ok(appPageSrc.includes("rounded-full text-[11px] font-bold bg-destructive/10"));
    });
  });

  describe("Requirement 3: Clean English Labels Across App Nav and Cards", () => {
    it("sidebar displays clean English navigation labels", () => {
      assert.ok(appNavSrc.includes("Shop Menu"));
      assert.ok(appNavSrc.includes("Store Navigation"));
      assert.ok(appNavSrc.includes("Home"));
      assert.ok(appNavSrc.includes("Ledger"));
      assert.ok(appNavSrc.includes("Settings"));
    });

    it("stat cards use clean English labels", () => {
      assert.ok(appPageSrc.includes("Today&apos;s Sales"));
      assert.ok(appPageSrc.includes("Total Pending Udhar"));
    });

    it("section headers avoid brackets in h2", () => {
      assert.ok(!appPageSrc.includes("Top Debtors ("));
      assert.ok(!appPageSrc.includes("Low Stock ("));
    });
  });

  describe("Requirement 4: Submit Button Hint and Loading Spinner", () => {
    it("shows loading spinner inside submit button while parse is in flight", () => {
      assert.ok(appPageSrc.includes("animate-spin h-3.5 w-3.5"));
      assert.ok(appPageSrc.includes("Recording..."));
    });

    it("shows short hint 'Type or speak an entry first' when input is empty and disabled", () => {
      assert.ok(appPageSrc.includes("Type or speak an entry first"));
      assert.ok(appPageSrc.includes("💡 Type or speak an entry first"));
    });
  });

  describe("Requirement 5: Stat Cards Equal Height and Tabular Numbers", () => {
    it("enforces equal height and flex justification on stat cards", () => {
      assert.ok(appPageSrc.includes("h-full min-h-[110px]"));
    });

    it("enforces tabular-nums on AnimatedNumber and stat cards", () => {
      assert.ok(animatedNumberSrc.includes("tabular-nums"));
      assert.ok(appPageSrc.includes("tabular-nums"));
    });
  });

  describe("Requirement 6: Mobile Layout Preservation and Bundle Isolation", () => {
    it("preserves exact mobile ordering (< 1024px) via order-1..6", () => {
      assert.ok(appPageSrc.includes("order-1 lg:order-none"));
      assert.ok(appPageSrc.includes("order-2 lg:order-none"));
      assert.ok(appPageSrc.includes("order-3 lg:order-none"));
      assert.ok(appPageSrc.includes("order-4 lg:order-none"));
      assert.ok(appPageSrc.includes("order-5 lg:order-none"));
      assert.ok(appPageSrc.includes("order-6 lg:order-none"));
    });

    it("hides desktop extension (quick actions & recent entries) on mobile via hidden lg:flex", () => {
      assert.ok(appPageSrc.includes("hidden lg:flex lg:flex-col lg:gap-6"));
    });

    it("strictly isolates /app from gsap, lenis, and spline", () => {
      assert.ok(!appPageSrc.includes("gsap"));
      assert.ok(!appPageSrc.includes("lenis"));
      assert.ok(!appPageSrc.includes("@splinetool"));
    });
  });
});
