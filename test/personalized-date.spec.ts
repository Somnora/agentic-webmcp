import { describe, expect, it, vi } from "vitest";
import { normalizeServicesJsonOffer } from "../src/catalog";
import { validateDecisionContextRequest } from "../src/decision-brief";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { DEMO_SERVICES } from "../src/demo-services";
import { handleRequest } from "../src/index";
import { inspectOrigin } from "../src/origins";
import { createPersonalizedDatePlans } from "../src/personalized-date";

const timestamp = "2026-09-03T18:00:00.000Z";
const planningDate = "2026-10-10";
const origin = inspectOrigin("services-lab");

function profileFact(id: string, subjectId: string, kind: string, value: string[]) {
  return {
    version: "1",
    id,
    subjectId,
    kind,
    value,
    source: "user-stated",
    confidence: "confirmed",
    sensitivity: kind === "previous-activity" ? "private" : "standard",
    lifeStage: kind === "previous-activity" ? "recent" : null,
    allowedUses: ["date"],
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function rawDecisionContext(options: { partnerAvoid?: string[]; unsupportedAccessibility?: boolean; subjectIds?: string[]; vertical?: string } = {}) {
  const facts = [
    profileFact("fact-you-interests", "date-you", "interest", ["photography", "local food"]),
    profileFact("fact-partner-interests", "date-partner", "interest", ["surf", "local history"]),
    profileFact("fact-previous", "date-you", "previous-activity", ["movie night"]),
    ...(options.partnerAvoid?.length ? [profileFact("fact-partner-avoid", "date-partner", "avoidance", options.partnerAvoid)] : []),
  ];
  const hardConstraints = [
    { id: "date-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
    { id: "date-day", kind: "date-range", label: `Date is ${planningDate}`, value: planningDate, source: "current-request", factId: null },
    { id: "date-party", kind: "party-size", label: "Two participants", value: 2, source: "current-request", factId: null },
    ...(options.partnerAvoid?.length ? [{ id: "date-avoid", kind: "avoid", label: "Their hard dislikes", value: options.partnerAvoid, source: "profile", factId: "fact-partner-avoid" }] : []),
    ...(options.unsupportedAccessibility ? [{ id: "date-access", kind: "accessibility", label: "Step-free access", value: "required", source: "current-request", factId: null }] : []),
  ];
  return {
    brief: {
      version: "1",
      id: "date-oahu",
      vertical: options.vertical ?? "date",
      goal: "Plan a source-backed Oahu date that balances both participants",
      subjectIds: options.subjectIds ?? ["date-you", "date-partner"],
      selectedFactIds: [],
      decisionOnlyFacts: facts,
      hardConstraints,
      softPreferences: [
        { id: "preference-you", kind: "interest", label: "Your interests", value: ["photography", "local food"], weight: "high", source: "profile", factId: "fact-you-interests" },
        { id: "preference-partner", kind: "interest", label: "Their interests", value: ["surf", "local history"], weight: "high", source: "profile", factId: "fact-partner-interests" },
        { id: "preference-mood", kind: "theme", label: "Desired mood", value: "calm and connected", weight: "medium", source: "current-request", factId: null },
        { id: "preference-novelty", kind: "novelty", label: "Desired novelty", value: "mostly-new", weight: "high", source: "current-request", factId: null },
      ],
      budget: {
        currencyCode: "USD",
        targetAmount: null,
        maximumAmount: "500.00",
        includesTaxes: false,
        includesFees: false,
        contingencyPercent: 10,
      },
      location: {
        label: "Oahu, Hawaii",
        city: null,
        region: "Oahu, Hawaii",
        countryCode: "US",
        timezone: "Pacific/Honolulu",
        flexible: false,
      },
      timeWindow: {
        start: `${planningDate}T08:00:00-10:00`,
        end: `${planningDate}T20:00:00-10:00`,
        timezone: "Pacific/Honolulu",
        flexible: false,
      },
      output: "package",
      missingInformation: [],
      createdAt: timestamp,
    },
    selectedFacts: [],
  };
}

function decisionContext(options: Parameters<typeof rawDecisionContext>[0] = {}) {
  return validateDecisionContextRequest(rawDecisionContext(options), Date.parse(timestamp));
}

const normalizedOffers = DEMO_SERVICES
  .map((service) => normalizeServicesJsonOffer(service, origin, timestamp))
  .filter((offer) => offer !== null);

function jsonRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const assetFetcher: Fetcher = {
  fetch: async () => new Response("<!doctype html><title>Date</title>"),
  connect: () => { throw new Error("Asset sockets are not used in tests."); },
};
const demoOriginFetcher: Fetcher = {
  fetch: async (input, init) => handleDemoOriginRequest(new Request(input, init)),
  connect: () => { throw new Error("Demo origin sockets are not used in tests."); },
};
const env: Env = {
  ASSETS: assetFetcher,
  VERSION_METADATA: { id: "test-version", tag: "", timestamp },
  CATALOG_SHOP: "agentic-app-review-test.myshopify.com",
  APP_COMMIT: "local",
  DEMO_ORIGIN: demoOriginFetcher,
};

describe("personalized date planning", () => {
  it("builds exact low-cost, balanced, and special-occasion packages", () => {
    const result = createPersonalizedDatePlans(decisionContext(), normalizedOffers, timestamp);
    expect(result.status).toBe("planned");
    expect(result.plans.map((plan) => [plan.tier, plan.itemHandles])).toEqual([
      ["low-cost", ["haleiwa-food-story-walk"]],
      ["balanced", ["haleiwa-food-story-walk", "oahu-sunset-photo-walk"]],
      ["special-occasion", ["north-shore-surf-foundations", "haleiwa-food-story-walk", "oahu-sunset-photo-walk"]],
    ]);
    expect(result.plans.map((plan) => plan.itinerary.items.length)).toEqual([1, 2, 3]);
    expect(result.plans.map((plan) => plan.costRange)).toEqual([
      expect.objectContaining({ min: { amount: "116.00", currencyCode: "USD" }, max: { amount: "127.60", currencyCode: "USD" } }),
      expect.objectContaining({ min: { amount: "260.00", currencyCode: "USD" }, max: { amount: "286.00", currencyCode: "USD" } }),
      expect.objectContaining({ min: { amount: "450.00", currencyCode: "USD" }, max: { amount: "495.00", currencyCode: "USD" } }),
    ]);
    expect(result.plans.every((plan) => Number(plan.costRange.max.amount) <= Number(plan.budgetCeiling.amount))).toBe(true);
    expect(result.plans.every((plan) => plan.balance === "both-participants")).toBe(true);
    expect(result.plans.every((plan) => plan.itinerary.status === "planning-only")).toBe(true);
    expect(result.personalization).toMatchObject({ status: "applied", actionEligible: true, handling: "request-only" });
  });

  it("filters hard dislikes before scoring and reports an incomplete tier set", () => {
    const result = createPersonalizedDatePlans(decisionContext({ partnerAvoid: ["surf"] }), normalizedOffers, timestamp);
    expect(result.status).toBe("needs-attention");
    expect(result.plans).toHaveLength(2);
    expect(result.plans.flatMap((plan) => plan.itemHandles)).not.toContain("north-shore-surf-foundations");
    expect(result.personalization.excludedByDislike).toEqual([
      expect.objectContaining({ handle: "north-shore-surf-foundations", matchedTerms: ["surf"] }),
    ]);
    expect(result.warning).toContain("Some cost bands");
  });

  it("fails closed when a hard constraint lacks source evidence", () => {
    const result = createPersonalizedDatePlans(decisionContext({ unsupportedAccessibility: true }), normalizedOffers, timestamp);
    expect(result).toMatchObject({
      status: "needs-attention",
      plans: [],
      personalization: {
        actionEligible: false,
        unsupportedConstraints: [{ id: "date-access", kind: "accessibility" }],
      },
    });
  });

  it("requires the date vertical and exactly two subjects", () => {
    const context = decisionContext();
    expect(() => createPersonalizedDatePlans({ ...context, brief: { ...context.brief, vertical: "gift" } }, normalizedOffers, timestamp)).toThrow("date decision brief");
    expect(() => createPersonalizedDatePlans({ ...context, brief: { ...context.brief, subjectIds: ["date-you"] } }, normalizedOffers, timestamp)).toThrow("exactly two profile subjects");
  });

  it("serves verified, no-store date plans from the controlled origin", async () => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest("https://example.test/api/date-plans?originId=services-lab", {
      originId: "services-lab",
      decisionContext: rawDecisionContext(),
    }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body: {
      status: string;
      live: boolean;
      plans: Array<{ tier: string; evidenceConfidence: string }>;
      personalization: { handling: string };
    } = await response.json();
    expect(body).toMatchObject({ status: "planned", live: true, personalization: { handling: "request-only" } });
    expect(body.plans).toHaveLength(3);
    expect(body.plans.every((plan) => plan.evidenceConfidence === "Verified across service JSON and page data")).toBe(true);
  });

  it("rejects date-planning request bodies above the dedicated limit", async () => {
    const oversized = JSON.stringify({ originId: "services-lab", decisionContext: rawDecisionContext(), padding: "x".repeat(9000) });
    const response = await handleRequest(new Request("https://example.test/api/date-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversized,
    }), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_INPUT", error: "Request body is too large." });
  });
});
