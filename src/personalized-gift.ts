import type { DecisionContext, RetailIntent } from "./decision-types";
import type { Offer } from "./offers";
import { profileFactText, type ProfileFact, type SubjectKind } from "./profile";
import {
  validateRecommendationIntent,
  type Recommendation,
  type RecommendationIntent,
  type RecommendationResult,
} from "./recommendations";

export type AppliedProfileFact = {
  id: string;
  kind: ProfileFact["kind"];
  summary: string;
  confidence: ProfileFact["confidence"];
  decisionOnly: boolean;
};

export type DeferredProfileFact = AppliedProfileFact & {
  reason: string;
};

export type UnsupportedGiftConstraint = {
  id: string;
  kind: string;
  label: string;
  reason: string;
};

export type PersonalizedRecommendation = Recommendation & {
  matchedFacts: Array<{
    factId: string;
    kind: ProfileFact["kind"];
    explanation: string;
  }>;
};

export type GiftPersonalization = {
  status: "applied" | "partial" | "not-applied";
  actionEligible: boolean;
  briefId: string;
  vertical: "gift";
  handling: "request-only";
  appliedFacts: AppliedProfileFact[];
  deferredFacts: DeferredProfileFact[];
  unsupportedConstraints: UnsupportedGiftConstraint[];
  note: string;
};

export type PersonalizedGiftResult = Omit<RecommendationResult, "recommendations"> & {
  recommendations: PersonalizedRecommendation[];
  personalization: GiftPersonalization;
};

const TASTE_FACT_KINDS = new Set<ProfileFact["kind"]>([
  "interest",
  "liked-experience",
  "fond-memory-signal",
]);
const AVOID_FACT_KINDS = new Set<ProfileFact["kind"]>([
  "avoidance",
  "disliked-experience",
]);
const SUPPORTED_CONSTRAINT_KINDS = new Set(["must-have", "avoid", "existing-item"]);
const STOP_WORDS = new Set(["and", "for", "from", "into", "near", "that", "the", "their", "they", "this", "with"]);

function compactJoin(values: readonly string[], maximum: number, separator = " "): string | null {
  let output = "";
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.replace(/\s+/g, " ").trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    const candidate = output ? `${output}${separator}${normalized}` : normalized;
    if (candidate.length <= maximum) {
      output = candidate;
      continue;
    }
    if (!output) output = normalized.slice(0, maximum).trim();
  }
  return output || null;
}

function textValues(facts: readonly ProfileFact[]): string[] {
  return facts.map(profileFactText);
}

function constraintValues(context: DecisionContext, kind: "must-have" | "avoid"): string[] {
  return context.brief.hardConstraints
    .filter((constraint) => constraint.kind === kind)
    .map((constraint) => Array.isArray(constraint.value) ? constraint.value.join(" ") : String(constraint.value));
}

function appliedFact(fact: ProfileFact, context: DecisionContext): AppliedProfileFact {
  return {
    id: fact.id,
    kind: fact.kind,
    summary: profileFactText(fact),
    confidence: fact.confidence,
    decisionOnly: context.brief.decisionOnlyFacts.some((candidate) => candidate.id === fact.id),
  };
}

export function giftRecommendationIntent(
  context: DecisionContext,
  explicitInput: Record<string, unknown> = {},
  now = Date.now(),
): RecommendationIntent {
  if (context.brief.vertical !== "gift") throw new RangeError("Gift personalization requires a gift decision brief.");
  const intent = (explicitInput.intent as RetailIntent | undefined) ?? context.brief.intent ?? "gift";
  const subjectKind = (explicitInput.subjectKind as SubjectKind | undefined)
    ?? context.brief.subjectKind
    ?? (context.brief.subjectIds.some((id) => id.includes("self")) ? "self" : "recipient");
  if (intent === "self-treat" && subjectKind !== "self") {
    throw new RangeError("self-treat intent requires a self subject.");
  }
  const deadline = (explicitInput.occasionDeadline as string | undefined) ?? context.brief.occasionDeadline;
  if (deadline && Date.parse(deadline) < now) {
    throw new RangeError("Occasion deadline cannot be in the past.");
  }
  const explicit = validateRecommendationIntent(explicitInput);
  const tasteFacts = context.selectedFacts.filter((fact) => TASTE_FACT_KINDS.has(fact.kind));
  const avoidFacts = context.selectedFacts.filter((fact) => AVOID_FACT_KINDS.has(fact.kind));
  const tasteContext = compactJoin([explicit.tasteContext ?? "", ...textValues(tasteFacts)], 120);
  const mustHave = compactJoin([explicit.mustHave ?? "", ...constraintValues(context, "must-have")], 80);
  const avoid = compactJoin([explicit.avoid ?? "", ...textValues(avoidFacts), ...constraintValues(context, "avoid")], 80, ", ");
  return validateRecommendationIntent({
    ...explicit,
    shoppingFor: intent === "self-treat" ? "self" : "gift",
    tasteContext,
    mustHave,
    avoid,
  });
}

export function matchesExistingItem(offer: Offer, fact: ProfileFact): boolean {
  const terms = significantTerms(fact);
  if (!terms.length) return false;
  const haystack = `${offer.title} ${offer.handle}`.toLocaleLowerCase();
  if (terms.length <= 2) {
    return terms.every((term) => haystack.includes(term));
  }
  const matchCount = terms.filter((term) => haystack.includes(term)).length;
  return matchCount >= Math.ceil(terms.length * 0.75);
}

function offerSearchText(offer: Offer): string {
  return [
    offer.title,
    offer.description,
    offer.vendor ?? "",
    offer.productType ?? "",
    offer.marketplace?.conditionDescription ?? "",
  ].join(" ").toLocaleLowerCase();
}

function significantTerms(fact: ProfileFact): string[] {
  return profileFactText(fact)
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function matchedFacts(offer: Offer, facts: readonly ProfileFact[]): PersonalizedRecommendation["matchedFacts"] {
  const haystack = offerSearchText(offer);
  return facts.flatMap((fact) => {
    const terms = significantTerms(fact).filter((term) => haystack.includes(term));
    if (!terms.length) return [];
    return [{
      factId: fact.id,
      kind: fact.kind,
      explanation: `The source listing matches: ${terms.slice(0, 3).join(", ")}.`,
    }];
  });
}

export function personalizeGiftResult(
  result: RecommendationResult,
  context: DecisionContext,
): PersonalizedGiftResult {
  if (context.brief.vertical !== "gift") throw new RangeError("Gift personalization requires a gift decision brief.");
  const intent = context.brief.intent ?? "gift";
  const existingItemFacts = context.selectedFacts.filter((fact) => fact.kind === "existing-item");
  const maxAmount = context.brief.budget?.maximumAmount ? Number(context.brief.budget.maximumAmount) : null;
  const budgetCurrency = context.brief.budget?.currencyCode ?? null;

  const factWasApplied = (fact: ProfileFact): boolean => {
    if (fact.kind === "existing-item") return true;
    const summary = profileFactText(fact).toLocaleLowerCase();
    if (TASTE_FACT_KINDS.has(fact.kind)) return result.goal.intent.tasteContext?.toLocaleLowerCase().includes(summary) ?? false;
    if (AVOID_FACT_KINDS.has(fact.kind)) return result.goal.intent.avoid?.toLocaleLowerCase().includes(summary) ?? false;
    return false;
  };
  const applied = context.selectedFacts.filter(factWasApplied);
  const deferred = context.selectedFacts.filter((fact) => !factWasApplied(fact));
  const unsupportedConstraints = context.brief.hardConstraints
    .filter((constraint) => !SUPPORTED_CONSTRAINT_KINDS.has(constraint.kind))
    .map((constraint) => ({
      id: constraint.id,
      kind: constraint.kind,
      label: constraint.label,
      reason: "The current marketplace Offer contract does not expose evidence for this hard constraint yet.",
    }));
  const actionEligible = unsupportedConstraints.length === 0;

  const isOfferDisqualified = (offer: Offer): boolean => {
    if (existingItemFacts.some((fact) => matchesExistingItem(offer, fact))) {
      return true;
    }
    if (intent === "self-treat" && maxAmount !== null) {
      if (Number(offer.priceRange.min.amount) > maxAmount) return true;
      if (budgetCurrency !== null && offer.priceRange.min.currencyCode !== budgetCurrency) return true;
    }
    return false;
  };

  const qualifiedOffers = result.offers.filter((offer) => !isOfferDisqualified(offer));
  const qualifiedHandles = new Set(qualifiedOffers.map((offer) => offer.handle));
  const offersByHandle = new Map(qualifiedOffers.map((offer) => [offer.handle, offer]));

  const recommendations = actionEligible
    ? result.recommendations
      .filter((recommendation) => qualifiedHandles.has(recommendation.handle))
      .map((recommendation) => {
        const offer = offersByHandle.get(recommendation.handle);
        return { ...recommendation, matchedFacts: offer ? matchedFacts(offer, applied) : [] };
      })
    : [];
  const status = applied.length === 0
    ? "not-applied"
    : deferred.length || unsupportedConstraints.length ? "partial" : "applied";
  const note = actionEligible
    ? "Only the facts selected for this request were applied. Nothing was saved by the Worker."
    : "Recommendations are withheld because at least one hard constraint cannot be verified from the current Offer evidence.";
  return {
    ...result,
    offers: actionEligible ? qualifiedOffers : [],
    recommendations,
    ...(!actionEligible ? { warning: note } : {}),
    personalization: {
      status,
      actionEligible,
      briefId: context.brief.id,
      vertical: "gift",
      handling: "request-only",
      appliedFacts: applied.map((fact) => appliedFact(fact, context)),
      deferredFacts: deferred.map((fact) => ({
        ...appliedFact(fact, context),
        reason: TASTE_FACT_KINDS.has(fact.kind) || AVOID_FACT_KINDS.has(fact.kind) || fact.kind === "existing-item"
          ? "This fact did not fit within the current marketplace context limit and was not scored."
          : "This fact type is validated but is not part of the current marketplace scoring strategy.",
      })),
      unsupportedConstraints,
      note,
    },
  };
}

export function giftBudgetInput(context: DecisionContext, explicit: string | null): string | null {
  const maximum = context.brief.budget?.maximumAmount ?? null;
  if (explicit !== null && maximum !== null) return Math.min(Number(explicit), Number(maximum)).toFixed(2);
  return explicit ?? maximum ?? context.brief.budget?.targetAmount ?? null;
}
