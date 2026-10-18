import { parseShopkeeperInput } from "../src/lib/agents/parser";

async function runSmokeAi() {
  console.log("=================================================");
  console.log("DukaanAI — Manual AI Smoke Test (3 Real Calls)");
  console.log("=================================================\n");

  const testCases = [
    "Ramesh ne 500 ka saaman liya, 200 abhi diye",
    "Ramesh ne 300 de diye",
    "Suresh ji ne do sau pachas rupaye jama karwaye",
  ];

  for (let i = 0; i < testCases.length; i++) {
    const input = testCases[i];
    console.log(`[Call ${i + 1}/3] Parsing: "${input}"`);
    const start = Date.now();
    try {
      const result = await parseShopkeeperInput(input);
      const elapsed = Date.now() - start;
      console.log(`  ✓ Success in ${elapsed}ms (Model: ${result.model_used})`);
      console.log(`  Action: ${result.action}`);
      console.log(`  Data:`, JSON.stringify(result.data));
      console.log(`  Summary: ${result.summary}`);
      console.log(`  Confidence: ${result.confidence}\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✖ Failed: ${msg}\n`);
    }
  }

  console.log("Smoke test completed.");
}

runSmokeAi().catch((err) => {
  console.error("Fatal smoke test error:", err);
  process.exit(1);
});
