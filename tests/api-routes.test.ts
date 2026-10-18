import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POST as parseHandler } from "../src/app/api/parse/route";
import { POST as confirmHandler } from "../src/app/api/confirm/route";
import { NextRequest } from "next/server";

describe("API Route Handlers Security & Zod Validation", () => {
  it("POST /api/parse rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Ramesh ne 500 ka saaman liya" }),
    });

    const res = await parseHandler(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.code, "UNAUTHORIZED");
    assert.match(json.error, /Unauthorized/);
  });

  it("POST /api/confirm rejects unauthenticated requests with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: "123e4567-e89b-12d3-a456-426614174000",
        action: "add_sale",
        data: { customer: "Ramesh", total: 500, paid: 200 },
      }),
    });

    const res = await confirmHandler(req);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.code, "UNAUTHORIZED");
    assert.match(json.error, /Unauthorized/);
  });
});
