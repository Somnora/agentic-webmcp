import { describe, expect, it, vi } from "vitest";
import { decisionStrategy, validateRevisionReference } from "../src/decision-orchestrator";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { handleRequest } from "../src/index";

const timestamp = "2026-09-03T18:00:00.000Z";

function fact(id: string, subjectId: string, kind: string, value: string[], allowedUses: string[]) {
  return {
    version: "1",
    id,
    subjectId,
    kind,
    value,
    source: "user-stated",
    confidence: "confirmed",
    sensitivity: kind === "fond-memory-signal" || kind === "previous-activity" ? "private" : "standard",
    lifeStage: kind === "fond-memory-signal" ? "childhood" : null,
    allowedUses,
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function baseBrief(id: string, vertical: string, goal: string, subjectIds: string[]) {
  return {
    version: "1",
    id,
    vertical,
    goal,
    subjectIds,
    selectedFactIds: [],
    hardConstraints: [],
    softPreferences: [],
    budget: null,
    location: null,
    timeWindow: null,
    output: "package",
    missingInformation: [],
    createdAt: timestamp,
  };
}

function giftContext() {
  const interests = fact("gift-interests", "gift-recipient", "interest", ["single coil", "classic shape"], ["gift"]);
  return {
    brief: {
      ...baseBrief("decision-gift-1", "gift", "Find an electric guitar for my nephew", ["gift-recipient"]),
      decisionOnlyFacts: [interests],
      softPreferences: [{ id: "gift-style", kind: "interest", label: "Recipient interests", value: interests.value, weight: "high", source: "profile", factId: interests.id }],
      budget: { currencyCode: "USD", targetAmount: null, maximumAmount: "900.00", includesTaxes: null, includesFees: true, contingencyPercent: 0 },
      output: "shortlist",
    },
    selectedFacts: [],
  };
}

function dateContext() {
  const yourInterests = fact("date-your-interests", "date-you", "interest", ["photography", "local food"], ["date"]);
  const theirInterests = fact("date-their-interests", "date-partner", "interest", ["surf", "local history"], ["date"]);
  const previous = fact("date-previous", "date-you", "previous-activity", ["movie night"], ["date"]);
  return {
    brief: {
      ...baseBrief("decision-date-1", "date", "Plan a balanced Oahu date", ["date-you", "date-partner"]),
      decisionOnlyFacts: [yourInterests, theirInterests, previous],
      hardConstraints: [
        { id: "date-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
        { id: "date-day", kind: "date-range", label: "Date is October 10", value: "2026-10-10", source: "current-request", factId: null },
        { id: "date-party", kind: "party-size", label: "Two participants", value: 2, source: "current-request", factId: null },
      ],
      softPreferences: [
        { id: "date-you-preference", kind: "interest", label: "Your interests", value: yourInterests.value, weight: "high", source: "profile", factId: yourInterests.id },
        { id: "date-partner-preference", kind: "interest", label: "Their interests", value: theirInterests.value, weight: "high", source: "profile", factId: theirInterests.id },
        { id: "date-mood", kind: "theme", label: "Desired mood", value: "calm and connected", weight: "medium", source: "current-request", factId: null },
        { id: "date-novelty", kind: "novelty", label: "Novelty", value: "mostly-new", weight: "high", source: "current-request", factId: null },
      ],
      budget: { currencyCode: "USD", targetAmount: null, maximumAmount: "500.00", includesTaxes: false, includesFees: false, contingencyPercent: 10 },
      location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-10T08:00:00-10:00", end: "2026-10-10T20:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
    },
    selectedFacts: [],
  };
}

function vacationContext(id = "decision-vacation-1") {
  const memory = fact("vacation-memory", "vacation-traveler", "fond-memory-signal", ["quiet mornings near water", "walkable local food"], ["vacation"]);
  const experiences = fact("vacation-experiences", "vacation-traveler", "liked-experience", ["coastal photography", "beginner surf"], ["vacation"]);
  return {
    brief: {
      ...baseBrief(id, "vacation", "Build a three-night Oahu package", ["vacation-traveler"]),
      decisionOnlyFacts: [memory, experiences],
      hardConstraints: [
        { id: "trip-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
        { id: "trip-dates", kind: "date-range", label: "October 9 through October 12", value: ["2026-10-09", "2026-10-12"], source: "current-request", factId: null },
        { id: "trip-party", kind: "party-size", label: "Two travelers", value: 2, source: "current-request", factId: null },
      ],
      softPreferences: [
        { id: "trip-memory", kind: "theme", label: "Memory signals", value: memory.value, weight: "high", source: "profile", factId: memory.id },
        { id: "trip-experience", kind: "experience", label: "Liked experiences", value: experiences.value, weight: "high", source: "profile", factId: experiences.id },
        { id: "trip-lodging", kind: "lodging-style", label: "Lodging style", value: "small quiet lodging near water", weight: "high", source: "current-request", factId: null },
        { id: "trip-dining", kind: "dining", label: "Dining", value: "local plant-forward food", weight: "medium", source: "current-request", factId: null },
        { id: "trip-pace", kind: "pace", label: "Pace", value: "one anchor activity per day", weight: "high", source: "current-request", factId: null },
        { id: "trip-novelty", kind: "novelty", label: "Novelty", value: "mostly-new", weight: "high", source: "current-request", factId: null },
      ],
      budget: { currencyCode: "USD", targetAmount: null, maximumAmount: "2200.00", includesTaxes: false, includesFees: false, contingencyPercent: 10 },
      location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-09T08:00:00-10:00", end: "2026-10-12T20:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
    },
    selectedFacts: [],
  };
}

function staffingContext() {
  return {
    brief: {
      ...baseBrief("decision-staffing-1", "staffing", "Find an electrician and carpenter in Oahu", ["homeowner"]),
      decisionOnlyFacts: [],
      hardConstraints: [
        { id: "staffing-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
        { id: "staffing-date", kind: "date-range", label: "Date is 2026-10-17", value: "2026-10-17", source: "current-request", factId: null },
        { id: "staffing-role-1", kind: "must-have", label: "Residential electrician", value: "residential electrician", source: "current-request", factId: null },
        { id: "staffing-role-2", kind: "must-have", label: "Finish carpenter", value: "finish carpenter", source: "current-request", factId: null },
        { id: "staffing-hours", kind: "custom", label: "Estimated project hours", value: 8, source: "current-request", factId: null },
      ],
      budget: {
        currencyCode: "USD",
        targetAmount: null,
        maximumAmount: "2500.00",
        includesTaxes: null,
        includesFees: true,
        contingencyPercent: 10,
      },
      location: { label: "Oahu, Hawaii", city: "Honolulu", region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-17T08:00:00-10:00", end: "2026-10-17T16:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
    },
    selectedFacts: [],
  };
}

function jsonRequest(body: Record<string, unknown>, originId?: string): Request {
  const query = originId ? `?originId=${originId}` : "";
  return new Request(`https://example.test/api/decisions/plan${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const assetFetcher: Fetcher = {
  fetch: async () => new Response("<!doctype html><title>Decision agent</title>"),
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

describe("unified decision orchestrator", () => {
  it("pins each supported vertical to one deterministic strategy", () => {
    expect(decisionStrategy("gift")).toMatchObject({ id: "gift-marketplace-v1", originId: "catalog-lab" });
    expect(decisionStrategy("date")).toMatchObject({ id: "date-services-v1", originId: "services-lab" });
    expect(decisionStrategy("vacation")).toMatchObject({ id: "vacation-package-v1", originId: "services-lab" });
    expect(decisionStrategy("staffing")).toMatchObject({ id: "staffing-provider-v1", originId: "services-lab" });
    expect(validateRevisionReference("decision-vacation-1")).toBe("decision-vacation-1");
    expect(() => validateRevisionReference("not valid")).toThrow("revisionOf");
  });

  it.each([
    ["gift", giftContext(), "catalog-lab", "gift-marketplace-v1", false, false, 3],
    ["date", dateContext(), "services-lab", "date-services-v1", true, false, 3],
    ["vacation", vacationContext(), "services-lab", "vacation-package-v1", true, false, 3],
    ["staffing", staffingContext(), "services-lab", "staffing-provider-v1", false, true, 1],
  ])("routes %s through the shared no-store result envelope", async (vertical, decisionContext, originId, strategyId, memoryAvailable, handoffAvailable, optionCount) => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest({
      originId,
      query: vertical === "gift" ? "electric guitar" : undefined,
      maxResults: 3,
      decisionContext,
    }, originId), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      version: "1",
      vertical,
      status: "planned",
      optionCount,
      strategy: { id: strategyId, originId, deterministic: true },
      evidence: { originId, live: true },
      handling: { persistence: "request-only", cache: "no-store", externalAction: "none", revisionMode: "full-context-replacement" },
      nextActions: [
        { id: "revise", available: true },
        { id: "handoff", available: handoffAvailable, requiresHumanApproval: true },
        { id: "remember", available: memoryAvailable, requiresHumanApproval: true },
      ],
    });
  });

  it("links a revision while projecting the complete replacement context", async () => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest({
      originId: "services-lab",
      revisionOf: "decision-vacation-1",
      decisionContext: vacationContext("decision-vacation-2"),
    }, "services-lab"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      decisionId: "decision-vacation-2",
      revisionOf: "decision-vacation-1",
      contextProjection: {
        subjectIds: ["vacation-traveler"],
        factIds: ["vacation-memory", "vacation-experiences"],
        hardConstraintIds: ["trip-location", "trip-dates", "trip-party"],
      },
    });
  });

  it("selects the strategy origin when the caller omits originId", async () => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest({ decisionContext: dateContext() }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      vertical: "date",
      strategy: { originId: "services-lab" },
      evidence: { originId: "services-lab" },
    });
  });

  it("fails closed for an incompatible origin, invalid staffing constraints, and an oversized body", async () => {
    vi.setSystemTime(new Date(timestamp));
    const incompatible = await handleRequest(jsonRequest({ originId: "services-lab", query: "electric guitar", decisionContext: giftContext() }, "services-lab"), env);
    expect(incompatible.status).toBe(400);
    expect(await incompatible.json()).toMatchObject({ error: expect.stringContaining("requires the catalog-lab") });

    const invalidStaffing = await handleRequest(jsonRequest({
      originId: "services-lab",
      decisionContext: {
        brief: { ...baseBrief("decision-staffing-invalid", "staffing", "Find an electrician", ["homeowner"]), decisionOnlyFacts: [] },
        selectedFacts: [],
      },
    }, "services-lab"), env);
    expect(invalidStaffing.status).toBe(400);
    expect(await invalidStaffing.json()).toMatchObject({ error: expect.stringContaining("Staffing requires 1 to 6 explicit must-have roles") });

    const oversized = await handleRequest(jsonRequest({ originId: "services-lab", decisionContext: vacationContext(), padding: "x".repeat(17_000) }), env);
    expect(oversized.status).toBe(400);
    expect(await oversized.json()).toMatchObject({ error: "Request body is too large." });
  });

});
