import { describe, expect, it, vi } from "vitest";
import { normalizeProductsJsonOffer } from "../src/catalog";
import { DEMO_PRODUCTS } from "../src/demo-origin-catalog";
import { inspectOrigin } from "../src/origins";
import { findBestOptions, rankOffers, validateBudget, validateRecommendationIntent } from "../src/recommendations";

const origin = inspectOrigin("catalog-lab");

function response(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

describe("marketplace recommendations", () => {
  it("ranks marketplace offers with visible factor scores", () => {
    const offers = DEMO_PRODUCTS.map((product) => normalizeProductsJsonOffer(product, origin)!).filter(Boolean);
    const ranked = rankOffers(offers, "electric guitar", 900);
    expect(ranked).toHaveLength(3);
    expect(ranked[0]).toMatchObject({ rank: 1, label: "Best fit", handle: "sunburst-s-style-electric" });
    expect(ranked[0]?.score).toBeGreaterThan(80);
    expect(ranked[0]?.factors).toEqual(expect.objectContaining({ relevance: 25, condition: 18.4, preferenceFit: 5, returns: 10 }));
    expect(ranked[0]?.tradeoff).toBeTruthy();
    expect(ranked[0]?.evidenceConfidence).toContain("Single source");
  });

  it("filters by delivered price and query relevance", () => {
    const offers = DEMO_PRODUCTS.map((product) => normalizeProductsJsonOffer(product, origin)!).filter(Boolean);
    expect(rankOffers(offers, "acoustic guitar", 500).map((item) => item.handle)).toEqual(["natural-dreadnought-acoustic"]);
    expect(rankOffers(offers, "electric guitar", 580).map((item) => item.handle)).toEqual(["mahogany-single-cut-electric"]);
  });

  it("treats a multi-word avoidance as one exclusion instead of rejecting every shared product term", () => {
    const offers = DEMO_PRODUCTS.map((product) => normalizeProductsJsonOffer(product, origin)!).filter(Boolean);
    expect(rankOffers(offers, "guitar", 900, { avoid: "acoustic guitar" }).map((item) => item.handle)).toEqual([
      "sunburst-s-style-electric",
      "mahogany-single-cut-electric",
      "offset-electric-ocean-blue",
    ]);
    expect(rankOffers(offers, "guitar", 900, { avoid: "acoustic guitar, final sale" }).map((item) => item.handle)).toEqual([
      "sunburst-s-style-electric",
      "mahogany-single-cut-electric",
    ]);
  });

  it("validates the delivered-price ceiling", () => {
    expect(validateBudget("900")).toBe(900);
    expect(validateBudget(null)).toBeNull();
    expect(() => validateBudget("10")).toThrow("between 25 and 100000");
  });

  it("uses session-only taste, constraints, and exploration labels", () => {
    const offers = DEMO_PRODUCTS.map((product) => normalizeProductsJsonOffer(product, origin)!).filter(Boolean);
    const ranked = rankOffers(offers, "electric guitar", 900, {
      shoppingFor: "gift",
      mode: "explore",
      priorities: ["taste", "condition", "price"],
      tasteContext: "single coil fitted case",
      mustHave: "single coil",
      avoid: "final sale",
    });
    expect(ranked.map((item) => item.handle)).toEqual(["sunburst-s-style-electric"]);
    expect(ranked[0]).toMatchObject({ label: "Best fit", why: expect.stringContaining("recipient context") });

    const exploratory = rankOffers(offers, "electric guitar", 900, { mode: "explore" });
    expect(exploratory.map((item) => item.label)).toEqual(["Best fit", "Best value", "Worth a look"]);

    const distinctRefinement = rankOffers(offers, "electric guitar", 900, {
      priorities: ["taste", "condition", "price"],
      tasteContext: "single coil pickups",
      refinementChoice: "match",
    });
    expect(distinctRefinement).toHaveLength(3);
    expect(Object.values(distinctRefinement[0]!.factors).every((score) => Number.isFinite(score) && score >= 0)).toBe(true);
  });

  it("validates and bounds preference input", () => {
    expect(validateRecommendationIntent({ shoppingFor: "gift", mode: "explore", priorities: ["taste", "price"] })).toMatchObject({
      shoppingFor: "gift",
      mode: "explore",
      priorities: ["taste", "price"],
    });
    expect(() => validateRecommendationIntent({ priorities: ["match", "taste", "condition", "price"] })).toThrow("no more than three");
    expect(() => validateRecommendationIntent({ tasteContext: "x".repeat(121) })).toThrow("120 characters or fewer");
    expect(() => validateRecommendationIntent({ refinementChoice: "brand" })).toThrow("refinementChoice must be one of");
  });

  it("asks one evidence-derived question and applies the answer as an explicit rerank", async () => {
    const fetcher = vi.fn(async () => response({ products: DEMO_PRODUCTS })) as typeof fetch;
    const intent = {
      shoppingFor: "gift",
      mode: "explore",
      priorities: ["taste", "condition", "price"],
      tasteContext: "single coil pickups",
    };
    const initial = await findBestOptions("electric guitar", "3", "900", origin, fetcher, {}, intent);
    expect(initial.refinement).toMatchObject({
      status: "needs-clarification",
      reason: "competing-tradeoffs",
      beforeHandle: "sunburst-s-style-electric",
      selectedChoice: null,
    });
    expect(initial.refinement.question).toContain("Which consideration");
    expect(initial.refinement.choices.map((choice) => choice.id)).toEqual(["price", "taste", "returns"]);

    const refined = await findBestOptions("electric guitar", "3", "900", origin, fetcher, {}, { ...intent, refinementChoice: "price" });
    expect(refined.refinement).toMatchObject({
      status: "resolved",
      reason: "answered",
      selectedChoice: { id: "price", label: "Lower delivered price" },
      beforeHandle: "sunburst-s-style-electric",
      afterHandle: expect.any(String),
    });
    expect(refined.refinement.question).toBe(initial.refinement.question);
    expect(refined.refinement.choices).toEqual(initial.refinement.choices);
    expect(refined.refinement.explanation).toContain("10-point rubric boost");
    expect(refined.rubric.deliveredPrice).toBe(35);
    expect(Object.values(refined.rubric).reduce((sum, value) => sum + value, 0)).toBe(100);

    const unavailableChoice = (["match", "taste", "condition", "price", "returns", "delivery"] as const)
      .find((choice) => !initial.refinement.choices.some((available) => available.id === choice));
    expect(unavailableChoice).toBeTruthy();
    await expect(findBestOptions("electric guitar", "3", "900", origin, fetcher, {}, { ...intent, refinementChoice: unavailableChoice }))
      .rejects.toThrow("must match one of the choices returned by the checkpoint");
  });

  it("does not ask a refinement question when only one option qualifies", async () => {
    const fetcher = vi.fn(async () => response({ products: DEMO_PRODUCTS })) as typeof fetch;
    const result = await findBestOptions("acoustic guitar", "3", "500", origin, fetcher);
    expect(result.refinement).toMatchObject({ status: "not-needed", reason: "insufficient-options", margin: null });
    await expect(findBestOptions("acoustic guitar", "3", "500", origin, fetcher, {}, { refinementChoice: "price" }))
      .rejects.toThrow("not accepted without two eligible options");
  });

  it("returns a compact ranked catalog from the controlled origin", async () => {
    const fetcher = vi.fn(async () => response({ products: DEMO_PRODUCTS })) as typeof fetch;
    const result = await findBestOptions("electric guitar", "3", "900", origin, fetcher);
    expect(result.recommendations).toHaveLength(3);
    expect(result.offers.map((offer) => offer.handle)).toEqual(result.recommendations.map((item) => item.handle));
    expect(result.rubric).toEqual({ relevance: 25, preferenceFit: 10, condition: 20, deliveredPrice: 20, sellerConfidence: 10, returns: 10, delivery: 5 });
    expect(Object.values(result.rubric).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(result.goal.intent).toMatchObject({ shoppingFor: "self", mode: "decide", priorities: [] });
  });
});
