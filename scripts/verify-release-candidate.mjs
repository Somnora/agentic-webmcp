import { releaseCandidateChecks } from "./release-candidate-checks.mjs";

const baseUrl = (process.env.AGENTIC_WEBMCP_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
let failures = 0;

console.log(`Verifying personalized release candidate at ${baseUrl}`);
for (const check of releaseCandidateChecks(baseUrl)) {
  const started = Date.now();
  try {
    await check.run();
    console.log(`[PASS] ${check.name} (${Date.now() - started}ms)`);
  } catch (error) {
    failures += 1;
    console.error(`[FAIL] ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failures) process.exitCode = 1;
else console.log("All personalized release-candidate checks passed.");
