import { getProduct, normalizeServicesJsonOffer, type CatalogEnv, type CatalogSource } from "./catalog";
import {
  finalizeOffer,
  money,
  reconcileOfferEvidence,
  singleSourceEvidence,
  uniformProvenance,
  type MarketplaceCondition,
  type MarketplaceEvidence,
  type Offer,
  type Variant,
} from "./offers";
import { assertOfferAdapterContract } from "./origin-contract";
import { offerUrl, publicOrigin, validateInterpolatePath, type Origin, type PublicOrigin } from "./origins";
import { OriginFailure, markAdapterAttemptFailure, normalizeFailureReason, type OriginFailureReason } from "./reliability";
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
  catalogFailureReason?: OriginFailureReason;
  pageFailureReason?: OriginFailureReason;
};

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

function findOfferNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOfferNode(item);
      if (found) return found;
    }
    return null;
  }
  const candidate = record(value);
  const types = array(candidate["@type"]).map((item) => text(item, 40).toLocaleLowerCase());
  if (types.includes("product") || types.includes("productgroup") || types.includes("service")) return candidate;
  for (const key of ["@graph", "mainEntity", "itemListElement", "hasVariant"]) {
    const found = findOfferNode(candidate[key]);
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
      const offer = findOfferNode(parsed);
      if (offer) return offer;
    } catch {
      // Ignore malformed untrusted JSON-LD and continue looking.
    }
  }
  return null;
}

function jsonLdServiceOffer(service: Record<string, unknown>, origin: Origin, handle: string): Offer | null {
  const properties = jsonLdProperties(service);
  const provider = record(service.provider);
  const offers = array(service.offers).map(record);
  const offer = offers[0] ?? {};
  const availability = text(offer.availability, 200).toLocaleLowerCase();
  let windows: unknown[] = [];
  const rawWindows = text(properties.get("scheduling_windows"), 1600);
  try {
    const parsed: unknown = JSON.parse(rawWindows);
    windows = Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
  const fetchedAt = new Date().toISOString();
  const normalized = normalizeServicesJsonOffer({
    id: text(offer.sku ?? service.sku, 180) || `service-${handle}`,
    handle,
    title: text(service.name, 160),
    description: text(service.description, 600),
    provider: {
      display_name: text(provider.name, 100),
      verification: properties.get("provider_verification"),
    },
    category: text(service.serviceType, 40),
    location: {
      city: properties.get("location_city"),
      region: properties.get("location_region"),
      country_code: properties.get("location_country_code"),
      venue: properties.get("location_venue"),
    },
    duration_minutes: properties.get("duration_minutes"),
    price: record(offer.priceSpecification).price ?? offer.price,
    currency_code: offer.priceCurrency,
    price_basis: properties.get("price_basis"),
    party_size: {
      min: properties.get("party_size_min"),
      max: properties.get("party_size_max"),
    },
    scheduling: { timezone: properties.get("scheduling_timezone"), windows },
    cancellation: {
      refundable: properties.get("cancellation_refundable"),
      window_hours: properties.get("cancellation_window_hours"),
      fee: properties.get("cancellation_fee"),
    },
    itinerary_eligible: properties.get("itinerary_eligible"),
    available: availability.includes("instock") || availability.includes("limitedavailability"),
  }, origin, fetchedAt);
  if (!normalized) return null;
  const provenance = uniformProvenance("json-ld");
  provenance.provider = singleSourceEvidence("json-ld");
  provenance.location = singleSourceEvidence("json-ld");
  provenance.duration = singleSourceEvidence("json-ld");
  provenance.scheduling = singleSourceEvidence("json-ld");
  provenance.cancellation = singleSourceEvidence("json-ld");
  provenance.verification.singleSourceFields = ["pricing", "availability", "provider", "location", "duration", "scheduling", "cancellation"];
  return finalizeOffer({
    ...normalized,
    source: { adapter: "json-ld", live: true, fetchedAt, untrusted: true },
    provenance,
  }, Date.parse(fetchedAt), origin.policy.maxOfferAgeSeconds);
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

function boundedNumber(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function jsonLdProperties(product: Record<string, unknown>): Map<string, unknown> {
  const properties = new Map<string, unknown>();
  for (const item of array(product.additionalProperty)) {
    const property = record(item);
    const name = text(property.name, 80).toLocaleLowerCase();
    if (name) properties.set(name, property.value);
  }
  return properties;
}

function jsonLdMarketplace(
  product: Record<string, unknown>,
  offers: Record<string, unknown>[],
  currencyCode: string,
  itemPrice: string,
): MarketplaceEvidence | undefined {
  const properties = jsonLdProperties(product);
  const condition = text(properties.get("condition"), 32) as MarketplaceCondition;
  const conditionDescription = text(properties.get("condition_description"), 320);
  const seller = record(offers[0]?.seller);
  const displayName = text(seller.name, 100);
  const positiveFeedbackPercent = boundedNumber(properties.get("seller_feedback_percent"), 0, 100);
  const feedbackCount = boundedNumber(properties.get("seller_feedback_count"), 0, 10_000_000);
  const shippingPriceValue = boundedNumber(properties.get("shipping_price"), 0, 100_000);
  const method = text(properties.get("shipping_method"), 80);
  const estimatedMin = boundedNumber(properties.get("shipping_estimated_days_min"), 0, 90);
  const estimatedMax = boundedNumber(properties.get("shipping_estimated_days_max"), 0, 90);
  const acceptedValue = properties.get("returns_accepted");
  const accepted = typeof acceptedValue === "boolean" ? acceptedValue : null;
  const rawWindow = properties.get("returns_window_days");
  const windowDays = rawWindow === null ? null : boundedNumber(rawWindow, 1, 365);
  const paidBy = text(properties.get("returns_paid_by"), 24);
  if (
    !["new", "open-box", "excellent", "very-good", "good", "fair"].includes(condition)
    || !conditionDescription
    || !displayName
    || positiveFeedbackPercent === null
    || feedbackCount === null
    || shippingPriceValue === null
    || !method
    || estimatedMin === null
    || estimatedMax === null
    || estimatedMax < estimatedMin
    || accepted === null
    || !["buyer", "seller", "not-applicable"].includes(paidBy)
    || (accepted && (windowDays === null || paidBy === "not-applicable"))
    || (!accepted && (windowDays !== null || paidBy !== "not-applicable"))
  ) return undefined;
  const shippingPrice = money(shippingPriceValue, currencyCode);
  const deliveredPrice = money(Number(itemPrice) + Number(shippingPrice.amount), currencyCode);
  return {
    condition,
    conditionDescription,
    seller: { displayName, positiveFeedbackPercent, feedbackCount },
    shipping: { price: shippingPrice, method, estimatedDays: { min: estimatedMin, max: estimatedMax } },
    returns: { accepted, windowDays, paidBy: paidBy as MarketplaceEvidence["returns"]["paidBy"] },
    deliveredPrice,
  };
}

export function normalizeJsonLdOffer(product: Record<string, unknown>, origin: Origin, handle: string): Offer | null {
  const types = array(product["@type"]).map((value) => text(value, 40).toLocaleLowerCase());
  if (types.includes("service")) return jsonLdServiceOffer(product, origin, handle);
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
      id: text(offerNode.sku ?? product.sku, 180) || `${offerUrl(origin, handle)}#offer-${index + 1}`,
      title: text(offerNode.name, 120) || (leafOffers.length > 1 ? `Offer ${index + 1}` : "Default offer"),
      available,
      quantityAvailable: null,
      price: money(priceNode.price ?? offerNode.price ?? low, text(offerNode.priceCurrency, 8) || currencyCode),
      options: [],
    };
  });
  const available = variants.some((variant) => variant.available);
  const fetchedAt = new Date().toISOString();
  const vendorNode = record(product.brand);
  const vendor = text(vendorNode.name ?? product.brand, 100);
  const image = jsonLdImage(product.image);
  const marketplace = variants[0] ? jsonLdMarketplace(product, leafOffers, currencyCode, variants[0].price.amount) : undefined;
  const provenance = uniformProvenance("json-ld");
  if (marketplace) {
    provenance.condition = singleSourceEvidence("json-ld");
    provenance.seller = singleSourceEvidence("json-ld");
    provenance.shipping = singleSourceEvidence("json-ld");
    provenance.returns = singleSourceEvidence("json-ld");
  }
  return finalizeOffer({
    originId: origin.id,
    handle,
    title,
    description: text(product.description, 600),
    url: offerUrl(origin, handle),
    ...(vendor ? { vendor } : {}),
    vertical: origin.vertical,
    priceRange: { min: money(low, currencyCode), max: money(high, currencyCode) },
    variants,
    constraints: { available },
    ...(marketplace ? { marketplace } : {}),
    ...(image ? { image } : {}),
    source: {
      adapter: "json-ld",
      live: true,
      fetchedAt,
      untrusted: true,
    },
    provenance,
  }, Date.parse(fetchedAt), origin.policy.maxOfferAgeSeconds);
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
    ...(offer.service ? [
      `Provider: ${offer.service.provider.displayName}`,
      `Location: ${offer.service.location.city}, ${offer.service.location.region}, ${offer.service.location.countryCode}`,
      `Duration: ${offer.service.durationMinutes} minutes`,
      `Price basis: ${offer.service.priceBasis}`,
      `Schedule timezone: ${offer.service.scheduling.timezone}`,
      `Cancellation: ${offer.service.cancellation.refundable ? `${offer.service.cancellation.windowHours} hour window` : "not refundable"}`,
    ] : []),
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
  let pageFailureReason: OriginFailureReason | undefined;
  let pageAttempt: Awaited<ReturnType<typeof fetchOriginText>>["diagnosticAttempt"];
  try {
    const response = await fetchOriginText(origin, path, {
      method: "GET",
      headers: { "Accept": "text/html", "User-Agent": "Ribband-WebMCP/0.1" },
    }, origin.policy.maxPageResponseBytes, fetcher);
    pageAttempt = response.diagnosticAttempt;
    if (!response.contentType.toLocaleLowerCase().includes("text/html")) {
      throw new OriginFailure("invalid-response", "Allowlisted page did not return HTML.");
    }
    pageLive = true;
    const jsonLd = extractJsonLd(response.text);
    jsonLdOffer = jsonLd ? normalizeJsonLdOffer(jsonLd, origin, handle) : null;
    pageText = await strippedPageText(response.text);
  } catch (error) {
    markAdapterAttemptFailure(pageAttempt, error);
    pageWarning = error instanceof Error ? error.message : "Allowlisted page could not be read.";
    pageFailureReason = normalizeFailureReason(error);
  }
  const structuredOffer = catalog.offers[0];
  const offer = structuredOffer?.source.live && jsonLdOffer?.source.live
    ? reconcileOfferEvidence(structuredOffer, jsonLdOffer)
    : structuredOffer?.source.live ? structuredOffer : jsonLdOffer ?? structuredOffer;
  if (!offer) throw new RangeError("No offer facts were found for the allowlisted path.");
  assertOfferAdapterContract(origin, offer);
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
    ...(catalog.failureReason ? { catalogFailureReason: catalog.failureReason } : {}),
    ...(pageFailureReason ? { pageFailureReason } : {}),
  };
}
