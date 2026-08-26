export type Vertical = "retail" | "wholesale" | "travel";

export type Adapter =
  | "shopify-storefront"
  | "shopify-products-json"
  | "public-products-json"
  | "json-ld"
  | "html-markdown";

export type OriginMode = "controlled-demo" | "live-merchant";

export type Origin = {
  id: string;
  mode: OriginMode;
  vertical: Vertical;
  displayName: string;
  hostname: string;
  canonicalUrl: string;
  adapter: Adapter;
  fallbackAdapters: readonly Adapter[];
  productPathPattern: string;
  interpolatePathPatterns: readonly string[];
  currencyCode: string;
  notes: string;
  healthPath: string;
  demo: {
    queries: readonly string[];
    handles: readonly string[];
    variant: string;
    briefGoal: string;
  };
};

export type PublicOrigin = Pick<
  Origin,
  "id" | "mode" | "vertical" | "displayName" | "hostname" | "canonicalUrl" | "adapter" | "fallbackAdapters" | "notes" | "healthPath" | "demo"
>;

export const DEFAULT_ORIGIN_ID = "catalog-lab";

export const ORIGINS: readonly Origin[] = Object.freeze([
  Object.freeze({
    id: DEFAULT_ORIGIN_ID,
    mode: "controlled-demo",
    vertical: "retail",
    displayName: "Agentic Catalog Lab",
    hostname: "agentic-webmcp-origin.somnora.workers.dev",
    canonicalUrl: "https://agentic-webmcp-origin.somnora.workers.dev",
    adapter: "public-products-json",
    fallbackAdapters: ["json-ld", "html-markdown"] as const,
    productPathPattern: "^/products/([a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?)/?$",
    interpolatePathPatterns: [
      "^/products/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?/?$",
    ] as const,
    currencyCode: "USD",
    notes: "Controlled public demo catalog. Live HTTPS responses, original fixture content, no checkout or payment.",
    healthPath: "/products/field-notebook",
    demo: {
      queries: ["notebook", "desk", "travel"],
      handles: ["field-notebook", "modular-desk-tray"],
      variant: "Sand",
      briefGoal: "Choose an available workspace product with a clear price and variant.",
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
    fallbackAdapters: ["shopify-products-json", "html-markdown"] as const,
    productPathPattern: "^/products/([a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?)/?$",
    interpolatePathPatterns: [
      "^/products/[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?/?$",
    ] as const,
    currencyCode: "USD",
    notes: "Live merchant origin. Public access can fall back to a clearly labeled bundled snapshot.",
    healthPath: "/products/the-complete-snowboard",
    demo: {
      queries: ["snowboard", "ice", "wax"],
      handles: ["the-complete-snowboard", "selling-plans-ski-wax"],
      variant: "Ice",
      briefGoal: "Choose a snowboard with clear availability and a usable price range.",
    },
  }),
]);

const ORIGIN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function getOrigin(originId?: string | null): Origin {
  const id = (originId ?? DEFAULT_ORIGIN_ID).trim().toLocaleLowerCase();
  if (!ORIGIN_ID_PATTERN.test(id)) throw new RangeError("Origin id is invalid.");
  const origin = ORIGINS.find((item) => item.id === id);
  if (!origin) throw new RangeError("Origin is not allowlisted.");
  return origin;
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
    notes: origin.notes,
    healthPath: origin.healthPath,
    demo: origin.demo,
  };
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
