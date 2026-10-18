import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  recordAndCheckDbRateLimit,
  extractClientIp,
} from "../src/lib/rate-limit";
import { NextRequest } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

describe("Rate Limiting & Daily Quota Protection (DB-backed)", () => {
  it("should extract client IP from x-forwarded-for header", () => {
    const req = new NextRequest("http://localhost:3000/api/parse", {
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18",
      },
    });
    assert.equal(extractClientIp(req), "203.0.113.195");
  });

  it("should extract client IP from x-real-ip header", () => {
    const req = new NextRequest("http://localhost:3000/api/parse", {
      headers: {
        "x-real-ip": "198.51.100.42",
      },
    });
    assert.equal(extractClientIp(req), "198.51.100.42");
  });

  it("should fallback to 127.0.0.1 when IP headers are absent", () => {
    const req = new NextRequest("http://localhost:3000/api/parse");
    assert.equal(extractClientIp(req), "127.0.0.1");
  });

  it("should handle user rate limit rejection at 20/min from database procedure", async () => {
    const mockSupabase = {
      rpc: async () => ({
        data: {
          allowed: false,
          code: "RATE_LIMIT_USER",
          error: "Too many requests for this account (limit: 20/min). Please wait a moment.",
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const res = await recordAndCheckDbRateLimit(mockSupabase, "u1", "127.0.0.1");
    assert.equal(res.allowed, false);
    assert.equal(res.code, "RATE_LIMIT_USER");
    assert.match(res.error || "", /Too many requests for this account \(limit: 20\/min\)/);
  });

  it("should handle IP rate limit rejection at 15/min from database procedure", async () => {
    const mockSupabase = {
      rpc: async () => ({
        data: {
          allowed: false,
          code: "RATE_LIMIT_IP",
          error: "Too many requests from this IP address (limit: 15/min). Please wait a moment.",
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const res = await recordAndCheckDbRateLimit(mockSupabase, "u1", "10.0.0.1");
    assert.equal(res.allowed, false);
    assert.equal(res.code, "RATE_LIMIT_IP");
    assert.match(res.error || "", /limit: 15\/min/);
  });

  it("should return friendly 'demo limit reached, try again tomorrow' when daily cap is exceeded", async () => {
    const mockSupabase = {
      rpc: async () => ({
        data: {
          allowed: false,
          code: "DAILY_LIMIT_EXCEEDED",
          error: "demo limit reached, try again tomorrow",
          count: 201,
          cap: 200,
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const res = await recordAndCheckDbRateLimit(mockSupabase, "u1", "127.0.0.1");
    assert.equal(res.allowed, false);
    assert.equal(res.code, "DAILY_LIMIT_EXCEEDED");
    assert.equal(res.error, "demo limit reached, try again tomorrow");
  });

  it("should allow request when within rate limits", async () => {
    const mockSupabase = {
      rpc: async () => ({
        data: {
          allowed: true,
          count: 45,
          cap: 200,
        },
        error: null,
      }),
    } as unknown as SupabaseClient;

    const res = await recordAndCheckDbRateLimit(mockSupabase, "u1", "127.0.0.1");
    assert.equal(res.allowed, true);
    assert.equal(res.count, 45);
  });

  describe("SQL Migration 002_ledger.sql Rules Verification", () => {
    const migrationPath = path.resolve(__dirname, "../supabase/migrations/002_ledger.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    it("should set user limit to 20/min and keep IP limit at 15/min", () => {
      // User limit should check > 20
      assert.match(migrationSql, /v_user_count\s*>\s*20/);
      // IP limit should check > 15
      assert.match(migrationSql, /v_ip_count\s*>\s*15/);
    });

    it("should mark blocked calls as 'parse_blocked' so they do not count toward daily cap", () => {
      // Must update rate_limit_hits action to parse_blocked upon hitting limits
      assert.match(migrationSql, /set\s+action\s*=\s*'parse_blocked'/);
      // Must filter daily count strictly by action = 'parse'
      assert.match(migrationSql, /where\s+action\s*=\s*'parse'/);
    });

    it("should document known residual risk comment regarding direct RPC calls without service role key", () => {
      // Must explain the known residual risk (with 's' flag for multiline comment)
      assert.match(
        migrationSql,
        /residual risk.*signed-in user can call this RPC directly.*inflated up to the per-user limit/is
      );
      // Must state not adding service role key to API routes
      assert.match(
        migrationSql,
        /avoid adding the service role key to any API route/is
      );
    });
  });
});
