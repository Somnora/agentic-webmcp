import { describe, expect, it, vi } from "vitest";
import { normalizeServicesJsonOffer } from "../src/catalog";
import { validateDecisionContextRequest } from "../src/decision-brief";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { DEMO_SERVICES } from "../src/demo-services";
import { handleRequest } from "../src/index";
import { inspectOrigin } from "../src/origins";
import { createPersonalizedVacationPackages } from "../src/personalized-vacation";

const timestamp = "2026-09-03T18:00:00.000Z";
const origin = inspectOrigin("services-lab");

function fact(id: string, kind: string, value: string[], lifeStage: string | null = null) {
  return {
    version: "1",
    id,
    subjectId: "vacation-traveler",
    kind,
    value,
    source: "user-stated",
    confidence: "confirmed",
    sensitivity: lifeStage ? "private" : "standard",
    lifeStage,
    allowedUses: ["vacation"],
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function rawDecisionContext(options: {
  avoid?: string[];
  unsupportedAccessibility?: boolean;
  vertical?: string;
  explorationMode?: "comfort-seeking" | "novelty-seeking" | "balanced";
  visitedPlaces?: string[];
  likedExperiences?: string[];
  fondMemories?: string[];
} = {}) {
  const visited = options.visitedPlaces ?? ["Portugal", "Canada"];
  const memories = options.fondMemories ?? ["quiet mornings near water", "walkable local food"];
  const experiences = options.likedExperiences ?? ["coastal photography", "beginner surf"];
  const explorationMode = options.explorationMode ?? "balanced";
  const facts = [
    fact("fact-visited", "visited-place", visited),
    fact("fact-memory", "fond-memory-signal", memories, "childhood"),
    fact("fact-experiences", "liked-experience", experiences),
    fact("fact-pace", "pace-preference", ["one anchor activity per day"]),
    ...(options.avoid?.length ? [fact("fact-avoid", "avoidance", options.avoid)] : []),
  ];
  return {
    brief: {
      version: "1",
      id: "vacation-oahu",
      vertical: options.vertical ?? "vacation",
      goal: "Build a source-backed three-night Oahu package around selected memories and experiences",
      subjectIds: ["vacation-traveler"],
      selectedFactIds: [],
      decisionOnlyFacts: facts,
      hardConstraints: [
        { id: "trip-location", kind: "location", label: "Oahu, Hawaii", value: "Oahu, Hawaii, US", source: "current-request", factId: null },
        { id: "trip-dates", kind: "date-range", label: "October 9 through October 12", value: ["2026-10-09", "2026-10-12"], source: "current-request", factId: null },
        { id: "trip-party", kind: "party-size", label: "Two travelers", value: 2, source: "current-request", factId: null },
        ...(options.avoid?.length ? [{ id: "trip-avoid", kind: "avoid", label: "Hard dislikes", value: options.avoid, source: "profile", factId: "fact-avoid" }] : []),
        ...(options.unsupportedAccessibility ? [{ id: "trip-access", kind: "accessibility", label: "Step-free lodging", value: "required", source: "current-request", factId: null }] : []),
      ],
      softPreferences: [
        { id: "trip-memory", kind: "theme", label: "Memory signals", value: memories, weight: "high", source: "profile", factId: "fact-memory" },
        { id: "trip-experience", kind: "experience", label: "Liked experiences", value: experiences, weight: "high", source: "profile", factId: "fact-experiences" },
        { id: "trip-lodging", kind: "lodging-style", label: "Lodging style", value: "small quiet lodging near water", weight: "high", source: "current-request", factId: null },
        { id: "trip-dining", kind: "dining", label: "Dining", value: "local plant-forward food", weight: "medium", source: "current-request", factId: null },
        { id: "trip-pace", kind: "pace", label: "Pace", value: "one anchor activity per day", weight: "high", source: "profile", factId: "fact-pace" },
        { id: "trip-novelty", kind: "novelty", label: `Exploration mode: ${explorationMode}`, value: explorationMode, weight: "high", source: "current-request", factId: null },
      ],
      budget: { currencyCode: "USD", targetAmount: null, maximumAmount: "2200.00", includesTaxes: false, includesFees: false, contingencyPercent: 10 },
      location: { label: "Oahu, Hawaii", city: null, region: "Oahu, Hawaii", countryCode: "US", timezone: "Pacific/Honolulu", flexible: false },
      timeWindow: { start: "2026-10-09T08:00:00-10:00", end: "2026-10-12T20:00:00-10:00", timezone: "Pacific/Honolulu", flexible: false },
      output: "package",
      missingInformation: [],
      createdAt: timestamp,
    },
    selectedFacts: [],
  };
}

function context(options: Parameters<typeof rawDecisionContext>[0] = {}) {
  return validateDecisionContextRequest(rawDecisionContext(options), Date.parse(timestamp));
}

const offers = DEMO_SERVICES
  .map((service) => normalizeServicesJsonOffer(service, origin, timestamp))
  .filter((offer) => offer !== null);

function jsonRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.test/api/vacation-packages?originId=services-lab", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const assetFetcher: Fetcher = {
  fetch: async () => new Response("<!doctype html><title>Vacation</title>"),
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

describe("personalized vacation packaging", () => {
  it("builds value, balanced, and signature packages with exact category totals", () => {
    const result = createPersonalizedVacationPackages(context(), offers, timestamp);
    expect(result.status).toBe("planned");
    expect(result.packages.map((item) => item.tier)).toEqual(["value", "balanced", "signature"]);
    expect(result.packages.map((item) => item.itinerary.items.length)).toEqual([2, 3, 4]);
    for (const item of result.packages) {
      expect(item.nights).toBe(3);
      expect(item.travelers).toBe(2);
      expect(item.items.map((entry) => entry.category)).toEqual(expect.arrayContaining(["lodging", "transport", "dining", "activity"]));
      const componentTotal = [item.totals.lodging, item.totals.transport, item.totals.dining, item.totals.activities]
        .reduce((sum, amount) => sum + Number(amount.amount), 0);
      expect(componentTotal.toFixed(2)).toBe(item.totals.publishedSubtotal.amount);
      expect(Number(item.totals.planningRange.max.amount)).toBeLessThanOrEqual(Number(item.budgetCeiling.amount));
      expect(item.itinerary.status).toBe("planning-only");
      expect(item.totals.unknownCosts.length).toBeGreaterThan(0);
    }
    expect(result.personalization).toMatchObject({ actionEligible: true, handling: "request-only" });
  });

  it("filters a hard transport dislike before package scoring", () => {
    const result = createPersonalizedVacationPackages(context({ avoid: ["car"] }), offers, timestamp);
    expect(result.packages).toHaveLength(3);
    expect(result.packages.flatMap((item) => item.itemHandles)).not.toContain("oahu-compact-car");
    expect(result.packages.every((item) => item.itemHandles.includes("oahu-shared-airport-transfer"))).toBe(true);
    expect(result.personalization.excludedByConstraint).toEqual(expect.arrayContaining([
      expect.objectContaining({ handle: "oahu-compact-car", matchedTerms: ["car"] }),
    ]));
  });

  it("fails closed when a hard constraint lacks Offer evidence", () => {
    expect(createPersonalizedVacationPackages(context({ unsupportedAccessibility: true }), offers, timestamp)).toMatchObject({
      status: "needs-attention",
      packages: [],
      personalization: { actionEligible: false, unsupportedConstraints: [{ id: "trip-access", kind: "accessibility" }] },
    });
  });

  it("serves verified no-store packages from the controlled origin", async () => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest({ originId: "services-lab", decisionContext: rawDecisionContext() }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body: { status: string; live: boolean; packages: Array<{ evidenceConfidence: string }>; personalization: { handling: string } } = await response.json();
    expect(body).toMatchObject({ status: "planned", live: true, personalization: { handling: "request-only" } });
    expect(body.packages).toHaveLength(3);
    expect(body.packages.every((item) => item.evidenceConfidence === "Verified across service JSON and page data")).toBe(true);
  });

  it("rejects vacation requests above the dedicated body limit", async () => {
    const response = await handleRequest(jsonRequest({ originId: "services-lab", decisionContext: rawDecisionContext(), padding: "x".repeat(13000) }), env);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_INPUT", error: "Request body is too large." });
  });

  it("novelty-seeking mode penalizes visited destinations and surfaces verified experience gaps", () => {
    const novelContext = context({
      explorationMode: "novelty-seeking",
      visitedPlaces: ["Oahu, Hawaii"],
      likedExperiences: ["historic culinary food walk"],
    });
    const result = createPersonalizedVacationPackages(novelContext, offers, timestamp);
    expect(result.status).toBe("planned");
    for (const pkg of result.packages) {
      expect(pkg.noveltyFit.explorationMode).toBe("novelty-seeking");
      expect(pkg.noveltyFit.experienceGaps.length).toBeGreaterThan(0);
      expect(pkg.noveltyFit.experienceGaps).toContain("Surfing lessons");
      expect(pkg.why).toContain("Exploration mode: novelty-seeking.");
      expect(pkg.why).toContain("Experience gaps:");
      expect(pkg.tradeoff).toContain("novelty-seeking");
    }
  });

  it("comfort-seeking mode rewards liked experiences and fond memories with zero visited destination penalty", () => {
    const repeatVisitedContext = context({
      explorationMode: "comfort-seeking",
      visitedPlaces: ["Oahu, Hawaii"],
      likedExperiences: ["coastal photography", "beginner surf"],
      fondMemories: ["quiet mornings near water", "walkable local food"],
    });
    const repeatUnvisitedContext = context({
      explorationMode: "comfort-seeking",
      visitedPlaces: ["Portugal", "Canada"],
      likedExperiences: ["coastal photography", "beginner surf"],
      fondMemories: ["quiet mornings near water", "walkable local food"],
    });

    const visitedResult = createPersonalizedVacationPackages(repeatVisitedContext, offers, timestamp);
    const unvisitedResult = createPersonalizedVacationPackages(repeatUnvisitedContext, offers, timestamp);

    expect(visitedResult.status).toBe("planned");
    expect(unvisitedResult.status).toBe("planned");

    for (let i = 0; i < visitedResult.packages.length; i++) {
      const pkg = visitedResult.packages[i]!;
      const unvisitedPkg = unvisitedResult.packages[i]!;
      expect(pkg.noveltyFit.explorationMode).toBe("comfort-seeking");
      expect(pkg.noveltyFit.repeatHighlights.length).toBeGreaterThan(0);
      expect(pkg.why).toContain("Exploration mode: comfort-seeking.");
      expect(pkg.why).toContain("Repeat highlights:");
      // Zero destination penalty: returning to Oahu produces identical score as visiting unvisited destination
      expect(pkg.score).toBe(unvisitedPkg.score);
    }
  });

  it("balanced mode populates both repeatHighlights and experienceGaps with synergy reward", () => {
    const balancedContext = context({
      explorationMode: "balanced",
      visitedPlaces: ["Portugal"],
      likedExperiences: ["beginner surf"],
      fondMemories: ["walkable local food"],
    });
    const result = createPersonalizedVacationPackages(balancedContext, offers, timestamp);
    expect(result.status).toBe("planned");
    const signaturePkg = result.packages.find((pkg) => pkg.tier === "signature")!;
    expect(signaturePkg.noveltyFit.explorationMode).toBe("balanced");
    expect(signaturePkg.noveltyFit.repeatHighlights.length).toBeGreaterThan(0);
    expect(signaturePkg.noveltyFit.experienceGaps.length).toBeGreaterThan(0);
    expect(signaturePkg.why).toContain("Exploration mode: balanced.");
    expect(signaturePkg.why).toContain("Repeat highlights:");
    expect(signaturePkg.why).toContain("Experience gaps:");
  });

  it("scoring monotonicity: novelty-seeking strictly ranks novel package over repeat package", () => {
    const repeatTravelerContext = context({
      explorationMode: "novelty-seeking",
      visitedPlaces: ["Oahu, Hawaii"],
      likedExperiences: ["beginner surf", "coastal photography", "local culinary tasting walk"],
      fondMemories: ["quiet mornings near water", "walkable local food"],
    });
    const novelTravelerContext = context({
      explorationMode: "novelty-seeking",
      visitedPlaces: ["Portugal", "Canada"],
      likedExperiences: ["alpine skiing", "high mountain backpacking"],
      fondMemories: ["mountain cabin hearth"],
    });

    const repeatResult = createPersonalizedVacationPackages(repeatTravelerContext, offers, timestamp);
    const novelResult = createPersonalizedVacationPackages(novelTravelerContext, offers, timestamp);

    expect(repeatResult.status).toBe("planned");
    expect(novelResult.status).toBe("planned");

    for (let i = 0; i < 3; i++) {
      const repeatScore = repeatResult.packages[i]!.score;
      const novelScore = novelResult.packages[i]!.score;
      expect(novelScore).toBeGreaterThan(repeatScore);
    }
  });

  it("scoring monotonicity: comfort-seeking strictly ranks repeat package over novel package", () => {
    const repeatTravelerContext = context({
      explorationMode: "comfort-seeking",
      visitedPlaces: ["Oahu, Hawaii"],
      likedExperiences: ["beginner surf", "coastal photography", "local culinary tasting walk"],
      fondMemories: ["quiet mornings near water", "walkable local food"],
    });
    const novelTravelerContext = context({
      explorationMode: "comfort-seeking",
      visitedPlaces: ["Portugal", "Canada"],
      likedExperiences: ["alpine skiing", "high mountain backpacking"],
      fondMemories: ["mountain cabin hearth"],
    });

    const repeatResult = createPersonalizedVacationPackages(repeatTravelerContext, offers, timestamp);
    const novelResult = createPersonalizedVacationPackages(novelTravelerContext, offers, timestamp);

    expect(repeatResult.status).toBe("planned");
    expect(novelResult.status).toBe("planned");

    for (let i = 0; i < 3; i++) {
      const repeatScore = repeatResult.packages[i]!.score;
      const novelScore = novelResult.packages[i]!.score;
      expect(repeatScore).toBeGreaterThan(novelScore);
    }
  });
});
