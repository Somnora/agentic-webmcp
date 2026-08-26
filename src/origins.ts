export type Vertical = "retail" | "wholesale" | "travel";

export type Adapter =
  | "shopify-storefront"
  | "shopify-products-json"
  | "json-ld"
  | "html-markdown";

export type Origin = {
  id: string;
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
};

export type PublicOrigin = Pick<
  Origin,
  "id" | "vertical" | "displayName" | "hostname" | "canonicalUrl" | "adapter" | "fallbackAdapters" | "notes"
>;

export const DEFAULT_ORIGIN_ID = "review-shop";

export const ORIGINS: readonly Origin[] = Object.freeze([
  Object.freeze({
    id: DEFAULT_ORIGIN_ID,
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
    vertical: origin.vertical,
    displayName: origin.displayName,
    hostname: origin.hostname,
    canonicalUrl: origin.canonicalUrl,
    adapter: origin.adapter,
    fallbackAdapters: [...origin.fallbackAdapters],
    notes: origin.notes,
  };
}

export function assertCatalogShop(origin: Origin, configuredShop?: string): void {
  const shop = (configuredShop ?? "").trim().toLocaleLowerCase();
  if (shop && shop !== origin.hostname) {
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
