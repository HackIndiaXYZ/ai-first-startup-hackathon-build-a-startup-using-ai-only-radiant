import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateLedgerAction } from "../src/lib/agents/ledger";
import { findBestCustomerMatch } from "../src/lib/agents/customer-matcher";
import { Customer } from "../src/lib/agents/types";

describe("Ledger Business Validation Rules", () => {
  describe("Sale Validation (paid <= total & Stock)", () => {
    it("should accept valid credit sale where paid < total", () => {
      const res = validateLedgerAction({
        action: "add_sale",
        customer: "Ramesh",
        total: 500,
        paid: 200,
        confidence: 0.95,
        summary: "Sale to Ramesh",
      });
      assert.equal(res.valid, true);
      assert.equal(res.error, undefined);
    });

    it("should accept sale without items (only total amount)", () => {
      const res = validateLedgerAction({
        action: "add_sale",
        customer: "Ramesh",
        total: 800,
        paid: 0,
        confidence: 0.95,
        summary: "Sale without line items",
      });
      assert.equal(res.valid, true);
    });

    it("should ignore unmatched items for stock validation (stock applies only to matched products)", () => {
      const res = validateLedgerAction(
        {
          action: "add_sale",
          customer: "Ramesh",
          total: 300,
          paid: 0,
          items: [{ product: "Unmatched Random Item", qty: 50 }],
          confidence: 0.95,
          summary: "Sale with unmatched product",
        },
        {
          productStock: {
            "aashirvaad atta": 10,
          },
        }
      );
      assert.equal(res.valid, true);
    });

    it("should reject sale when line item matches a tracked product and exceeds available stock", () => {
      const res = validateLedgerAction(
        {
          action: "add_sale",
          customer: "Ramesh",
          total: 600,
          paid: 0,
          items: [{ product: "Aashirvaad Atta", qty: 15 }],
          confidence: 0.95,
          summary: "Sale with excess stock",
        },
        {
          productStock: {
            "aashirvaad atta": 10,
          },
        }
      );
      assert.equal(res.valid, false);
      assert.match(res.error || "", /Insufficient stock for product "Aashirvaad Atta"/);
    });

    it("should reject sale when paid > total", () => {
      const res = validateLedgerAction({
        action: "add_sale",
        customer: "Ramesh",
        total: 500,
        paid: 600,
        confidence: 0.95,
        summary: "Invalid sale",
      });
      assert.equal(res.valid, false);
      assert.match(res.error || "", /Paid amount \(₹600\) cannot exceed total sale amount \(₹500\)/);
    });

    it("should reject negative total sale amount", () => {
      const res = validateLedgerAction({
        action: "add_sale",
        total: -50,
        paid: 0,
        confidence: 0.9,
        summary: "Negative sale",
      });
      assert.equal(res.valid, false);
    });
  });

  describe("Payment Validation (Payment vs Current Udhar)", () => {
    it("should accept valid payment within current udhar balance", () => {
      const res = validateLedgerAction(
        {
          action: "record_payment",
          customer: "Ramesh",
          amount: 200,
          confidence: 0.95,
          summary: "Payment",
        },
        { customerBalance: 500 }
      );
      assert.equal(res.valid, true);
    });

    it("should reject payment when amount exceeds customer's current udhar balance", () => {
      const res = validateLedgerAction(
        {
          action: "record_payment",
          customer: "Ramesh",
          amount: 500,
          confidence: 0.95,
          summary: "Overpayment",
        },
        { customerBalance: 300 }
      );
      assert.equal(res.valid, false);
      assert.match(
        res.error || "",
        /Payment amount \(₹500\) cannot exceed customer's current udhar balance of ₹300/
      );
    });

    it("should reject payment when customer has 0 udhar balance", () => {
      const res = validateLedgerAction(
        {
          action: "record_payment",
          customer: "Ramesh",
          amount: 100,
          confidence: 0.95,
          summary: "Payment on zero balance",
        },
        { customerBalance: 0 }
      );
      assert.equal(res.valid, false);
      assert.match(
        res.error || "",
        /Payment amount \(₹100\) cannot exceed customer's current udhar balance of ₹0/
      );
    });

    it("should reject non-positive payment (zero or negative)", () => {
      const resZero = validateLedgerAction({
        action: "record_payment",
        customer: "Ramesh",
        amount: 0,
        confidence: 0.95,
        summary: "Zero",
      });
      assert.equal(resZero.valid, false);

      const resNeg = validateLedgerAction({
        action: "record_payment",
        customer: "Ramesh",
        amount: -50,
        confidence: 0.95,
        summary: "Negative",
      });
      assert.equal(resNeg.valid, false);
    });
  });

  describe("Stock Validation (stock not negative)", () => {
    it("should accept positive stock addition for existing product", () => {
      const res = validateLedgerAction(
        {
          action: "adjust_stock",
          product: "Tata Namak",
          qty_change: 15,
          confidence: 0.95,
          summary: "Add stock",
        },
        { productStock: { "tata namak": 5 } }
      );
      assert.equal(res.valid, true);
    });

    it("should reject stock adjustment for non-existent product (never auto-create products)", () => {
      const res = validateLedgerAction(
        {
          action: "adjust_stock",
          product: "Unknown Product X",
          qty_change: 10,
          confidence: 0.95,
          summary: "Add stock",
        },
        { productStock: { "tata namak": 5 } }
      );
      assert.equal(res.valid, false);
      assert.match(res.error || "", /Product "Unknown Product X" does not exist in inventory/);
    });

    it("should reject stock reduction when reduction exceeds available stock (negative stock)", () => {
      const res = validateLedgerAction(
        {
          action: "adjust_stock",
          product: "Tata Namak",
          qty_change: -10,
          confidence: 0.95,
          summary: "Excess reduction",
        },
        { productStock: { "tata namak": 4 } }
      );
      assert.equal(res.valid, false);
      assert.match(res.error || "", /Stock cannot be negative/);
      assert.match(res.error || "", /currently has 4, cannot reduce by 10/);
    });
  });
});

describe("Customer Name Matcher — Disambiguation, Surnames & Honorifics", () => {
  const shopCustomers: Customer[] = [
    { id: "c1", shop_id: "s1", name: "Ramesh Kumar", phone: "9876543210" },
    { id: "c2", shop_id: "s1", name: "Ramesh Patel", phone: "9876543211" },
    { id: "c3", shop_id: "s1", name: "Sunil Verma", phone: "9876543212" },
    { id: "c4", shop_id: "s1", name: "Anita Sharma", phone: "9876543213" },
  ];

  it("should return status 'ambiguous' when two customers share the same first name (Ramesh)", () => {
    const res = findBestCustomerMatch("Ramesh", shopCustomers);
    assert.equal(res.status, "ambiguous");
    assert.equal(res.matched, null);
    assert.ok(res.candidates.length >= 2);
    const candidateNames = res.candidates.map((c) => c.customer.name);
    assert.ok(candidateNames.includes("Ramesh Kumar"));
    assert.ok(candidateNames.includes("Ramesh Patel"));
  });

  it("should return status 'ambiguous' for honorific 'Ramesh ji' when multiple Ramesh exist", () => {
    const res = findBestCustomerMatch("Ramesh ji", shopCustomers);
    assert.equal(res.status, "ambiguous");
    assert.equal(res.matched, null);
    assert.ok(res.candidates.length >= 2);
  });

  it("should resolve unambiguously when full surname is provided ('Ramesh Kumar')", () => {
    const res = findBestCustomerMatch("Ramesh Kumar", shopCustomers);
    assert.equal(res.status, "matched");
    assert.equal(res.matched?.id, "c1");
    assert.equal(res.matched?.name, "Ramesh Kumar");
  });

  it("should resolve unambiguously when surname + honorific is provided ('Ramesh Patel bhai')", () => {
    const res = findBestCustomerMatch("Ramesh Patel bhai", shopCustomers);
    assert.equal(res.status, "matched");
    assert.equal(res.matched?.id, "c2");
    assert.equal(res.matched?.name, "Ramesh Patel");
  });

  it("should preserve surnames and NEVER strip them (Sunil Sharma vs Sunil Verma)", () => {
    // Customer in shop is Sunil Verma. Query is Sunil Sharma.
    // Because Sharma is a surname (not an honorific), it must NOT match Sunil Verma!
    const res = findBestCustomerMatch("Sunil Sharma", shopCustomers);
    // Since Anita Sharma and Sunil Verma exist, Sunil Sharma is a different person -> status 'ambiguous' or 'new', NOT auto-merged to Sunil Verma!
    assert.notEqual(res.matched?.id, "c3");
  });

  it("should return status 'new' for completely new customer", () => {
    const res = findBestCustomerMatch("Vikas Yadav", shopCustomers);
    assert.equal(res.status, "new");
    assert.equal(res.matched, null);
    assert.equal(res.proposedName, "Vikas Yadav");
  });

  it("should strip allowed cultural honorifics (ji, bhai, bhaiya, uncle, aunty, didi, sahab, seth)", () => {
    const res = findBestCustomerMatch("Anita didi", shopCustomers);
    assert.equal(res.status, "matched");
    assert.equal(res.matched?.name, "Anita Sharma");
  });
});

describe("Server-side Dual Confirms for Same Customer (Postgres RPC Math)", () => {
  interface SimTransaction {
    id: string;
    shop_id: string;
    customer_id: string;
    total: number;
    paid: number;
    idempotency_key: string;
  }

  it("creates two transactions and adds both balances when two confirms have different keys for the same customer", () => {
    const shopId = "shop-ledger-1";
    const customerId = "cust-ramesh-1";
    const transactions: SimTransaction[] = [];
    const customerBalances: Record<string, number> = { [customerId]: 0 };

    function processEntry(payload: {
      shop_id: string;
      customer_id: string;
      total: number;
      paid: number;
      idempotency_key: string;
    }) {
      // Idempotency check matching 002_ledger.sql
      const existing = transactions.find(
        (t) => t.shop_id === payload.shop_id && t.idempotency_key === payload.idempotency_key
      );
      if (existing) {
        return {
          success: true,
          idempotent: true,
          transaction_id: existing.id,
          balance: customerBalances[payload.customer_id] || 0,
        };
      }

      const tx: SimTransaction = {
        id: `tx-${transactions.length + 1}`,
        shop_id: payload.shop_id,
        customer_id: payload.customer_id,
        total: payload.total,
        paid: payload.paid,
        idempotency_key: payload.idempotency_key,
      };
      transactions.push(tx);

      // Udhar addition
      const udhar = payload.total - payload.paid;
      customerBalances[payload.customer_id] = (customerBalances[payload.customer_id] || 0) + udhar;

      return {
        success: true,
        idempotent: false,
        transaction_id: tx.id,
        balance: customerBalances[payload.customer_id],
      };
    }

    const key1 = "00000000-0000-4000-8000-000000000001";
    const key2 = "00000000-0000-4000-8000-000000000002";

    // 1. Confirm 1 for Ramesh: Rs 500 total, Rs 200 paid => Rs 300 udhar
    const res1 = processEntry({
      shop_id: shopId,
      customer_id: customerId,
      total: 500,
      paid: 200,
      idempotency_key: key1,
    });
    assert.equal(res1.success, true);
    assert.equal(res1.idempotent, false);
    assert.equal(res1.balance, 300);
    assert.equal(transactions.length, 1);

    // Retry of confirm 1 with same key: must be idempotent
    const retryRes = processEntry({
      shop_id: shopId,
      customer_id: customerId,
      total: 500,
      paid: 200,
      idempotency_key: key1,
    });
    assert.equal(retryRes.idempotent, true);
    assert.equal(retryRes.balance, 300);
    assert.equal(transactions.length, 1);

    // 2. Confirm 2 for the SAME Ramesh with fresh key: Rs 400 total, Rs 100 paid => Rs 300 udhar
    const res2 = processEntry({
      shop_id: shopId,
      customer_id: customerId,
      total: 400,
      paid: 100,
      idempotency_key: key2,
    });
    assert.equal(res2.success, true);
    assert.equal(res2.idempotent, false);
    assert.notEqual(res2.transaction_id, res1.transaction_id);

    // Balance adds both entries: 300 + 300 = 600
    assert.equal(res2.balance, 600);
    assert.equal(customerBalances[customerId], 600);
    assert.equal(transactions.length, 2, "Two distinct keys must record two transactions");
  });
});

