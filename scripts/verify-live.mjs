import { execFileSync } from "node:child_process";

const baseUrl = (process.env.AGENTIC_WEBMCP_URL || "https://agentic-webmcp.somnora.workers.dev").replace(/\/$/, "");
const originUrl = "https://agentic-webmcp-origin.somnora.workers.dev";
const expectedCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const verificationKey = encodeURIComponent(expectedCommit);

const expectedTools = [
  "list_origins",
  "select_origin",
  "search_products",
  "find_best_options",
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
      const response = await fetch(`${baseUrl}/health?verification=${verificationKey}`);
      const body = await response.json();
      if (response.status !== 200 || body.status !== "ok" || body.defaultOriginId !== "catalog-lab") throw new Error(`unexpected response ${response.status}`);
      if (body.deployment?.commit !== expectedCommit) throw new Error(`deployment commit mismatch: ${body.deployment?.commit || "missing"}`);
      if (!body.deployment?.versionId || !body.deployment?.deployedAt) throw new Error("deployment metadata missing");
      if (response.headers.get("Origin-Agent-Cluster") !== "?1") throw new Error("missing origin isolation");
      if (!response.headers.get("Permissions-Policy")?.includes("tools=(self)")) throw new Error("missing tools policy");
      if (response.headers.get("X-Frame-Options") !== "DENY") throw new Error("missing framing denial");
    },
  },
  {
    name: "controlled origin service",
    run: async () => {
      const response = await fetch(`${originUrl}/health`);
      const body = await response.json();
      if (response.status !== 200 || body.status !== "ok" || body.products !== 4) throw new Error("controlled origin unavailable");
    },
  },
  {
    name: "origin adapter health",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/origins/health?originId=catalog-lab&verification=${verificationKey}`);
      const body = await response.json();
      if (response.status !== 200 || body.origin?.id !== "catalog-lab") throw new Error("origin health unavailable");
      if (body.status !== "live" || body.catalog?.adapter !== "public-products-json" || body.catalog?.live !== true || body.page?.live !== true) {
        throw new Error("controlled origin is not fully live");
      }
    },
  },
  {
    name: "workspace",
    run: async () => {
      const response = await fetch(`${baseUrl}/`);
      const html = await response.text();
      if (response.status !== 200 || !html.includes("Compare the evidence") || !html.includes("recommend-form") || !html.includes("interpolate-form") || !html.includes("presenter-toggle")) throw new Error("workspace unavailable");
    },
  },
  {
    name: "recording presenter client",
    run: async () => {
      const response = await fetch(`${baseUrl}/presenter.js`);
      const script = await response.text();
      if (response.status !== 200 || !script.includes("REHEARSAL_STEPS") || !script.includes("human_approval_button") || !script.includes("Guided demo complete")) {
        throw new Error("recording presenter unavailable");
      }
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
      if (response.status !== 200 || body.origins?.length !== 2) throw new Error("unexpected origin list");
      if (body.origins[0]?.id !== "catalog-lab" || body.origins[0]?.hostname !== "agentic-webmcp-origin.somnora.workers.dev") throw new Error("default origin mismatch");
      if (body.origins[0]?.mode !== "controlled-demo") throw new Error("demo origin is not labeled");
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
      const response = await fetch(`${baseUrl}/api/catalog?originId=catalog-lab&query=electric%20guitar&limit=4`);
      const body = await response.json();
      if (response.status !== 200 || body.live !== true || body.source !== "public-products-json" || !body.offers?.some((offer) => offer.handle === "sunburst-s-style-electric")) {
        throw new Error("catalog returned no live guitar offer");
      }
      if (!body.offers.every((offer) => offer.provenance?.pricing && offer.provenance?.availability)) throw new Error("offer provenance missing");
    },
  },
  {
    name: "product details",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/products/sunburst-s-style-electric?originId=catalog-lab`);
      const body = await response.json();
      if (response.status !== 200 || body.live !== true || body.offers?.[0]?.handle !== "sunburst-s-style-electric") throw new Error("guitar listing unavailable");
      if (body.offers[0]?.marketplace?.condition !== "excellent") throw new Error("marketplace evidence unavailable");
    },
  },
  {
    name: "explainable recommendations",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/recommendations?originId=catalog-lab&query=electric%20guitar&maxDeliveredPrice=900&limit=4`);
      const body = await response.json();
      if (response.status !== 200 || body.recommendations?.[0]?.handle !== "sunburst-s-style-electric") throw new Error("ranked options unavailable");
      if (typeof body.recommendations[0]?.score !== "number" || body.recommendations[0]?.factors?.condition === undefined) throw new Error("recommendation evidence missing");
    },
  },
  {
    name: "interpolation contract",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/interpolate?originId=catalog-lab&path=%2Fproducts%2Fsunburst-s-style-electric`);
      const body = await response.json();
      if (response.status !== 200 || body.offer?.handle !== "sunburst-s-style-electric" || body.live !== true || body.pageLive !== true) throw new Error("live interpolation unavailable");
      if (body.canonicalUrl !== `${originUrl}/products/sunburst-s-style-electric`) throw new Error("canonical URL mismatch");
      if (typeof body.markdown !== "string" || !body.markdown.includes("Canonical origin")) throw new Error("stripped Markdown missing");
      if (body.markdown.includes("Controlled WebMCP demonstration origin") || body.markdown.includes("Demonstration data only")) throw new Error("page chrome was not stripped");
    },
  },
  {
    name: "proposal does not commit",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/cart/propose?originId=catalog-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originId: "catalog-lab", handle: "sunburst-s-style-electric", variantTitle: "As listed", quantity: 1 }),
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
      const response = await fetch(`${baseUrl}/api/interpolate?originId=catalog-lab&path=%2Fcollections%2Fall`);
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
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await check.run();
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 2000));
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
