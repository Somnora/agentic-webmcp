import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { loadRehearsalSteps } from "../public/presenter.js";

const presenter = readFileSync(new URL("../public/presenter.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const sequence = JSON.parse(readFileSync(new URL("../public/demo-sequence.json", import.meta.url), "utf8"));

describe("recording presenter", () => {
  it("includes the converter, core WebMCP calls, and human-only commit boundary", () => {
    for (const name of [
      "document.modelContext.registerTool",
      "list_origins",
      "select_origin",
      "search_products",
      "find_best_options",
      "interpolate_page",
      "compare_products",
      "propose_add_to_cart",
      "human_approval_button",
    ]) {
      expect(presenter + JSON.stringify(sequence)).toContain(name);
    }
    expect(presenter).not.toContain('action: "commitCart"');
  });

  it("provides explicit presenter controls and under-the-hood copy", () => {
    expect(page).toContain('id="presenter-toggle"');
    expect(page).toContain('id="presenter-rehearse"');
    expect(page).toContain('id="presenter-next"');
    expect(page).toContain("UNDER THE HOOD");
    expect(page).toContain("Run guided demo");
    expect(page).not.toContain("presenter-time");
    expect(page).not.toContain("presenter-progress");
    expect(page).not.toContain("presenter-caption");
  });

  it("uses one non-interactive morphing frame and a precise SVG cursor", () => {
    expect(page).toContain('id="presenter-focus"');
    expect(page).toContain('id="presenter-cursor"');
    expect(styles).toContain("pointer-events: none");
    expect(styles).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(styles).toContain(".presenter-cursor.clicking svg { animation: presenter-click 220ms ease-out; }");
    expect(styles).not.toContain(".presenter-cursor.clicking { animation:");
    expect(styles).toContain("body.presenter-active, body.presenter-active * { cursor: none !important; }");
  });

  it("shows the conversion path and keeps raw tool output optional", () => {
    for (const label of ["Allowlisted page", "Stripped Markdown", "Normalized Offer", "Agent tool", "Human approval"]) {
      expect(page).toContain(label);
    }
    expect(page).toContain('id="conversion-path-status"');
    expect(page).toContain('id="download-dossier"');
    expect(page).toContain('id="origin-diagnostics"');
    expect(app).toContain("loadOriginDiagnostics");
    expect(app).toContain("failureReason");
    expect(app).toContain("updateConversionPath(tool)");
    expect(app).toContain("createDecisionDossier");
    expect(app).toContain('node("summary", "", "Raw JSON")');
    expect(app).toContain("renderAgentResult(tool, actor, resultText, displayPayload)");
    expect(app).toContain("currentHandoff(offer)");
    expect(app).toContain("compactListingOffer(offer)");
    expect(app).toContain("RESEARCH ONLY");
    expect(styles).toContain(".handoff-line.eligible");
  });

  it("shows session-only taste and intent with formatted recommendation results", () => {
    for (const id of ["recommend-shopping-for", "recommend-mode", "recommend-taste", "recommend-must-have", "recommend-avoid"]) {
      expect(page).toContain(`id="${id}"`);
    }
    expect(page).toContain('id="refinement-panel"');
    expect(page).toContain("Session only");
    expect(app).toContain('method: "POST"');
    expect(app).toContain("recommendation.evidenceConfidence");
    expect(app).toContain("recommendation.tradeoff");
    expect(app).toContain("renderRefinement(payload.refinement)");
    expect(app).toContain('refinementChoice: choice.id');
    expect(app).toContain("presenter?.humanRefined()");
    expect(sequence.steps.find((step) => step.action === "recommend").args.shoppingFor).toBe("gift");
    expect(sequence.steps.find((step) => step.action === "recommend").waitForRefinement).toBe(true);
    expect(presenter).toContain('waitingKind === "refinement"');
    expect(styles).toContain(".recommendation-copy");
  });

  it("keeps the itinerary conflict panel out of the layout when no conflicts exist", () => {
    expect(page).toContain('id="itinerary-conflicts" class="itinerary-conflicts" hidden');
    expect(app).toContain('resultFact("Budget remaining"');
    expect(styles).toContain(".itinerary-conflicts[hidden] { display: none; }");
    expect(app).toContain("[elements.itineraryDate, plan.date]");
    expect(app).toContain("[elements.itineraryBudget, plan.constraints.budget?.amount]");
  });

  it("shares a sub-three-minute narrated plan and exports actual edit cues", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => sequence }));
    expect(await loadRehearsalSteps(fetcher)).toEqual(sequence.steps);
    expect(fetcher).toHaveBeenCalledWith("/demo-sequence.json", { cache: "no-store" });
    expect(sequence.steps.reduce((total, step) => total + step.duration, 0)).toBeLessThan(180000);
    expect(sequence.steps.every((step) => step.narration && step.id && step.detail)).toBe(true);
    expect(new Set(sequence.steps.map((step) => step.id)).size).toBe(sequence.steps.length);
    expect(sequence.steps.find((step) => step.action === "itinerary").args.budget).toBe(500);
    const dossier = sequence.steps.findIndex((step) => step.waitForDossier);
    const services = sequence.steps.findIndex((step) => step.args?.originId === "services-lab");
    expect(dossier).toBeLessThan(services);
    expect(page).toContain('id="presenter-export"');
    expect(app).toContain("presenter?.humanDossierDownloaded()");
  });

  it("rejects a failed sequence fetch or an agent-callable human action", async () => {
    await expect(loadRehearsalSteps(async () => ({ ok: false }))).rejects.toThrow("could not be loaded");
    for (const action of ["commitCart", "checkout", "human_approval_button", "pay"]) {
      const steps = [{ ...sequence.steps[0], action }];
      await expect(loadRehearsalSteps(async () => ({ ok: true, json: async () => ({ steps }) }))).rejects.toThrow("unsupported step");
    }
  });
});
