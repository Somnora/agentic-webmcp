import { describe, expect, it, vi } from "vitest";
import { normalizeProductsJsonOffer } from "../src/catalog";
import { DEMO_PRODUCTS } from "../src/demo-origin-catalog";
import { inspectOrigin } from "../src/origins";
import { findBestOptions, rankOffers, validateBudget } from "../src/recommendations";

const origin = inspectOrigin("catalog-lab");

function response(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

describe("marketplace recommendations", () => {
  it("ranks marketplace offers with visible factor scores", () => {
    const offers = DEMO_PRODUCTS.map((product) => normalizeProductsJsonOffer(product, origin)!).filter(Boolean);
    const ranked = rankOffers(offers, "electric guitar", 900);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]).toMatchObject({ rank: 1, handle: "sunburst-s-style-electric" });
    expect(ranked[0]?.score).toBeGreaterThan(80);
    expect(ranked[0]?.factors).toEqual(expect.objectContaining({ relevance: 30, condition: 23, returns: 10 }));
  });

  it("filters by delivered price and query relevance", () => {
    const offers = DEMO_PRODUCTS.map((product) => normalizeProductsJsonOffer(product, origin)!).filter(Boolean);
    expect(rankOffers(offers, "acoustic guitar", 500).map((item) => item.handle)).toEqual(["natural-dreadnought-acoustic"]);
    expect(rankOffers(offers, "electric guitar", 580).map((item) => item.handle)).toEqual(["mahogany-single-cut-electric"]);
  });

  it("validates the delivered-price ceiling", () => {
    expect(validateBudget("900")).toBe(900);
    expect(validateBudget(null)).toBeNull();
    expect(() => validateBudget("10")).toThrow("between 25 and 100000");
  });

  it("returns a compact ranked catalog from the controlled origin", async () => {
    const fetcher = vi.fn(async () => response({ products: DEMO_PRODUCTS })) as typeof fetch;
    const result = await findBestOptions("electric guitar", "3", "900", origin, fetcher);
    expect(result.recommendations).toHaveLength(3);
    expect(result.offers.map((offer) => offer.handle)).toEqual(result.recommendations.map((item) => item.handle));
    expect(result.rubric).toEqual({ relevance: 30, condition: 25, deliveredPrice: 25, sellerConfidence: 10, returns: 10 });
  });
});
