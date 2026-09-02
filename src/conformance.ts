import { searchProducts, type CatalogEnv } from "./catalog";
import { interpolatePage } from "./interpolate";
import { assertOfferAdapterContract, originAuthorizationState, validateOriginManifest } from "./origin-contract";
import { validateInterpolatePath, type Origin } from "./origins";
import { OriginFailure } from "./reliability";
import { fetchOriginText, type Fetcher } from "./upstream";

export type ConformanceStatus = "pass" | "attention" | "fail";

export type ConformanceCheck = {
  id: "manifest" | "authorization" | "hostname" | "paths" | "redirects" | "response-limits" | "adapters" | "provenance" | "freshness" | "fallback";
  status: ConformanceStatus;
  detail: string;
};

export type OriginConformanceReport = {
  originId: string;
  hostname: string;
  checkedAt: string;
  status: ConformanceStatus;
  summary: string;
  checks: ConformanceCheck[];
};

function check(id: ConformanceCheck["id"], status: ConformanceStatus, detail: string): ConformanceCheck {
  return { id, status, detail: detail.slice(0, 300) };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown validation failure.";
}

async function redirectPolicyCheck(origin: Origin): Promise<ConformanceCheck> {
  const redirectFetcher = (async () => new Response(null, {
    status: 302,
    headers: { Location: "https://off-origin.invalid/products/probe" },
  })) as Fetcher;
  try {
    await fetchOriginText(origin, origin.healthPath, { method: "GET" }, 1024, redirectFetcher);
    return check("redirects", "fail", "Off-origin redirects were not rejected.");
  } catch (error) {
    return errorText(error).includes("off-origin redirect")
      ? check("redirects", "pass", "Manual redirect handling rejects off-origin destinations.")
      : check("redirects", "fail", `Redirect policy check failed unexpectedly: ${errorText(error)}`);
  }
}

async function responseLimitCheck(origin: Origin): Promise<ConformanceCheck> {
  const oversizedFetcher = (async () => new Response("", {
    headers: { "Content-Length": String(origin.policy.maxPageResponseBytes + 1) },
  })) as Fetcher;
  try {
    await fetchOriginText(origin, origin.healthPath, { method: "GET" }, origin.policy.maxPageResponseBytes, oversizedFetcher);
    return check("response-limits", "fail", "An oversized response was accepted.");
  } catch (error) {
    return errorText(error).includes("byte limit")
      ? check("response-limits", "pass", `Responses above ${origin.policy.maxPageResponseBytes} bytes are rejected before parsing.`)
      : check("response-limits", "fail", `Response limit check failed unexpectedly: ${errorText(error)}`);
  }
}

async function fallbackCheck(origin: Origin, env: CatalogEnv): Promise<ConformanceCheck> {
  const unavailableFetcher = (async () => new Response(JSON.stringify({ error: "unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  })) as Fetcher;
  try {
    const result = await searchProducts("", 1, origin, unavailableFetcher, env);
    const mislabeled = result.live || result.offers.some((offer) => offer.source.live || offer.handoff.eligible);
    return mislabeled
      ? check("fallback", "fail", "An unavailable upstream produced live or handoff-eligible fallback data.")
      : check("fallback", "pass", `Unavailable upstreams produce labeled ${result.source} research data with handoff disabled.`);
  } catch (error) {
    return error instanceof OriginFailure && error.reason === "http-error"
      ? check("fallback", "pass", "Unavailable upstreams fail closed because this origin has no catalog snapshot fallback.")
      : check("fallback", "fail", `Fallback behavior could not be proven: ${errorText(error)}`);
  }
}

function overallStatus(checks: ConformanceCheck[]): ConformanceStatus {
  if (checks.some((item) => item.status === "fail")) return "fail";
  if (checks.some((item) => item.status === "attention")) return "attention";
  return "pass";
}

export async function runOriginConformance(
  origin: Origin,
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
  now = new Date(),
): Promise<OriginConformanceReport> {
  const checks: ConformanceCheck[] = [];
  const manifestIssues = validateOriginManifest(origin);
  checks.push(manifestIssues.length
    ? check("manifest", "fail", manifestIssues.join("; "))
    : check("manifest", "pass", "The origin manifest is structurally valid and its capabilities are explicit."));

  const authorizationCurrent = originAuthorizationState(origin, now.getTime()) === "current";
  checks.push(authorizationCurrent
    ? check("authorization", "pass", `${origin.authorization.status} authorization is current through ${origin.authorization.reviewAfter}.`)
    : check("authorization", "fail", "Authorization is not active for the current conformance time."));

  try {
    const canonical = new URL(origin.canonicalUrl);
    checks.push(canonical.protocol === "https:" && canonical.hostname === origin.hostname && canonical.origin === origin.canonicalUrl
      ? check("hostname", "pass", `Exact HTTPS hostname ${origin.hostname} is enforced.`)
      : check("hostname", "fail", "Canonical URL and exact HTTPS hostname do not match."));
  } catch (error) {
    checks.push(check("hostname", "fail", `Canonical URL is invalid: ${errorText(error)}`));
  }

  try {
    const allowed = validateInterpolatePath(origin, origin.healthPath);
    let rejected = false;
    try {
      validateInterpolatePath(origin, "/collections/not-allowlisted");
    } catch {
      rejected = true;
    }
    checks.push(rejected
      ? check("paths", "pass", `${allowed.path} is accepted and a non-product path is rejected.`)
      : check("paths", "fail", "A non-product path passed the interpolation allowlist."));
  } catch (error) {
    checks.push(check("paths", "fail", errorText(error)));
  }

  checks.push(await redirectPolicyCheck(origin));
  checks.push(await responseLimitCheck(origin));

  if (!authorizationCurrent) {
    checks.push(check("adapters", "fail", "Origin adapter probe was skipped because authorization is not current."));
    checks.push(check("provenance", "fail", "Offer provenance was not read because authorization is not current."));
    checks.push(check("freshness", "fail", "Offer freshness was not read because authorization is not current."));
  } else {
    try {
      const projection = await interpolatePage(origin, origin.healthPath, fetcher, env);
      const chain = new Set([origin.adapter, ...origin.fallbackAdapters, "bundled-snapshot"]);
      checks.push(chain.has(projection.source)
        ? check("adapters", projection.live ? "pass" : "attention", `${projection.source} returned ${projection.live ? "live" : "fallback"} Offer data. Page ${projection.pageLive ? "is live" : "is unavailable"}.`)
        : check("adapters", "fail", `Adapter ${projection.source} is outside the configured chain.`));
      try {
        assertOfferAdapterContract(origin, projection.offer);
        const verification = projection.offer.provenance.verification;
        checks.push(verification.state === "conflict"
          ? check("provenance", "fail", verification.label)
          : check("provenance", "pass", `${verification.label}. ${verification.verifiedFields.length} decision fields are cross-checked.`));
      } catch (error) {
        checks.push(check("provenance", "fail", errorText(error)));
      }
      const handoff = projection.offer.handoff;
      checks.push(handoff.eligible
        ? check("freshness", "pass", `Offer is fresh through ${handoff.freshUntil} under the ${handoff.maxAgeSeconds}-second policy.`)
        : projection.offer.source.live
          ? check("freshness", "fail", `Live Offer is not handoff eligible: ${handoff.reason}.`)
          : check("freshness", "attention", `Fallback Offer is correctly ineligible: ${handoff.reason}.`));
    } catch (error) {
      checks.push(check("adapters", "fail", `Origin adapter probe failed: ${errorText(error)}`));
      checks.push(check("provenance", "fail", "No normalized Offer was available for provenance validation."));
      checks.push(check("freshness", "fail", "No normalized Offer was available for freshness validation."));
    }
  }

  checks.push(await fallbackCheck(origin, env));
  const status = overallStatus(checks);
  const passed = checks.filter((item) => item.status === "pass").length;
  const attention = checks.filter((item) => item.status === "attention").length;
  const failed = checks.filter((item) => item.status === "fail").length;
  return {
    originId: origin.id,
    hostname: origin.hostname,
    checkedAt: now.toISOString(),
    status,
    summary: `${passed} passed, ${attention} need attention, ${failed} failed.`,
    checks,
  };
}
