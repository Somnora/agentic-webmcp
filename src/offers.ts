import type { Adapter, Vertical } from "./origins";

export type OfferSourceAdapter = Adapter | "bundled-snapshot";

export type EvidenceState = "verified" | "single-source" | "conflict";

export type EvidenceClaim = {
  state: EvidenceState;
  primary: OfferSourceAdapter;
  sources: OfferSourceAdapter[];
  note?: string;
};

export type ReconciledEvidenceField = "pricing" | "availability" | "condition" | "shipping" | "returns";

export type EvidenceVerification = {
  state: EvidenceState;
  label: string;
  checkedAt: string | null;
  sources: OfferSourceAdapter[];
  verifiedFields: ReconciledEvidenceField[];
  singleSourceFields: ReconciledEvidenceField[];
  conflictFields: ReconciledEvidenceField[];
};

export type OfferProvenance = {
  title: EvidenceClaim;
  description: EvidenceClaim;
  pricing: EvidenceClaim;
  availability: EvidenceClaim;
  variants: EvidenceClaim;
  condition?: EvidenceClaim;
  seller?: EvidenceClaim;
  shipping?: EvidenceClaim;
  returns?: EvidenceClaim;
  verification: EvidenceVerification;
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

export type HandoffReason =
  | "eligible"
  | "source-not-live"
  | "source-stale"
  | "source-timestamp-invalid"
  | "unavailable"
  | "evidence-conflict";

export type HandoffEligibility = {
  eligible: boolean;
  reason: HandoffReason;
  freshness: "fresh" | "stale" | "invalid" | "not-live";
  freshUntil: string | null;
  maxAgeSeconds: number;
};

export const DEFAULT_MAX_HANDOFF_OFFER_AGE_SECONDS = 5 * 60;
const MAX_FUTURE_CLOCK_SKEW_MS = 60 * 1000;

export type OfferInput = {
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

export type Offer = OfferInput & {
  handoff: HandoffEligibility;
};

export function assessOfferHandoff(
  offer: OfferInput,
  now = Date.now(),
  maxAgeSeconds = DEFAULT_MAX_HANDOFF_OFFER_AGE_SECONDS,
): HandoffEligibility {
  const fetchedAt = Date.parse(offer.source.fetchedAt);
  const maxAgeMs = maxAgeSeconds * 1000;
  const validTimestamp = Number.isFinite(fetchedAt);
  const freshUntil = validTimestamp ? new Date(fetchedAt + maxAgeMs).toISOString() : null;
  if (!offer.source.live || offer.source.adapter === "bundled-snapshot") {
    return { eligible: false, reason: "source-not-live", freshness: "not-live", freshUntil, maxAgeSeconds };
  }
  if (!validTimestamp || fetchedAt - now > MAX_FUTURE_CLOCK_SKEW_MS) {
    return { eligible: false, reason: "source-timestamp-invalid", freshness: "invalid", freshUntil: null, maxAgeSeconds };
  }
  if (now - fetchedAt > maxAgeMs) {
    return { eligible: false, reason: "source-stale", freshness: "stale", freshUntil, maxAgeSeconds };
  }
  if (offer.provenance.verification.state === "conflict") {
    return { eligible: false, reason: "evidence-conflict", freshness: "fresh", freshUntil, maxAgeSeconds };
  }
  if (!offer.constraints.available) {
    return { eligible: false, reason: "unavailable", freshness: "fresh", freshUntil, maxAgeSeconds };
  }
  return { eligible: true, reason: "eligible", freshness: "fresh", freshUntil, maxAgeSeconds };
}

export function finalizeOffer(
  offer: OfferInput,
  now = Date.now(),
  maxAgeSeconds = DEFAULT_MAX_HANDOFF_OFFER_AGE_SECONDS,
): Offer {
  return { ...offer, handoff: assessOfferHandoff(offer, now, maxAgeSeconds) };
}

export function uniformProvenance(adapter: OfferSourceAdapter): OfferProvenance {
  return {
    title: singleSourceEvidence(adapter),
    description: singleSourceEvidence(adapter),
    pricing: singleSourceEvidence(adapter),
    availability: singleSourceEvidence(adapter),
    variants: singleSourceEvidence(adapter),
    verification: {
      state: "single-source",
      label: `Single source: ${adapterLabel(adapter)}`,
      checkedAt: null,
      sources: [adapter],
      verifiedFields: [],
      singleSourceFields: ["pricing", "availability", "condition", "shipping", "returns"],
      conflictFields: [],
    },
  };
}

export function singleSourceEvidence(adapter: OfferSourceAdapter): EvidenceClaim {
  return { state: "single-source", primary: adapter, sources: [adapter] };
}

function adapterLabel(adapter: OfferSourceAdapter): string {
  const labels: Record<OfferSourceAdapter, string> = {
    "shopify-storefront": "Storefront GraphQL",
    "shopify-products-json": "product JSON",
    "public-products-json": "product JSON",
    "json-ld": "page",
    "html-markdown": "page Markdown",
    "bundled-snapshot": "bundled snapshot",
  };
  return labels[adapter];
}

function evidenceValue(offer: Offer, field: ReconciledEvidenceField): unknown {
  if (field === "pricing") return offer.priceRange;
  if (field === "availability") return offer.constraints.available;
  if (field === "condition") return offer.marketplace?.condition;
  if (field === "shipping") return offer.marketplace?.shipping;
  return offer.marketplace?.returns;
}

function sameEvidence(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compactEvidenceValue(value: unknown): string {
  if (value === undefined) return "not supplied";
  if (typeof value === "boolean" || typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value).slice(0, 180);
}

export function reconcileOfferEvidence(primary: Offer, page: Offer, checkedAt = new Date().toISOString()): Offer {
  if (primary.originId !== page.originId || primary.handle !== page.handle) {
    throw new RangeError("Evidence sources must describe the same origin and product handle.");
  }
  const fields: ReconciledEvidenceField[] = ["pricing", "availability", "condition", "shipping", "returns"];
  const provenance: OfferProvenance = {
    ...primary.provenance,
    title: { ...primary.provenance.title, sources: [...primary.provenance.title.sources] },
    description: { ...primary.provenance.description, sources: [...primary.provenance.description.sources] },
    pricing: { ...primary.provenance.pricing, sources: [...primary.provenance.pricing.sources] },
    availability: { ...primary.provenance.availability, sources: [...primary.provenance.availability.sources] },
    variants: { ...primary.provenance.variants, sources: [...primary.provenance.variants.sources] },
    ...(primary.provenance.condition ? { condition: { ...primary.provenance.condition, sources: [...primary.provenance.condition.sources] } } : {}),
    ...(primary.provenance.seller ? { seller: { ...primary.provenance.seller, sources: [...primary.provenance.seller.sources] } } : {}),
    ...(primary.provenance.shipping ? { shipping: { ...primary.provenance.shipping, sources: [...primary.provenance.shipping.sources] } } : {}),
    ...(primary.provenance.returns ? { returns: { ...primary.provenance.returns, sources: [...primary.provenance.returns.sources] } } : {}),
    verification: { ...primary.provenance.verification, sources: [...primary.provenance.verification.sources], verifiedFields: [], singleSourceFields: [], conflictFields: [] },
  };
  const verifiedFields: ReconciledEvidenceField[] = [];
  const singleSourceFields: ReconciledEvidenceField[] = [];
  const conflictFields: ReconciledEvidenceField[] = [];
  for (const field of fields) {
    const primaryValue = evidenceValue(primary, field);
    const pageValue = evidenceValue(page, field);
    const primaryClaim = provenance[field];
    if (primaryValue === undefined || pageValue === undefined || !primaryClaim) {
      singleSourceFields.push(field);
      continue;
    }
    const sources = [...new Set([...primaryClaim.sources, page.source.adapter])];
    if (sameEvidence(primaryValue, pageValue)) {
      provenance[field] = { state: "verified", primary: primaryClaim.primary, sources };
      verifiedFields.push(field);
    } else {
      provenance[field] = {
        state: "conflict",
        primary: primaryClaim.primary,
        sources,
        note: `${adapterLabel(primaryClaim.primary)}: ${compactEvidenceValue(primaryValue)}; page: ${compactEvidenceValue(pageValue)}`,
      };
      conflictFields.push(field);
    }
  }
  const sources = [...new Set([primary.source.adapter, page.source.adapter])];
  const state: EvidenceState = conflictFields.length ? "conflict" : verifiedFields.length ? "verified" : "single-source";
  const label = state === "conflict"
    ? `Evidence conflict: ${conflictFields.join(", ")}`
    : state === "verified"
      ? `Verified across ${adapterLabel(primary.source.adapter)} and ${adapterLabel(page.source.adapter)}`
      : `Single source: ${adapterLabel(primary.source.adapter)}`;
  provenance.verification = {
    state,
    label,
    checkedAt,
    sources,
    verifiedFields,
    singleSourceFields,
    conflictFields,
  };
  return finalizeOffer({ ...primary, provenance }, Date.parse(primary.source.fetchedAt), primary.handoff.maxAgeSeconds);
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
