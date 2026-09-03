import { assessOfferHandoff, type Offer } from "./offers";
import type { Adapter, Origin } from "./origins";

const ORIGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const HTTPS_PORT = "";
function unsafeOfferPathProbes(origin: Origin): string[] {
  return [
    "/",
    "/collections/not-allowlisted",
    `${origin.offerPathPrefix}/probe/extra`,
    `${origin.offerPathPrefix}/-invalid`,
    `${origin.offerPathPrefix}/INVALID`,
    `${origin.offerPathPrefix}/probe.json`,
    `${origin.offerPathPrefix}/probe%2Fextra`,
  ];
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export type OriginAuthorizationRuntimeState = "current" | "inactive" | "invalid" | "not-yet-active" | "expired";

export class OriginAuthorizationError extends Error {
  readonly originId: string;
  readonly state: Exclude<OriginAuthorizationRuntimeState, "current">;

  constructor(origin: Origin, state: Exclude<OriginAuthorizationRuntimeState, "current">) {
    const message = state === "expired"
      ? `Origin authorization expired at ${origin.authorization.reviewAfter}.`
      : state === "not-yet-active"
        ? `Origin authorization is not active until ${origin.authorization.attestedAt}.`
        : state === "inactive"
          ? "Origin authorization is inactive."
          : "Origin authorization dates are invalid.";
    super(message);
    this.name = "OriginAuthorizationError";
    this.originId = origin.id;
    this.state = state;
  }
}

export function originAuthorizationState(origin: Origin, now = Date.now()): OriginAuthorizationRuntimeState {
  if (origin.authorization.status === "inactive") return "inactive";
  const attestedAt = Date.parse(origin.authorization.attestedAt);
  const reviewAfter = Date.parse(origin.authorization.reviewAfter);
  if (!Number.isFinite(attestedAt) || !Number.isFinite(reviewAfter) || reviewAfter <= attestedAt) return "invalid";
  if (attestedAt > now) return "not-yet-active";
  if (reviewAfter <= now) return "expired";
  return "current";
}

export function assertOriginAuthorizationCurrent(origin: Origin, now = Date.now()): void {
  const state = originAuthorizationState(origin, now);
  if (state !== "current") throw new OriginAuthorizationError(origin, state);
}

function adapterChain(origin: Origin): Set<Adapter | "bundled-snapshot"> {
  return new Set([origin.adapter, ...origin.fallbackAdapters, "bundled-snapshot"]);
}

export function validateOriginManifest(origin: Origin): string[] {
  const issues: string[] = [];
  if (!ORIGIN_ID_PATTERN.test(origin.id)) issues.push("id must be a stable lowercase origin id");
  let canonical: URL | null = null;
  try {
    canonical = new URL(origin.canonicalUrl);
  } catch {
    issues.push("canonicalUrl must be a valid URL");
  }
  if (
    canonical
    && (canonical.protocol !== "https:"
      || canonical.hostname !== origin.hostname
      || canonical.port !== HTTPS_PORT
      || canonical.username
      || canonical.password
      || canonical.pathname !== "/"
      || canonical.search
      || canonical.hash)
  ) issues.push("canonicalUrl must be the exact HTTPS hostname root");
  if (origin.hostname !== origin.hostname.toLocaleLowerCase() || origin.hostname.length > 253) {
    issues.push("hostname must be lowercase and bounded");
  }
  if (!["/products", "/services"].includes(origin.offerPathPrefix) || !origin.healthPath.startsWith(`${origin.offerPathPrefix}/`)) {
    issues.push("offerPathPrefix must be bounded and match healthPath");
  }
  if (!origin.productPathPattern.startsWith("^") || !origin.productPathPattern.endsWith("$") || origin.productPathPattern.length > 240) {
    issues.push("productPathPattern must be anchored and bounded");
  }
  if (!origin.interpolatePathPatterns.length || origin.interpolatePathPatterns.some((pattern) => !pattern.startsWith("^") || !pattern.endsWith("$") || pattern.length > 240)) {
    issues.push("interpolatePathPatterns must contain anchored, bounded patterns");
  }
  try {
    const productPattern = new RegExp(origin.productPathPattern);
    const interpolationPatterns = origin.interpolatePathPatterns.map((pattern) => new RegExp(pattern));
    const productMatch = productPattern.exec(origin.healthPath);
    const expectedHandle = origin.healthPath.split("/").filter(Boolean).pop();
    if (!productMatch || !interpolationPatterns.some((pattern) => pattern.test(origin.healthPath))) {
      issues.push("healthPath must match the product and interpolation allowlists");
    }
    if (!productMatch?.[1] || productMatch[1] !== expectedHandle) {
      issues.push("productPathPattern must capture exactly one bounded product handle");
    }
    const unsafePaths = unsafeOfferPathProbes(origin);
    if (unsafePaths.some((path) => productPattern.test(path))) {
      issues.push("productPathPattern must reject non-product and nested paths");
    }
    if (interpolationPatterns.some((pattern) => unsafePaths.some((path) => pattern.test(path)))) {
      issues.push("interpolatePathPatterns must reject non-product and nested paths");
    }
  } catch {
    issues.push("path patterns must compile");
  }
  if (!origin.healthPath.startsWith("/") || origin.healthPath.startsWith("//") || origin.healthPath.includes("?") || origin.healthPath.includes("#")) {
    issues.push("healthPath must be a path without query or fragment");
  }
  const chain = [origin.adapter, ...origin.fallbackAdapters];
  if (new Set(chain).size !== chain.length) issues.push("adapter chain must not contain duplicates");
  if (origin.adapter === "public-services-json" && (origin.vertical !== "services" || origin.offerPathPrefix !== "/services")) {
    issues.push("public-services-json requires a services vertical and /services path prefix");
  }
  if (origin.vertical === "services" && origin.adapter !== "public-services-json") {
    issues.push("services vertical requires the public-services-json adapter");
  }
  if (origin.authorization.status === "inactive") issues.push("authorization must be active");
  for (const scope of ["catalog-read", "page-interpolation", "video-display"] as const) {
    if (!origin.authorization.scopes.includes(scope)) issues.push(`authorization must include ${scope}`);
  }
  if (!validDate(origin.authorization.attestedAt) || !validDate(origin.authorization.reviewAfter)) {
    issues.push("authorization dates must be valid ISO dates");
  } else if (Date.parse(origin.authorization.reviewAfter) <= Date.parse(origin.authorization.attestedAt)) {
    issues.push("authorization reviewAfter must be later than attestedAt");
  }
  if (origin.capabilities.catalogRead !== true || origin.capabilities.pageInterpolation !== true) {
    issues.push("catalog and interpolation capabilities must be explicit");
  }
  if (origin.capabilities.merchantHandoff !== "live-fresh-offer-only") {
    issues.push("merchant handoff must require a live fresh Offer");
  }
  if (origin.capabilities.checkout !== false || origin.capabilities.payment !== false) {
    issues.push("checkout and payment must remain disabled");
  }
  if (!Number.isInteger(origin.policy.maxOfferAgeSeconds) || origin.policy.maxOfferAgeSeconds < 30 || origin.policy.maxOfferAgeSeconds > 900) {
    issues.push("maxOfferAgeSeconds must be between 30 and 900");
  }
  if (!Number.isInteger(origin.policy.upstreamTimeoutMs) || origin.policy.upstreamTimeoutMs < 250 || origin.policy.upstreamTimeoutMs > 10_000) {
    issues.push("upstreamTimeoutMs must be between 250 and 10000");
  }
  for (const [name, value] of Object.entries({
    maxGraphqlResponseBytes: origin.policy.maxGraphqlResponseBytes,
    maxCatalogResponseBytes: origin.policy.maxCatalogResponseBytes,
    maxPageResponseBytes: origin.policy.maxPageResponseBytes,
  })) {
    if (!Number.isInteger(value) || value < 32 * 1024 || value > 1024 * 1024) issues.push(`${name} must be between 32768 and 1048576`);
  }
  return issues;
}

export function assertOriginRegistry(origins: readonly Origin[]): void {
  const ids = new Set<string>();
  const hostOrigins = new Map<string, Origin[]>();
  for (const origin of origins) {
    const issues = validateOriginManifest(origin);
    if (issues.length) throw new Error(`Origin manifest ${origin.id} is invalid: ${issues.join("; ")}.`);
    if (ids.has(origin.id)) throw new Error(`Origin manifest id ${origin.id} is duplicated.`);
    const peers = hostOrigins.get(origin.hostname) ?? [];
    for (const peer of peers) {
      const overlaps = new RegExp(peer.productPathPattern).test(origin.healthPath)
        || new RegExp(origin.productPathPattern).test(peer.healthPath)
        || peer.offerPathPrefix === origin.offerPathPrefix;
      if (overlaps) throw new Error(`Origin manifest hostname ${origin.hostname} has overlapping path scopes.`);
    }
    ids.add(origin.id);
    hostOrigins.set(origin.hostname, [...peers, origin]);
  }
}

export function assertOfferAdapterContract(origin: Origin, offer: Offer): void {
  const issues: string[] = [];
  const allowedAdapters = adapterChain(origin);
  if (offer.originId !== origin.id) issues.push("origin id mismatch");
  if (offer.vertical !== origin.vertical) issues.push("vertical mismatch");
  if (origin.vertical === "services" && !offer.service) issues.push("services vertical requires service evidence");
  if (origin.vertical !== "services" && offer.service) issues.push("service evidence is outside the selected vertical");
  if (!allowedAdapters.has(offer.source.adapter)) issues.push("source adapter is outside the manifest chain");
  if (offer.source.adapter === "bundled-snapshot" && offer.source.live) issues.push("bundled snapshot cannot be live");
  if (offer.source.adapter !== "bundled-snapshot" && !offer.source.live) issues.push("non-snapshot adapter cannot be labeled fallback");
  try {
    const url = new URL(offer.url);
    if (
      url.protocol !== "https:"
      || url.hostname !== origin.hostname
      || url.port
      || url.username
      || url.password
      || url.search
      || url.hash
      || !new RegExp(origin.productPathPattern).test(url.pathname)
    ) issues.push("canonical Offer URL is outside the manifest allowlist");
  } catch {
    issues.push("canonical Offer URL is invalid");
  }
  const currencies = [offer.priceRange.min, offer.priceRange.max, ...offer.variants.map((variant) => variant.price)];
  if (currencies.some((value) => value.currencyCode !== origin.currencyCode)) issues.push("currency mismatch");
  if (offer.handoff.maxAgeSeconds !== origin.policy.maxOfferAgeSeconds) issues.push("handoff freshness policy mismatch");
  const assessedAt = Date.parse(offer.source.fetchedAt);
  const expected = assessOfferHandoff(offer, assessedAt, origin.policy.maxOfferAgeSeconds);
  if (JSON.stringify(offer.handoff) !== JSON.stringify(expected)) issues.push("handoff eligibility projection mismatch");
  const { verification, ...fieldClaims } = offer.provenance;
  for (const [field, claim] of Object.entries(fieldClaims)) {
    if (!allowedAdapters.has(claim.primary) || claim.sources.some((adapter) => !allowedAdapters.has(adapter))) {
      issues.push(`${field} provenance is outside the manifest chain`);
    }
    if (!claim.sources.includes(claim.primary) || new Set(claim.sources).size !== claim.sources.length) {
      issues.push(`${field} provenance sources are invalid`);
    }
    if (claim.state === "conflict" && !claim.note) issues.push(`${field} conflict must explain the mismatch`);
  }
  if (verification.sources.some((adapter) => !allowedAdapters.has(adapter))) {
    issues.push("verification sources are outside the manifest chain");
  }
  const verified = new Set(verification.verifiedFields);
  const singleSource = new Set(verification.singleSourceFields);
  const conflicts = new Set(verification.conflictFields);
  if ([...verified].some((field) => singleSource.has(field) || conflicts.has(field)) || [...singleSource].some((field) => conflicts.has(field))) {
    issues.push("verification fields must have one state");
  }
  if ((verification.state === "conflict") !== (verification.conflictFields.length > 0)) {
    issues.push("verification conflict summary is inconsistent");
  }
  if (issues.length) throw new Error(`Offer ${offer.handle} violates origin ${origin.id}: ${issues.join("; ")}.`);
}
