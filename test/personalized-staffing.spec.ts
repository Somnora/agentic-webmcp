import { describe, expect, it, vi } from "vitest";
import { validateDecisionContextRequest } from "../src/decision-brief";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { handleRequest } from "../src/index";
import { interpolatePage } from "../src/interpolate";
import { money, type Offer } from "../src/offers";
import { inspectOrigin } from "../src/origins";
import { createPersonalizedStaffingPlans } from "../src/personalized-staffing";

const timestamp = "2026-09-03T18:00:00.000Z";
const planningDate = "2026-10-17"; // Saturday
const origin = inspectOrigin("services-lab");

const fixtureFetcher = async (input: RequestInfo | URL, init?: RequestInit) => (
  handleDemoOriginRequest(new Request(input, init))
);

const demoOriginFetcher: Fetcher = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => handleDemoOriginRequest(new Request(input, init)),
  connect: () => {
    throw new Error("Demo origin sockets are not used in tests.");
  },
};

const assetFetcher: Fetcher = {
  fetch: async () => new Response("<!doctype html><title>Decision agent</title>"),
  connect: () => {
    throw new Error("Asset sockets are not used in tests.");
  },
};

const env: Env = {
  ASSETS: assetFetcher,
  VERSION_METADATA: { id: "test-version", tag: "", timestamp },
  CATALOG_SHOP: "agentic-app-review-test.myshopify.com",
  APP_COMMIT: "local",
  DEMO_ORIGIN: demoOriginFetcher,
};

async function loadVerifiedStaffingOffers(): Promise<Offer[]> {
  const handles = [
    "oahu-residential-electrician",
    "oahu-finish-carpenter",
    "oahu-paint-finish-lead",
    "oahu-gaffer-lighting-technician",
    "oahu-location-sound-mixer",
    "oahu-production-designer",
  ];
  const projections = await Promise.all(
    handles.map((handle) => interpolatePage(origin, `/services/${handle}`, fixtureFetcher)),
  );
  return projections.map((projection) => projection.offer);
}

function baseStaffingContext(overrides: {
  roles?: string[];
  credentials?: string[];
  equipment?: string[];
  date?: string;
  omitDate?: boolean;
  omitTimeWindow?: boolean;
  hours?: number;
  budgetAmount?: string;
  contingencyPercent?: number;
  avoids?: string[];
  unsupportedConstraints?: Array<{ id: string; kind: string; label: string; value: string }>;
  vertical?: string;
  locationCity?: string | null;
  locationLabel?: string;
} = {}) {
  const roles = overrides.roles ?? ["residential electrician", "finish carpenter"];
  const date = overrides.date ?? planningDate;
  const projectSite = overrides.locationLabel ?? (overrides.locationCity ?? "Oahu, Hawaii");
  const hardConstraints = [
    { id: "staffing-location", kind: "location", label: projectSite, value: `${projectSite}, Oahu, Hawaii, US`, source: "current-request", factId: null },
    ...(!overrides.omitDate ? [{ id: "staffing-date", kind: "date-range", label: `Date is ${date}`, value: date, source: "current-request", factId: null }] : []),
    ...roles.map((role, index) => ({
      id: `staffing-role-${index + 1}`,
      kind: "must-have",
      label: `Required role: ${role}`,
      value: role,
      source: "current-request",
      factId: null,
    })),
    ...(overrides.credentials ?? []).map((requirement, index) => ({
      id: `staffing-cred-${index + 1}`,
      kind: "credential",
      label: `Credential requirement: ${requirement}`,
      value: requirement,
      source: "current-request",
      factId: null,
    })),
    ...(overrides.equipment ?? []).map((requirement, index) => ({
      id: `staffing-equip-${index + 1}`,
      kind: "equipment",
      label: `Equipment requirement: ${requirement}`,
      value: requirement,
      source: "current-request",
      factId: null,
    })),
    ...(overrides.hours !== undefined ? [{
      id: "staffing-hours",
      kind: "custom",
      label: "Estimated project hours",
      value: overrides.hours,
      source: "current-request",
      factId: null,
    }] : [{
      id: "staffing-hours",
      kind: "custom",
      label: "Estimated project hours",
      value: 8,
      source: "current-request",
      factId: null,
    }]),
    ...(overrides.avoids ?? []).map((term, index) => ({
      id: `staffing-avoid-${index + 1}`,
      kind: "avoid",
      label: `Excluded term: ${term}`,
      value: term,
      source: "current-request",
      factId: null,
    })),
    ...(overrides.unsupportedConstraints ?? []).map((constraint) => ({
      ...constraint,
      source: "current-request",
      factId: null,
    })),
  ];

  return {
    brief: {
      version: "1",
      id: "decision-staffing-test-1",
      vertical: overrides.vertical ?? "staffing",
      goal: "Assemble an Oahu trade and production crew",
      subjectIds: ["client-1"],
      selectedFactIds: [],
      decisionOnlyFacts: [],
      hardConstraints,
      softPreferences: [],
      budget: {
        currencyCode: "USD",
        targetAmount: null,
        maximumAmount: overrides.budgetAmount ?? "2500.00",
        includesTaxes: null,
        includesFees: true,
        contingencyPercent: overrides.contingencyPercent ?? 10,
      },
      location: {
        label: overrides.locationLabel ?? (overrides.locationCity ?? "Oahu, Hawaii"),
        city: overrides.locationCity !== undefined ? overrides.locationCity : "Honolulu",
        region: "Oahu, Hawaii",
        countryCode: "US",
        timezone: "Pacific/Honolulu",
        flexible: false,
      },
      timeWindow: overrides.omitTimeWindow ? null : {
        start: `${date}T08:00:00-10:00`,
        end: `${date}T16:00:00-10:00`,
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

function jsonRequest(body: Record<string, unknown>, originId?: string): Request {
  const query = originId ? `?originId=${originId}` : "";
  return new Request(`https://example.test/api/decisions/plan${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("personalized staffing planning", () => {
  it("creates a complete verified crew plan matching roles, credentials, and equipment within budget", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const rawContext = baseStaffingContext({
      credentials: [
        "residential electrician: state electrical license",
        "finish carpenter: general liability coverage",
      ],
      equipment: [
        "residential electrician: electrical diagnostic meter",
        "finish carpenter: finish nailer",
      ],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("planned");
    expect(result.crews).toHaveLength(1);
    const crew = result.crews[0]!;
    expect(crew.status).toBe("ready-for-review");
    expect(crew.score).toBe(100);
    expect(crew.projectDate).toBe(planningDate);
    expect(crew.estimatedHours).toBe(8);
    expect(crew.requestedRoles).toEqual(["residential electrician", "finish carpenter"]);
    expect(crew.missingRoles).toEqual([]);
    expect(crew.scheduleGaps).toEqual([]);

    expect(crew.assignments).toHaveLength(2);
    const electricianAssignment = crew.assignments.find((item) => item.role === "residential electrician")!;
    expect(electricianAssignment).toMatchObject({
      offerHandle: "oahu-residential-electrician",
      providerId: "provider-kai-line-electric",
      providerName: "Kai Line Electric",
      providerVerification: { status: "controlled-demo" },
      price: {
        basis: "hourly",
        quoteMode: "published-rate",
        estimatedHours: 8,
        publishedSubtotal: { amount: "960.00", currencyCode: "USD" },
      },
      requiredCredentialMatches: ["state electrical license"],
      requiredEquipmentMatches: ["electrical diagnostic meter"],
      sourceReview: { action: "human-only" },
    });

    const carpenterAssignment = crew.assignments.find((item) => item.role === "finish carpenter")!;
    expect(carpenterAssignment).toMatchObject({
      offerHandle: "oahu-finish-carpenter",
      providerId: "provider-grain-and-line",
      providerName: "Grain and Line Carpentry",
      price: {
        basis: "hourly",
        quoteMode: "published-rate",
        estimatedHours: 8,
        publishedSubtotal: { amount: "760.00", currencyCode: "USD" },
      },
      requiredCredentialMatches: ["general liability coverage"],
      requiredEquipmentMatches: ["finish nailer"],
      sourceReview: { action: "human-only" },
    });

    // Subtotal: 960 + 760 = 1720. 10% contingency = 172. Planning high = 1892. Budget = 2500.
    expect(crew.costs).toMatchObject({
      publishedSubtotal: { amount: "1720.00", currencyCode: "USD" },
      contingency: { amount: "172.00", currencyCode: "USD" },
      planningHigh: { amount: "1892.00", currencyCode: "USD" },
      withinBudget: true,
    });
    expect(crew.quoteAccounting).toMatchObject({
      publishedRateAssignments: 2,
      estimateOnlyAssignments: 0,
    });

    expect(result.staffing).toMatchObject({
      status: "applied",
      actionEligible: true,
      vertical: "staffing",
      handling: "request-only",
      providerSourceReview: "human-only",
      contactCapability: "unavailable",
      contractingCapability: "unavailable",
      unsupportedConstraints: [],
    });
  });

  it("handles film crew assembly with estimate-only quote accounting and warnings", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const estimateOffer: Offer = {
      ...offers[5]!,
      service: {
        ...offers[5]!.service!,
        priceBasis: "estimate",
        professional: {
          ...offers[5]!.service!.professional!,
          quoteMode: "estimate-only",
        },
      },
    };
    const mixedOffers = [...offers.slice(0, 5), estimateOffer];
    const rawContext = baseStaffingContext({
      roles: ["gaffer / lighting technician", "location sound mixer", "production designer"],
      budgetAmount: "3500.00",
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, mixedOffers);

    expect(result.status).toBe("planned");
    const crew = result.crews[0]!;
    expect(crew.assignments).toHaveLength(3);
    expect(crew.quoteAccounting.publishedRateAssignments).toBe(2);
    expect(crew.quoteAccounting.estimateOnlyAssignments).toBe(1);
    expect(crew.quoteAccounting.unknownCosts.some((item) => item.includes("estimate-only"))).toBe(true);

    const designer = crew.assignments.find((item) => item.offerHandle === "oahu-production-designer")!;
    expect(designer.price.quoteMode).toBe("estimate-only");
    expect(designer.price.basis).toBe("estimate");
  });

  it("reports a schedule gap when role supply exists but schedule is uncovered", async () => {
    const offers = await loadVerifiedStaffingOffers();
    // 2026-10-20 is a Tuesday. Electrician is available Tue/Thu/Sat, but finish carpenter is only available Wed/Fri/Sat.
    const rawContext = baseStaffingContext({
      date: "2026-10-20",
      roles: ["residential electrician", "finish carpenter"],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    const crew = result.crews[0]!;
    expect(crew.status).toBe("needs-attention");
    expect(crew.scheduleGaps).toHaveLength(1);
    expect(crew.scheduleGaps[0]).toMatchObject({
      role: "finish carpenter",
      date: "2026-10-20",
      reason: expect.stringContaining("Tuesday"),
    });
    expect(crew.missingRoles).toHaveLength(1);
    expect(crew.missingRoles[0]!.reason).toContain("no provider covers the requested schedule");
    expect(result.staffing.actionEligible).toBe(false);
  });

  it("reports missing roles when no provider supplies the role", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const rawContext = baseStaffingContext({
      roles: ["residential electrician", "scaffold builder"],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    const crew = result.crews[0]!;
    expect(crew.missingRoles).toHaveLength(1);
    expect(crew.missingRoles[0]).toMatchObject({
      role: "scaffold builder",
      reason: "No verified provider Offer declares this role.",
    });
    expect(result.staffing.actionEligible).toBe(false);
  });

  it("reports missing roles when credential requirement is unmet", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const rawContext = baseStaffingContext({
      roles: ["residential electrician"],
      credentials: ["residential electrician: high voltage substation certification"],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    const crew = result.crews[0]!;
    expect(crew.missingRoles).toHaveLength(1);
    expect(crew.missingRoles[0]!.reason).toContain("high voltage substation certification");
    expect(result.staffing.actionEligible).toBe(false);
  });

  it("reports missing roles when equipment requirement is unmet", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const rawContext = baseStaffingContext({
      roles: ["finish carpenter"],
      equipment: ["finish carpenter: portable timber crane"],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    const crew = result.crews[0]!;
    expect(crew.missingRoles).toHaveLength(1);
    expect(crew.missingRoles[0]!.reason).toContain("portable timber crane");
    expect(result.staffing.actionEligible).toBe(false);
  });

  it("flags budget overage when planning high exceeds ceiling", async () => {
    const offers = await loadVerifiedStaffingOffers();
    // Total planning high is $1892.00, budget ceiling $1000.00
    const rawContext = baseStaffingContext({
      budgetAmount: "1000.00",
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    const crew = result.crews[0]!;
    expect(crew.costs.withinBudget).toBe(false);
    expect(crew.status).toBe("needs-attention");
    expect(result.staffing.actionEligible).toBe(false);
  });

  it("filters candidate providers by hard avoidance constraints", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const rawContext = baseStaffingContext({
      roles: ["residential electrician", "finish carpenter"],
      avoids: ["Kai Line Electric"],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    const crew = result.crews[0]!;
    expect(crew.missingRoles).toHaveLength(1);
    expect(crew.missingRoles[0]!.role).toBe("residential electrician");
    expect(crew.assignments.every((item) => item.providerName !== "Kai Line Electric")).toBe(true);
  });

  it("surfaces unsupported constraints and blocks action eligibility", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const rawContext = baseStaffingContext({
      unsupportedConstraints: [
        { id: "staffing-access", kind: "accessibility", label: "Step-free site access", value: "required" },
      ],
    });
    const context = validateDecisionContextRequest(rawContext);
    const result = createPersonalizedStaffingPlans(context, offers);

    expect(result.status).toBe("needs-attention");
    expect(result.staffing.actionEligible).toBe(false);
    expect(result.staffing.unsupportedConstraints).toEqual([
      { id: "staffing-access", kind: "accessibility", label: "Step-free site access", reason: "This hard constraint has no verified staffing evaluator." },
    ]);
  });

  it("validates input boundaries and fails closed with descriptive RangeError", () => {
    const offers: Offer[] = [];
    const valid = validateDecisionContextRequest(baseStaffingContext());

    expect(() => createPersonalizedStaffingPlans(
      { ...valid, brief: { ...valid.brief, vertical: "date" as "staffing" } },
      offers,
    )).toThrow("Staffing planning requires a staffing DecisionContext.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: [] })),
      offers,
    )).toThrow("Staffing requires 1 to 6 explicit must-have roles.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({
        roles: ["role1", "role2", "role3", "role4", "role5", "role6", "role7"],
      })),
      offers,
    )).toThrow("Staffing requires 1 to 6 explicit must-have roles.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ omitDate: true, omitTimeWindow: true })),
      offers,
    )).toThrow("Staffing requires a project date.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ date: "2026-02-31", omitTimeWindow: true })),
      offers,
    )).toThrow("Staffing requires a real calendar date.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ hours: 0 })),
      offers,
    )).toThrow("Estimated project hours must be an integer from 1 to 16.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ hours: 24 })),
      offers,
    )).toThrow("Estimated project hours must be an integer from 1 to 16.");

    expect(() => createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ budgetAmount: "50.00" })),
      offers,
    )).toThrow("Staffing requires a maximum budget from 100 to 100000 USD.");
  });

  it("serves verified no-store crew plans through the /api/decisions/plan endpoint", async () => {
    vi.setSystemTime(new Date(timestamp));
    const response = await handleRequest(jsonRequest({
      originId: "services-lab",
      decisionContext: baseStaffingContext({
        credentials: ["residential electrician: state electrical license"],
        equipment: ["finish carpenter: finish nailer"],
      }),
    }, "services-lab"), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json() as {
      version: string;
      vertical: string;
      status: string;
      optionCount: number;
      result: {
        crews: Array<{ assignments: Array<{ offerHandle: string }>; costs: { withinBudget: boolean } }>;
        staffing: { actionEligible: boolean; providerSourceReview: string };
      };
      nextActions: Array<{ id: string; available: boolean; requiresHumanApproval: boolean }>;
    };

    expect(body.vertical).toBe("staffing");
    expect(body.status).toBe("planned");
    expect(body.optionCount).toBe(1);
    expect(body.result.crews[0]!.assignments).toHaveLength(2);
    expect(body.result.crews[0]!.costs.withinBudget).toBe(true);
    expect(body.result.staffing.actionEligible).toBe(true);
    expect(body.result.staffing.providerSourceReview).toBe("human-only");
    expect(body.nextActions).toMatchObject([
      { id: "revise", available: true, requiresHumanApproval: false },
      { id: "handoff", available: true, requiresHumanApproval: true },
      { id: "remember", available: false, requiresHumanApproval: true },
    ]);
  });

  it("qualifies an islandwide provider across Honolulu, Kailua, and North Shore with proximity tiers", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const electricianOffers = offers.filter((o) => o.handle === "oahu-residential-electrician");

    const honoluluResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["residential electrician"], locationCity: "Honolulu", locationLabel: "Honolulu" })),
      electricianOffers,
    );
    expect(honoluluResult.status).toBe("planned");
    expect(honoluluResult.crews[0]!.assignments[0]!.serviceArea.proximityFit).toBe("local-match");

    const kailuaResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["residential electrician"], locationCity: "Kailua", locationLabel: "Kailua" })),
      electricianOffers,
    );
    expect(kailuaResult.status).toBe("planned");
    expect(kailuaResult.crews[0]!.assignments[0]!.serviceArea.proximityFit).toBe("cross-subregion-service");

    const northShoreResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["residential electrician"], locationCity: "North Shore", locationLabel: "North Shore" })),
      electricianOffers,
    );
    expect(northShoreResult.status).toBe("planned");
    expect(northShoreResult.crews[0]!.assignments[0]!.serviceArea.proximityFit).toBe("cross-subregion-service");
  });

  it("qualifies a subregion-limited provider in declared subregions and disqualifies outside declared subregions", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const carpenterOffers = offers.filter((o) => o.handle === "oahu-finish-carpenter");

    const kailuaResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["finish carpenter"], locationCity: "Kailua", locationLabel: "Kailua" })),
      carpenterOffers,
    );
    expect(kailuaResult.status).toBe("planned");
    expect(kailuaResult.crews[0]!.assignments[0]!.serviceArea.proximityFit).toBe("local-match");

    const honoluluResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["finish carpenter"], locationCity: "Honolulu", locationLabel: "Honolulu" })),
      carpenterOffers,
    );
    expect(honoluluResult.status).toBe("planned");
    expect(honoluluResult.crews[0]!.assignments[0]!.serviceArea.proximityFit).toBe("cross-subregion-service");

    const haleiwaResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["finish carpenter"], locationCity: "Haleiwa", locationLabel: "Haleiwa" })),
      carpenterOffers,
    );
    expect(haleiwaResult.status).toBe("needs-attention");
    expect(haleiwaResult.crews[0]!.assignments).toHaveLength(0);
    expect(haleiwaResult.crews[0]!.missingRoles).toHaveLength(1);
    expect(haleiwaResult.crews[0]!.missingRoles[0]!.role).toBe("finish carpenter");
  });

  it("emits an explicit geographic StaffingGap reason when all providers are outside project location", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const carpenterOffers = offers.filter((o) => o.handle === "oahu-finish-carpenter");

    const northShoreResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["finish carpenter"], locationCity: "North Shore", locationLabel: "North Shore" })),
      carpenterOffers,
    );
    expect(northShoreResult.status).toBe("needs-attention");
    expect(northShoreResult.crews[0]!.missingRoles[0]!.reason).toBe(
      "Role supply exists, but no provider serves the required project location: North Shore (outside provider service area).",
    );

    const haleiwaResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["finish carpenter"], locationCity: "Haleiwa", locationLabel: "Haleiwa" })),
      carpenterOffers,
    );
    expect(haleiwaResult.status).toBe("needs-attention");
    expect(haleiwaResult.crews[0]!.missingRoles[0]!.reason).toBe(
      "Role supply exists, but no provider serves the required project location: Haleiwa (outside provider service area).",
    );
  });

  it("enforces provider travelRadiusMiles ceiling and emits explicit radius gap reason", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const baseElectrician = offers.find((o) => o.handle === "oahu-residential-electrician")!;
    const limitedElectrician: Offer = {
      ...baseElectrician,
      service: {
        ...baseElectrician.service!,
        professional: {
          ...baseElectrician.service!.professional!,
          serviceArea: {
            ...baseElectrician.service!.professional!.serviceArea,
            travelRadiusMiles: 25,
          },
        },
      },
    };

    const northShoreResult = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["residential electrician"], locationCity: "North Shore", locationLabel: "North Shore" })),
      [limitedElectrician],
    );
    expect(northShoreResult.status).toBe("needs-attention");
    expect(northShoreResult.crews[0]!.missingRoles[0]!.reason).toBe(
      "Role supply exists, but project location exceeds provider travel radius (distance exceeds 25 miles).",
    );
  });

  it("prioritizes local subregion provider (Tier 1) over cross-subregion provider (Tier 2) regardless of price", async () => {
    const offers = await loadVerifiedStaffingOffers();
    const baseElectrician = offers.find((o) => o.handle === "oahu-residential-electrician")!;
    const honoluluElectrician: Offer = {
      ...baseElectrician,
      handle: "honolulu-electrician",
      priceRange: {
        min: money(70, "USD"),
        max: money(70, "USD"),
      },
      service: {
        ...baseElectrician.service!,
        provider: {
          ...baseElectrician.service!.provider,
          id: "honolulu-electric-co",
          displayName: "Honolulu Fast Electric",
        },
        location: {
          ...baseElectrician.service!.location,
          city: "Honolulu",
          region: "Honolulu, Oahu, Hawaii",
        },
        professional: {
          ...baseElectrician.service!.professional!,
          serviceArea: {
            label: "Oahu islandwide",
            regions: ["Oahu"],
            travelRadiusMiles: 35,
          },
        },
      },
    };

    const kaneoheElectrician: Offer = {
      ...baseElectrician,
      handle: "kaneohe-electrician",
      priceRange: {
        min: money(120, "USD"),
        max: money(120, "USD"),
      },
      service: {
        ...baseElectrician.service!,
        provider: {
          ...baseElectrician.service!.provider,
          id: "kaneohe-electric-co",
          displayName: "Kaneohe Master Electric",
        },
        location: {
          ...baseElectrician.service!.location,
          city: "Kaneohe",
          region: "Windward Oahu, Hawaii",
        },
        professional: {
          ...baseElectrician.service!.professional!,
          serviceArea: {
            label: "Windward Oahu",
            regions: ["Windward"],
            travelRadiusMiles: 25,
          },
        },
      },
    };

    const result = createPersonalizedStaffingPlans(
      validateDecisionContextRequest(baseStaffingContext({ roles: ["residential electrician"], locationCity: "Kailua", locationLabel: "Kailua", budgetAmount: "3000.00" })),
      [honoluluElectrician, kaneoheElectrician],
    );

    expect(result.status).toBe("planned");
    expect(result.crews[0]!.assignments).toHaveLength(1);
    const assignment = result.crews[0]!.assignments[0]!;
    expect(assignment.providerName).toBe("Kaneohe Master Electric");
    expect(assignment.serviceArea.proximityFit).toBe("local-match");
    expect(result.crews[0]!.why).toContain("Proximity fit: all assigned providers are local subregion matches.");
  });
});
