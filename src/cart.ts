import { getProduct, validateHandle, type CatalogEnv, type CatalogResult } from "./catalog";
import type { Money, Offer, Variant } from "./offers";
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const handle = validateHandle(input.handle);
  const quantity = validateQuantity(input.quantity ?? 1);
  const catalog = await getProduct(handle, origin, fetcher, env);
  const { offer, variant } = selectVariant(catalog, input.variantId, input.variantTitle);
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
  input: CartInput & { quoteId: string; expiresAt: string },
  origin: Origin,
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<CatalogResult & { receipt: Receipt; confirmation: Confirmation }> {
  const quoteId = input.quoteId.trim();
  if (!UUID_PATTERN.test(quoteId)) throw new RangeError("Quote id is invalid.");
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new RangeError("Quote has expired.");
  if (expiresAt > Date.now() + 15 * 60 * 1000 + 5000) throw new RangeError("Quote expiry is invalid.");
  const proposed = await proposeCartAdd(input, origin, fetcher, env);
  return {
    origin: proposed.origin,
    source: proposed.source,
    live: proposed.live,
    offers: proposed.offers,
    ...(proposed.warning ? { warning: proposed.warning } : {}),
    receipt: {
      receiptId: crypto.randomUUID(),
      quoteId,
      originId: origin.id,
      lines: proposed.quote.lines,
      total: proposed.quote.total,
      status: "in_cart",
      confirmedAt: new Date().toISOString(),
    },
    confirmation: { quoteId, status: "confirmed" },
  };
}
