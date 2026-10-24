import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createParseSession,
  prepareRetryPayload,
  resetParseSession,
  buildConfirmPayload,
  ParseApiResponse,
  ParseSession,
  generateIdempotencyKey,
} from "../src/lib/confirm-helpers";

describe("Confirmation Key Lifecycle (BUG A)", () => {
  const sampleCustomerParseResult: ParseApiResponse = {
    success: true,
    parsed: {
      action: "add_sale",
      data: {
        customer: "Ramesh Kumar",
        total: 500,
        paid: 200,
        items: [{ product: "Rice", qty: 2, unit_price: 250, total: 500 }],
      },
      confidence: 0.95,
      summary: "Sale of Rice to Ramesh Kumar for Rs 500 (Rs 200 paid)",
    },
    customer_match: {
      status: "matched",
      matched: { id: "cust-ramesh-1", name: "Ramesh Kumar", phone: "9876543210" },
      candidates: [],
      score: 1.0,
      originalQuery: "Ramesh Kumar",
      normalizedQuery: "ramesh kumar",
    },
  };

  const sampleCustomerParseResult2: ParseApiResponse = {
    success: true,
    parsed: {
      action: "add_sale",
      data: {
        customer: "Ramesh Kumar",
        total: 300,
        paid: 0,
        items: [{ product: "Dal", qty: 1, unit_price: 300, total: 300 }],
      },
      confidence: 0.92,
      summary: "Sale of Dal to Ramesh Kumar for Rs 300 (udhar)",
    },
    customer_match: {
      status: "matched",
      matched: { id: "cust-ramesh-1", name: "Ramesh Kumar", phone: "9876543210" },
      candidates: [],
      score: 1.0,
      originalQuery: "Ramesh Kumar",
      normalizedQuery: "ramesh kumar",
    },
  };

  it("(1) Two sequential parses for the same customer produce different keys and two confirm payloads", () => {
    // First parse arrives for Ramesh
    const session1 = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice, 200 diya");
    assert.ok(session1.idempotencyKey, "Session 1 must have an idempotency key");
    assert.match(
      session1.idempotencyKey,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Key must be a valid RFC4122 UUID"
    );

    // Build payload for first entry
    const payload1 = buildConfirmPayload({
      action: session1.parseResult.parsed.action,
      idempotencyKey: session1.idempotencyKey,
      rawInput: session1.rawInput,
      summary: session1.parseResult.parsed.summary,
      confidence: session1.parseResult.parsed.confidence,
      customerName: "Ramesh Kumar",
      total: 500,
      paid: 200,
    });

    // Second parse arrives for the same customer (Ramesh)
    const session2 = createParseSession(sampleCustomerParseResult2, "Ramesh 300 dal udhar");
    assert.ok(session2.idempotencyKey, "Session 2 must have an idempotency key");
    assert.match(
      session2.idempotencyKey,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Key 2 must be a valid RFC4122 UUID"
    );

    // CRITICAL: Keys must NOT collide across sequential parses
    assert.notEqual(
      session1.idempotencyKey,
      session2.idempotencyKey,
      "Sequential parses for the same customer must have distinct idempotency keys"
    );

    // Build payload for second entry
    const payload2 = buildConfirmPayload({
      action: session2.parseResult.parsed.action,
      idempotencyKey: session2.idempotencyKey,
      rawInput: session2.rawInput,
      summary: session2.parseResult.parsed.summary,
      confidence: session2.parseResult.parsed.confidence,
      customerName: "Ramesh Kumar",
      total: 300,
      paid: 0,
    });

    assert.equal(payload1.customer, "Ramesh Kumar");
    assert.equal(payload2.customer, "Ramesh Kumar");
    assert.equal(payload1.idempotency_key, session1.idempotencyKey);
    assert.equal(payload2.idempotency_key, session2.idempotencyKey);
    assert.notEqual(payload1.idempotency_key, payload2.idempotency_key);
    assert.equal(payload1.total, 500);
    assert.equal(payload2.total, 300);
  });

  it("(2) A retry after a network failure of the same entry reuses its key", () => {
    const session = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice");
    const originalKey = session.idempotencyKey;

    // First attempt payload
    const attempt1 = prepareRetryPayload(session, { total: 500, paid: 200 });
    assert.equal(attempt1.idempotency_key, originalKey);

    // Network drops / fails, user clicks Retry
    const attempt2 = prepareRetryPayload(session, { total: 500, paid: 200 });
    assert.equal(
      attempt2.idempotency_key,
      originalKey,
      "Retry of the same parse session must preserve the exact same idempotency key"
    );

    // Third retry
    const attempt3 = prepareRetryPayload(session, { total: 500, paid: 200 });
    assert.equal(attempt3.idempotency_key, originalKey);
  });

  it("(3) After success (or dismiss/cancel), state resets and subsequent parse gets fresh key", () => {
    let currentSession: ParseSession | null = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice");
    const key1 = currentSession.idempotencyKey;
    assert.ok(key1);

    // Successful confirm or dismiss -> drop state
    currentSession = resetParseSession();
    assert.equal(currentSession, null, "resetParseSession must return null to drop card state");

    // Later, new speech/text parse arrives
    currentSession = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice");
    const key2 = currentSession.idempotencyKey;
    assert.ok(key2);
    assert.notEqual(key1, key2, "New session after reset must receive a fresh key");
  });
});

describe("Server-Side Two Confirms for Same Customer Math & Transactions", () => {
  /**
   * Simulates Postgres RPC process_ledger_entry behavior from supabase/migrations/002_ledger.sql
   */
  interface DbTransaction {
    id: string;
    shop_id: string;
    customer_id: string;
    total_amount: number;
    paid_amount: number;
    idempotency_key: string;
  }

  function simulateProcessLedgerEntry(
    state: {
      transactions: DbTransaction[];
      customerBalances: Record<string, number>;
    },
    payload: {
      shop_id: string;
      customer_id: string;
      total: number;
      paid: number;
      idempotency_key: string;
    }
  ) {
    // 1. Check idempotency: if transaction exists with (shop_id, idempotency_key), return existing
    const existing = state.transactions.find(
      (tx) =>
        tx.shop_id === payload.shop_id &&
        tx.idempotency_key === payload.idempotency_key
    );

    if (existing) {
      return {
        success: true,
        idempotent: true,
        transaction_id: existing.id,
        customer_balance: state.customerBalances[payload.customer_id] || 0,
      };
    }

    // 2. Insert new transaction
    const newTx: DbTransaction = {
      id: generateIdempotencyKey(),
      shop_id: payload.shop_id,
      customer_id: payload.customer_id,
      total_amount: payload.total,
      paid_amount: payload.paid,
      idempotency_key: payload.idempotency_key,
    };
    state.transactions.push(newTx);

    // 3. Update customer udhar balance: udhar_added = total - paid
    const udharAdded = payload.total - payload.paid;
    const currentBal = state.customerBalances[payload.customer_id] || 0;
    const newBalance = currentBal + udharAdded;
    state.customerBalances[payload.customer_id] = newBalance;

    return {
      success: true,
      idempotent: false,
      transaction_id: newTx.id,
      customer_balance: newBalance,
    };
  }

  it("creates two transactions and adds both balances when two confirms have different keys for the same customer", () => {
    const dbState = {
      transactions: [] as DbTransaction[],
      customerBalances: { "cust-ramesh-1": 0 } as Record<string, number>,
    };

    const shopId = "shop-test-1";
    const customerId = "cust-ramesh-1";

    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    assert.notEqual(key1, key2);

    // Confirm 1: Sale of Rs 500, paid Rs 200 => Udhar = Rs 300
    const res1 = simulateProcessLedgerEntry(dbState, {
      shop_id: shopId,
      customer_id: customerId,
      total: 500,
      paid: 200,
      idempotency_key: key1,
    });

    assert.equal(res1.success, true);
    assert.equal(res1.idempotent, false);
    assert.equal(res1.customer_balance, 300);
    assert.equal(dbState.transactions.length, 1);
    assert.equal(dbState.customerBalances[customerId], 300);

    // Duplicate confirm with Key 1 (idempotency check): must NOT add duplicate balance
    const dupRes = simulateProcessLedgerEntry(dbState, {
      shop_id: shopId,
      customer_id: customerId,
      total: 500,
      paid: 200,
      idempotency_key: key1,
    });
    assert.equal(dupRes.idempotent, true);
    assert.equal(dupRes.transaction_id, res1.transaction_id);
    assert.equal(dupRes.customer_balance, 300);
    assert.equal(dbState.transactions.length, 1, "Duplicate key must not create a second transaction");
    assert.equal(dbState.customerBalances[customerId], 300);

    // Confirm 2: Second entry for the same customer!
    // Sale of Rs 300, paid Rs 100 => Udhar = Rs 200
    const res2 = simulateProcessLedgerEntry(dbState, {
      shop_id: shopId,
      customer_id: customerId,
      total: 300,
      paid: 100,
      idempotency_key: key2,
    });

    assert.equal(res2.success, true);
    assert.equal(res2.idempotent, false);
    assert.notEqual(res2.transaction_id, res1.transaction_id);

    // Balance adds both: 300 + 200 = 500
    assert.equal(res2.customer_balance, 500);
    assert.equal(dbState.customerBalances[customerId], 500);
    assert.equal(dbState.transactions.length, 2, "Two distinct keys must create two transactions");

    // Both transactions verify
    assert.equal(dbState.transactions[0].idempotency_key, key1);
    assert.equal(dbState.transactions[1].idempotency_key, key2);
    assert.equal(dbState.transactions[0].customer_id, customerId);
    assert.equal(dbState.transactions[1].customer_id, customerId);
  });
});
