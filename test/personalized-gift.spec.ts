import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/index";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { validateDecisionContextRequest } from "../src/decision-brief";
import { giftBudgetInput, giftRecommendationIntent, matchesExistingItem, personalizeGiftResult } from "../src/personalized-gift";
import type { RecommendationResult } from "../src/recommendations";

const timestamp = "2026-09-03T18:00:00.000Z";

function selectedFact(overrides: Record<string, unknown> = {}) {
  return {
    version: "1",
    id: "fact-guitar-style",
    subjectId: "subject-nephew",
    kind: "interest",
    value: ["single coil", "classic shape"],
    source: "user-stated",
    confidence: "confirmed",
    sensitivity: "standard",
    lifeStage: null,
    allowedUses: ["gift"],
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function decisionContext(overrides: Record<string, unknown> = {}) {
  const brief = {
    version: "1",
    id: "gift-nephew",
    vertical: "gift",
    goal: "Find a guitar for my nephew",
    subjectIds: ["subject-nephew"],
    selectedFactIds: ["fact-guitar-style"],
    decisionOnlyFacts: [],
    hardConstraints: [],
    softPreferences: [{
      id: "preference-style",
      kind: "interest",
      label: "Likes classic single coil guitars",
      value: ["single coil", "classic shape"],
      weight: "high",
      source: "profile",
      factId: "fact-guitar-style",
    }],
    budget: {
      currencyCode: "USD",
      targetAmount: "700.00",
      maximumAmount: "900.00",
      includesTaxes: null,
      includesFees: true,
      contingencyPercent: 0,
    },
    location: null,
    timeWindow: null,
    output: "shortlist",
    missingInformation: [],
    createdAt: timestamp,
    ...overrides,
  };
  return { brief, selectedFacts: [selectedFact()] };
}

function jsonRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const assetFetch = vi.fn(async (input: URL | RequestInfo) => {
  const url = input instanceof Request ? new URL(input.url) : new URL(String(input));
  return new Response(`<!doctype html><title>${url.pathname}</title>`);
});
const assetFetcher: Fetcher = {
  fetch: assetFetch,
  connect: () => {
    throw new Error("Asset socket connections are not used in tests.");
  },
};
const demoOriginFetcher: Fetcher = {
  fetch: async (input, init) => handleDemoOriginRequest(new Request(input, init)),
  connect: () => {
    throw new Error("Demo origin socket connections are not used in tests.");
  },
};
const env: Env = {
  ASSETS: assetFetcher,
  VERSION_METADATA: { id: "test-version", tag: "", timestamp },
  CATALOG_SHOP: "agentic-app-review-test.myshopify.com",
  APP_COMMIT: "local",
  DEMO_ORIGIN: demoOriginFetcher,
};

describe("personalized gift decisions", () => {
  it("maps only selected gift facts into the existing bounded intent", () => {
    const context = validateDecisionContextRequest(decisionContext(), Date.parse(timestamp));
    expect(giftRecommendationIntent(context)).toMatchObject({
      shoppingFor: "gift",
      tasteContext: "single coil, classic shape",
      mustHave: null,
      avoid: null,
    });
    expect(giftBudgetInput(context, "950")).toBe("900.00");
    expect(giftBudgetInput(context, "650")).toBe("650.00");
  });

  it("validates a request-only decision projection with no-store handling", async () => {
    const response = await handleRequest(jsonRequest("https://example.test/api/decision-briefs/validate", decisionContext()), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      context: {
        brief: { id: "gift-nephew", vertical: "gift" },
        selectedFacts: [{ id: "fact-guitar-style" }],
      },
      handling: { persistence: "request-only", cache: "no-store", selectedFactCount: 1 },
    });
  });

  it("serves the personalized alpha from an isolated workspace route", async () => {
    assetFetch.mockClear();
    const response = await handleRequest(new Request("https://example.test/workspace"), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("/workspace");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(assetFetch).toHaveBeenCalledOnce();
    expect(new URL((assetFetch.mock.calls[0]?.[0] as Request).url).pathname).toBe("/workspace");
  });

  it("applies the profile projection to live marketplace ranking", async () => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest("https://example.test/api/recommendations?originId=catalog-lab", {
      originId: "catalog-lab",
      query: "electric guitar",
      maxResults: 3,
      decisionContext: decisionContext(),
    }), env);
    expect(response.status).toBe(200);
    const body: {
      goal: { maxDeliveredPrice: number; intent: { shoppingFor: string; tasteContext: string } };
      recommendations: Array<{ handle: string; matchedFacts: Array<{ factId: string; kind: string }> }>;
      personalization: {
        status: string;
        actionEligible: boolean;
        handling: string;
        appliedFacts: Array<{ id: string; decisionOnly: boolean }>;
        unsupportedConstraints: unknown[];
      };
    } = await response.json();
    expect(body.goal).toMatchObject({
      maxDeliveredPrice: 900,
      intent: { shoppingFor: "gift", tasteContext: "single coil, classic shape" },
    });
    expect(body.recommendations[0]).toMatchObject({
      handle: "sunburst-s-style-electric",
      matchedFacts: [{ factId: "fact-guitar-style", kind: "interest" }],
    });
    expect(body.personalization).toMatchObject({
      status: "applied",
      actionEligible: true,
      handling: "request-only",
      appliedFacts: [{ id: "fact-guitar-style", decisionOnly: false }],
      unsupportedConstraints: [],
    });
    expect(JSON.stringify(body)).not.toContain("ownerId");
  });

  it("withholds recommendations when a hard constraint lacks Offer evidence", async () => {
    vi.setSystemTime(new Date(timestamp));
    const context = decisionContext({
      hardConstraints: [{
        id: "constraint-age",
        kind: "age-suitability",
        label: "Suitable for a child",
        value: "child",
        source: "current-request",
        factId: null,
      }],
    });
    const response = await handleRequest(jsonRequest("https://example.test/api/recommendations?originId=catalog-lab", {
      originId: "catalog-lab",
      query: "electric guitar",
      maxResults: 3,
      decisionContext: context,
    }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      offers: [],
      recommendations: [],
      personalization: {
        status: "partial",
        actionEligible: false,
        unsupportedConstraints: [{ id: "constraint-age", kind: "age-suitability" }],
      },
      warning: expect.stringContaining("withheld"),
    });
  });

  it("rejects self-treat retail intent when subject kind is recipient", () => {
    expect(() => validateDecisionContextRequest(decisionContext({
      intent: "self-treat",
      subjectKind: "recipient",
      subjectIds: ["subject-nephew"],
    }), Date.parse(timestamp))).toThrow("self-treat intent requires a self subject");

    const validContext = validateDecisionContextRequest(decisionContext({
      intent: "gift",
      subjectKind: "recipient",
      subjectIds: ["subject-nephew"],
    }), Date.parse(timestamp));
    expect(() => giftRecommendationIntent(validContext, { intent: "self-treat", subjectKind: "recipient" }, Date.parse(timestamp)))
      .toThrow("self-treat intent requires a self subject");
  });

  it("filters out existing items for gift intent using anti-duplicate matching", () => {
    const existingFact = {
      version: "1" as const,
      id: "fact-owned-guitar",
      subjectId: "subject-nephew",
      kind: "existing-item" as const,
      value: "Sunburst S-Style Electric",
      source: "user-stated" as const,
      confidence: "confirmed" as const,
      sensitivity: "standard" as const,
      lifeStage: null,
      allowedUses: ["gift" as const],
      lastConfirmedAt: timestamp,
      expiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const context = {
      brief: {
        version: "1" as const,
        id: "gift-nephew",
        vertical: "gift" as const,
        goal: "Find a guitar for my nephew",
        subjectIds: ["subject-nephew"],
        intent: "gift" as const,
        subjectKind: "recipient" as const,
        occasion: "Birthday",
        occasionDeadline: null,
        selectedFactIds: ["fact-owned-guitar"],
        decisionOnlyFacts: [],
        hardConstraints: [],
        softPreferences: [],
        budget: null,
        location: null,
        timeWindow: null,
        output: "shortlist" as const,
        missingInformation: [],
        createdAt: timestamp,
      },
      selectedFacts: [existingFact],
    };
    const dummyOffers = [
      {
        handle: "sunburst-s-style-electric",
        title: "Sunburst S-Style Electric Guitar",
        description: "Classic guitar",
        priceRange: {
          min: { amount: "750.00", currencyCode: "USD" },
          max: { amount: "750.00", currencyCode: "USD" },
        },
      },
      {
        handle: "vintage-acoustic",
        title: "Vintage Acoustic Guitar",
        description: "Rich tone acoustic guitar",
        priceRange: {
          min: { amount: "650.00", currencyCode: "USD" },
          max: { amount: "650.00", currencyCode: "USD" },
        },
      },
    ] as any;
    const recommendationResult = {
      origin: { id: "catalog-lab", uri: "http://localhost:3000" } as any,
      goal: { query: "guitar", maxResults: 2, maxDeliveredPrice: null, intent: { shoppingFor: "gift" } },
      source: "public-products-json" as const,
      live: false,
      offers: dummyOffers,
      rubric: {} as any,
      refinement: {} as any,
      recommendations: [
        { handle: "sunburst-s-style-electric", rank: 1, score: 0.95 },
        { handle: "vintage-acoustic", rank: 2, score: 0.85 },
      ] as any,
    } as unknown as RecommendationResult;
    const personalized = personalizeGiftResult(recommendationResult, context);
    expect(personalized.recommendations.map((r) => r.handle)).toEqual(["vintage-acoustic"]);
    expect(personalized.offers.map((o) => o.handle)).toEqual(["vintage-acoustic"]);
    expect(personalized.personalization.appliedFacts.some((f) => f.id === "fact-owned-guitar")).toBe(true);
  });

  it("enforces hard indulgence budget ceiling in self-treat mode", () => {
    const context = {
      brief: {
        version: "1" as const,
        id: "self-treat-decision",
        vertical: "gift" as const,
        goal: "Treat myself to a new piece of gear",
        subjectIds: ["subject-self"],
        intent: "self-treat" as const,
        subjectKind: "self" as const,
        occasion: null,
        occasionDeadline: null,
        selectedFactIds: [],
        decisionOnlyFacts: [],
        hardConstraints: [],
        softPreferences: [],
        budget: {
          currencyCode: "USD",
          targetAmount: "800.00",
          maximumAmount: "900.00",
          includesTaxes: null,
          includesFees: true,
          contingencyPercent: 0,
        },
        location: null,
        timeWindow: null,
        output: "shortlist" as const,
        missingInformation: [],
        createdAt: timestamp,
      },
      selectedFacts: [],
    };
    const dummyOffers = [
      {
        handle: "budget-fitting-gear",
        title: "Budget Fitting Gear",
        description: "Great quality gear",
        priceRange: {
          min: { amount: "850.00", currencyCode: "USD" },
          max: { amount: "850.00", currencyCode: "USD" },
        },
      },
      {
        handle: "expensive-gear",
        title: "Over Budget Gear",
        description: "Super expensive luxury gear",
        priceRange: {
          min: { amount: "950.00", currencyCode: "USD" },
          max: { amount: "950.00", currencyCode: "USD" },
        },
      },
    ] as any;
    const recommendationResult = {
      origin: { id: "catalog-lab", uri: "http://localhost:3000" } as any,
      goal: { query: "gear", maxResults: 2, maxDeliveredPrice: 900, intent: { shoppingFor: "self" } },
      source: "public-products-json" as const,
      live: false,
      offers: dummyOffers,
      rubric: {} as any,
      refinement: {} as any,
      recommendations: [
        { handle: "expensive-gear", rank: 1, score: 0.99 },
        { handle: "budget-fitting-gear", rank: 2, score: 0.88 },
      ] as any,
    } as unknown as RecommendationResult;
    const personalized = personalizeGiftResult(recommendationResult, context);
    expect(personalized.recommendations.map((r) => r.handle)).toEqual(["budget-fitting-gear"]);
    expect(personalized.offers.map((o) => o.handle)).toEqual(["budget-fitting-gear"]);
  });

  it("withholds gift recommendations when occasion deadline is in the past", () => {
    const pastDeadline = "2026-09-01T00:00:00.000Z";
    const context = {
      brief: {
        version: "1" as const,
        id: "gift-nephew",
        vertical: "gift" as const,
        goal: "Birthday gift",
        subjectIds: ["subject-nephew"],
        intent: "gift" as const,
        subjectKind: "recipient" as const,
        occasion: "Birthday",
        occasionDeadline: pastDeadline,
        selectedFactIds: [],
        decisionOnlyFacts: [],
        hardConstraints: [],
        softPreferences: [],
        budget: null,
        location: null,
        timeWindow: null,
        output: "shortlist" as const,
        missingInformation: [],
        createdAt: timestamp,
      },
      selectedFacts: [],
    };
    expect(() => giftRecommendationIntent(context, { occasionDeadline: pastDeadline }, Date.parse(timestamp)))
      .toThrow("Occasion deadline cannot be in the past");
  });
});
