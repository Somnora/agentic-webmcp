import { getProduct, type CatalogEnv, type CatalogSource } from "./catalog";
import { money, type Offer, type Variant } from "./offers";
import { publicOrigin, validateInterpolatePath, type Origin, type PublicOrigin } from "./origins";
import { fetchOriginText, type Fetcher } from "./upstream";

export type InterpolateResult = {
  origin: PublicOrigin;
  source: CatalogSource | "json-ld" | "html-markdown";
  live: boolean;
  pageLive: boolean;
  canonicalUrl: string;
  path: string;
  offer: Offer;
  markdown: string;
  warning?: string;
};

const MAX_HTML_BYTES = 256 * 1024;
const MAX_MARKDOWN_LENGTH = 1200;

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function findProductNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProductNode(item);
      if (found) return found;
    }
    return null;
  }
  const candidate = record(value);
  const types = array(candidate["@type"]).map((item) => text(item, 40).toLocaleLowerCase());
  if (types.includes("product")) return candidate;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const found = findProductNode(candidate[key]);
    if (found) return found;
  }
  return null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]?.trim();
    if (!raw || raw.length > 64 * 1024) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const product = findProductNode(parsed);
      if (product) return product;
    } catch {
      // Ignore malformed untrusted JSON-LD and continue looking.
    }
  }
  return null;
}

function jsonLdImage(value: unknown): { url: string; altText: string | null } | undefined {
  const first = array(value)[0];
  const rawUrl = typeof first === "string" ? first : text(record(first).url, 500);
  if (!rawUrl) return undefined;
  try {
    if (new URL(rawUrl).protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return { url: rawUrl.slice(0, 500), altText: null };
}

function normalizeJsonLdOffer(product: Record<string, unknown>, origin: Origin, handle: string): Offer | null {
  const title = text(product.name, 160);
  if (!title) return null;
  const offerNode = record(array(product.offers)[0]);
  const currencyCode = text(offerNode.priceCurrency, 8) || origin.currencyCode;
  const low = offerNode.lowPrice ?? offerNode.price;
  const high = offerNode.highPrice ?? offerNode.price ?? low;
  const availability = text(offerNode.availability, 200).toLocaleLowerCase();
  const available = availability.includes("instock") || availability.includes("limitedavailability");
  const variant: Variant = {
    id: text(offerNode.sku, 180) || `${origin.canonicalUrl}/products/${handle}#offer`,
    title: "Default offer",
    available,
    quantityAvailable: null,
    price: money(offerNode.price ?? low, currencyCode),
    options: [],
  };
  const vendorNode = record(product.brand);
  const vendor = text(vendorNode.name ?? product.brand, 100);
  const image = jsonLdImage(product.image);
  return {
    originId: origin.id,
    handle,
    title,
    description: text(product.description, 600),
    url: `${origin.canonicalUrl}/products/${handle}`,
    ...(vendor ? { vendor } : {}),
    vertical: origin.vertical,
    priceRange: { min: money(low, currencyCode), max: money(high, currencyCode) },
    variants: [variant],
    constraints: { available },
    ...(image ? { image } : {}),
    source: {
      adapter: "json-ld",
      live: true,
      fetchedAt: new Date().toISOString(),
      untrusted: true,
    },
  };
}

function strippedPageText(html: string): string {
  const withoutChrome = html
    .replace(/<(script|style|nav|footer|iframe|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h1|h2|h3|p|li|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutChrome)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 16)
    .join("\n")
    .slice(0, 700);
}

function offerFacts(offer: Offer): string {
  const variants = offer.variants.slice(0, 4).map((variant) => `${variant.title}: ${variant.price.amount} ${variant.price.currencyCode}, ${variant.available ? "available" : "unavailable"}`);
  return [
    `# ${offer.title}`,
    "",
    `Canonical origin: ${offer.url}`,
    `Handle: ${offer.handle}`,
    `Price: ${offer.priceRange.min.amount} to ${offer.priceRange.max.amount} ${offer.priceRange.min.currencyCode}`,
    `Availability: ${offer.constraints.available ? "available" : "unavailable"}`,
    ...(offer.description ? ["", offer.description] : []),
    ...(variants.length ? ["", "Variants:", ...variants.map((item) => `- ${item}`)] : []),
  ].join("\n");
}

function markdownFor(offer: Offer, pageText: string, pageLive: boolean): string {
  const lines = [offerFacts(offer)];
  if (pageText) lines.push("", "Stripped page text:", pageText);
  if (!pageLive) lines.push("", "The allowlisted page was not publicly readable. Structured facts use the labeled catalog fallback.");
  return lines.join("\n").slice(0, MAX_MARKDOWN_LENGTH);
}

export async function interpolatePage(
  origin: Origin,
  rawPath: string,
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<InterpolateResult> {
  const { path, handle } = validateInterpolatePath(origin, rawPath);
  const catalog = await getProduct(handle, origin, fetcher, env);
  let pageText = "";
  let jsonLdOffer: Offer | null = null;
  let pageLive = false;
  let pageWarning = "";
  try {
    const response = await fetchOriginText(origin, path, {
      method: "GET",
      headers: { "Accept": "text/html", "User-Agent": "Agentic-WebMCP/0.1" },
    }, MAX_HTML_BYTES, fetcher);
    if (!response.contentType.toLocaleLowerCase().includes("text/html")) {
      throw new Error("Allowlisted page did not return HTML.");
    }
    pageLive = true;
    const jsonLd = extractJsonLd(response.text);
    jsonLdOffer = jsonLd ? normalizeJsonLdOffer(jsonLd, origin, handle) : null;
    pageText = strippedPageText(response.text);
  } catch (error) {
    pageWarning = error instanceof Error ? error.message : "Allowlisted page could not be read.";
  }
  const structuredOffer = catalog.offers[0];
  const offer = structuredOffer?.source.live ? structuredOffer : jsonLdOffer ?? structuredOffer;
  if (!offer) throw new RangeError("No offer facts were found for the allowlisted path.");
  const live = offer.source.live;
  const warning = [catalog.warning, pageWarning].filter(Boolean).join(" ");
  return {
    origin: publicOrigin(origin),
    source: offer.source.live ? offer.source.adapter : catalog.source,
    live,
    pageLive,
    canonicalUrl: `${origin.canonicalUrl}${path}`,
    path,
    offer,
    markdown: markdownFor(offer, pageText, pageLive),
    ...(warning ? { warning } : {}),
  };
}
