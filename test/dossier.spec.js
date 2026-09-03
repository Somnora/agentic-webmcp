import { describe, expect, it } from "vitest";
import { createDecisionDossier, dossierFilename } from "../public/dossier.js";

describe("decision dossier", () => {
  it("renders the goal, ranking evidence, conflicts, selection, and human decision", () => {
    const dossier = createDecisionDossier({
      generatedAt: "2026-09-01T12:00:00.000Z",
      origin: { id: "catalog-lab", displayName: "Independent Gear Exchange", hostname: "agentic-webmcp-origin.somnora.workers.dev", authorization: "first-party-controlled", adapter: "public-products-json" },
      activeAdapter: "public-products-json",
      goal: { query: "electric guitar", maxDeliveredPrice: 900, intent: { shoppingFor: "gift", mode: "explore", priorities: ["taste", "condition"], tasteContext: "classic shape", mustHave: "single coil", avoid: "final sale" } },
      rubric: { relevance: 23, preferenceFit: 15, condition: 25 },
      refinement: { status: "resolved", reason: "answered", margin: 8.4, question: "Which consideration should guide the final ranking?", choices: [{ id: "returns", label: "Safer returns" }, { id: "price", label: "Lower delivered price" }], selectedChoice: { id: "returns", label: "Safer returns" }, changed: false, explanation: "Best fit stayed sunburst-guitar. Safer returns received an explicit 10-point rubric boost." },
      rankedOptions: [{ rank: 1, label: "Best fit", title: "Sunburst Guitar", handle: "sunburst-guitar", score: 94, deliveredPrice: { amount: "610.00", currencyCode: "USD" }, url: "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-guitar", why: "Matches the recipient context.", tradeoff: "Uses most of the budget.", evidenceConfidence: "Verified across product JSON and page", factors: { relevance: 23, preferenceFit: 15, condition: 23 } }],
      evidence: [{ title: "Sunburst Guitar", state: "conflict", label: "Evidence conflict: pricing", conflicts: ["pricing"], checkedAt: "2026-09-01T11:59:00.000Z", url: "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-guitar" }],
      selection: { title: "Sunburst Guitar", handle: "sunburst-guitar", quantity: 1, total: { amount: "610.00", currencyCode: "USD" }, url: "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-guitar", evidence: "Evidence conflict: pricing" },
      humanDecision: { status: "approved for merchant handoff", recordedAt: "2026-09-01T12:00:00.000Z" },
      activity: [{ time: "2026-09-01T11:58:00.000Z", actor: "agent via WebMCP", tool: "find_best_options", originId: "catalog-lab" }],
    });

    for (const value of ["electric guitar", "Someone else", "Explore", "classic shape", "single coil", "final sale", "Refinement checkpoint", "Which consideration", "Safer returns", "Lower delivered price", "Ranking changed: No", "Best fit stayed", "Best fit", "Matches the recipient context", "Verified across product JSON and page", "score 94", "preferenceFit 15", "Evidence conflict: pricing", "610.00 USD", "approved for merchant handoff", "Order created: No", "find_best_options"]) {
      expect(dossier).toContain(value);
    }
    expect(dossierFilename("catalog-lab", "2026-09-01T12:00:00.000Z")).toBe("ribband-decision-dossier-catalog-lab-2026-09-01.md");
  });

  it("keeps untrusted text on one line and rejects non-HTTPS source links", () => {
    const dossier = createDecisionDossier({
      origin: { displayName: "Unsafe\nheading", hostname: "example.test" },
      rankedOptions: [{ rank: 1, title: "Offer|Injected", handle: "offer", score: 1, url: "javascript:alert(1)" }],
    });
    expect(dossier).toContain("Unsafe heading");
    expect(dossier).toContain("Offer Injected");
    expect(dossier).not.toContain("javascript:");
  });

  it("renders a planning-only service itinerary with sources and limitations", () => {
    const dossier = createDecisionDossier({
      generatedAt: "2026-09-02T12:00:00.000Z",
      origin: { id: "services-lab", displayName: "Independent Services Directory", hostname: "agentic-webmcp-origin.somnora.workers.dev", adapter: "public-services-json" },
      goal: { type: "activity-itinerary", text: "Plan a surf lesson", date: "2026-10-10", partySize: 2 },
      itinerary: {
        status: "planning-only",
        planStatus: "ready-for-review",
        destination: { label: "Oahu, Hawaii, US" },
        date: "2026-10-10",
        partySize: 2,
        constraints: { days: 1, pace: "balanced", earliestStart: "08:00", latestEnd: "19:00", budget: { amount: "500.00", currencyCode: "USD" } },
        publishedPriceTotal: { amount: "190.00", currencyCode: "USD" },
        budgetRemaining: { amount: "310.00", currencyCode: "USD" },
        items: [{
          order: 1,
          title: "North Shore Surf Foundations",
          handle: "north-shore-surf-foundations",
          provider: "Pacific Current Instruction",
          location: "Haleiwa, Oahu, Hawaii, US",
          durationMinutes: 120,
          price: { amount: "190.00", currencyCode: "USD" },
          priceBasis: "per-person",
          status: "scheduled",
          date: "2026-10-10",
          startLocal: "08:00",
          endLocal: "10:00",
          publishedWindows: ["Tuesday 08:00-12:00"],
          sourceUrl: "https://agentic-webmcp-origin.somnora.workers.dev/services/north-shore-surf-foundations",
        }],
        conflicts: [],
        warnings: ["Published windows are not reservations."],
      },
    });
    for (const value of ["Plan a surf lesson", "Activity itinerary", "planning-only", "ready-for-review", "Oahu, Hawaii, US", "balanced", "08:00 to 19:00", "500.00 USD", "310.00 USD", "2026-10-10 08:00-10:00", "190.00 USD", "North Shore Surf Foundations", "Pacific Current Instruction", "Tuesday 08:00-12:00", "not reservations", "did not create an order or booking"]) {
      expect(dossier).toContain(value);
    }
  });
});
