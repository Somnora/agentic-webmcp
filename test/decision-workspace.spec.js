import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeApprovedMemoryFact, projectApprovedMemoryFact } from "../public/decision-memory.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("unified decision workspace", () => {
  it("ships one visible intake across gift, date, vacation, and staffing", () => {
    const page = read("public/decide.html");
    expect(page).toContain('id="decision-form"');
    expect(page).toContain('<option value="gift">');
    expect(page).toContain('<option value="date">');
    expect(page).toContain('<option value="vacation">');
    expect(page).toContain('<option value="staffing">');
    expect(page).toContain('id="staffing-fields"');
    expect(page).toContain('id="decision-context-list"');
    expect(page).toContain('id="decision-revision"');
    expect(page).toContain("Staffing verified");
    expect(page).toContain("Only a separately reviewed memory can be stored on this device");
  });

  it("calls only the unified route and registers one read-only tool", () => {
    const runtime = read("public/decide.js");
    expect(runtime).toContain('fetch("/api/decisions/plan"');
    expect(runtime).not.toContain("/api/recommendations");
    expect(runtime).not.toContain("/api/date-plans");
    expect(runtime).not.toContain("/api/vacation-packages");
    expect(runtime).toContain('name: "plan_decision"');
    expect(runtime.match(/name: "/g)).toHaveLength(1);
    expect(runtime).toContain("readOnlyHint: true");
    expect(runtime).toContain('enum: ["gift", "date", "vacation", "staffing"]');
    expect(runtime).not.toMatch(/name: ["'](?:save|update|delete|book|buy|contact|pay)_/);
  });

  it("supports staffing in the WebMCP tool schema and runtime builder", () => {
    const page = read("public/decide.html");
    const runtime = read("public/decide.js");
    expect(page).toContain('id="staffing-location"');
    expect(page).toContain('value="Honolulu"');
    expect(page).toContain("Project site or neighborhood");
    expect(runtime).toContain("buildStaffing");
    expect(runtime).toContain("renderStaffing");
    expect(runtime).toContain("staffing-client");
    expect(runtime).toContain("Staffing provider strategy");
    expect(runtime).toContain('staffingLocation: document.querySelector("#staffing-location")');
    expect(runtime).toContain('location: { type: "string", maxLength: 120 }');
    expect(runtime).toContain("elements.staffingLocation");
  });

  it("uses decision-only facts and linked full-context replacement", () => {
    const runtime = read("public/decide.js");
    expect(runtime).toContain("decisionOnlyFacts: facts");
    expect(runtime).toContain("const revisionOf = currentDecisionId");
    expect(runtime).toContain("decisionContext: context");
    expect(runtime).toContain("revisionOf");
    expect(runtime).toContain("textContent = value");
    expect(runtime).not.toContain("innerHTML");
    expect(runtime).not.toContain("indexedDB");
    expect(runtime).not.toContain("localStorage");
  });

  it("normalizes only confirmed, scoped on-device memory facts", () => {
    const fact = normalizeApprovedMemoryFact({
      id: "memory-vacation-1",
      kind: "liked-experience",
      value: "  Quiet   coastal mornings felt right. ",
      source: "inferred-and-confirmed",
      allowedUses: ["vacation", "date", "vacation"],
      createdAt: "2026-09-03T18:00:00.000Z",
      updatedAt: "2026-09-03T18:00:00.000Z",
      lastConfirmedAt: "2026-09-03T18:00:00.000Z",
    }, "2026-09-03T18:00:00.000Z");
    expect(fact).toMatchObject({
      subjectId: "profile-self",
      value: "Quiet coastal mornings felt right.",
      confidence: "confirmed",
      sensitivity: "private",
      allowedUses: ["vacation", "date"],
    });
    expect(projectApprovedMemoryFact(fact, "date", "date-you")).toMatchObject({ id: "memory-vacation-1", subjectId: "date-you" });
    expect(() => projectApprovedMemoryFact(fact, "gift", "gift-recipient")).toThrow("not approved for gift");
  });

  it("keeps outcome memory behind proposal and approval controls", () => {
    const page = read("public/decide.html");
    const runtime = read("public/decide.js");
    expect(page).toContain('id="decision-outcome-panel"');
    expect(page).toContain('id="decision-proposal-panel"');
    expect(page).toContain("Approve and save on this device");
    expect(runtime).toContain("Confirm deletion");
    expect(runtime).toContain('fetch("/api/profile-updates/propose"');
    expect(runtime).toContain("inferred-and-confirmed");
    expect(runtime).toContain("selectedMemoryIds.has");
    expect(runtime).toContain("selectedFactIds: selectedFacts.map");
  });

  it("documents the unified request, revision, and action boundaries", () => {
    const privacy = read("public/privacy.html");
    const threatModel = read("docs/THREAT_MODEL.md");
    expect(privacy).toContain("unified decision agent at `/decide` is request-only");
    expect(privacy).toContain("plan_decision");
    expect(privacy).toContain("Every revision submits the complete visible context again");
    expect(threatModel).toContain("dispatches only by its typed vertical");
    expect(threatModel).toContain("staffing decision without verified provider and credential Offers");
  });

  it("supports multi-subject demand registry and retail intent modes", () => {
    const page = read("public/decide.html");
    const runtime = read("public/decide.js");
    expect(page).toContain('id="decision-subject"');
    expect(page).toContain('id="gift-intent"');
    expect(page).toContain('id="gift-occasion"');
    expect(page).toContain('id="gift-deadline"');
    expect(page).toContain('id="gift-existing-items"');
    expect(runtime).toContain("subjectId: { type: \"string\", maxLength: 64 }");
    expect(runtime).toContain("intent: { type: \"string\", enum: [\"gift\", \"self-treat\"] }");
    expect(runtime).toContain("existingItems: { type: \"array\"");
    expect(runtime).toContain("occasionDeadline");
  });

  it("supports vacation exploration mode in the WebMCP tool schema and runtime builder", () => {
    const page = read("public/decide.html");
    const runtime = read("public/decide.js");
    expect(page).toContain('id="vacation-exploration-mode"');
    expect(page).toContain('value="balanced"');
    expect(page).toContain('value="comfort-seeking"');
    expect(page).toContain('value="novelty-seeking"');
    expect(runtime).toContain('vacationExplorationMode: document.querySelector("#vacation-exploration-mode")');
    expect(runtime).toContain('explorationMode: { type: "string", enum: ["balanced", "comfort-seeking", "novelty-seeking"] }');
    expect(runtime).toContain("elements.vacationExplorationMode");
    expect(runtime).toContain("Exploration mode: ${explorationMode}");
  });
});

