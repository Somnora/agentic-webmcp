import { describe, expect, it } from "vitest";
import { normalizeProductsJsonOffer } from "../src/catalog";
import { DEMO_PRODUCTS } from "../src/demo-origin-catalog";
import { normalizeJsonLdOffer } from "../src/interpolate";
import { reconcileOfferEvidence } from "../src/offers";
import { inspectOrigin } from "../src/origins";

const origin = inspectOrigin("catalog-lab");
const product = DEMO_PRODUCTS[0]!;

function pageOffer(price = product.variants[0]!.price) {
  return normalizeJsonLdOffer({
    "@type": "Product",
    name: product.title,
    description: "Page evidence.",
    additionalProperty: [
      { name: "condition", value: product.condition },
      { name: "condition_description", value: product.condition_description },
      { name: "seller_feedback_percent", value: product.seller.positive_feedback_percent },
      { name: "seller_feedback_count", value: product.seller.feedback_count },
      { name: "shipping_price", value: product.shipping.price },
      { name: "shipping_method", value: product.shipping.method },
      { name: "shipping_estimated_days_min", value: product.shipping.estimated_days_min },
      { name: "shipping_estimated_days_max", value: product.shipping.estimated_days_max },
      { name: "returns_accepted", value: product.returns.accepted },
      { name: "returns_window_days", value: product.returns.window_days },
      { name: "returns_paid_by", value: product.returns.paid_by },
    ],
    offers: [{
      "@type": "Offer",
      name: product.variants[0]!.title,
      sku: product.variants[0]!.id,
      price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: product.seller.display_name },
    }],
  }, origin, product.handle)!;
}

describe("Offer evidence reconciliation", () => {
  it("verifies decision fields across product JSON and the page", () => {
    const structured = normalizeProductsJsonOffer(product, origin)!;
    const reconciled = reconcileOfferEvidence(structured, pageOffer(), structured.source.fetchedAt);

    expect(reconciled.provenance.verification).toMatchObject({
      state: "verified",
      label: "Verified across product JSON and page",
      verifiedFields: ["pricing", "availability", "condition", "shipping", "returns"],
      conflictFields: [],
    });
    for (const field of ["pricing", "availability", "condition", "shipping", "returns"] as const) {
      expect(reconciled.provenance[field]).toMatchObject({ state: "verified", sources: ["public-products-json", "json-ld"] });
    }
    expect(reconciled.handoff).toMatchObject({ eligible: true, reason: "eligible" });
  });

  it("keeps primary values, records conflicts, and blocks handoff", () => {
    const structured = normalizeProductsJsonOffer(product, origin)!;
    const reconciled = reconcileOfferEvidence(structured, pageOffer("999.00"), structured.source.fetchedAt);

    expect(reconciled.priceRange.min.amount).toBe(product.variants[0]!.price);
    expect(reconciled.provenance.pricing).toMatchObject({ state: "conflict", primary: "public-products-json" });
    expect(reconciled.provenance.pricing.note).toContain("999.00");
    expect(reconciled.provenance.verification).toMatchObject({ state: "conflict", conflictFields: ["pricing"] });
    expect(reconciled.handoff).toMatchObject({ eligible: false, reason: "evidence-conflict" });
  });
});
