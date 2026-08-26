import { getProduct, type CatalogEnv, type CatalogSource } from "./catalog";
import { money, uniformProvenance, type Offer, type Variant } from "./offers";
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
  if (types.includes("product") || types.includes("productgroup")) return candidate;
  for (const key of ["@graph", "mainEntity", "itemListElement", "hasVariant"]) {
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

export function normalizeJsonLdOffer(product: Record<string, unknown>, origin: Origin, handle: string): Offer | null {
  const title = text(product.name, 160);
  if (!title) return null;
  const rootOffers = array(product.offers).map(record);
  const aggregate = rootOffers.find((item) => array(item["@type"]).some((type) => text(type, 40).toLocaleLowerCase() === "aggregateoffer"));
  const leafOffers = rootOffers.flatMap((item) => {
    const nested = array(item.offers).map(record);
    return nested.length ? nested : [item];
  }).slice(0, 8);
  const currencyCode = text(leafOffers[0]?.priceCurrency ?? aggregate?.priceCurrency, 8) || origin.currencyCode;
  const numericPrices = leafOffers
    .map((item) => Number.parseFloat(text(record(item.priceSpecification).price ?? item.price, 24)))
    .filter(Number.isFinite);
  const aggregateLow = aggregate?.lowPrice ?? aggregate?.price;
  const aggregateHigh = aggregate?.highPrice ?? aggregate?.price;
  const low = aggregateLow ?? (numericPrices.length ? Math.min(...numericPrices) : 0);
  const high = aggregateHigh ?? (numericPrices.length ? Math.max(...numericPrices) : low);
  const variants: Variant[] = (leafOffers.length ? leafOffers : [aggregate ?? {}]).map((offerNode, index) => {
    const availability = text(offerNode.availability, 200).toLocaleLowerCase();
    const available = availability.includes("instock") || availability.includes("limitedavailability");
    const priceNode = record(offerNode.priceSpecification);
    return {
      id: text(offerNode.sku ?? product.sku, 180) || `${origin.canonicalUrl}/products/${handle}#offer-${index + 1}`,
      title: text(offerNode.name, 120) || (leafOffers.length > 1 ? `Offer ${index + 1}` : "Default offer"),
      available,
      quantityAvailable: null,
      price: money(priceNode.price ?? offerNode.price ?? low, text(offerNode.priceCurrency, 8) || currencyCode),
      options: [],
    };
  });
  const available = variants.some((variant) => variant.available);
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
    variants,
    constraints: { available },
    ...(image ? { image } : {}),
    source: {
      adapter: "json-ld",
      live: true,
      fetchedAt: new Date().toISOString(),
      untrusted: true,
    },
    provenance: uniformProvenance("json-ld"),
  };
}

function strippedPageTextFallback(html: string): string {
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

async function strippedPageText(html: string): Promise<string> {
  if (typeof HTMLRewriter === "undefined") return strippedPageTextFallback(html);
  const lines: string[] = [];
  let rewriter = new HTMLRewriter();
  for (const tag of ["nav", "footer", "script", "style", "iframe", "form"]) {
    rewriter = rewriter.on(tag, {
      element(element) {
        element.remove();
      },
    });
  }
  for (const tag of ["h1", "h2", "h3", "p", "li"]) {
    rewriter = rewriter.on(tag, {
      text(chunk) {
        const value = chunk.text.replace(/\s+/g, " ").trim();
        if (value && lines.join(" ").length < 900) lines.push(value);
      },
    });
  }
  await rewriter.transform(new Response(html, { headers: { "Content-Type": "text/html" } })).arrayBuffer();
  return lines.join("\n").slice(0, 700);
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
    pageText = await strippedPageText(response.text);
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
