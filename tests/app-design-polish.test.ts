import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Design Polish Pass for /app Only", () => {
  const rootDir = process.cwd();

  const layoutPath = path.join(rootDir, "src/app/app/layout.tsx");
  const homePagePath = path.join(rootDir, "src/app/app/page.tsx");
  const ledgerPagePath = path.join(rootDir, "src/app/app/ledger/page.tsx");
  const detailPanelPath = path.join(rootDir, "src/components/customer-detail-panel.tsx");
  const confirmationCardPath = path.join(rootDir, "src/components/confirmation-card.tsx");
  const appNavPath = path.join(rootDir, "src/components/app-nav.tsx");
  const micButtonPath = path.join(rootDir, "src/components/mic-button.tsx");

  const layoutSrc = fs.readFileSync(layoutPath, "utf-8");
  const homePageSrc = fs.readFileSync(homePagePath, "utf-8");
  const ledgerPageSrc = fs.readFileSync(ledgerPagePath, "utf-8");
  const detailPanelSrc = fs.readFileSync(detailPanelPath, "utf-8");
  const confirmationCardSrc = fs.readFileSync(confirmationCardPath, "utf-8");
  const appNavSrc = fs.readFileSync(appNavPath, "utf-8");
  const micButtonSrc = fs.readFileSync(micButtonPath, "utf-8");

  describe("1. Visual System: Spacing, Radius, Restrained Palette, Tabular Numbers", () => {
    it("enforces scroll-smooth and horizontal overflow protection in AppLayout", () => {
      assert.ok(layoutSrc.includes("scroll-smooth"), "Layout should enable scroll-smooth");
      assert.ok(layoutSrc.includes("overflow-x-clip"), "Layout should clip horizontal overflow");
      assert.ok(layoutSrc.includes("max-w-[1200px]"), "Desktop layout should cap at max-w-[1200px]");
    });

    it("applies tabular-nums to amounts in home page overview, debtors, and recent entries", () => {
      assert.ok(homePageSrc.includes("tabular-nums"), "Home page should use tabular numbers for amounts");
      assert.ok(homePageSrc.includes("text-amber-700"), "Udhar should use amber color palette");
      assert.ok(homePageSrc.includes("text-green-700"), "Payments should use green color palette");
    });

    it("applies tabular-nums to amounts in confirmation card", () => {
      assert.ok(confirmationCardSrc.includes("tabular-nums"), "Confirmation card should use tabular numbers");
    });

    it("applies tabular-nums to customer ledger and customer detail panel", () => {
      assert.ok(ledgerPageSrc.includes("tabular-nums"), "Ledger page should use tabular numbers");
      assert.ok(detailPanelSrc.includes("tabular-nums"), "Detail panel should use tabular numbers");
    });
  });

  describe("2. Home Page: Clear Mic Action + Typed Input Beside It, Summary Row, Empty States & Skeletons", () => {
    it("places primary mic action with typed input beside it on desktop", () => {
      assert.ok(
        homePageSrc.includes("lg:flex-row lg:items-center lg:gap-6"),
        "Mic and typed input should be side-by-side on desktop"
      );
      assert.ok(homePageSrc.includes("MicButton"), "Mic button component should be present");
      assert.ok(homePageSrc.includes("id=\"typed-input-box\""), "Prominent typed input box should be present");
    });

    it("renders summary row with today's sales and total udhar", () => {
      assert.ok(homePageSrc.includes("Today's Sales") || homePageSrc.includes("Today&apos;s Sales"), "Shows English sales label");
      assert.ok(homePageSrc.includes("Total Pending Udhar"), "Shows English udhar label");
    });

    it("provides clean empty state for Top Debtors with 'No udhar yet' or settled accounts", () => {
      assert.ok(homePageSrc.includes("All customer accounts are settled") || homePageSrc.includes("No pending udhar"), "Debtors should show settled accounts empty state");
    });

    it("provides clean empty state for Low Stock with 'All items in stock'", () => {
      assert.ok(homePageSrc.includes("All items in stock"), "Low stock should show 'All items in stock' empty state");
    });

    it("renders skeleton loaders during initial loading", () => {
      assert.ok(homePageSrc.includes("animate-pulse"), "Skeleton pulse animation should be used");
      assert.ok(homePageSrc.includes("isLoadingDashboard"), "Loading state should toggle skeletons");
    });
  });

  describe("3. Customers (Ledger): Search, Udhar Balance, Customer Detail Panel & Add Customer Flow", () => {
    it("renders search input for filtering customer ledger", () => {
      assert.ok(ledgerPageSrc.includes("id=\"search-customer\""), "Customer search input should be present");
      assert.ok(ledgerPageSrc.includes("searchQuery"), "Search query filter should be wired");
    });

    it("displays udhar balance on each customer row", () => {
      assert.ok(ledgerPageSrc.includes("customer.balance"), "Customer balance should be rendered");
      assert.ok(ledgerPageSrc.includes("Udhar Due") || ledgerPageSrc.includes("Settled"), "Status label for balance");
    });

    it("includes a visible 'Add customer' button and validated form calling /api/confirm with add_customer", () => {
      assert.ok(ledgerPageSrc.includes("btn-add-customer-ledger"), "Visible Add Customer button should exist");
      assert.ok(ledgerPageSrc.includes("Add Customer"), "Add customer button text");
      assert.ok(ledgerPageSrc.includes("action: \"add_customer\""), "Calls add_customer action");
      assert.ok(ledgerPageSrc.includes("/api/confirm"), "Posts to /api/confirm");
      assert.ok(ledgerPageSrc.includes("newCustName"), "Customer name field should exist");
      assert.ok(ledgerPageSrc.includes("newCustPhone"), "Customer phone field should exist");
    });

    it("renders customer detail panel with balance, transaction history, and quick actions", () => {
      assert.ok(detailPanelSrc.includes("customer.balance"), "Detail panel shows current balance");
      assert.ok(detailPanelSrc.includes("transactions"), "Detail panel lists transaction records");
      assert.ok(detailPanelSrc.includes("btn-customer-record-payment"), "Quick action to record payment exists");
      assert.ok(detailPanelSrc.includes("whatsappUrl"), "WhatsApp reminder quick action exists");
      assert.ok(
        detailPanelSrc.includes("No transaction history yet"),
        "Empty state for zero transactions"
      );
    });
  });

  describe("4. Motion (CSS Only) & Strict Isolation from gsap/lenis/spline", () => {
    it("confirmation card uses CSS slide-in animation and respects prefers-reduced-motion", () => {
      assert.ok(
        confirmationCardSrc.includes("slide-in-from-bottom"),
        "Confirmation card should slide in"
      );
      assert.ok(
        confirmationCardSrc.includes("motion-reduce:animate-none"),
        "Respects prefers-reduced-motion"
      );
    });

    it("uses 150-200ms transitions on hover, press and focus", () => {
      assert.ok(
        homePageSrc.includes("duration-150") || homePageSrc.includes("duration-200"),
        "Home page transitions should be 150-200ms"
      );
      assert.ok(
        ledgerPageSrc.includes("duration-150") || ledgerPageSrc.includes("duration-200"),
        "Ledger transitions should be 150-200ms"
      );
    });

    it("does NOT import gsap, lenis, or @splinetool anywhere under src/app/app/", () => {
      const appDir = path.join(rootDir, "src/app/app");
      const walkFiles = (dir: string): string[] => {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            results = results.concat(walkFiles(filePath));
          } else {
            results.push(filePath);
          }
        }
        return results;
      };

      const files = walkFiles(appDir);
      for (const file of files) {
        const content = fs.readFileSync(file, "utf-8");
        assert.ok(!content.includes("gsap"), `Forbidden gsap import in ${file}`);
        assert.ok(!content.includes("lenis"), `Forbidden lenis import in ${file}`);
        assert.ok(!content.includes("@splinetool"), `Forbidden spline import in ${file}`);
      }
    });

    it("does NOT import gsap, lenis, or @splinetool in components used by /app", () => {
      const appComponents = [
        homePagePath,
        ledgerPagePath,
        detailPanelPath,
        confirmationCardPath,
        appNavPath,
        micButtonPath,
      ];
      for (const comp of appComponents) {
        const content = fs.readFileSync(comp, "utf-8");
        assert.ok(!content.includes("gsap"), `Forbidden gsap import in ${comp}`);
        assert.ok(!content.includes("lenis"), `Forbidden lenis import in ${comp}`);
        assert.ok(!content.includes("@splinetool"), `Forbidden spline import in ${comp}`);
      }
    });
  });

  describe("5. Feedback & Accessibility", () => {
    it("provides loading spinners and feedback text on submit buttons", () => {
      assert.ok(homePageSrc.includes("Recording...") || homePageSrc.includes("isParsing"), "Parse submit feedback");
      assert.ok(ledgerPageSrc.includes("Adding...") || ledgerPageSrc.includes("isSubmittingCustomer"), "Add customer submit feedback");
      assert.ok(confirmationCardSrc.includes("Saving...") || confirmationCardSrc.includes("isSaving"), "Confirm entry submit feedback");
    });

    it("enforces minimum 48px tap targets on interactive elements", () => {
      assert.ok(homePageSrc.includes("min-h-[48px]"), "Input / action min-h-[48px]");
      assert.ok(ledgerPageSrc.includes("min-h-[48px]"), "Ledger interactive targets min-h-[48px]");
      assert.ok(confirmationCardSrc.includes("min-h-[48px]"), "Confirmation actions min-h-[48px]");
      assert.ok(micButtonSrc.includes("w-24 h-24"), "Mic button has prominent 96px touch target");
    });

    it("provides visible focus rings and accessible labels", () => {
      assert.ok(appNavSrc.includes("focus-visible:ring-2") || appNavSrc.includes("focus-visible:ring-primary"), "Nav links have focus rings");
      assert.ok(ledgerPageSrc.includes("focus-visible:ring-2") || ledgerPageSrc.includes("focus-visible:ring-primary"), "Ledger items have focus rings");
      assert.ok(micButtonSrc.includes("aria-label"), "Mic button has accessible aria-label");
      assert.ok(appNavSrc.includes("aria-label"), "AppNav has accessible aria-label");
    });
  });
});
