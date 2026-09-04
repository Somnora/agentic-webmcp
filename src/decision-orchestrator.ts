import type { DecisionContext } from "./decision-types";
import type { PersonalizedDateResult } from "./personalized-date";
import type { PersonalizedGiftResult } from "./personalized-gift";
import type { PersonalizedStaffingResult } from "./personalized-staffing";
import type { PersonalizedVacationResult } from "./personalized-vacation";
import type { DecisionVertical } from "./profile";

export type OrchestratedDecisionVertical = "shopping" | "gift" | "date" | "vacation" | "staffing";
export type OrchestratedDecisionResult = PersonalizedGiftResult | PersonalizedDateResult | PersonalizedVacationResult | PersonalizedStaffingResult;

export type DecisionEvidence = {
  originId: string;
  source: string;
  live: boolean;
  offerCount: number;
};

export type DecisionStrategy = {
  id: "shopping-marketplace-v1" | "gift-marketplace-v1" | "date-services-v1" | "vacation-package-v1" | "staffing-provider-v1";
  vertical: OrchestratedDecisionVertical;
  originId: "catalog-lab" | "services-lab";
  resultKind: "recommendations" | "plan-packages";
  deterministic: true;
};

export type OrchestratedDecisionEnvelope = {
  version: "1";
  decisionId: string;
  revisionOf: string | null;
  vertical: OrchestratedDecisionVertical;
  goal: string;
  status: "planned" | "needs-attention";
  optionCount: number;
  strategy: DecisionStrategy;
  evidence: DecisionEvidence;
  contextProjection: {
    subjectIds: string[];
    factIds: string[];
    hardConstraintIds: string[];
    softPreferenceIds: string[];
  };
  handling: {
    persistence: "request-only";
    cache: "no-store";
    externalAction: "none";
    revisionMode: "full-context-replacement";
  };
  nextActions: Array<{
    id: "revise" | "handoff" | "remember";
    available: boolean;
    requiresHumanApproval: boolean;
    effect: string;
  }>;
  result: OrchestratedDecisionResult;
};

const STRATEGIES: Record<OrchestratedDecisionVertical, DecisionStrategy> = {
  shopping: {
    id: "shopping-marketplace-v1",
    vertical: "shopping",
    originId: "catalog-lab",
    resultKind: "recommendations",
    deterministic: true,
  },
  gift: {
    id: "gift-marketplace-v1",
    vertical: "gift",
    originId: "catalog-lab",
    resultKind: "recommendations",
    deterministic: true,
  },
  date: {
    id: "date-services-v1",
    vertical: "date",
    originId: "services-lab",
    resultKind: "plan-packages",
    deterministic: true,
  },
  vacation: {
    id: "vacation-package-v1",
    vertical: "vacation",
    originId: "services-lab",
    resultKind: "plan-packages",
    deterministic: true,
  },
  staffing: {
    id: "staffing-provider-v1",
    vertical: "staffing",
    originId: "services-lab",
    resultKind: "plan-packages",
    deterministic: true,
  },
};

const DECISION_REFERENCE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,95}$/;

export function decisionStrategy(vertical: DecisionVertical): DecisionStrategy {
  return STRATEGIES[vertical];
}

export function validateRevisionReference(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DECISION_REFERENCE_PATTERN.test(value)) {
    throw new RangeError("revisionOf must be a valid prior decision id.");
  }
  return value;
}

function resultStatus(result: OrchestratedDecisionResult): { status: "planned" | "needs-attention"; optionCount: number } {
  if ("recommendations" in result) {
    return {
      status: result.personalization.actionEligible && result.recommendations.length ? "planned" : "needs-attention",
      optionCount: result.recommendations.length,
    };
  }
  if ("crews" in result) return { status: result.status, optionCount: result.crews.length };
  if ("plans" in result) return { status: result.status, optionCount: result.plans.length };
  return { status: result.status, optionCount: result.packages.length };
}

export function orchestrateDecisionResult(
  context: DecisionContext,
  result: OrchestratedDecisionResult,
  evidence: DecisionEvidence,
  revisionOf: string | null = null,
): OrchestratedDecisionEnvelope {
  const strategy = decisionStrategy(context.brief.vertical);
  const summary = resultStatus(result);
  return {
    version: "1",
    decisionId: context.brief.id,
    revisionOf,
    vertical: strategy.vertical,
    goal: context.brief.goal,
    status: summary.status,
    optionCount: summary.optionCount,
    strategy,
    evidence,
    contextProjection: {
      subjectIds: [...context.brief.subjectIds],
      factIds: context.selectedFacts.map((fact) => fact.id),
      hardConstraintIds: context.brief.hardConstraints.map((constraint) => constraint.id),
      softPreferenceIds: context.brief.softPreferences.map((preference) => preference.id),
    },
    handling: {
      persistence: "request-only",
      cache: "no-store",
      externalAction: "none",
      revisionMode: "full-context-replacement",
    },
    nextActions: [
      {
        id: "revise",
        available: true,
        requiresHumanApproval: false,
        effect: "Submit the complete decision context again with revisionOf set to this decision id.",
      },
      {
        id: "handoff",
        available: strategy.vertical === "staffing" && "staffing" in result && result.staffing.actionEligible,
        requiresHumanApproval: true,
        effect: strategy.vertical === "staffing"
          ? "A human may review and explicitly open a controlled provider source page. Contact, quote requests, contracts, booking, and payment remain unavailable."
          : "No provider contact, booking, purchase, contract, or payment action is available from this decision.",
      },
      {
        id: "remember",
        available: strategy.vertical === "date" || strategy.vertical === "vacation",
        requiresHumanApproval: true,
        effect: strategy.vertical === "date" || strategy.vertical === "vacation"
          ? "After you report an outcome, Ribband may propose a profile change. Only a visible human approval may save it on-device."
          : "Shopping, gift-recipient, and staffing outcomes remain decision-only in the unified agent.",
      },
    ],
    result,
  };
}
