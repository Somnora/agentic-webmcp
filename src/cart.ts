import { getProduct, validateHandle, type CatalogEnv, type CatalogResult } from "./catalog";
import { assessOfferHandoff, DEFAULT_MAX_HANDOFF_OFFER_AGE_SECONDS, type Money, type Offer, type Variant } from "./offers";
import type { Origin } from "./origins";
import type { Fetcher } from "./upstream";

export type QuoteLine = {
  originId: string;
  handle: string;
  variantId: string;
  variantTitle: string;
  quantity: number;
  unitPrice: Money;
  shippingPrice?: Money;
  condition?: string;
  seller?: string;
  sourceUrl: string;
};

export type Quote = {
  quoteId: string;
  originId: string;
  lines: QuoteLine[];
  total: Money;
  createdAt: string;
  expiresAt: string;
  status: "proposed";
};

export type Confirmation = {
  quoteId: string;
  status: "awaiting_human_confirmation" | "confirmed" | "dismissed";
};

export type Receipt = {
  receiptId: string;
  quoteId: string;
  originId: string;
  lines: QuoteLine[];
  total: Money;
  status: "in_cart";
  confirmedAt: string;
};

export type CartInput = {
  originId: string;
  handle: string;
  variantId?: string;
  variantTitle?: string;
  quantity?: unknown;
};

export type CartCommitInput = CartInput & {
  reviewedQuote: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_HANDOFF_OFFER_AGE_MS = DEFAULT_MAX_HANDOFF_OFFER_AGE_SECONDS * 1000;

export function assertOfferHandoffEligible(
  offer: Offer,
  now = Date.now(),
  maxAgeMs = MAX_HANDOFF_OFFER_AGE_MS,
): void {
  const assessment = assessOfferHandoff(offer, now, Math.floor(maxAgeMs / 1000));
  if (assessment.eligible) return;
  if (assessment.reason === "source-not-live") {
    throw new RangeError("Offer is not eligible for merchant handoff because its source is not live.");
  }
  if (assessment.reason === "source-stale" || assessment.reason === "source-timestamp-invalid") {
    throw new RangeError("Offer is not eligible for merchant handoff because its source timestamp is stale or invalid.");
  }
  if (assessment.reason === "service-booking-not-enabled") {
    throw new RangeError("Service booking is not enabled. Agentic can research and assemble an itinerary, but it cannot reserve or pay for a service.");
  }
  throw new RangeError("Offer is not eligible for merchant handoff because it is unavailable.");
}

export function validateQuantity(raw: unknown): number {
  const quantity = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
    throw new RangeError("Quantity must be an integer from 1 to 4.");
  }
  return quantity;
}

function validateOrigin(input: CartInput, origin: Origin): void {
  if (input.originId.trim().toLocaleLowerCase() !== origin.id) {
    throw new RangeError("Cart origin does not match the selected allowlisted origin.");
  }
}

function selectVariant(catalog: CatalogResult, variantId?: string, variantTitle?: string): { offer: Offer; variant: Variant } {
  const offer = catalog.offers[0];
  if (!offer) throw new RangeError("Product not found.");
  const id = (variantId ?? "").trim();
  const title = (variantTitle ?? "").trim().toLocaleLowerCase();
  const variant = id
    ? offer.variants.find((item) => item.id === id)
    : title
      ? offer.variants.find((item) => item.title.toLocaleLowerCase() === title)
      : offer.variants.find((item) => item.available) ?? offer.variants[0];
  if (!variant) throw new RangeError("Variant not found.");
  if (!variant.available) throw new RangeError("That variant is not available for sale.");
  return { offer, variant };
}

function total(unitPrice: Money, quantity: number): Money {
  const cents = Math.round(Number.parseFloat(unitPrice.amount) * 100);
  return {
    amount: Number.isFinite(cents) ? ((cents * quantity) / 100).toFixed(2) : "0.00",
    currencyCode: unitPrice.currencyCode,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new RangeError(`${field} must be a string.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new RangeError(`${field} is invalid.`);
  return normalized;
}

function reviewedMoney(value: unknown, field: string, currencyCode: string): Money {
  const candidate = record(value);
  const amount = boundedString(candidate.amount, `${field} amount`, 24);
  const currency = boundedString(candidate.currencyCode, `${field} currency`, 8).toLocaleUpperCase();
  if (!/^(?:0|[1-9][0-9]{0,6})\.[0-9]{2}$/.test(amount) || currency !== currencyCode) {
    throw new RangeError(`${field} is invalid.`);
  }
  return { amount, currencyCode: currency };
}

function optionalReviewedMoney(value: unknown, field: string, currencyCode: string): Money | undefined {
  return value === undefined ? undefined : reviewedMoney(value, field, currencyCode);
}

function parseReviewedQuote(raw: unknown, input: CartInput, origin: Origin, now: number): Quote {
  const candidate = record(raw);
  const quoteId = boundedString(candidate.quoteId, "Quote id", 64);
  if (!UUID_PATTERN.test(quoteId)) throw new RangeError("Quote id is invalid.");
  const originId = boundedString(candidate.originId, "Quote origin", 64).toLocaleLowerCase();
  if (originId !== origin.id || originId !== input.originId.trim().toLocaleLowerCase()) {
    throw new RangeError("Reviewed quote origin does not match the selected allowlisted origin.");
  }
  if (candidate.status !== "proposed") throw new RangeError("Reviewed quote status is invalid.");
  const createdAt = boundedString(candidate.createdAt, "Quote creation time", 40);
  const expiresAt = boundedString(candidate.expiresAt, "Quote expiry", 40);
  const createdTime = Date.parse(createdAt);
  const expiryTime = Date.parse(expiresAt);
  if (!Number.isFinite(createdTime) || !Number.isFinite(expiryTime) || expiryTime - createdTime !== 15 * 60 * 1000) {
    throw new RangeError("Quote timing is invalid.");
  }
  if (createdTime > now + 5000 || expiryTime <= now) throw new RangeError("Quote has expired or is not yet valid.");
  if (!Array.isArray(candidate.lines) || candidate.lines.length !== 1) throw new RangeError("Reviewed quote must contain one line.");
  const rawLine = record(candidate.lines[0]);
  const handle = validateHandle(boundedString(rawLine.handle, "Quote handle", 100));
  const variantId = boundedString(rawLine.variantId, "Quote variant id", 180);
  const variantTitle = boundedString(rawLine.variantTitle, "Quote variant title", 120);
  const quantity = validateQuantity(rawLine.quantity);
  const lineOriginId = boundedString(rawLine.originId, "Quote line origin", 64).toLocaleLowerCase();
  if (lineOriginId !== origin.id || handle !== validateHandle(input.handle) || quantity !== validateQuantity(input.quantity ?? 1)) {
    throw new RangeError("Reviewed quote does not match the requested item.");
  }
  if (input.variantId && variantId !== input.variantId.trim()) throw new RangeError("Reviewed quote variant does not match the requested item.");
  if (input.variantTitle && variantTitle.toLocaleLowerCase() !== input.variantTitle.trim().toLocaleLowerCase()) {
    throw new RangeError("Reviewed quote variant does not match the requested item.");
  }
  const sourceUrl = boundedString(rawLine.sourceUrl, "Quote source URL", 500);
  let source: URL;
  try {
    source = new URL(sourceUrl);
  } catch {
    throw new RangeError("Quote source URL is invalid.");
  }
  if (
    source.protocol !== "https:"
    || source.hostname !== origin.hostname
    || source.port
    || source.username
    || source.password
    || source.search
    || source.hash
    || !new RegExp(origin.productPathPattern).test(source.pathname)
  ) throw new RangeError("Quote source URL is outside the selected allowlisted origin.");
  const unitPrice = reviewedMoney(rawLine.unitPrice, "Quote unit price", origin.currencyCode);
  const shippingPrice = optionalReviewedMoney(rawLine.shippingPrice, "Quote shipping price", origin.currencyCode);
  const condition = rawLine.condition === undefined ? undefined : boundedString(rawLine.condition, "Quote condition", 32);
  const seller = rawLine.seller === undefined ? undefined : boundedString(rawLine.seller, "Quote seller", 100);
  const line: QuoteLine = {
    originId,
    handle,
    variantId,
    variantTitle,
    quantity,
    unitPrice,
    ...(shippingPrice ? { shippingPrice } : {}),
    ...(condition ? { condition } : {}),
    ...(seller ? { seller } : {}),
    sourceUrl: source.toString(),
  };
  return {
    quoteId,
    originId,
    lines: [line],
    total: reviewedMoney(candidate.total, "Quote total", origin.currencyCode),
    createdAt: new Date(createdTime).toISOString(),
    expiresAt: new Date(expiryTime).toISOString(),
    status: "proposed",
  };
}

function reviewedFacts(quote: Quote): string {
  return JSON.stringify({ originId: quote.originId, lines: quote.lines, total: quote.total });
}

function lineFor(origin: Origin, offer: Offer, variant: Variant, quantity: number): QuoteLine {
  return {
    originId: origin.id,
    handle: offer.handle,
    variantId: variant.id,
    variantTitle: variant.title,
    quantity,
    unitPrice: variant.price,
    ...(offer.marketplace ? {
      shippingPrice: offer.marketplace.shipping.price,
      condition: offer.marketplace.condition,
      seller: offer.marketplace.seller.displayName,
    } : {}),
    sourceUrl: offer.url,
  };
}

export async function proposeCartAdd(
  input: CartInput,
  origin: Origin,
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<CatalogResult & { quote: Quote; confirmation: Confirmation }> {
  validateOrigin(input, origin);
  if (origin.vertical === "services") {
    throw new RangeError("Service booking is not enabled. Agentic can research and assemble an itinerary, but it cannot reserve or pay for a service.");
  }
  const handle = validateHandle(input.handle);
  const quantity = validateQuantity(input.quantity ?? 1);
  const catalog = await getProduct(handle, origin, fetcher, env);
  const { offer, variant } = selectVariant(catalog, input.variantId, input.variantTitle);
  assertOfferHandoffEligible(offer, Date.now(), origin.policy.maxOfferAgeSeconds * 1000);
  const createdAt = new Date();
  const quoteId = crypto.randomUUID();
  const lines = [lineFor(origin, offer, variant, quantity)];
  const quoteUnitPrice = offer.marketplace?.deliveredPrice ?? variant.price;
  return {
    ...catalog,
    offers: [offer],
    quote: {
      quoteId,
      originId: origin.id,
      lines,
      total: total(quoteUnitPrice, quantity),
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString(),
      status: "proposed",
    },
    confirmation: { quoteId, status: "awaiting_human_confirmation" },
  };
}

export async function commitCartAdd(
  input: CartCommitInput,
  origin: Origin,
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<CatalogResult & { receipt: Receipt; confirmation: Confirmation }> {
  const reviewed = parseReviewedQuote(input.reviewedQuote, input, origin, Date.now());
  const proposed = await proposeCartAdd(input, origin, fetcher, env);
  if (reviewedFacts(reviewed) !== reviewedFacts(proposed.quote)) {
    throw new RangeError("The offer changed after the reviewed quote was shown. Request a new proposal.");
  }
  return {
    origin: proposed.origin,
    source: proposed.source,
    live: proposed.live,
    offers: proposed.offers,
    ...(proposed.warning ? { warning: proposed.warning } : {}),
    receipt: {
      receiptId: crypto.randomUUID(),
      quoteId: reviewed.quoteId,
      originId: origin.id,
      lines: reviewed.lines,
      total: reviewed.total,
      status: "in_cart",
      confirmedAt: new Date().toISOString(),
    },
    confirmation: { quoteId: reviewed.quoteId, status: "confirmed" },
  };
}
