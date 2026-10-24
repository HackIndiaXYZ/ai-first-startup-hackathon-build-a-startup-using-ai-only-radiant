import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  calculateInvoiceMath,
  formatInvoiceNumber,
  sanitizePdfText,
  generateInvoicePdf,
} from "@/lib/invoice";
import {
  normalizePhoneNumber,
  buildReminderMessage,
  buildWhatsAppUrl,
} from "@/lib/reminders";
import { STRINGS } from "@/lib/strings";

describe("Tier 2 Phase 6: Invoices, Reminders & Stock Polish", () => {
  describe("1. Invoice Math & Formatting Helpers", () => {
    it("should compute subtotal for line items accurately", () => {
      const items = [
        { qty: 2, unit_price: 50 },
        { qty: 3, unit_price: 30 },
      ];
      const result = calculateInvoiceMath({ items });
      assert.equal(result.lineItemsSubtotal, 190);
      assert.equal(result.totalAmount, 190);
      assert.equal(result.paidAmount, 0);
      assert.equal(result.udharAmount, 190);
      assert.equal(result.isFullyPaid, false);
    });

    it("should compute partial payment and pending udhar correctly", () => {
      const result = calculateInvoiceMath({ total: 500, paid: 200 });
      assert.equal(result.totalAmount, 500);
      assert.equal(result.paidAmount, 200);
      assert.equal(result.udharAmount, 300);
      assert.equal(result.isFullyPaid, false);
    });

    it("should compute full cash sales (udhar = 0, isFullyPaid = true)", () => {
      const result = calculateInvoiceMath({ total: 750, paid: 750 });
      assert.equal(result.totalAmount, 750);
      assert.equal(result.paidAmount, 750);
      assert.equal(result.udharAmount, 0);
      assert.equal(result.isFullyPaid, true);
    });

    it("should compute 100% udhar credit sales (paid = 0)", () => {
      const result = calculateInvoiceMath({ total: 420, paid: 0 });
      assert.equal(result.totalAmount, 420);
      assert.equal(result.paidAmount, 0);
      assert.equal(result.udharAmount, 420);
      assert.equal(result.isFullyPaid, false);
    });

    it("should clamp negative paid or total amounts safely to zero", () => {
      const result = calculateInvoiceMath({ total: -100, paid: -50 });
      assert.equal(result.totalAmount, 0);
      assert.equal(result.paidAmount, 0);
      assert.equal(result.udharAmount, 0);
      assert.equal(result.isFullyPaid, true);
    });

    it("should clamp paid amount if it somehow exceeds total", () => {
      const result = calculateInvoiceMath({ total: 300, paid: 400 });
      assert.equal(result.totalAmount, 300);
      assert.equal(result.paidAmount, 300);
      assert.equal(result.udharAmount, 0);
      assert.equal(result.isFullyPaid, true);
    });

    it("should format standard invoice numbers from UUIDs", () => {
      const inv = formatInvoiceNumber("c8d5e1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a");
      assert.equal(inv, "INV-C8D5E1A2");
    });

    it("should sanitize PDF text to ASCII/WinAnsi without crashing standard Helvetica", () => {
      assert.equal(sanitizePdfText("₹500 for wheat"), "Rs. 500 for wheat");
      assert.equal(sanitizePdfText("मेरी दुकान / My Dukaan"), "My Dukaan");
      assert.equal(sanitizePdfText("Sunil Sharma"), "Sunil Sharma");
      assert.equal(sanitizePdfText(null, "Default"), "Default");
      assert.equal(sanitizePdfText("", "Fallback"), "Fallback");
    });
  });

  describe("2. Phone Number Normalization", () => {
    it("should normalize a 10-digit Indian mobile number to 91XXXXXXXXXX", () => {
      assert.equal(normalizePhoneNumber("9876543210"), "919876543210");
      assert.equal(normalizePhoneNumber("8123456789"), "918123456789");
      assert.equal(normalizePhoneNumber("7000112233"), "917000112233");
    });

    it("should strip leading 0 and prepend 91 for 11-digit numbers", () => {
      assert.equal(normalizePhoneNumber("09876543210"), "919876543210");
    });

    it("should handle existing 91 country code (12 digits)", () => {
      assert.equal(normalizePhoneNumber("919876543210"), "919876543210");
    });

    it("should handle +91 with spaces, hyphens, and brackets", () => {
      assert.equal(normalizePhoneNumber("+91 98765 43210"), "919876543210");
      assert.equal(normalizePhoneNumber("+91-98765-43210"), "919876543210");
      assert.equal(normalizePhoneNumber("+91 (98765) 43210"), "919876543210");
    });

    it("should handle 0091 international dialing prefix", () => {
      assert.equal(normalizePhoneNumber("00919876543210"), "919876543210");
    });

    it("should return null for invalid, short, or non-phone inputs", () => {
      assert.equal(normalizePhoneNumber(""), null);
      assert.equal(normalizePhoneNumber(null), null);
      assert.equal(normalizePhoneNumber(undefined), null);
      assert.equal(normalizePhoneNumber("12345"), null);
      assert.equal(normalizePhoneNumber("abcdefghij"), null);
      assert.equal(normalizePhoneNumber("00000"), null);
    });
  });

  describe("3. Payment Reminder Template & WhatsApp Link", () => {
    it("should generate polite Hinglish message matching specification", () => {
      const msg = buildReminderMessage({
        customerName: "Ramesh",
        udharAmount: 300,
        shopName: "Sharma Kirana Store",
      });
      assert.equal(
        msg,
        "Namaste Ramesh ji, aapka Rs 300 udhar baaki hai. Please jaldi bhej dijiye. - Sharma Kirana Store"
      );
    });

    it("should avoid duplicate 'ji ji' when name already includes honorific", () => {
      const msg = buildReminderMessage({
        customerName: "Ramesh ji",
        udharAmount: 500,
        shopName: "Gupta General Store",
      });
      assert.equal(
        msg,
        "Namaste Ramesh ji, aapka Rs 500 udhar baaki hai. Please jaldi bhej dijiye. - Gupta General Store"
      );
    });

    it("should format large amounts with Indian comma grouping", () => {
      const msg = buildReminderMessage({
        customerName: "Suresh Patel",
        udharAmount: 14500,
        shopName: "Patel Kirana",
      });
      assert.equal(
        msg,
        "Namaste Suresh Patel ji, aapka Rs 14,500 udhar baaki hai. Please jaldi bhej dijiye. - Patel Kirana"
      );
    });

    it("should fallback cleanly if shop name is not provided", () => {
      const msg = buildReminderMessage({
        customerName: "Manoj",
        udharAmount: 250,
      });
      assert.equal(
        msg,
        "Namaste Manoj ji, aapka Rs 250 udhar baaki hai. Please jaldi bhej dijiye. - Kirana Store"
      );
    });

    it("should generate a valid wa.me link with encoded message for valid phone", () => {
      const msg = "Namaste Ramesh ji, aapka Rs 300 udhar baaki hai.";
      const url = buildWhatsAppUrl("9876543210", msg);
      assert.ok(url);
      assert.ok(url.startsWith("https://wa.me/919876543210?text="));
      assert.ok(url.includes("Namaste%20Ramesh%20ji"));
    });

    it("should return null for WhatsApp URL if phone is missing or invalid", () => {
      const msg = "Namaste Ramesh ji";
      assert.equal(buildWhatsAppUrl(null, msg), null);
      assert.equal(buildWhatsAppUrl("", msg), null);
      assert.equal(buildWhatsAppUrl("123", msg), null);
    });
  });

  describe("4. PDF Generation with pdf-lib", () => {
    it("should generate a valid PDF byte array starting with %PDF- header", async () => {
      const pdfBytes = await generateInvoicePdf({
        transactionId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        dateIst: "24 Oct 2026, 09:30 AM",
        shopName: "Sharma Kirana Store",
        shopGstin: "07AAAAA0000A1Z5",
        customerName: "Ramesh Kumar",
        customerPhone: "9876543210",
        items: [
          { name: "Aashirvaad Atta 5kg", qty: 2, unit_price: 220, unit: "bag", total: 440 },
          { name: "Tata Salt 1kg", qty: 1, unit_price: 28, unit: "packet", total: 28 },
        ],
        totalAmount: 468,
        paidAmount: 200,
      });

      assert.ok(pdfBytes instanceof Uint8Array);
      assert.ok(pdfBytes.length > 500, "PDF should have substantial size");

      // Verify %PDF- magic header
      const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
      assert.equal(header, "%PDF-");
    });

    it("should generate valid PDF for general grocery single-total sales (no line items)", async () => {
      const pdfBytes = await generateInvoicePdf({
        transactionId: "99887766-5544-3322-1100-aabbccddeeff",
        dateIst: "24 Oct 2026, 11:15 AM",
        shopName: "My Kirana",
        customerName: null, // Walk-in customer
        customerPhone: null,
        totalAmount: 350,
        paidAmount: 350,
      });

      assert.ok(pdfBytes instanceof Uint8Array);
      const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
      assert.equal(header, "%PDF-");
    });
  });

  describe("5. Centralized Strings & Zero Devanagari UI Verification", () => {
    const rootDir = process.cwd();

    it("enforces zero Devanagari characters in src/lib/strings.ts", () => {
      const stringsPath = path.join(rootDir, "src/lib/strings.ts");
      const content = fs.readFileSync(stringsPath, "utf-8");
      const hasDevanagari = /[\u0900-\u097F]/.test(content);
      assert.equal(hasDevanagari, false, "src/lib/strings.ts must NOT contain any Devanagari characters");
    });

    it("enforces zero Devanagari characters in src/app/app/stock/page.tsx", () => {
      const stockPath = path.join(rootDir, "src/app/app/stock/page.tsx");
      const content = fs.readFileSync(stockPath, "utf-8");
      const hasDevanagari = /[\u0900-\u097F]/.test(content);
      assert.equal(hasDevanagari, false, "src/app/app/stock/page.tsx must NOT contain any Devanagari characters");
    });

    it("enforces zero Devanagari characters in src/components/reminder-dialog.tsx", () => {
      const reminderPath = path.join(rootDir, "src/components/reminder-dialog.tsx");
      const content = fs.readFileSync(reminderPath, "utf-8");
      const hasDevanagari = /[\u0900-\u097F]/.test(content);
      assert.equal(hasDevanagari, false, "src/components/reminder-dialog.tsx must NOT contain any Devanagari characters");
    });

    it("verifies STRINGS exports required keys for invoice, reminders, and stock", () => {
      assert.ok(STRINGS.invoice.taxInvoice);
      assert.ok(STRINGS.invoice.viewInvoice);
      assert.ok(STRINGS.reminders.remindButton);
      assert.ok(STRINGS.reminders.sendViaWhatsApp);
      assert.ok(STRINGS.stock.title);
      assert.ok(STRINGS.stock.lowBadge);
      assert.ok(STRINGS.stock.adjustStock);
    });

    it("verifies GET /api/invoice/[transactionId] route file exists and verifies shop ownership", () => {
      const routePath = path.join(rootDir, "src/app/api/invoice/[transactionId]/route.ts");
      const content = fs.readFileSync(routePath, "utf-8");
      assert.ok(content.includes("generateInvoicePdf"));
      assert.ok(content.includes("eq(\"shop_id\", shop.id)"));
      assert.ok(content.includes("Content-Type\": \"application/pdf"));
    });
  });
});
