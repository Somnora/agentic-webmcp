import { describe, expect, it } from "vitest";
import { normalizeJsonLdOffer } from "../src/interpolate";
import { inspectOrigin } from "../src/origins";

const origin = inspectOrigin("review-shop");

describe("JSON-LD Offer interpolation", () => {
  it("normalizes ProductGroup aggregate and leaf offers", () => {
    const offer = normalizeJsonLdOffer({
      "@type": "ProductGroup",
      name: "Configurable Snowboard",
      description: "A product group from page JSON-LD.",
      brand: { "@type": "Brand", name: "Review Shop" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "650.00",
        highPrice: "700.00",
        priceCurrency: "USD",
        offers: [
          { "@type": "Offer", name: "Ice", sku: "ice-1", price: "700.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
          { "@type": "Offer", name: "Dawn", sku: "dawn-1", price: "650.00", priceCurrency: "USD", availability: "https://schema.org/OutOfStock" },
        ],
      },
    }, origin, "configurable-snowboard");

    expect(offer).toMatchObject({
      title: "Configurable Snowboard",
      priceRange: { min: { amount: "650.00" }, max: { amount: "700.00" } },
      source: { adapter: "json-ld", live: true },
      provenance: {
        pricing: { state: "single-source", primary: "json-ld" },
        variants: { state: "single-source", primary: "json-ld" },
      },
    });
    expect(offer?.variants).toHaveLength(2);
    expect(offer?.variants[0]).toMatchObject({ title: "Ice", available: true });
    expect(offer?.variants[1]).toMatchObject({ title: "Dawn", available: false });
  });
});
