import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("App Responsive Pass (>= 1024px and Mobile < 1024px)", () => {
  const rootDir = process.cwd();

  const appLayoutPath = path.join(rootDir, "src/app/app/layout.tsx");
  const appPagePath = path.join(rootDir, "src/app/app/page.tsx");
  const ledgerPagePath = path.join(rootDir, "src/app/app/ledger/page.tsx");
  const appNavPath = path.join(rootDir, "src/components/app-nav.tsx");
  const appHeaderPath = path.join(rootDir, "src/components/app-header.tsx");
  const detailPanelPath = path.join(rootDir, "src/components/customer-detail-panel.tsx");

  const appLayoutSrc = fs.readFileSync(appLayoutPath, "utf-8");
  const appPageSrc = fs.readFileSync(appPagePath, "utf-8");
  const ledgerPageSrc = fs.readFileSync(ledgerPagePath, "utf-8");
  const appNavSrc = fs.readFileSync(appNavPath, "utf-8");
  const appHeaderSrc = fs.readFileSync(appHeaderPath, "utf-8");
  const detailPanelSrc = fs.readFileSync(detailPanelPath, "utf-8");

  describe("Requirement 1: Container Width & Centering (~1200px, No Horizontal Scroll)", () => {
    it("centers the content and enforces max width ~1200px on desktop in layout and header", () => {
      assert.ok(appLayoutSrc.includes("max-w-md lg:max-w-[1200px] mx-auto w-full"));
      assert.ok(appHeaderSrc.includes("max-w-md lg:max-w-[1200px] mx-auto w-full"));
    });

    it("prevents horizontal scroll via overflow-x-clip and flexible containers", () => {
      assert.ok(appLayoutSrc.includes("overflow-x-clip"));
      assert.ok(appLayoutSrc.includes("min-w-0"));
      assert.ok(/px-0\s+sm:px-4\s+lg:px-8/.test(appLayoutSrc));
    });
  });

  describe("Requirement 2: Desktop Sidebar vs Mobile Bottom Nav", () => {
    it("hides the bottom nav on desktop screens >= 1024px (lg:hidden)", () => {
      assert.ok(appNavSrc.includes("lg:hidden"));
      assert.ok(appNavSrc.includes("fixed bottom-0"));
    });

    it("exports an AppSidebar displayed only on >= 1024px (hidden lg:flex)", () => {
      assert.ok(appNavSrc.includes("export function AppSidebar"));
      assert.ok(appNavSrc.includes("hidden lg:flex"));
      assert.ok(appLayoutSrc.includes("<AppSidebar />"));
    });

    it("sidebar contains Home, Ledger, and Settings with hover and focus-visible states", () => {
      assert.ok(appNavSrc.includes('href="/app"'));
      assert.ok(appNavSrc.includes('href="/app/ledger"'));
      assert.ok(appNavSrc.includes('href="/app/settings"'));

      // Hover states
      assert.ok(appNavSrc.includes("hover:bg-muted/60"));
      assert.ok(appNavSrc.includes("hover:text-foreground"));

      // Focus-visible states
      assert.ok(appNavSrc.includes("focus-visible:ring-2"));
      assert.ok(appNavSrc.includes("focus-visible:ring-primary"));

      // Tap / accessibility targets >= 48px
      assert.ok(appNavSrc.includes("min-h-[48px]"));
    });
  });

  describe("Requirement 3: Main Area Two-Column Layout (>= 1024px) & Mobile Layout Preservation", () => {
    it("uses grid with lg:grid-cols-12 and lg:gap-8 on desktop", () => {
      assert.ok(appPageSrc.includes("lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start"));
    });

    it("left column contains Mic, typed input, and confirmation card in lg:col-span-7", () => {
      assert.ok(appPageSrc.includes("contents lg:flex lg:flex-col lg:gap-6 lg:col-span-7"));
      // Contains voice & text entry
      assert.ok(appPageSrc.includes('aria-label="Voice and text entry"'));
      // Contains ConfirmationCard
      assert.ok(appPageSrc.includes("<ConfirmationCard"));
      assert.ok(appPageSrc.includes('aria-label="Transaction confirmation"'));
    });

    it("right column contains today's sales, total udhar, top debtors, and low stock in lg:col-span-5", () => {
      assert.ok(appPageSrc.includes("contents lg:flex lg:flex-col lg:gap-6 lg:col-span-5"));
      // Business overview (Sales + Udhar)
      assert.ok(appPageSrc.includes('aria-label="Business overview"'));
      assert.ok(appPageSrc.includes("आज की बिक्री"));
      assert.ok(appPageSrc.includes("कुल उधार"));
      // Top debtors
      assert.ok(appPageSrc.includes('aria-label="Top debtors"'));
      assert.ok(appPageSrc.includes("शीर्ष बकायेदार"));
      // Low stock
      assert.ok(appPageSrc.includes('aria-label="Low stock items"'));
      assert.ok(appPageSrc.includes("कम स्टॉक चेतावनी"));
    });

    it("preserves exact mobile layout ordering (< 1024px) via display: contents and order-1..6", () => {
      // On mobile: Sales & Udhar (1) -> Entry (2) -> Confirm (3) -> Debtors (4) -> Low Stock (5) -> Error (6)
      assert.ok(appPageSrc.includes("order-1 lg:order-none"));
      assert.ok(appPageSrc.includes("order-2 lg:order-none"));
      assert.ok(appPageSrc.includes("order-3 lg:order-none"));
      assert.ok(appPageSrc.includes("order-4 lg:order-none"));
      assert.ok(appPageSrc.includes("order-5 lg:order-none"));
      assert.ok(appPageSrc.includes("order-6 lg:order-none"));
    });
  });

  describe("Requirement 4: Ledger Master-Detail Layout on Desktop (>= 1024px)", () => {
    it("structures the ledger into a list panel and a detail panel on desktop", () => {
      assert.ok(ledgerPageSrc.includes("lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start"));
      // Left column: list
      assert.ok(ledgerPageSrc.includes("lg:col-span-5"));
      // Right column: detail panel
      assert.ok(ledgerPageSrc.includes("lg:col-span-7"));
      assert.ok(ledgerPageSrc.includes("<CustomerDetailPanel"));
    });

    it("allows selecting a customer on desktop without breaking standard mobile links", () => {
      assert.ok(ledgerPageSrc.includes("selectedCustomerId"));
      assert.ok(ledgerPageSrc.includes("window.innerWidth >= 1024"));
      assert.ok(ledgerPageSrc.includes("setSelectedCustomerId"));
    });

    it("CustomerDetailPanel renders customer header, balance, quick action, and transactions", () => {
      assert.ok(detailPanelSrc.includes("CustomerDetailPanel"));
      assert.ok(detailPanelSrc.includes("वर्तमान बकाया (Current Udhar Balance)"));
      assert.ok(detailPanelSrc.includes("लेन-देन इतिहास (Transaction History)"));
      assert.ok(detailPanelSrc.includes("नया हिसाब दर्ज करें"));
    });
  });

  describe("Requirement 5: Keyboard Shortcuts & Auto-Focus", () => {
    it("Enter key sends the typed input", () => {
      assert.ok(appPageSrc.includes('e.key === "Enter"'));
      assert.ok(appPageSrc.includes("handleParseText(typedInput)"));
    });

    it("Escape key cancels the confirmation card when active", () => {
      assert.ok(appPageSrc.includes('e.key === "Escape"'));
      assert.ok(appPageSrc.includes("setParseResult(null)"));
      assert.ok(appPageSrc.includes("setActiveIdempotencyKey(null)"));
      assert.ok(appPageSrc.includes('window.addEventListener("keydown", handleKeyDown)'));
    });

    it("moves focus to the confirmation card when it appears", () => {
      assert.ok(appPageSrc.includes("confirmationCardRef.current.focus()"));
      assert.ok(appPageSrc.includes('id="confirmation-card-section"'));
      assert.ok(appPageSrc.includes("tabIndex={-1}"));
    });
  });

  describe("Requirement 6: API and Lib Integrity (No modifications to API, lib or logic code)", () => {
    it("ensures no changes to src/lib or src/app/api", () => {
      const gitStatus = fs.existsSync(path.join(rootDir, "src/lib/agents/parser.ts"));
      assert.ok(gitStatus);
      const apiParse = fs.existsSync(path.join(rootDir, "src/app/api/parse/route.ts"));
      assert.ok(apiParse);
      const apiConfirm = fs.existsSync(path.join(rootDir, "src/app/api/confirm/route.ts"));
      assert.ok(apiConfirm);
    });
  });

  describe("Requirement 7: Next.js 16 Static Layout Shell & await connection() Compliance", () => {
    it("keeps AppLayout synchronous and renders AppSidebar and AppNav in static shell", () => {
      assert.ok(appLayoutSrc.includes("export default function AppLayout"));
      assert.ok(!appLayoutSrc.includes("export default async function AppLayout"));
      assert.ok(appLayoutSrc.includes("<AppSidebar />"));
      assert.ok(appLayoutSrc.includes("<AppNav />"));
    });

    it("wraps dynamic server components in Suspense with await connection() at the top", () => {
      assert.ok(appLayoutSrc.includes('import { connection } from "next/server"'));
      assert.ok(appLayoutSrc.includes("await connection()"));
      assert.ok(appLayoutSrc.includes("<Suspense fallback={<AppHeaderSkeleton />}>"));
      assert.ok(appLayoutSrc.includes("<AppHeaderServer />"));
      assert.ok(appLayoutSrc.includes("<AppAuthGuard>"));
    });

    it("reads new Date() only at request time and passes it into getIstDayRange without lib edits", () => {
      assert.ok(appLayoutSrc.includes("const now = new Date()"));
      assert.ok(appLayoutSrc.includes("getIstDayRange(now)"));
    });
  });
});
