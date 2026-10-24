import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createParseSession,
  prepareRetryPayload,
  resetParseSession,
  buildConfirmPayload,
  ParseApiResponse,
  ParseSession,
} from "./confirm-helpers";

describe("Confirmation Key Lifecycle (src/lib)", () => {
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
    const session1 = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice, 200 diya");
    assert.ok(session1.idempotencyKey);
    assert.match(session1.idempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

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

    const session2 = createParseSession(sampleCustomerParseResult2, "Ramesh 300 dal udhar");
    assert.ok(session2.idempotencyKey);
    assert.match(session2.idempotencyKey, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    assert.notEqual(session1.idempotencyKey, session2.idempotencyKey);

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

    assert.equal(payload1.idempotency_key, session1.idempotencyKey);
    assert.equal(payload2.idempotency_key, session2.idempotencyKey);
    assert.notEqual(payload1.idempotency_key, payload2.idempotency_key);
  });

  it("(2) A retry after a network failure of the same entry reuses its key", () => {
    const session = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice");
    const originalKey = session.idempotencyKey;

    const attempt1 = prepareRetryPayload(session, { total: 500, paid: 200 });
    assert.equal(attempt1.idempotency_key, originalKey);

    const attempt2 = prepareRetryPayload(session, { total: 500, paid: 200 });
    assert.equal(attempt2.idempotency_key, originalKey);
  });

  it("(3) After success the state resets", () => {
    let currentSession: ParseSession | null = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice");
    const key1 = currentSession.idempotencyKey;

    currentSession = resetParseSession();
    assert.equal(currentSession, null);

    currentSession = createParseSession(sampleCustomerParseResult, "Ramesh 500 rice");
    const key2 = currentSession.idempotencyKey;
    assert.notEqual(key1, key2);
  });
});
