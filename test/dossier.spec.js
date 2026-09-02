import { describe, expect, it } from "vitest";
import { createDecisionDossier, dossierFilename } from "../public/dossier.js";

describe("decision dossier", () => {
  it("renders the goal, ranking evidence, conflicts, selection, and human decision", () => {
    const dossier = createDecisionDossier({
      generatedAt: "2026-09-01T12:00:00.000Z",
      origin: { id: "catalog-lab", displayName: "Independent Gear Exchange", hostname: "agentic-webmcp-origin.somnora.workers.dev", authorization: "first-party-controlled", adapter: "public-products-json" },
      activeAdapter: "public-products-json",
      goal: { query: "electric guitar", maxDeliveredPrice: 900 },
      rubric: { relevance: 30, condition: 25 },
      rankedOptions: [{ rank: 1, title: "Sunburst Guitar", handle: "sunburst-guitar", score: 94, deliveredPrice: { amount: "610.00", currencyCode: "USD" }, url: "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-guitar", factors: { relevance: 30, condition: 23 } }],
      evidence: [{ title: "Sunburst Guitar", state: "conflict", label: "Evidence conflict: pricing", conflicts: ["pricing"], checkedAt: "2026-09-01T11:59:00.000Z", url: "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-guitar" }],
      selection: { title: "Sunburst Guitar", handle: "sunburst-guitar", quantity: 1, total: { amount: "610.00", currencyCode: "USD" }, url: "https://agentic-webmcp-origin.somnora.workers.dev/products/sunburst-guitar", evidence: "Evidence conflict: pricing" },
      humanDecision: { status: "approved for merchant handoff", recordedAt: "2026-09-01T12:00:00.000Z" },
      activity: [{ time: "2026-09-01T11:58:00.000Z", actor: "agent via WebMCP", tool: "find_best_options", originId: "catalog-lab" }],
    });

    for (const value of ["electric guitar", "score 94", "relevance 30", "Evidence conflict: pricing", "610.00 USD", "approved for merchant handoff", "Order created: No", "find_best_options"]) {
      expect(dossier).toContain(value);
    }
    expect(dossierFilename("catalog-lab", "2026-09-01T12:00:00.000Z")).toBe("agentic-decision-dossier-catalog-lab-2026-09-01.md");
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
});
