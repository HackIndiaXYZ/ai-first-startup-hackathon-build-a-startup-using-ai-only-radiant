import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transliterateDevanagari, buildDeterministicSaleSummary, buildDeterministicPaymentSummary, buildDeterministicStockSummary } from "../src/lib/agents/parser";
import { SPEECH_LANG } from "../src/hooks/use-speech-recognition";
import { STRINGS } from "../src/lib/strings";

describe("Language Pass — Zero Devanagari in src/ & English Fallbacks", () => {
  it("should have ZERO Devanagari characters ([\\u0900-\\u097F]) in any file under src/", () => {
    const srcDir = path.resolve(__dirname, "../src");
    const allowedExtensions = new Set([".ts", ".tsx", ".css", ".json", ".md"]);
    const violations: { file: string; line: number; text: string }[] = [];
    const devanagariRegex = /[\u0900-\u097F]/;

    function walkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (devanagariRegex.test(lines[i])) {
              violations.push({
                file: path.relative(path.resolve(__dirname, ".."), fullPath),
                line: i + 1,
                text: lines[i].trim(),
              });
            }
          }
        }
      }
    }

    walkDir(srcDir);

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} Devanagari violations in src/:\n` +
        violations.map((v) => `  ${v.file}:${v.line} -> ${v.text}`).join("\n")
    );
  });

  it("should enforce SPEECH_LANG === 'en-IN' for Romanized speech transcription", () => {
    assert.equal(SPEECH_LANG, "en-IN");
  });

  it("should transliterate Devanagari names to Roman script", () => {
    assert.equal(transliterateDevanagari("\u0930\u092E\u0947\u0936"), "Ramesh"); // रमेश
    assert.equal(transliterateDevanagari("\u0936\u0930\u094D\u092E\u093E"), "Sharma"); // शर्मा
    assert.equal(transliterateDevanagari("\u0935\u0930\u094D\u092E\u093E"), "Varma"); // वर्मा
    assert.equal(transliterateDevanagari("Ramesh Kumar"), "Ramesh Kumar");
  });

  it("should replace a Devanagari model summary with a deterministic English summary", () => {
    // Deterministic sale summary builder test
    const saleSummary = buildDeterministicSaleSummary(
      "Ramesh Kumar",
      500,
      200
    );
    assert.match(saleSummary, /Ramesh Kumar/);
    assert.match(saleSummary, /Rs 500/);
    assert.match(saleSummary, /Rs 200 cash, Rs 300 udhar/);
    assert.doesNotMatch(saleSummary, /[\u0900-\u097F]/);

    // Deterministic payment summary builder test
    const paymentSummary = buildDeterministicPaymentSummary("Suresh", 400);
    assert.match(paymentSummary, /Suresh paid Rs 400/);
    assert.doesNotMatch(paymentSummary, /[\u0900-\u097F]/);

    // Deterministic stock summary builder test
    const stockSummary = buildDeterministicStockSummary("Sugar", 10);
    assert.match(stockSummary, /Sugar: \+10 stock updated/);
    assert.doesNotMatch(stockSummary, /[\u0900-\u097F]/);
  });

  it("should export complete English strings dictionary with no Devanagari in values", () => {
    assert.ok(STRINGS);
    assert.ok(STRINGS.common.appName);
    assert.ok(STRINGS.home.typePlaceholder.includes("Ramesh ne 500 ka saaman liya, 200 abhi diye"));

    const strJson = JSON.stringify(STRINGS);
    assert.doesNotMatch(strJson, /[\u0900-\u097F]/);
  });
});
