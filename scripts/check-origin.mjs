const args = process.argv.slice(2);
const originId = (args[0] || "catalog-lab").trim();
const baseInput = args[1] || process.env.AGENTIC_WEBMCP_URL || "http://127.0.0.1:8787";

let base;
try {
  base = new URL(baseInput);
} catch {
  console.error("App URL must be a valid URL.");
  process.exit(1);
}
const local = base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname);
if (base.username || base.password || base.search || base.hash || (!local && base.protocol !== "https:")) {
  console.error("App URL must use HTTPS, except for localhost development.");
  process.exit(1);
}

const endpoint = new URL("/api/origins/conformance", base);
endpoint.searchParams.set("originId", originId);
let response;
try {
  response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
} catch (error) {
  console.error(`Origin conformance request failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}
let report;
try {
  report = await response.json();
} catch {
  console.error(`Origin conformance returned HTTP ${response.status} without JSON.`);
  process.exit(1);
}
if (!response.ok) {
  console.error(`${report.code || "CONFORMANCE_ERROR"}: ${report.error || `HTTP ${response.status}`}`);
  process.exit(1);
}

console.log(`Origin conformance: ${report.originId} | ${report.hostname}`);
console.log(`Status: ${String(report.status).toUpperCase()} | ${report.summary}`);
for (const item of report.checks) console.log(`${String(item.status).toUpperCase().padEnd(9)} ${item.id.padEnd(16)} ${item.detail}`);
if (report.status === "fail") process.exitCode = 1;
