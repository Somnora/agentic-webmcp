import { assertOriginAuthorizationCurrent, assertOriginRegistry, originAuthorizationState } from "./origin-contract";

export type Vertical = "retail" | "marketplace" | "wholesale" | "services" | "travel";

export type Adapter =
  | "shopify-storefront"
  | "shopify-products-json"
  | "public-products-json"
  | "public-services-json"
  | "json-ld"
  | "html-markdown";

export type OriginMode = "controlled-demo" | "live-merchant";

export type OriginAuthorization = {
  status: "first-party-controlled" | "operator-authorized" | "inactive";
  evidence: "repository-controlled-worker" | "operator-attestation";
  dataRights: "first-party-fixture" | "operator-controlled-store";
  scopes: readonly ("catalog-read" | "page-interpolation" | "video-display")[];
  attestedAt: string;
  reviewAfter: string;
};

export type OriginCapabilities = {
  catalogRead: true;
  pageInterpolation: true;
  merchantHandoff: "live-fresh-offer-only";
  checkout: false;
  payment: false;
};

export type OriginPolicy = {
  maxOfferAgeSeconds: number;
  upstreamTimeoutMs: number;
  maxGraphqlResponseBytes: number;
  maxCatalogResponseBytes: number;
  maxPageResponseBytes: number;
};

export type Origin = {
  id: string;
  mode: OriginMode;
  vertical: Vertical;
  displayName: string;
  hostname: string;
  canonicalUrl: string;
  adapter: Adapter;
  fallbackAdapters: readonly Adapter[];
  offerPathPrefix: "/products" | "/services";
  productPathPattern: string;
  interpolatePathPatterns: readonly string[];
  currencyCode: string;
  notes: string;
  healthPath: string;
  authorization: OriginAuthorization;
  capabilities: OriginCapabilities;
  policy: OriginPolicy;
  demo: {
    queries: readonly string[];
    handles: readonly string[];
    variant: string;
    briefGoal: string;
  };
};

export type PublicOrigin = Pick<
  Origin,
  "id" | "mode" | "vertical" | "displayName" | "hostname" | "canonicalUrl" | "adapter" | "fallbackAdapters" | "offerPathPrefix" | "notes" | "healthPath" | "authorization" | "capabilities" | "policy" | "demo"
>;

export const DEFAULT_ORIGIN_ID = "catalog-lab";
export const ORIGIN_MANIFEST_VERSION = "2026-09-02";

export const ORIGINS: readonly Origin[] = Object.freeze([
  Object.freeze({
    id: DEFAULT_ORIGIN_ID,
    mode: "controlled-demo",
    vertical: "marketplace",
    displayName: "Independent Gear Exchange",
    hostname: "agentic-webmcp-origin.somnora.workers.dev",
    canonicalUrl: "https://agentic-webmcp-origin.somnora.workers.dev",
    adapter: "public-products-json",
    fallbackAdapters: ["json-ld", "html-markdown"] as const,
    offerPathPrefix: "/products",
    productPathPattern: "^/products/([a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?)/?$",
    interpolatePathPatterns: [
      "^/products/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?/?$",
    ] as const,
    currencyCode: "USD",
    notes: "Controlled public marketplace. Live HTTPS responses, original guitar listings, no checkout or payment.",
    healthPath: "/products/sunburst-s-style-electric",
    authorization: {
      status: "first-party-controlled",
      evidence: "repository-controlled-worker",
      dataRights: "first-party-fixture",
      scopes: ["catalog-read", "page-interpolation", "video-display"] as const,
      attestedAt: "2026-08-26T00:00:00.000Z",
      reviewAfter: "2027-08-26T00:00:00.000Z",
    } as const,
    capabilities: {
      catalogRead: true,
      pageInterpolation: true,
      merchantHandoff: "live-fresh-offer-only",
      checkout: false,
      payment: false,
    } as const,
    policy: {
      maxOfferAgeSeconds: 300,
      upstreamTimeoutMs: 4000,
      maxGraphqlResponseBytes: 384 * 1024,
      maxCatalogResponseBytes: 512 * 1024,
      maxPageResponseBytes: 256 * 1024,
    },
    demo: {
      queries: ["electric guitar", "acoustic guitar", "offset guitar"],
      handles: ["sunburst-s-style-electric", "natural-dreadnought-acoustic"],
      variant: "As listed",
      briefGoal: "Find the strongest guitar option under 900 USD using condition, delivered price, seller confidence, and returns.",
    },
  }),
  Object.freeze({
    id: "services-lab",
    mode: "controlled-demo",
    vertical: "services",
    displayName: "Independent Services Directory",
    hostname: "agentic-webmcp-origin.somnora.workers.dev",
    canonicalUrl: "https://agentic-webmcp-origin.somnora.workers.dev",
    adapter: "public-services-json",
    fallbackAdapters: ["json-ld", "html-markdown"] as const,
    offerPathPrefix: "/services",
    productPathPattern: "^/services/([a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?)/?$",
    interpolatePathPatterns: [
      "^/services/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?/?$",
    ] as const,
    currencyCode: "USD",
    notes: "Controlled public services directory. Original Oahu and Tangier activity fixtures, with no booking, messaging, checkout, or payment.",
    healthPath: "/services/north-shore-surf-foundations",
    authorization: {
      status: "first-party-controlled",
      evidence: "repository-controlled-worker",
      dataRights: "first-party-fixture",
      scopes: ["catalog-read", "page-interpolation", "video-display"] as const,
      attestedAt: "2026-09-02T00:00:00.000Z",
      reviewAfter: "2027-09-02T00:00:00.000Z",
    } as const,
    capabilities: {
      catalogRead: true,
      pageInterpolation: true,
      merchantHandoff: "live-fresh-offer-only",
      checkout: false,
      payment: false,
    } as const,
    policy: {
      maxOfferAgeSeconds: 300,
      upstreamTimeoutMs: 4000,
      maxGraphqlResponseBytes: 384 * 1024,
      maxCatalogResponseBytes: 512 * 1024,
      maxPageResponseBytes: 256 * 1024,
    },
    demo: {
      queries: ["Oahu experience", "surf lesson", "wellness"],
      handles: ["north-shore-surf-foundations", "haleiwa-food-story-walk", "oahu-sunset-photo-walk"],
      variant: "Published service",
      briefGoal: "Plan a relaxed Oahu day for two people under 500 USD with a surf lesson, local food, and a sunset activity.",
    },
  }),
  Object.freeze({
    id: "review-shop",
    mode: "live-merchant",
    vertical: "retail",
    displayName: "Agentic App Review Shop",
    hostname: "agentic-app-review-test.myshopify.com",
    canonicalUrl: "https://agentic-app-review-test.myshopify.com",
    adapter: "shopify-storefront",
    fallbackAdapters: ["shopify-products-json", "json-ld", "html-markdown"] as const,
    offerPathPrefix: "/products",
    productPathPattern: "^/products/([a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?)/?$",
    interpolatePathPatterns: [
      "^/products/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?/?$",
    ] as const,
    currencyCode: "USD",
    notes: "Operator-authorized merchant origin. Public access can fall back to a research-only bundled snapshot.",
    healthPath: "/products/the-complete-snowboard",
    authorization: {
      status: "operator-authorized",
      evidence: "operator-attestation",
      dataRights: "operator-controlled-store",
      scopes: ["catalog-read", "page-interpolation", "video-display"] as const,
      attestedAt: "2026-08-30T00:00:00.000Z",
      reviewAfter: "2026-09-04T20:00:00.000Z",
    } as const,
    capabilities: {
      catalogRead: true,
      pageInterpolation: true,
      merchantHandoff: "live-fresh-offer-only",
      checkout: false,
      payment: false,
    } as const,
    policy: {
      maxOfferAgeSeconds: 300,
      upstreamTimeoutMs: 4000,
      maxGraphqlResponseBytes: 384 * 1024,
      maxCatalogResponseBytes: 512 * 1024,
      maxPageResponseBytes: 256 * 1024,
    },
    demo: {
      queries: ["snowboard", "ice", "wax"],
      handles: ["the-complete-snowboard", "selling-plans-ski-wax"],
      variant: "Ice",
      briefGoal: "Choose a snowboard with clear availability and a usable price range.",
    },
  }),
]);

assertOriginRegistry(ORIGINS);

const ORIGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function inspectOrigin(originId?: string | null): Origin {
  const id = (originId ?? DEFAULT_ORIGIN_ID).trim().toLocaleLowerCase();
  if (!ORIGIN_ID_PATTERN.test(id)) throw new RangeError("Origin id is invalid.");
  const origin = ORIGINS.find((item) => item.id === id);
  if (!origin) throw new RangeError("Origin is not allowlisted.");
  return origin;
}

export function getOrigin(originId?: string | null, now = Date.now()): Origin {
  const origin = inspectOrigin(originId);
  assertOriginAuthorizationCurrent(origin, now);
  return origin;
}

export function runtimeOrigins(now = Date.now()): Origin[] {
  return ORIGINS.filter((origin) => originAuthorizationState(origin, now) === "current");
}

export function publicOrigin(origin: Origin): PublicOrigin {
  return {
    id: origin.id,
    mode: origin.mode,
    vertical: origin.vertical,
    displayName: origin.displayName,
    hostname: origin.hostname,
    canonicalUrl: origin.canonicalUrl,
    adapter: origin.adapter,
    fallbackAdapters: [...origin.fallbackAdapters],
    offerPathPrefix: origin.offerPathPrefix,
    notes: origin.notes,
    healthPath: origin.healthPath,
    authorization: origin.authorization,
    capabilities: origin.capabilities,
    policy: origin.policy,
    demo: origin.demo,
  };
}

export function offerUrl(origin: Origin, handle: string): string {
  return `${origin.canonicalUrl}${origin.offerPathPrefix}/${handle}`;
}

export function assertCatalogShop(origin: Origin, configuredShop?: string): void {
  const shop = (configuredShop ?? "").trim().toLocaleLowerCase();
  if (origin.adapter === "shopify-storefront" && shop && shop !== origin.hostname) {
    throw new RangeError("Configured catalog hostname does not match the selected allowlisted origin.");
  }
}

export function validateInterpolatePath(origin: Origin, rawPath: string): { path: string; handle: string } {
  const input = rawPath.trim();
  if (!input || input.length > 240 || !input.startsWith("/") || input.startsWith("//")) {
    throw new RangeError("Interpolation path must be an allowlisted path on the selected origin.");
  }
  let url: URL;
  try {
    url = new URL(input, origin.canonicalUrl);
  } catch {
    throw new RangeError("Interpolation path is invalid.");
  }
  if (
    url.protocol !== "https:"
    || url.hostname.toLocaleLowerCase() !== origin.hostname
    || url.port
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new RangeError("Interpolation path does not match the selected allowlisted origin.");
  }
  const allowed = origin.interpolatePathPatterns.some((pattern) => new RegExp(pattern).test(url.pathname));
  const productMatch = new RegExp(origin.productPathPattern).exec(url.pathname);
  if (!allowed || !productMatch?.[1]) throw new RangeError("Interpolation path is not allowlisted for this origin.");
  return { path: url.pathname, handle: productMatch[1] };
}
