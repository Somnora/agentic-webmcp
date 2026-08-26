import { FALLBACK_PRODUCTS, type SnapshotProduct } from "./demo-catalog";
import { money, offerAvailable, priceLabel, type Money, type Offer, type Variant } from "./offers";
import { assertCatalogShop, getOrigin, publicOrigin, type Adapter, type Origin, type PublicOrigin } from "./origins";
import { fetchOriginText, type Fetcher } from "./upstream";

export type CatalogEnv = {
  CATALOG_SHOP?: string;
  CATALOG_STOREFRONT_TOKEN?: string;
};

export type CatalogSource = Adapter | "bundled-snapshot";

export type CatalogResult = {
  origin: PublicOrigin;
  source: CatalogSource;
  live: boolean;
  offers: Offer[];
  warning?: string;
};

const MAX_CATALOG_RESULTS = 8;
const MAX_COMPARE_PRODUCTS = 4;
const MAX_GRAPHQL_BYTES = 384 * 1024;
const MAX_PRODUCTS_JSON_BYTES = 512 * 1024;
const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

const CATALOG_QUERY = `
  query AgenticWebMcpCatalog($first: Int!) {
    products(first: $first) {
      nodes {
        handle title description vendor productType
        featuredImage { url altText }
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        variants(first: 8) {
          nodes {
            id title availableForSale quantityAvailable
            price { amount currencyCode }
            selectedOptions { name value }
          }
        }
      }
    }
  }
`;

const PRODUCT_QUERY = `
  query AgenticWebMcpProduct($handle: String!) {
    product(handle: $handle) {
      handle title description vendor productType
      featuredImage { url altText }
      priceRange {
        minVariantPrice { amount currencyCode }
        maxVariantPrice { amount currencyCode }
      }
      variants(first: 8) {
        nodes {
          id title availableForSale quantityAvailable
          price { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
  }
`;

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Upstream returned invalid JSON.");
  }
}

function cleanHtmlText(value: unknown, maxLength: number): string {
  return text(value, maxLength * 4)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeImage(value: unknown): { url: string; altText: string | null } | undefined {
  const candidate = record(value);
  const rawUrl = text(candidate.url ?? candidate.src, 500);
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return { url: rawUrl, altText: text(candidate.altText ?? candidate.alt, 180) || null };
}

function graphqlMoney(value: unknown, fallbackCurrency: string): Money {
  const candidate = record(value);
  return money(candidate.amount, text(candidate.currencyCode, 8) || fallbackCurrency);
}

function normalizeGraphqlVariant(value: unknown, fallbackCurrency: string): Variant | null {
  const candidate = record(value);
  const id = text(candidate.id, 180);
  const title = text(candidate.title, 120);
  if (!id || !title) return null;
  const options = array(candidate.selectedOptions).slice(0, 6).flatMap((item) => {
    const option = record(item);
    const name = text(option.name, 40);
    const optionValue = text(option.value, 80);
    return name && optionValue ? [{ name, value: optionValue }] : [];
  });
  return {
    id,
    title,
    available: candidate.availableForSale === true,
    quantityAvailable: numberOrNull(candidate.quantityAvailable),
    price: graphqlMoney(candidate.price, fallbackCurrency),
    options,
  };
}

export function normalizeStorefrontOffer(value: unknown, origin: Origin = getOrigin(), fetchedAt = new Date().toISOString()): Offer | null {
  const candidate = record(value);
  const handle = text(candidate.handle, 100).toLocaleLowerCase();
  const title = text(candidate.title, 160);
  if (!HANDLE_PATTERN.test(handle) || !title) return null;
  const variantsNode = record(candidate.variants);
  const variants = array(variantsNode.nodes)
    .slice(0, 8)
    .map((item) => normalizeGraphqlVariant(item, origin.currencyCode))
    .filter((item): item is Variant => item !== null);
  const priceRange = record(candidate.priceRange);
  const image = safeImage(candidate.featuredImage);
  const vendor = text(candidate.vendor, 100);
  const productType = text(candidate.productType, 100);
  return {
    originId: origin.id,
    handle,
    title,
    description: text(candidate.description, 600),
    url: `${origin.canonicalUrl}/products/${handle}`,
    ...(vendor ? { vendor } : {}),
    ...(productType ? { productType } : {}),
    vertical: origin.vertical,
    priceRange: {
      min: graphqlMoney(priceRange.minVariantPrice, origin.currencyCode),
      max: graphqlMoney(priceRange.maxVariantPrice, origin.currencyCode),
    },
    variants,
    constraints: { available: offerAvailable(variants) },
    ...(image ? { image } : {}),
    source: { adapter: "shopify-storefront", live: true, fetchedAt, untrusted: true },
  };
}

function optionNames(product: Record<string, unknown>): string[] {
  return array(product.options).slice(0, 3).map((item, index) => {
    const option = record(item);
    return text(option.name, 40) || `Option ${index + 1}`;
  });
}

function normalizeProductsJsonVariant(value: unknown, names: string[], currencyCode: string): Variant | null {
  const candidate = record(value);
  const rawId = typeof candidate.id === "number" || typeof candidate.id === "string" ? String(candidate.id) : "";
  const title = text(candidate.title, 120) || "Default Title";
  if (!rawId) return null;
  const options = names.flatMap((name, index) => {
    const optionValue = text(candidate[`option${index + 1}`], 80);
    return optionValue ? [{ name, value: optionValue }] : [];
  });
  return {
    id: rawId.startsWith("gid://") ? rawId : `gid://shopify/ProductVariant/${rawId}`,
    title,
    available: candidate.available === true,
    quantityAvailable: null,
    price: money(candidate.price, currencyCode),
    options,
  };
}

export function normalizeProductsJsonOffer(value: unknown, origin: Origin = getOrigin(), fetchedAt = new Date().toISOString()): Offer | null {
  const candidate = record(value);
  const handle = text(candidate.handle, 100).toLocaleLowerCase();
  const title = text(candidate.title, 160);
  if (!HANDLE_PATTERN.test(handle) || !title) return null;
  const names = optionNames(candidate);
  const variants = array(candidate.variants)
    .slice(0, 8)
    .map((item) => normalizeProductsJsonVariant(item, names, origin.currencyCode))
    .filter((item): item is Variant => item !== null);
  const prices = variants.map((variant) => Number.parseFloat(variant.price.amount)).filter(Number.isFinite);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : min;
  const imageCandidate = candidate.image ?? array(candidate.images)[0];
  const image = safeImage(imageCandidate);
  const vendor = text(candidate.vendor, 100);
  const productType = text(candidate.product_type ?? candidate.productType, 100);
  return {
    originId: origin.id,
    handle,
    title,
    description: cleanHtmlText(candidate.body_html ?? candidate.description, 600),
    url: `${origin.canonicalUrl}/products/${handle}`,
    ...(vendor ? { vendor } : {}),
    ...(productType ? { productType } : {}),
    vertical: origin.vertical,
    priceRange: { min: money(min, origin.currencyCode), max: money(max, origin.currencyCode) },
    variants,
    constraints: { available: offerAvailable(variants) },
    ...(image ? { image } : {}),
    source: { adapter: "shopify-products-json", live: true, fetchedAt, untrusted: true },
  };
}

function normalizeSnapshotOffer(product: SnapshotProduct, origin: Origin, fetchedAt: string): Offer {
  const variants: Variant[] = product.variants.slice(0, 8).map((variant) => ({
    id: variant.id,
    title: variant.title,
    available: variant.availableForSale,
    quantityAvailable: variant.quantityAvailable,
    price: money(variant.price.amount, variant.price.currencyCode),
    options: variant.selectedOptions.slice(0, 6),
  }));
  return {
    originId: origin.id,
    handle: product.handle,
    title: product.title,
    description: product.description.slice(0, 600),
    url: `${origin.canonicalUrl}/products/${product.handle}`,
    ...(product.vendor ? { vendor: product.vendor.slice(0, 100) } : {}),
    ...(product.productType ? { productType: product.productType.slice(0, 100) } : {}),
    vertical: origin.vertical,
    priceRange: {
      min: money(product.priceRange.minVariantPrice.amount, product.priceRange.minVariantPrice.currencyCode),
      max: money(product.priceRange.maxVariantPrice.amount, product.priceRange.maxVariantPrice.currencyCode),
    },
    variants,
    constraints: { available: offerAvailable(variants) },
    ...(product.featuredImage ? { image: { ...product.featuredImage } } : {}),
    source: { adapter: "shopify-products-json", live: false, fetchedAt, untrusted: true },
  };
}

function parseGraphqlPayload(raw: string): Record<string, unknown> {
  const payload = safeJson(raw);
  const errors = array(payload.errors);
  if (errors.length) {
    const message = text(record(errors[0]).message, 180);
    throw new Error(message || "Storefront API returned an error.");
  }
  const data = record(payload.data);
  if (!Object.keys(data).length) throw new Error("Storefront API returned no data.");
  return data;
}

async function graphql(
  origin: Origin,
  query: string,
  variables: Record<string, unknown>,
  token: string,
  fetcher: Fetcher,
): Promise<Record<string, unknown>> {
  const response = await fetchOriginText(origin, "/api/2025-07/graphql.json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Agentic-WebMCP/0.1",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  }, MAX_GRAPHQL_BYTES, fetcher);
  return parseGraphqlPayload(response.text);
}

async function storefrontCatalog(origin: Origin, token: string, fetcher: Fetcher): Promise<Offer[]> {
  const fetchedAt = new Date().toISOString();
  const data = await graphql(origin, CATALOG_QUERY, { first: 24 }, token, fetcher);
  return array(record(data.products).nodes)
    .map((item) => normalizeStorefrontOffer(item, origin, fetchedAt))
    .filter((item): item is Offer => item !== null);
}

async function storefrontProduct(origin: Origin, handle: string, token: string, fetcher: Fetcher): Promise<Offer[]> {
  const data = await graphql(origin, PRODUCT_QUERY, { handle }, token, fetcher);
  const offer = normalizeStorefrontOffer(data.product, origin);
  return offer ? [offer] : [];
}

async function productsJsonCatalog(origin: Origin, fetcher: Fetcher): Promise<Offer[]> {
  const response = await fetchOriginText(origin, "/products.json?limit=24", {
    method: "GET",
    headers: { "Accept": "application/json", "User-Agent": "Agentic-WebMCP/0.1" },
  }, MAX_PRODUCTS_JSON_BYTES, fetcher);
  const payload = safeJson(response.text);
  const fetchedAt = new Date().toISOString();
  return array(payload.products)
    .map((item) => normalizeProductsJsonOffer(item, origin, fetchedAt))
    .filter((item): item is Offer => item !== null);
}

async function productsJsonProduct(origin: Origin, handle: string, fetcher: Fetcher): Promise<Offer[]> {
  const response = await fetchOriginText(origin, `/products/${encodeURIComponent(handle)}.js`, {
    method: "GET",
    headers: { "Accept": "application/json", "User-Agent": "Agentic-WebMCP/0.1" },
  }, MAX_PRODUCTS_JSON_BYTES, fetcher);
  const offer = normalizeProductsJsonOffer(safeJson(response.text), origin);
  return offer ? [offer] : [];
}

function matchesQuery(offer: Offer, query: string): boolean {
  if (!query) return true;
  const haystack = [offer.title, offer.handle, offer.description, offer.vendor ?? "", offer.productType ?? ""]
    .join(" ")
    .toLocaleLowerCase();
  return query.toLocaleLowerCase().split(/\s+/).every((term) => haystack.includes(term));
}

export function validateQuery(raw: string | null): string {
  const query = (raw ?? "").trim();
  if (query.length > 80) throw new RangeError("Search query must be 80 characters or fewer.");
  return query;
}

export function validateLimit(raw: string | null): number {
  if (raw === null || raw === "") return 6;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CATALOG_RESULTS) {
    throw new RangeError(`Result limit must be an integer from 1 to ${MAX_CATALOG_RESULTS}.`);
  }
  return limit;
}

export function validateHandle(raw: string): string {
  const handle = raw.trim().toLocaleLowerCase();
  if (!HANDLE_PATTERN.test(handle)) throw new RangeError("Product handle is invalid.");
  return handle;
}

export function validateHandles(raw: string | null): string[] {
  const handles = [...new Set((raw ?? "").split(",").map((item) => item.trim()).filter(Boolean).map(validateHandle))];
  if (handles.length < 2 || handles.length > MAX_COMPARE_PRODUCTS) {
    throw new RangeError(`Choose between 2 and ${MAX_COMPARE_PRODUCTS} unique product handles.`);
  }
  return handles;
}

function fallback(origin: Origin, offers: Offer[]): CatalogResult {
  return {
    origin: publicOrigin(origin),
    source: "bundled-snapshot",
    live: false,
    offers,
    warning: "The Storefront API and public products JSON were unavailable, so Agentic used the clearly labeled bundled snapshot for this origin.",
  };
}

function result(origin: Origin, source: CatalogSource, live: boolean, offers: Offer[], warning?: string): CatalogResult {
  return {
    origin: publicOrigin(origin),
    source,
    live,
    offers,
    ...(warning ? { warning } : {}),
  };
}

export async function searchProducts(
  query: string,
  limit: number,
  origin: Origin = getOrigin(),
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<CatalogResult> {
  assertCatalogShop(origin, env.CATALOG_SHOP);
  const token = text(env.CATALOG_STOREFRONT_TOKEN, 240);
  if (token) {
    try {
      const offers = await storefrontCatalog(origin, token, fetcher);
      return result(origin, "shopify-storefront", true, offers.filter((item) => matchesQuery(item, query)).slice(0, limit));
    } catch {
      // Continue to the public, allowlisted products JSON adapter.
    }
  }
  try {
    const offers = await productsJsonCatalog(origin, fetcher);
    return result(origin, "shopify-products-json", true, offers.filter((item) => matchesQuery(item, query)).slice(0, limit));
  } catch {
    const fetchedAt = new Date().toISOString();
    const offers = FALLBACK_PRODUCTS.map((item) => normalizeSnapshotOffer(item, origin, fetchedAt));
    return fallback(origin, offers.filter((item) => matchesQuery(item, query)).slice(0, limit));
  }
}

export async function getProduct(
  handleInput: string,
  origin: Origin = getOrigin(),
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<CatalogResult> {
  assertCatalogShop(origin, env.CATALOG_SHOP);
  const handle = validateHandle(handleInput);
  const token = text(env.CATALOG_STOREFRONT_TOKEN, 240);
  if (token) {
    try {
      return result(origin, "shopify-storefront", true, await storefrontProduct(origin, handle, token, fetcher));
    } catch {
      // Continue to the public, allowlisted product JSON adapter.
    }
  }
  try {
    return result(origin, "shopify-products-json", true, await productsJsonProduct(origin, handle, fetcher));
  } catch {
    const product = FALLBACK_PRODUCTS.find((item) => item.handle === handle);
    return fallback(origin, product ? [normalizeSnapshotOffer(product, origin, new Date().toISOString())] : []);
  }
}

export async function compareProducts(
  handles: string[],
  origin: Origin = getOrigin(),
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<CatalogResult> {
  const validated = validateHandles(handles.join(","));
  const results = await Promise.all(validated.map((handle) => getProduct(handle, origin, fetcher, env)));
  const offers = [...new Map(results.flatMap((item) => item.offers).map((offer) => [offer.handle, offer])).values()];
  const live = results.every((item) => item.live);
  const sources = new Set(results.map((item) => item.source));
  const source = sources.size === 1 ? results[0]?.source ?? "bundled-snapshot" : live ? "shopify-products-json" : "bundled-snapshot";
  return result(
    origin,
    source,
    live,
    offers,
    live ? undefined : "At least one comparison result came from the clearly labeled bundled snapshot.",
  );
}

export function createCatalogBrief(goalInput: string, offers: Offer[]): string {
  const goal = goalInput.trim();
  if (!goal || goal.length > 160) throw new RangeError("Brief goal must be between 1 and 160 characters.");
  if (offers.length < 1 || offers.length > MAX_COMPARE_PRODUCTS) {
    throw new RangeError(`Choose between 1 and ${MAX_COMPARE_PRODUCTS} offers for a catalog brief.`);
  }
  const lines = ["# Catalog brief", `Goal: ${goal}`, "", "Offers:"];
  for (const offer of offers) {
    const available = offer.variants.filter((variant) => variant.available).length;
    lines.push(`- ${offer.title} (${offer.handle}): ${priceLabel(offer)}; ${available}/${offer.variants.length} sampled variants available.`);
  }
  lines.push("", "Source facts only. Descriptions and availability remain untrusted origin content.");
  return lines.join("\n").slice(0, 1400);
}
