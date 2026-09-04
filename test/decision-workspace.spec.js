import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeApprovedMemoryFact, projectApprovedMemoryFact } from "../public/decision-memory.js";
import { adaptStaffingResult, isControlledServicesHttpsUrl } from "../public/staffing-view-model.js";
import { validateDecisionContextRequest } from "../src/decision-brief";
import { orchestrateDecisionResult } from "../src/decision-orchestrator";
import { handleDemoOriginRequest } from "../src/demo-origin";
import { interpolatePage } from "../src/interpolate";
import { inspectOrigin } from "../src/origins";
import { createPersonalizedStaffingPlans } from "../src/personalized-staffing";

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

  it("adapts staffing API contract from real engine result and enforces authoritative boundaries", async () => {
    const origin = inspectOrigin("services-lab");
    const fixtureFetcher = async (input, init) => handleDemoOriginRequest(new Request(input, init));
    const handles = [
      "oahu-residential-electrician",
      "oahu-finish-carpenter",
      "oahu-paint-finish-lead",
      "oahu-gaffer-lighting-technician",
      "oahu-location-sound-mixer",
      "oahu-production-designer",
    ];

    const projections = await Promise.all(
      handles.map((handle) => interpolatePage(origin, `/services/${handle}`, fixtureFetcher))
    );
    const offers = projections.map((p) => p.offer);

    const context = validateDecisionContextRequest({
      brief: {
        version: "1",
        id: "decision-staffing-actual-1",
        vertical: "staffing",
        goal: "Staff a residential electrician and finish carpenter in Honolulu",
        subjectIds: ["client-1"],
        selectedFactIds: [],
        decisionOnlyFacts: [],
        hardConstraints: [
          { id: "staffing-location", kind: "location", label: "Honolulu", value: "Honolulu, Oahu, Hawaii, US", source: "current-request", factId: null },
          { id: "staffing-date", kind: "date-range", label: "Date is 2026-10-17", value: "2026-10-17", source: "current-request", factId: null },
          { id: "staffing-role-1", kind: "must-have", label: "Required role: residential electrician", value: "residential electrician", source: "current-request", factId: null },
          { id: "staffing-role-2", kind: "must-have", label: "Required role: finish carpenter", value: "finish carpenter", source: "current-request", factId: null },
          { id: "staffing-cred-1", kind: "credential", label: "Credential requirement: residential electrician: state electrical license", value: "residential electrician: state electrical license", source: "current-request", factId: null },
          { id: "staffing-cred-2", kind: "credential", label: "Credential requirement: finish carpenter: general liability coverage", value: "finish carpenter: general liability coverage", source: "current-request", factId: null },
          { id: "staffing-equip-1", kind: "equipment", label: "Equipment requirement: residential electrician: electrical diagnostic meter", value: "residential electrician: electrical diagnostic meter", source: "current-request", factId: null },
          { id: "staffing-equip-2", kind: "equipment", label: "Equipment requirement: finish carpenter: finish nailer", value: "finish carpenter: finish nailer", source: "current-request", factId: null },
          { id: "staffing-hours", kind: "custom", label: "Estimated project hours", value: 8, source: "current-request", factId: null },
        ],
        softPreferences: [],
        budget: {
          currencyCode: "USD",
          targetAmount: null,
          maximumAmount: "2500.00",
          includesTaxes: null,
          includesFees: true,
          contingencyPercent: 10,
        },
        location: {
          label: "Honolulu",
          city: "Honolulu",
          region: "Oahu, Hawaii",
          countryCode: "US",
          timezone: "Pacific/Honolulu",
          flexible: false,
        },
        timeWindow: {
          start: "2026-10-17T08:00:00-10:00",
          end: "2026-10-17T16:00:00-10:00",
          timezone: "Pacific/Honolulu",
          flexible: false,
        },
        output: "package",
        missingInformation: [],
        createdAt: "2026-09-03T18:00:00.000Z",
      },
      selectedFacts: [],
    });

    const staffingResult = createPersonalizedStaffingPlans(context, offers);
    const envelope = orchestrateDecisionResult(context, staffingResult, {
      evidenceType: "controlled-service-json",
      originId: "services-lab",
      timestamp: "2026-09-03T18:00:00.000Z",
      snapshotMatchesReconciled: true,
      notes: "Controlled service fixtures.",
    });

    const handoffAction = envelope.nextActions.find((a) => a.id === "handoff");
    expect(handoffAction).toBeDefined();
    expect(handoffAction.available).toBe(true);
    expect(handoffAction.requiresHumanApproval).toBe(true);

    const vm = adaptStaffingResult(envelope.result, handoffAction);
    expect(vm.actionEligible).toBe(true);
    expect(vm.envelopeHandoffEligible).toBe(true);
    expect(vm.crews).toHaveLength(1);
    const crew = vm.crews[0];
    expect(crew.status).toBe("ready-for-review");
    expect(crew.assignments).toHaveLength(2);

    const electrician = crew.assignments.find((a) => a.role === "residential electrician");
    expect(electrician).toBeDefined();
    expect(electrician.providerName).toBe("Kai Line Electric");
    expect(electrician.offerHandle).toBe("oahu-residential-electrician");
    expect(electrician.sourceUrl).toBe("https://agentic-webmcp-origin.somnora.workers.dev/services/oahu-residential-electrician");
    expect(electrician.isControlledUrl).toBe(true);
    expect(electrician.sourceAction).toBe("human-only");
    expect(electrician.sourceReviewEligible).toBe(true);
    expect(electrician.proximityFit).toBe("local-match");
    expect(electrician.proximityLabel).toBe("Local subregion match");
    expect(electrician.verifiedCredentials.some((c) => c.label.toLowerCase() === "state electrical license" && c.status === "controlled-verified")).toBe(true);

    const carpenter = crew.assignments.find((a) => a.role === "finish carpenter");
    expect(carpenter).toBeDefined();
    expect(carpenter.providerName).toBe("Grain and Line Carpentry");
    expect(carpenter.offerHandle).toBe("oahu-finish-carpenter");
    expect(carpenter.sourceUrl).toBe("https://agentic-webmcp-origin.somnora.workers.dev/services/oahu-finish-carpenter");
    expect(carpenter.isControlledUrl).toBe(true);
    expect(carpenter.sourceAction).toBe("human-only");
    expect(carpenter.sourceReviewEligible).toBe(true);
    expect(carpenter.proximityFit).toBe("cross-subregion-service");
    expect(carpenter.proximityLabel).toContain("Cross-subregion service");
    expect(carpenter.verifiedCredentials.some((c) => c.label.toLowerCase() === "general liability coverage" && c.status === "controlled-verified")).toBe(true);

    // Fails closed if handoffAction is missing or unavailable
    const noHandoffVm = adaptStaffingResult(envelope.result, null);
    expect(noHandoffVm.envelopeHandoffEligible).toBe(false);
    expect(noHandoffVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    const unavailableHandoffVm = adaptStaffingResult(envelope.result, { available: false, requiresHumanApproval: true });
    expect(unavailableHandoffVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    const noApprovalHandoffVm = adaptStaffingResult(envelope.result, { available: true, requiresHumanApproval: false });
    expect(noApprovalHandoffVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    // Fails closed if result.staffing.actionEligible is false
    const notActionEligibleResult = {
      ...envelope.result,
      staffing: { ...envelope.result.staffing, actionEligible: false },
    };
    const notEligibleVm = adaptStaffingResult(notActionEligibleResult, handoffAction);
    expect(notEligibleVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    // Fails closed if providerSourceReview is not "human-only"
    const automatedReviewResult = {
      ...envelope.result,
      staffing: { ...envelope.result.staffing, providerSourceReview: "automated" },
    };
    const automatedVm = adaptStaffingResult(automatedReviewResult, handoffAction);
    expect(automatedVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    // Fails closed if assignment sourceReview action is not "human-only"
    const badAssignmentActionCrew = {
      ...envelope.result.crews[0],
      assignments: [
        {
          ...envelope.result.crews[0].assignments[0],
          sourceReview: { ...envelope.result.crews[0].assignments[0].sourceReview, action: "automated" },
        },
      ],
    };
    const badAssignmentActionVm = adaptStaffingResult({ ...envelope.result, crews: [badAssignmentActionCrew] }, handoffAction);
    expect(badAssignmentActionVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    // Fails closed if sourceReview.url is not HTTPS on the controlled origin
    const badUrlCrew = {
      ...envelope.result.crews[0],
      assignments: [
        {
          ...envelope.result.crews[0].assignments[0],
          sourceReview: { ...envelope.result.crews[0].assignments[0].sourceReview, url: "http://agentic-webmcp-origin.somnora.workers.dev/services/test" },
        },
      ],
    };
    const badUrlVm = adaptStaffingResult({ ...envelope.result, crews: [badUrlCrew] }, handoffAction);
    expect(badUrlVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    // Rejects unknown proximity: never defaults to local-match and disables handoff
    const unknownProximityCrew = {
      ...envelope.result.crews[0],
      assignments: [
        {
          ...envelope.result.crews[0].assignments[0],
          serviceArea: { ...envelope.result.crews[0].assignments[0].serviceArea, proximityFit: "unverified-proximity" },
        },
      ],
    };
    const unknownProximityVm = adaptStaffingResult({ ...envelope.result, crews: [unknownProximityCrew] }, handoffAction);
    expect(unknownProximityVm.crews[0].assignments[0].proximityFit).toBeNull();
    expect(unknownProximityVm.crews[0].assignments[0].proximityLabel).toBeNull();
    expect(unknownProximityVm.crews[0].assignments[0].sourceReviewEligible).toBe(false);

    // Contract errors on missing staffing metadata or missing assignment sourceReview
    expect(() => adaptStaffingResult({ crews: [] }, handoffAction)).toThrow(TypeError);
    const missingSourceReviewCrew = {
      ...envelope.result.crews[0],
      assignments: [{ ...envelope.result.crews[0].assignments[0], sourceReview: null }],
    };
    expect(() => adaptStaffingResult({ ...envelope.result, crews: [missingSourceReviewCrew] }, handoffAction)).toThrow(TypeError);

    // URL validation helper unit assertions
    expect(isControlledServicesHttpsUrl("https://agentic-webmcp-origin.somnora.workers.dev/services/test")).toBe(true);
    expect(isControlledServicesHttpsUrl("http://agentic-webmcp-origin.somnora.workers.dev/services/test")).toBe(false);
    expect(isControlledServicesHttpsUrl("https://other-origin.workers.dev/services/test")).toBe(false);
    expect(isControlledServicesHttpsUrl("https://agentic-webmcp-origin.somnora.workers.dev/products/test")).toBe(false);
    expect(isControlledServicesHttpsUrl("invalid-url")).toBe(false);

    const page = read("public/decide.html");
    expect(page).toContain('value="residential electrician: state electrical license, finish carpenter: general liability coverage"');
    expect(page).toContain('value="residential electrician: electrical diagnostic meter, finish carpenter: finish nailer"');

    const runtime = read("public/decide.js");
    expect(runtime).toContain("Review provider source");
    expect(runtime).toContain("Open provider source");
    expect(runtime).toContain("source-review-panel");
    expect(runtime).toContain('openLink.rel = "noopener noreferrer"');
  });

  it("enforces that the provider source disclosure and link are invisible before review", () => {
    const css = read("public/workspace.css");
    const runtime = read("public/decide.js");

    // CSS rule must explicitly hide [hidden] and .source-review-panel[hidden] with display: none !important
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
    expect(css).toMatch(/\.source-review-panel\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);

    // The runtime must initialize confirmPanel with hidden = true
    expect(runtime).toContain("confirmPanel.hidden = true;");

    // The openLink must be placed inside confirmPanel (never exposed outside before review)
    expect(runtime).toContain("panelActions.append(openLink, cancelBtn);");
    expect(runtime).toContain("confirmPanel.append(panelHeader, panelDestination, panelDisclosure, panelActions);");

    // In Chrome, verify computed visibility: .source-review-panel[hidden] must compute to display: none
    const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const testHtml = `<!doctype html>
<html>
<head>
<link rel="stylesheet" href="file:///Users/jamesmcshane/APP_PROJECTS/Agentic/agentic-webmcp/public/workspace.css">
</head>
<body>
<div class="source-review-container">
  <button id="btn" class="review-source-button">Review</button>
  <div id="panel" class="source-review-panel" hidden>
    <a id="link" class="open-source-link" href="#">Open</a>
  </div>
</div>
<div id="test-output"></div>
<script>
window.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel");
  const initialDisplay = window.getComputedStyle(panel).display;
  panel.hidden = false;
  const revealedDisplay = window.getComputedStyle(panel).display;
  document.getElementById("test-output").textContent = JSON.stringify({ initialDisplay, revealedDisplay });
});
</script>
</body>
</html>`;
    const tempFile = `/tmp/test-visibility-${Date.now()}.html`;
    writeFileSync(tempFile, testHtml);
    try {
      const domOutput = execFileSync(chromePath, [
        "--headless=new",
        "--virtual-time-budget=2000",
        "--run-all-compositor-stages-before-draw",
        "--dump-dom",
        tempFile,
      ], { encoding: "utf8" });
      const match = domOutput.match(/<div id="test-output">(\{.*?\})<\/div>/);
      expect(match).toBeTruthy();
      const result = JSON.parse(match[1]);
      expect(result.initialDisplay).toBe("none");
      expect(result.revealedDisplay).toBe("grid");
    } finally {
      try { unlinkSync(tempFile); } catch {}
    }
  });
});

