import { describe, expect, it } from "vitest";
import { createCatalogBrief, getProduct, normalizeServicesJsonOffer, searchProducts } from "../src/catalog";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { DEMO_SERVICES } from "../src/demo-services";
import { interpolatePage } from "../src/interpolate";
import { createActivityItinerary } from "../src/itinerary";
import { inspectOrigin } from "../src/origins";
import type { Fetcher } from "../src/upstream";

const origin = inspectOrigin("services-lab");
const fixtureFetcher = (async (input: RequestInfo | URL, init?: RequestInit) => (
  handleDemoOriginRequest(new Request(input, init))
)) as Fetcher;

describe("service Offer foundation", () => {
  it("normalizes local and destination services into the shared Offer contract", () => {
    const offer = normalizeServicesJsonOffer(DEMO_SERVICES[0], origin, "2026-09-02T12:00:00.000Z");
    expect(offer).toMatchObject({
      originId: "services-lab",
      vertical: "services",
      source: { adapter: "public-services-json", live: true },
      service: {
        category: "activity",
        provider: { displayName: "Pacific Current Instruction", verification: "controlled-demo" },
        location: { city: "Haleiwa", region: "Oahu, Hawaii", countryCode: "US", venue: "outdoor" },
        durationMinutes: 120,
        priceBasis: "per-person",
        partySize: { min: 1, max: 6 },
        cancellation: { refundable: true, windowHours: 24 },
        itineraryEligible: true,
      },
      handoff: { eligible: false, reason: "service-booking-not-enabled" },
    });
    expect(offer?.provenance.verification.singleSourceFields).toEqual([
      "pricing",
      "availability",
      "provider",
      "location",
      "duration",
      "scheduling",
      "cancellation",
    ]);
  });

  it("searches and retrieves bounded service JSON from the allowlisted origin", async () => {
    const search = await searchProducts("surf lesson", 4, origin, fixtureFetcher);
    expect(search).toMatchObject({ live: true, source: "public-services-json", origin: { id: "services-lab" } });
    expect(search.offers.map((offer) => offer.handle)).toEqual(["north-shore-surf-foundations"]);

    const detail = await getProduct("tangier-traditional-archery", origin, fixtureFetcher);
    expect(detail.offers[0]).toMatchObject({
      service: { location: { city: "Tangier", countryCode: "MA" }, durationMinutes: 90 },
    });
  });

  it("interpolates a service page and verifies evidence across JSON and JSON-LD", async () => {
    const result = await interpolatePage(origin, "/services/north-shore-surf-foundations", fixtureFetcher);
    expect(result).toMatchObject({
      live: true,
      pageLive: true,
      canonicalUrl: "https://agentic-webmcp-origin.somnora.workers.dev/services/north-shore-surf-foundations",
      offer: {
        service: { location: { city: "Haleiwa" }, durationMinutes: 120 },
        provenance: {
          verification: {
            state: "verified",
            verifiedFields: ["pricing", "availability", "provider", "location", "duration", "scheduling", "cancellation"],
            conflictFields: [],
          },
        },
      },
    });
    expect(result.markdown).toContain("Schedule timezone: Pacific/Honolulu");
  });

  it("creates a source-linked brief from the shared Offer model", () => {
    const surf = normalizeServicesJsonOffer(DEMO_SERVICES[0], origin)!;
    const brief = createCatalogBrief("Compare a source-grounded Oahu lesson", [surf]);
    for (const value of [
      "# Service brief",
      "Pacific Current Instruction",
      "Haleiwa, Oahu, Hawaii",
      "120 min",
      "party 1-6",
      "24h refundable window",
      "itinerary eligible",
      surf.url,
    ]) expect(brief).toContain(value);
  });

  it("builds a constraint-aware Oahu plan inside published windows and budget", async () => {
    const catalog = await Promise.all([
      getProduct("north-shore-surf-foundations", origin, fixtureFetcher),
      getProduct("haleiwa-food-story-walk", origin, fixtureFetcher),
      getProduct("oahu-sunset-photo-walk", origin, fixtureFetcher),
    ]);
    const itinerary = createActivityItinerary(
      {
        goal: "Plan a relaxed Oahu day under 500 USD",
        date: "2026-10-10",
        days: 1,
        partySize: 2,
        budget: 500,
        pace: "balanced",
        earliestStart: "08:00",
        latestEnd: "19:00",
      },
      catalog.flatMap((result) => result.offers),
      "2026-09-02T12:00:00.000Z",
    );
    expect(itinerary).toMatchObject({
      status: "planning-only",
      planStatus: "ready-for-review",
      destination: { label: "Oahu, Hawaii, US", timezone: "Pacific/Honolulu" },
      date: "2026-10-10",
      partySize: 2,
      constraints: { days: 1, pace: "balanced", budget: { amount: "500.00", currencyCode: "USD" } },
      publishedPriceTotal: { amount: "450.00", currencyCode: "USD" },
      budgetRemaining: { amount: "50.00", currencyCode: "USD" },
      conflicts: [],
    });
    expect(itinerary.items).toEqual([
      expect.objectContaining({ handle: "north-shore-surf-foundations", status: "scheduled", day: 1, startLocal: "08:00", endLocal: "10:00" }),
      expect.objectContaining({ handle: "haleiwa-food-story-walk", status: "scheduled", day: 1, startLocal: "11:30", endLocal: "13:00" }),
      expect.objectContaining({ handle: "oahu-sunset-photo-walk", status: "scheduled", day: 1, startLocal: "16:00", endLocal: "17:30" }),
    ]);
    expect(itinerary.warnings).toEqual(expect.arrayContaining([expect.stringContaining("not reservations")]));
    expect(itinerary.markdown).toContain("# Oahu, Hawaii activity plan");
    expect(itinerary.markdown).toContain("Saturday, 2026-10-10");
  });

  it("surfaces destination, party-size, schedule, and budget conflicts", () => {
    const handyman = normalizeServicesJsonOffer(DEMO_SERVICES.find((service) => service.handle === "home-repair-walkthrough")!, origin)!;
    const surf = normalizeServicesJsonOffer(DEMO_SERVICES[0], origin)!;
    const tangier = normalizeServicesJsonOffer(DEMO_SERVICES.find((service) => service.handle === "tangier-traditional-archery")!, origin)!;
    const destination = createActivityItinerary({ goal: "Plan one destination", date: "2026-10-10", partySize: 2 }, [surf, tangier]);
    expect(destination.planStatus).toBe("needs-attention");
    expect(destination.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ code: "destination-mismatch" })]));

    const tangierPlan = createActivityItinerary({ goal: "Plan Tangier archery", date: "2026-10-11", partySize: 2 }, [tangier]);
    expect(tangierPlan.markdown).toContain("# Tanger-Tetouan-Al Hoceima activity plan");

    const party = createActivityItinerary({ goal: "Plan a group lesson", date: "2026-10-10", partySize: 10 }, [surf]);
    expect(party.conflicts).toEqual([expect.objectContaining({ code: "party-size" })]);

    const ineligible = createActivityItinerary({ goal: "Plan home work", date: "2026-10-10" }, [handyman]);
    expect(ineligible.conflicts).toEqual([expect.objectContaining({ code: "not-itinerary-eligible" })]);

    const overBudget = createActivityItinerary({ goal: "Plan one lesson", date: "2026-10-10", partySize: 2, budget: 100 }, [surf]);
    expect(overBudget).toMatchObject({ publishedPriceTotal: { amount: "0.00" }, conflicts: [expect.objectContaining({ code: "budget-limit" })] });
  });

  it("requires a real date and returns a planning conflict when it is omitted", () => {
    const surf = normalizeServicesJsonOffer(DEMO_SERVICES[0], origin)!;
    expect(() => createActivityItinerary({ goal: "Plan a lesson", date: "2026-02-30" }, [surf])).toThrow("real calendar date");
    expect(createActivityItinerary({ goal: "Plan a lesson" }, [surf])).toMatchObject({
      planStatus: "needs-attention",
      conflicts: [expect.objectContaining({ code: "date-required" })],
    });
  });
});
