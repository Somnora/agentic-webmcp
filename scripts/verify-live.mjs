import { execFileSync } from "node:child_process";

const baseUrl = (process.env.AGENTIC_WEBMCP_URL || "https://agentic-webmcp.somnora.workers.dev").replace(/\/$/, "");
const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const expectedTools = [
  "list_origins",
  "select_origin",
  "search_products",
  "get_product",
  "compare_products",
  "interpolate_page",
  "create_catalog_brief",
  "propose_add_to_cart",
];

const checks = [
  {
    name: "health and security headers",
    run: async () => {
      const response = await fetch(`${baseUrl}/health`);
      const body = await response.json();
      if (response.status !== 200 || body.status !== "ok" || body.defaultOriginId !== "review-shop") throw new Error(`unexpected response ${response.status}`);
      if (body.deployment?.commit !== expectedCommit) throw new Error(`deployment commit mismatch: ${body.deployment?.commit || "missing"}`);
      if (!body.deployment?.versionId || !body.deployment?.deployedAt) throw new Error("deployment metadata missing");
      if (response.headers.get("Origin-Agent-Cluster") !== "?1") throw new Error("missing origin isolation");
      if (!response.headers.get("Permissions-Policy")?.includes("tools=(self)")) throw new Error("missing tools policy");
      if (response.headers.get("X-Frame-Options") !== "DENY") throw new Error("missing framing denial");
    },
  },
  {
    name: "origin adapter health",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/origins/health?originId=review-shop`);
      const body = await response.json();
      if (response.status !== 200 || body.origin?.id !== "review-shop") throw new Error("origin health unavailable");
      if (!body.catalog?.adapter || typeof body.page?.live !== "boolean" || !body.checkedAt) throw new Error("origin health incomplete");
    },
  },
  {
    name: "workspace",
    run: async () => {
      const response = await fetch(`${baseUrl}/`);
      const html = await response.text();
      if (response.status !== 200 || !html.includes("A structured agent view") || !html.includes("interpolate-form")) throw new Error("workspace unavailable");
    },
  },
  {
    name: "WebMCP registration client",
    run: async () => {
      const response = await fetch(`${baseUrl}/tools.js`);
      const script = await response.text();
      for (const tool of expectedTools) {
        if (!script.includes(`name: "${tool}"`)) throw new Error(`${tool} is not registered`);
      }
      if (script.includes("name: \"commit_add_to_cart\"")) throw new Error("commit tool must not be registered");
    },
  },
  {
    name: "origin allowlist",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/origins`);
      const body = await response.json();
      if (response.status !== 200 || body.origins?.length !== 1) throw new Error("unexpected origin list");
      if (body.origins[0]?.id !== "review-shop" || body.origins[0]?.hostname !== "agentic-app-review-test.myshopify.com") throw new Error("default origin mismatch");
    },
  },
  {
    name: "privacy disclosure",
    run: async () => {
      const response = await fetch(`${baseUrl}/privacy.html`);
      const html = await response.text();
      if (response.status !== 200 || !html.includes("Privacy for the public demo") || !html.includes("propose_add_to_cart")) throw new Error("privacy disclosure unavailable");
    },
  },
  {
    name: "catalog search",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/catalog?originId=review-shop&query=wax&limit=4`);
      const body = await response.json();
      if (response.status !== 200 || !Array.isArray(body.offers) || !body.offers.some((offer) => offer.handle === "selling-plans-ski-wax")) {
        throw new Error("catalog returned no wax offer");
      }
      if (!body.offers.every((offer) => offer.provenance?.pricing && offer.provenance?.availability)) throw new Error("offer provenance missing");
    },
  },
  {
    name: "product details",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/products/the-complete-snowboard?originId=review-shop`);
      const body = await response.json();
      if (response.status !== 200 || body.offers?.[0]?.handle !== "the-complete-snowboard") throw new Error("complete snowboard unavailable");
    },
  },
  {
    name: "interpolation contract",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/interpolate?originId=review-shop&path=%2Fproducts%2Fthe-complete-snowboard`);
      const body = await response.json();
      if (response.status !== 200 || body.offer?.handle !== "the-complete-snowboard") throw new Error("interpolation unavailable");
      if (body.canonicalUrl !== "https://agentic-app-review-test.myshopify.com/products/the-complete-snowboard") throw new Error("canonical URL mismatch");
      if (typeof body.markdown !== "string" || !body.markdown.includes("Canonical origin")) throw new Error("stripped Markdown missing");
    },
  },
  {
    name: "proposal does not commit",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/cart/propose?originId=review-shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originId: "review-shop", handle: "the-complete-snowboard", variantTitle: "Ice", quantity: 1 }),
      });
      const body = await response.json();
      if (response.status !== 200 || body.confirmation?.status !== "awaiting_human_confirmation" || body.receipt) {
        throw new Error("proposal contract failed");
      }
    },
  },
  {
    name: "allowlist rejection",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/interpolate?originId=review-shop&path=%2Fcollections%2Fall`);
      if (response.status !== 400) throw new Error(`expected 400, received ${response.status}`);
      const body = await response.json();
      if (body.code !== "PATH_NOT_ALLOWED" || body.retryable !== false) throw new Error("structured allowlist error missing");
    },
  },
];

let failures = 0;
console.log(`Verifying ${baseUrl}`);
for (const check of checks) {
  const started = Date.now();
  try {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await check.run();
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (lastError) throw lastError;
    console.log(`[PASS] ${check.name} (${Date.now() - started}ms)`);
  } catch (error) {
    failures += 1;
    console.error(`[FAIL] ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}
if (failures) process.exitCode = 1;
else console.log(`All ${checks.length} live checks passed.`);
