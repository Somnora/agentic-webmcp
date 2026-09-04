import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeApprovedMemoryFact, projectApprovedMemoryFact } from "../public/decision-memory.js";
import { adaptStaffingResult } from "../public/staffing-view-model.js";

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

  it("adapts staffing API contract without runtime errors and enforces boundaries", () => {
    const rawResult = {
      status: "planned",
      crews: [
        {
          id: "decision-staffing-1-crew-1",
          label: "Verified crew plan",
          title: "2-role project crew for Honolulu",
          status: "ready-for-review",
          score: 95,
          projectDate: "2026-10-17",
          estimatedHours: 8,
          requestedRoles: ["residential electrician", "finish carpenter"],
          assignments: [
            {
              role: "residential electrician",
              roleLabel: "Residential Electrician",
              offerHandle: "oahu-residential-electrician",
              offerTitle: "Licensed Residential Electrician",
              providerId: "oahu-electric-pros",
              providerName: "Oahu Electric Pros",
              serviceArea: {
                label: "Honolulu",
                regions: ["Honolulu"],
                travelRadiusMiles: 25,
                proximityFit: "local-match",
              },
              availability: {
                date: "2026-10-17",
                weekday: "saturday",
                timezone: "Pacific/Honolulu",
                startLocal: "08:00",
                endLocal: "17:00",
              },
              credentialEvidence: [
                {
                  id: "license-1",
                  label: "State Electrical License",
                  status: "controlled-verified",
                  issuer: "Hawaii DCCA",
                  identifier: "EJ-12345",
                  verifiedAt: "2026-08-01T00:00:00.000Z",
                  evidenceSummary: "Verified against state licensing database",
                },
                {
                  id: "attestation-1",
                  label: "Safety Training",
                  status: "provider-attested",
                  issuer: "Provider",
                  identifier: null,
                  verifiedAt: null,
                  evidenceSummary: "Self-attested safety training",
                },
              ],
              equipment: ["electrical diagnostic meter"],
              price: {
                published: { amount: "85.00", currencyCode: "USD" },
                basis: "per-hour",
                quoteMode: "published-rate",
                estimatedHours: 8,
                publishedSubtotal: { amount: "680.00", currencyCode: "USD" },
                planningHigh: { amount: "748.00", currencyCode: "USD" },
              },
              sourceReview: {
                url: "https://agentic-app-review-test.myshopify.com/services/oahu-residential-electrician",
                action: "human-only",
                transmittedInformation: "Opening the controlled source sends an ordinary browser request to that page. Ribband sends no project brief, contact details, contract, or payment data.",
              },
            },
          ],
          missingRoles: [],
          scheduleGaps: [
            {
              role: "finish carpenter",
              date: "2026-10-17",
              reason: "No scheduled provider covers Saturday afternoon for this role.",
            },
          ],
          budgetCeiling: { amount: "2000.00", currencyCode: "USD" },
          costs: {
            publishedSubtotal: { amount: "680.00", currencyCode: "USD" },
            contingency: { amount: "68.00", currencyCode: "USD" },
            planningHigh: { amount: "748.00", currencyCode: "USD" },
            withinBudget: true,
            basis: "8 planned hours plus 10% contingency",
          },
          quoteAccounting: {
            publishedRateAssignments: 1,
            estimateOnlyAssignments: 0,
            unknownCosts: [],
          },
          why: "Verified provider matches all hard constraints.",
          tradeoff: "Planning estimates used for travel.",
          evidenceConfidence: "Controlled service JSON reconciled.",
        },
      ],
      staffing: {
        status: "applied",
        actionEligible: true,
        briefId: "decision-staffing-1",
        vertical: "staffing",
        handling: "request-only",
        providerSourceReview: "human-only",
        contactCapability: "unavailable",
        contractingCapability: "unavailable",
        unsupportedConstraints: [],
        note: "Ribband may prepare a page-only source review. It cannot contact a provider, request a quote, contract, book labor, or pay.",
      },
    };

    const vm = adaptStaffingResult(rawResult);
    expect(vm.actionEligible).toBe(true);
    expect(vm.crews).toHaveLength(1);
    const crew = vm.crews[0];
    expect(crew.providerSourceReview).toBe("human-only");
    expect(crew.assignments).toHaveLength(1);

    const assignment = crew.assignments[0];
    expect(assignment.providerName).toBe("Oahu Electric Pros");
    expect(assignment.sourceUrl).toBe("https://agentic-app-review-test.myshopify.com/services/oahu-residential-electrician");
    expect(assignment.transmittedInformation).toContain("Ribband sends no project brief, contact details, contract, or payment data.");

    expect(assignment.verifiedCredentials).toHaveLength(1);
    expect(assignment.verifiedCredentials[0].label).toBe("State Electrical License");
    expect(assignment.verifiedCredentials[0].status).toBe("controlled-verified");

    expect(assignment.otherCredentials).toHaveLength(1);
    expect(assignment.otherCredentials[0].label).toBe("Safety Training");
    expect(assignment.otherCredentials[0].status).toBe("provider-attested");

    expect(crew.scheduleGaps).toHaveLength(1);
    expect(crew.scheduleGaps[0].role).toBe("finish carpenter");
    expect(crew.scheduleGaps[0].reason).toBe("No scheduled provider covers Saturday afternoon for this role.");

    const page = read("public/decide.html");
    expect(page).toContain('value="residential electrician: state electrical license, finish carpenter: general liability coverage"');
    expect(page).toContain('value="residential electrician: electrical diagnostic meter, finish carpenter: finish nailer"');

    const runtime = read("public/decide.js");
    expect(runtime).toContain("Review provider source");
    expect(runtime).toContain("Open provider source");
    expect(runtime).toContain("source-review-panel");
    expect(runtime).toContain('openLink.rel = "noopener noreferrer"');
  });
});

