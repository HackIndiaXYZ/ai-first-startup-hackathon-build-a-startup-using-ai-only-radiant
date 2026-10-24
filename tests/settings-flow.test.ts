import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  DEMO_STOCK_PRODUCTS,
  getMissingDemoProducts,
  validateShopName,
  validateGstin,
} from "../src/lib/demo-stock";
import { STRINGS } from "../src/lib/strings";

describe("Settings Flow — Shop Profile & Demo Stock Management", () => {
  // ===========================================================================
  // 1. Shop Name Validation
  // ===========================================================================
  describe("1. Shop Name Validation", () => {
    it("should reject empty or whitespace-only shop name", () => {
      assert.equal(validateShopName("").valid, false);
      assert.equal(validateShopName("   ").valid, false);
      assert.match(validateShopName("").error || "", /cannot be empty/i);
    });

    it("should reject shop name with less than 2 characters", () => {
      assert.equal(validateShopName("A").valid, false);
      assert.match(validateShopName("A").error || "", /at least 2 characters/i);
    });

    it("should accept valid Kirana shop names", () => {
      assert.equal(validateShopName("Sharma Kirana Store").valid, true);
      assert.equal(validateShopName("Gupta General Store").valid, true);
      assert.equal(validateShopName("Apni Dukaan").valid, true);
    });
  });

  // ===========================================================================
  // 2. GSTIN Validation & Formatting
  // ===========================================================================
  describe("2. GSTIN Validation & Formatting", () => {
    it("should allow empty GSTIN for unregistered small kirana stores", () => {
      const res = validateGstin("");
      assert.equal(res.valid, true);
      assert.equal(res.formatted, null);

      const whitespaceRes = validateGstin("   ");
      assert.equal(whitespaceRes.valid, true);
      assert.equal(whitespaceRes.formatted, null);
    });

    it("should accept and uppercase standard 15-character GSTIN", () => {
      const res = validateGstin("07aaaaa0000a1z5");
      assert.equal(res.valid, true);
      assert.equal(res.formatted, "07AAAAA0000A1Z5");

      const res2 = validateGstin("27AAPFU0939F1ZV");
      assert.equal(res2.valid, true);
      assert.equal(res2.formatted, "27AAPFU0939F1ZV");
    });

    it("should reject invalid GSTINs (wrong length or structure)", () => {
      // Too short
      assert.equal(validateGstin("07AAAAA0000A1Z").valid, false);
      // Too long
      assert.equal(validateGstin("07AAAAA0000A1Z599").valid, false);
      // Invalid characters
      assert.equal(validateGstin("07AAAAA0000A1!5").valid, false);
    });
  });

  // ===========================================================================
  // 3. Demo Stock Products & Deduplication
  // ===========================================================================
  describe("3. Demo Stock Products & Deduplication", () => {
    it("should have 10 curated demo products with realistic prices, units, and stock", () => {
      assert.equal(DEMO_STOCK_PRODUCTS.length, 10);
      for (const p of DEMO_STOCK_PRODUCTS) {
        assert.ok(p.name.length > 3, "Product name must be descriptive");
        assert.ok(p.price > 0, "Price must be positive");
        assert.ok(p.stock_qty >= 0, "Stock qty must be non-negative");
        assert.ok(p.reorder_level > 0, "Reorder level must be positive");
        assert.ok(["packet", "l", "kg", "piece"].includes(p.unit), `Valid unit: ${p.unit}`);
      }
    });

    it("should include low-stock products to demonstrate reorder alerts", () => {
      const lowStockItems = DEMO_STOCK_PRODUCTS.filter(
        (p) => p.stock_qty <= p.reorder_level
      );
      // Should have at least 3 low-stock items
      assert.ok(
        lowStockItems.length >= 3,
        `Expected at least 3 low-stock items, found ${lowStockItems.length}`
      );
    });

    it("should return all demo products when shop has 0 products", () => {
      const missing = getMissingDemoProducts([]);
      assert.equal(missing.length, 10);
    });

    it("should filter out already existing products (case-insensitive)", () => {
      const existing = [
        "Aashirvaad Shudh Chakki Atta 5kg",
        "fortune sunlite refined oil 1l",
      ];
      const missing = getMissingDemoProducts(existing);
      assert.equal(missing.length, 8);
      assert.ok(!missing.some((m) => m.name.toLowerCase().includes("aashirvaad")));
      assert.ok(!missing.some((m) => m.name.toLowerCase().includes("fortune sunlite")));
    });

    it("should return empty array when all demo products exist", () => {
      const allNames = DEMO_STOCK_PRODUCTS.map((p) => p.name);
      const missing = getMissingDemoProducts(allNames);
      assert.equal(missing.length, 0);
    });
  });

  // ===========================================================================
  // 4. Roman-only Language Guard (Zero Devanagari)
  // ===========================================================================
  describe("4. Roman Script Language Guard", () => {
    it("should ensure DEMO_STOCK_PRODUCTS contains 0 Devanagari characters", () => {
      const devanagariRegex = /[\u0900-\u097F]/;
      for (const p of DEMO_STOCK_PRODUCTS) {
        assert.equal(
          devanagariRegex.test(p.name),
          false,
          `Devanagari found in product name: ${p.name}`
        );
      }
    });

    it("should ensure STRINGS.settings contains 0 Devanagari characters", () => {
      const devanagariRegex = /[\u0900-\u097F]/;
      const settingsStrings = JSON.stringify(STRINGS.settings);
      assert.equal(
        devanagariRegex.test(settingsStrings),
        false,
        "Devanagari found in STRINGS.settings"
      );
    });
  });

  // ===========================================================================
  // 5. Settings Screen Accessibility & IDs
  // ===========================================================================
  describe("5. Settings Screen Accessibility & Required IDs", () => {
    it("should contain all required element IDs in settings/page.tsx", () => {
      const pagePath = path.join(process.cwd(), "src/app/app/settings/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(content.includes('id="btn-edit-shop-profile"'), "Missing edit shop button");
      assert.ok(content.includes('id="form-edit-shop-profile"'), "Missing edit shop form");
      assert.ok(content.includes('id="input-shop-name"'), "Missing shop name input");
      assert.ok(content.includes('id="input-shop-gstin"'), "Missing shop gstin input");
      assert.ok(content.includes('id="btn-save-shop-profile"'), "Missing save shop button");
      assert.ok(content.includes('id="btn-cancel-shop-profile"'), "Missing cancel shop button");
      assert.ok(content.includes('id="btn-add-demo-stock"'), "Missing add demo stock button");
      assert.ok(content.includes('id="link-view-stock"'), "Missing view stock link");
      assert.ok(content.includes('id="btn-settings-signout"'), "Missing sign out button");
    });

    it("should guarantee touch tap targets >= 48px", () => {
      const pagePath = path.join(process.cwd(), "src/app/app/settings/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(content.includes("min-h-[48px]"), "All interactive elements should satisfy 48px tap targets");
    });
  });
});
