import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getIstDayRange, isTodayInIst } from "../src/lib/date-utils";
import {
  generateIdempotencyKey,
  isLowConfidence,
  buildConfirmPayload,
  formatApiError,
} from "../src/lib/confirm-helpers";

describe("Pure Helpers & IST Calculations (src/lib)", () => {
  describe("Asia/Kolkata (IST = UTC+5:30) Day Range & Midnight Transitions", () => {
    it("should compute exact IST boundaries for a typical mid-day timestamp", () => {
      // 2026-10-19 12:00:00 IST = 2026-10-19T06:30:00.000Z
      const midDayUtc = new Date("2026-10-19T06:30:00.000Z");
      const range = getIstDayRange(midDayUtc);

      assert.equal(range.istDateString, "2026-10-19");
      // 00:00:00 IST on Oct 19 is 18:30:00 UTC on Oct 18
      assert.equal(range.startIso, "2026-10-18T18:30:00.000Z");
      // 23:59:59.999 IST on Oct 19 is 18:29:59.999 UTC on Oct 19
      assert.equal(range.endIso, "2026-10-19T18:29:59.999Z");
    });

    it("should correctly handle exactly 1 millisecond before midnight IST", () => {
      // 2026-10-18 23:59:59.999 IST = 2026-10-18T18:29:59.999Z
      const justBeforeMidnight = new Date("2026-10-18T18:29:59.999Z");
      const range = getIstDayRange(justBeforeMidnight);

      assert.equal(range.istDateString, "2026-10-18");
      assert.equal(range.startIso, "2026-10-17T18:30:00.000Z");
      assert.equal(range.endIso, "2026-10-18T18:29:59.999Z");

      assert.equal(isTodayInIst(justBeforeMidnight, justBeforeMidnight), true);
      // But the next millisecond (midnight) belongs to Oct 19, not Oct 18
      assert.equal(isTodayInIst("2026-10-18T18:30:00.000Z", justBeforeMidnight), false);
    });

    it("should correctly handle exact midnight IST (00:00:00.000 IST)", () => {
      // 2026-10-19 00:00:00.000 IST = 2026-10-18T18:30:00.000Z
      const exactMidnight = new Date("2026-10-18T18:30:00.000Z");
      const range = getIstDayRange(exactMidnight);

      assert.equal(range.istDateString, "2026-10-19");
      assert.equal(range.startIso, "2026-10-18T18:30:00.000Z");
      assert.equal(range.endIso, "2026-10-19T18:29:59.999Z");

      assert.equal(isTodayInIst(exactMidnight, exactMidnight), true);
      // The preceding millisecond belongs to Oct 18, not Oct 19
      assert.equal(isTodayInIst("2026-10-18T18:29:59.999Z", exactMidnight), false);
    });

    it("should correctly handle 1 millisecond after midnight IST", () => {
      // 2026-10-19 00:00:00.001 IST = 2026-10-18T18:30:00.001Z
      const justAfterMidnight = new Date("2026-10-18T18:30:00.001Z");
      const range = getIstDayRange(justAfterMidnight);

      assert.equal(range.istDateString, "2026-10-19");
      assert.equal(range.startIso, "2026-10-18T18:30:00.000Z");
      assert.equal(range.endIso, "2026-10-19T18:29:59.999Z");
    });
  });

  describe("Idempotency Key Generator", () => {
    it("should generate valid unique UUID v4 format strings", () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();

      assert.notEqual(key1, key2);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.match(key1, uuidRegex);
      assert.match(key2, uuidRegex);
    });
  });

  describe("Low-Confidence Checker", () => {
    it("should flag confidence below 0.70 as low confidence", () => {
      assert.equal(isLowConfidence(0.69), true);
      assert.equal(isLowConfidence(0.50), true);
      assert.equal(isLowConfidence(0.0), true);
      assert.equal(isLowConfidence(NaN), true);
    });

    it("should accept confidence at or above 0.70 as reliable", () => {
      assert.equal(isLowConfidence(0.70), false);
      assert.equal(isLowConfidence(0.85), false);
      assert.equal(isLowConfidence(0.99), false);
      assert.equal(isLowConfidence(1.0), false);
    });
  });

  describe("Confirm Payload Builder", () => {
    it("should build complete add_sale payload", () => {
      const payload = buildConfirmPayload({
        action: "add_sale",
        idempotencyKey: "test-uuid-1",
        rawInput: "Ramesh ne 500 ka samaan liya",
        summary: "रमेश: ₹500 का सामान",
        confidence: 0.95,
        customerName: "Ramesh Kumar",
        total: 500,
        paid: 200,
        items: [{ product: "Atta", qty: 2, total: 500 }],
        createCustomer: false,
      });

      assert.deepEqual(payload, {
        idempotency_key: "test-uuid-1",
        raw_input: "Ramesh ne 500 ka samaan liya",
        action: "add_sale",
        summary: "रमेश: ₹500 का सामान",
        confidence: 0.95,
        customer: "Ramesh Kumar",
        total: 500,
        paid: 200,
        items: [{ product: "Atta", qty: 2, total: 500 }],
        create_customer: false,
      });
    });

    it("should build record_payment payload", () => {
      const payload = buildConfirmPayload({
        action: "record_payment",
        idempotencyKey: "test-uuid-2",
        rawInput: "Suresh ji ne 300 diye",
        summary: "सुरेश: ₹300 जमा",
        confidence: 0.98,
        customerName: "Suresh Verma",
        amount: 300,
      });

      assert.deepEqual(payload, {
        idempotency_key: "test-uuid-2",
        raw_input: "Suresh ji ne 300 diye",
        action: "record_payment",
        summary: "सुरेश: ₹300 जमा",
        confidence: 0.98,
        customer: "Suresh Verma",
        amount: 300,
      });
    });

    it("should build adjust_stock payload", () => {
      const payload = buildConfirmPayload({
        action: "adjust_stock",
        idempotencyKey: "test-uuid-3",
        rawInput: "Atta 10 packet aaya",
        summary: "आटा: +10 पैकेट",
        confidence: 0.92,
        product: "Aashirvaad Atta",
        qtyChange: 10,
        unit: "packet",
      });

      assert.deepEqual(payload, {
        idempotency_key: "test-uuid-3",
        raw_input: "Atta 10 packet aaya",
        action: "adjust_stock",
        summary: "आटा: +10 पैकेट",
        confidence: 0.92,
        product: "Aashirvaad Atta",
        qty_change: 10,
        unit: "packet",
      });
    });

    it("should build add_customer payload", () => {
      const payload = buildConfirmPayload({
        action: "add_customer",
        idempotencyKey: "test-uuid-4",
        rawInput: "Naya grahak Manoj 9876543210",
        summary: "मनोज को नया जोड़ा",
        confidence: 0.90,
        customerName: "Manoj Tiwari",
        phone: "+91 98765 43210",
        notes: "Tailor shop",
      });

      assert.deepEqual(payload, {
        idempotency_key: "test-uuid-4",
        raw_input: "Naya grahak Manoj 9876543210",
        action: "add_customer",
        summary: "मनोज को नया जोड़ा",
        confidence: 0.90,
        name: "Manoj Tiwari",
        phone: "+91 98765 43210",
        notes: "Tailor shop",
      });
    });
  });

  describe("API Error Formatter", () => {
    it("should format demo limit and quota errors with friendly Hindi/English text", () => {
      const formatted = formatApiError("demo limit reached, try again tomorrow");
      assert.match(formatted, /डेमो सीमा समाप्त/);
      assert.match(formatted, /Demo limit reached/i);
    });

    it("should format abort and timeout errors cleanly", () => {
      const formatted = formatApiError(new Error("The operation was aborted"));
      assert.match(formatted, /अनुरोध समय समाप्त/);
    });

    it("should preserve specific ledger overpayment error messages", () => {
      const overpaymentMsg = "Payment of ₹500 cannot exceed customer's current udhar balance of ₹350.00";
      const formatted = formatApiError(overpaymentMsg);
      assert.equal(formatted, overpaymentMsg);
    });

    it("should format network failures cleanly", () => {
      const formatted = formatApiError(new TypeError("Failed to fetch"));
      assert.match(formatted, /नेटवर्क कनेक्शन त्रुटि/);
    });
  });
});
