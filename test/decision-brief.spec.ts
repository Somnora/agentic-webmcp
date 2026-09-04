import { describe, expect, it } from "vitest";
import { buildDecisionContext, validateDecisionBrief, validateDecisionContextRequest } from "../src/decision-brief";
import { validateProfileFact } from "../src/profile";

const timestamp = "2026-09-03T18:00:00.000Z";

function profileFact(overrides: Record<string, unknown> = {}) {
  return {
    version: "1",
    id: "fact-recipient-interest",
    subjectId: "subject-nephew",
    kind: "interest",
    value: ["drawing", "animation"],
    source: "user-stated",
    confidence: "confirmed",
    sensitivity: "standard",
    lifeStage: null,
    allowedUses: ["gift"],
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function brief(overrides: Record<string, unknown> = {}) {
  return {
    version: "1",
    id: "decision-birthday-gift",
    vertical: "gift",
    goal: "Find a birthday gift for my nephew",
    subjectIds: ["subject-nephew"],
    selectedFactIds: ["fact-recipient-interest"],
    decisionOnlyFacts: [],
    hardConstraints: [{
      id: "constraint-age",
      kind: "age-suitability",
      label: "Suitable for a child",
      value: "child",
      source: "current-request",
      factId: null,
    }],
    softPreferences: [{
      id: "preference-interest",
      kind: "interest",
      label: "Recipient enjoys drawing and animation",
      value: ["drawing", "animation"],
      weight: "high",
      source: "profile",
      factId: "fact-recipient-interest",
    }],
    budget: {
      currencyCode: "usd",
      targetAmount: "50",
      maximumAmount: "75.5",
      includesTaxes: null,
      includesFees: true,
      contingencyPercent: 5,
    },
    location: null,
    timeWindow: {
      start: null,
      end: "2026-09-20",
      timezone: "America/Los_Angeles",
      flexible: false,
    },
    output: "shortlist",
    missingInformation: [],
    createdAt: timestamp,
    ...overrides,
  };
}

describe("decision brief contracts", () => {
  it("normalizes a bounded gift brief and price envelope", () => {
    expect(validateDecisionBrief(brief())).toMatchObject({
      vertical: "gift",
      goal: "Find a birthday gift for my nephew",
      budget: {
        currencyCode: "USD",
        targetAmount: "50.00",
        maximumAmount: "75.50",
        contingencyPercent: 5,
      },
      output: "shortlist",
    });
  });

  it("accepts explicit self shopping and rejects recipient-shaped shopping", () => {
    const shoppingBrief = brief({
      id: "decision-shopping-self",
      vertical: "shopping",
      goal: "Compare source-backed guitars for myself",
      subjectIds: ["subject-self"],
      intent: "self-treat",
      subjectKind: "self",
      occasion: null,
      occasionDeadline: null,
      selectedFactIds: [],
      decisionOnlyFacts: [],
      hardConstraints: [],
      softPreferences: [],
    });
    expect(validateDecisionBrief(shoppingBrief)).toMatchObject({
      vertical: "shopping",
      intent: "self-treat",
      subjectKind: "self",
    });
    expect(() => validateDecisionBrief({ ...shoppingBrief, intent: "gift", subjectKind: "recipient" }))
      .toThrow("Shopping decisions require self-treat intent and a self subject");
  });

  it("builds a context from only the explicitly selected saved facts", () => {
    const selected = validateProfileFact(profileFact());
    const unrelated = validateProfileFact(profileFact({
      id: "fact-private-travel",
      subjectId: "subject-self",
      kind: "fond-memory-signal",
      value: "honeymoon in Italy",
      sensitivity: "private",
      lifeStage: "honeymoon",
      allowedUses: ["vacation"],
    }));
    const context = buildDecisionContext(brief(), [selected, unrelated], Date.parse(timestamp));
    expect(context.selectedFacts).toEqual([selected]);
    expect(JSON.stringify(context)).not.toContain("honeymoon in Italy");
  });

  it("accepts decision-only facts without requiring persistence", () => {
    const decisionOnly = profileFact({
      id: "fact-existing-sketchbook",
      kind: "existing-item",
      value: "large sketchbook",
      allowedUses: ["gift"],
    });
    const value = brief({
      selectedFactIds: [],
      decisionOnlyFacts: [decisionOnly],
      softPreferences: [],
    });
    expect(buildDecisionContext(value, []).selectedFacts).toMatchObject([
      { id: "fact-existing-sketchbook", kind: "existing-item" },
    ]);
  });

  it("requires a request projection to contain exactly the selected saved facts", () => {
    const selected = profileFact();
    expect(validateDecisionContextRequest({ brief: brief(), selectedFacts: [selected] }).selectedFacts)
      .toMatchObject([{ id: "fact-recipient-interest" }]);
    expect(() => validateDecisionContextRequest({ brief: brief(), selectedFacts: [] }))
      .toThrow("exactly the saved facts");
    expect(() => validateDecisionContextRequest({
      brief: brief(),
      selectedFacts: [selected, profileFact({ id: "unselected-fact" })],
    })).toThrow("exactly the saved facts");
  });

  it("rejects budgets whose target exceeds the hard maximum", () => {
    expect(() => validateDecisionBrief(brief({
      budget: {
        currencyCode: "USD",
        targetAmount: "100.00",
        maximumAmount: "75.00",
        includesTaxes: null,
        includesFees: null,
        contingencyPercent: 0,
      },
    }))).toThrow("targetAmount cannot exceed maximumAmount");
  });

  it("rejects profile references that are not part of the decision projection", () => {
    expect(() => validateDecisionBrief(brief({ selectedFactIds: [] }))).toThrow("references a fact that is not part of this decision");
  });

  it("rejects duplicate ids, unknown fields, and invalid windows", () => {
    expect(() => validateDecisionBrief(brief({ subjectIds: ["subject-nephew", "subject-nephew"] }))).toThrow("must not contain duplicates");
    expect(() => validateDecisionBrief({ ...brief(), privateProfile: true })).toThrow("unsupported fields");
    expect(() => validateDecisionBrief(brief({
      timeWindow: { start: "2026-09-21", end: "2026-09-20", timezone: null, flexible: false },
    }))).toThrow("start cannot be later than end");
    expect(() => validateDecisionBrief(brief({
      hardConstraints: [{
        id: "nested",
        kind: "custom",
        label: "Nested input",
        value: [["not allowed"]],
        source: "current-request",
        factId: null,
      }],
    }))).toThrow("must be a string, number, or boolean");
  });
});
