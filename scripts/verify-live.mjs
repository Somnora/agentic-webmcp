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
      if (!response.headers.get("X-Agentic-Correlation-Id")) throw new Error("missing correlation id");
      if (!response.headers.get("Server-Timing")?.includes("app;dur=")) throw new Error("missing server timing");
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
      if (body.handoff?.eligible !== true || body.handoff?.maxAgeSeconds !== 300) throw new Error("controlled origin handoff policy is not ready");
    },
  },
  {
    name: "workspace",
    run: async () => {
      const response = await fetch(`${baseUrl}/`);
      const html = await response.text();
      if (response.status !== 200 || !html.includes("Compare the evidence") || !html.includes("recommend-form") || !html.includes("interpolate-form") || !html.includes("presenter-toggle") || !html.includes("download-dossier")) throw new Error("workspace unavailable");
      const dossierResponse = await fetch(`${baseUrl}/dossier.js`);
      const dossierScript = await dossierResponse.text();
      if (dossierResponse.status !== 200 || !dossierScript.includes("createDecisionDossier")) throw new Error("decision dossier client unavailable");
    },
  },
  {
    name: "origin reliability diagnostics",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/origins/diagnostics?originId=catalog-lab`);
      const body = await response.json();
      if (response.status !== 200 || body.status !== "live" || body.activeAdapter !== "public-products-json") throw new Error("origin diagnostics unavailable");
      if (body.correlationId !== response.headers.get("X-Agentic-Correlation-Id")) throw new Error("diagnostic correlation mismatch");
      if (!Array.isArray(body.attempts) || body.attempts.length < 2 || body.attempts.some((attempt) => attempt.outcome !== "success" || typeof attempt.durationMs !== "number")) {
        throw new Error("adapter timing evidence missing");
      }
      if (!response.headers.get("Server-Timing")?.includes("public-products-json")) throw new Error("adapter server timing missing");
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
      if (response.status !== 200 || !Array.isArray(body.origins) || body.origins.length < 1 || body.origins.length > 2) throw new Error("unexpected origin list");
      if (body.manifestVersion !== "2026-09-01") throw new Error("origin manifest version mismatch");
      if (body.origins.some((origin) => !["catalog-lab", "review-shop"].includes(origin.id))) throw new Error("unknown origin was listed");
      const controlled = body.origins.find((origin) => origin.id === "catalog-lab");
      const merchant = body.origins.find((origin) => origin.id === "review-shop");
      if (!controlled || controlled.hostname !== "agentic-webmcp-origin.somnora.workers.dev") throw new Error("default origin mismatch");
      if (controlled.mode !== "controlled-demo") throw new Error("demo origin is not labeled");
      if (controlled.authorization?.status !== "first-party-controlled") throw new Error("controlled origin authorization missing");
      if (merchant && merchant.authorization?.status !== "operator-authorized") throw new Error("merchant origin authorization is invalid");
      if (merchant && Date.parse(merchant.authorization.reviewAfter) <= Date.now()) throw new Error("expired merchant origin remains discoverable");
      if (body.origins.some((origin) => origin.capabilities?.checkout !== false || origin.capabilities?.payment !== false)) throw new Error("checkout or payment capability must be disabled");
    },
  },
  {
    name: "origin conformance contract",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/origins/conformance?originId=catalog-lab`);
      const body = await response.json();
      if (response.status !== 200 || body.status !== "pass" || body.checks?.length !== 10) throw new Error("origin conformance failed");
      if (!body.checks.every((item) => item.status === "pass")) throw new Error("origin conformance contains a non-pass result");
      if (!body.checks.some((item) => item.id === "provenance" && item.detail.includes("Verified across product JSON and page"))) {
        throw new Error("origin conformance did not reconcile product JSON and page evidence");
      }
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
      if (!body.offers.every((offer) => offer.handoff?.eligible === true && offer.handoff?.freshness === "fresh")) throw new Error("offer handoff policy missing");
    },
  },
  {
    name: "product details",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/products/sunburst-s-style-electric?originId=catalog-lab`);
      const body = await response.json();
      if (response.status !== 200 || body.live !== true || body.offers?.[0]?.handle !== "sunburst-s-style-electric") throw new Error("guitar listing unavailable");
      if (body.offers[0]?.marketplace?.condition !== "excellent") throw new Error("marketplace evidence unavailable");
      if (body.offers[0]?.handoff?.eligible !== true) throw new Error("live listing is not handoff eligible");
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
      if (body.offer?.handoff?.eligible !== true) throw new Error("interpolated Offer is not handoff eligible");
      const verification = body.offer?.provenance?.verification;
      if (verification?.state !== "verified" || verification?.label !== "Verified across product JSON and page") throw new Error("evidence reconciliation missing");
      for (const field of ["pricing", "availability", "condition", "shipping", "returns"]) {
        if (!verification.verifiedFields?.includes(field)) throw new Error(`${field} was not reconciled`);
      }
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
      if (body.offers?.[0]?.handoff?.eligible !== true) throw new Error("proposal did not use an eligible Offer");
      const line = body.quote?.lines?.[0];
      const commitBody = {
        originId: body.quote?.originId,
        quote: body.quote,
        handle: line?.handle,
        variantId: line?.variantId,
        quantity: line?.quantity,
      };
      const blocked = await fetch(`${baseUrl}/api/cart/commit?originId=catalog-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commitBody),
      });
      if (blocked.status !== 400 || (await blocked.json()).code !== "HUMAN_CONFIRMATION_REQUIRED") {
        throw new Error("commit did not require the human button");
      }
      const confirmed = await fetch(`${baseUrl}/api/cart/commit?originId=catalog-lab`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agentic-Human-Confirm": "true" },
        body: JSON.stringify(commitBody),
      });
      const confirmedBody = await confirmed.json();
      if (confirmed.status !== 200 || confirmedBody.receipt?.status !== "in_cart") throw new Error("human approval receipt failed");
      if (confirmedBody.receipt?.quoteId !== body.quote?.quoteId || JSON.stringify(confirmedBody.receipt?.lines) !== JSON.stringify(body.quote?.lines)) {
        throw new Error("receipt did not preserve the reviewed quote facts");
      }
    },
  },
  {
    name: "authorized merchant policy",
    run: async () => {
      const originsResponse = await fetch(`${baseUrl}/api/origins`);
      const origins = await originsResponse.json();
      const merchant = origins.origins?.find((origin) => origin.id === "review-shop");
      const healthResponse = await fetch(`${baseUrl}/api/origins/health?originId=review-shop`);
      const health = await healthResponse.json();
      if (!merchant) {
        if (healthResponse.status !== 403 || health.code !== "ORIGIN_AUTHORIZATION_INACTIVE") throw new Error("expired merchant origin did not fail closed");
        const conformanceResponse = await fetch(`${baseUrl}/api/origins/conformance?originId=review-shop`);
        const conformance = await conformanceResponse.json();
        if (conformanceResponse.status !== 200 || conformance.status !== "fail" || !conformance.checks?.some((item) => item.id === "authorization" && item.status === "fail")) {
          throw new Error("expired merchant conformance report unavailable");
        }
        return;
      }
      if (healthResponse.status !== 200 || health.origin?.authorization?.status !== "operator-authorized") throw new Error("merchant manifest unavailable");
      const response = await fetch(`${baseUrl}/api/cart/propose?originId=review-shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originId: "review-shop", handle: "the-complete-snowboard", variantTitle: "Ice", quantity: 1 }),
      });
      const body = await response.json();
      if (health.catalog?.live === true) {
        if (response.status !== 200 || body.offers?.[0]?.handoff?.eligible !== true) throw new Error("live merchant proposal proof failed");
      } else if (response.status !== 409 || body.code !== "OFFER_NOT_ELIGIBLE") {
        throw new Error("fallback merchant proposal was not rejected");
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
