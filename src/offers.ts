import type { Adapter, Vertical } from "./origins";

export type OfferSourceAdapter = Adapter | "bundled-snapshot";

export type OfferProvenance = {
  title: OfferSourceAdapter;
  description: OfferSourceAdapter;
  pricing: OfferSourceAdapter;
  availability: OfferSourceAdapter;
  variants: OfferSourceAdapter;
  condition?: OfferSourceAdapter;
  seller?: OfferSourceAdapter;
  shipping?: OfferSourceAdapter;
  returns?: OfferSourceAdapter;
};

export type Money = { amount: string; currencyCode: string };

export type Variant = {
  id: string;
  title: string;
  available: boolean;
  quantityAvailable: number | null;
  price: Money;
  options: Array<{ name: string; value: string }>;
};

export type Constraints = {
  available: boolean;
  quantityAvailable?: number | null;
  moq?: number;
  leadDays?: number;
  accountRequired?: boolean;
  refundable?: boolean;
  occupancy?: { min: number; max: number };
  stayNights?: { min: number; max: number };
};

export type MarketplaceCondition = "new" | "open-box" | "excellent" | "very-good" | "good" | "fair";

export type MarketplaceEvidence = {
  condition: MarketplaceCondition;
  conditionDescription: string;
  seller: {
    displayName: string;
    positiveFeedbackPercent: number;
    feedbackCount: number;
  };
  shipping: {
    price: Money;
    method: string;
    estimatedDays: { min: number; max: number };
  };
  returns: {
    accepted: boolean;
    windowDays: number | null;
    paidBy: "buyer" | "seller" | "not-applicable";
  };
  deliveredPrice: Money;
};

export type Offer = {
  originId: string;
  handle: string;
  title: string;
  description: string;
  url: string;
  vendor?: string;
  productType?: string;
  vertical: Vertical;
  priceRange: { min: Money; max: Money };
  variants: Variant[];
  constraints: Constraints;
  marketplace?: MarketplaceEvidence;
  image?: { url: string; altText: string | null };
  source: {
    adapter: OfferSourceAdapter;
    live: boolean;
    fetchedAt: string;
    untrusted: true;
  };
  provenance: OfferProvenance;
};

export function uniformProvenance(adapter: OfferSourceAdapter): OfferProvenance {
  return {
    title: adapter,
    description: adapter,
    pricing: adapter,
    availability: adapter,
    variants: adapter,
  };
}

export function money(value: unknown, currencyCode = "USD"): Money {
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, 24) : "";
  const numeric = Number.parseFloat(raw);
  const currency = currencyCode.trim().toLocaleUpperCase().slice(0, 8);
  return {
    amount: Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00",
    currencyCode: currency || "USD",
  };
}

export function offerAvailable(variants: Variant[]): boolean {
  return variants.some((variant) => variant.available);
}

export function priceLabel(offer: Offer): string {
  const { min, max } = offer.priceRange;
  return min.amount === max.amount
    ? `${min.amount} ${min.currencyCode}`
    : `${min.amount}-${max.amount} ${min.currencyCode}`;
}
