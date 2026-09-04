import type { DecisionConstraint, DecisionContext, DecisionPreference } from "./decision-types";
import { createActivityItinerary, type ActivityItinerary } from "./itinerary";
import { money, type Money, type Offer } from "./offers";
import { profileFactText, type ProfileFact } from "./profile";

export type DatePlanTier = "low-cost" | "balanced" | "special-occasion";

export type DateMatchedFact = {
  factId: string;
  subjectId: string;
  kind: ProfileFact["kind"];
  summary: string;
  matchedTerms: string[];
  explanation: string;
};

export type DateParticipantCoverage = {
  subjectId: string;
  matchedFactIds: string[];
  matchedTerms: string[];
};

export type PersonalizedDatePlan = {
  id: string;
  tier: DatePlanTier;
  label: string;
  title: string;
  score: number;
  budgetCeiling: Money;
  costRange: { min: Money; max: Money; basis: string };
  itemHandles: string[];
  matchedFacts: DateMatchedFact[];
  participantCoverage: DateParticipantCoverage[];
  balance: "both-participants" | "one-person-stretch" | "no-source-match";
  repeatedActivityMatches: string[];
  why: string;
  tradeoff: string;
  evidenceConfidence: string;
  itinerary: ActivityItinerary;
};

export type UnsupportedDateConstraint = {
  id: string;
  kind: string;
  label: string;
  reason: string;
};

export type DatePersonalization = {
  status: "applied" | "partial" | "not-applied";
  actionEligible: boolean;
  briefId: string;
  vertical: "date";
  handling: "request-only";
  appliedFacts: Array<{
    id: string;
    subjectId: string;
    kind: ProfileFact["kind"];
    summary: string;
    confidence: ProfileFact["confidence"];
    decisionOnly: boolean;
  }>;
  deferredFacts: Array<{
    id: string;
    subjectId: string;
    kind: ProfileFact["kind"];
    summary: string;
    confidence: ProfileFact["confidence"];
    decisionOnly: boolean;
    reason: string;
  }>;
  unsupportedConstraints: UnsupportedDateConstraint[];
  excludedByDislike: Array<{ handle: string; title: string; matchedTerms: string[] }>;
  note: string;
};

export type PersonalizedDateResult = {
  status: "planned" | "needs-attention";
  plans: PersonalizedDatePlan[];
  personalization: DatePersonalization;
  warning?: string;
};

type TierPolicy = {
  tier: DatePlanTier;
  label: string;
  ratio: number;
  targetItems: number;
  title: string;
  tradeoff: string;
};

type ScoredCandidate = {
  signature: string;
  offers: Offer[];
  itinerary: ActivityItinerary;
  matchedFacts: DateMatchedFact[];
  participantCoverage: DateParticipantCoverage[];
  repeatedActivityMatches: string[];
  balance: PersonalizedDatePlan["balance"];
  score: number;
  estimatedHighCents: number;
};

const TIER_POLICIES: readonly TierPolicy[] = [
  {
    tier: "low-cost",
    label: "Low-cost date",
    ratio: 0.3,
    targetItems: 1,
    title: "One strong shared experience",
    tradeoff: "The leanest plan keeps cost low by centering the date on one experience.",
  },
  {
    tier: "balanced",
    label: "Balanced date",
    ratio: 0.6,
    targetItems: 2,
    title: "Two experiences with breathing room",
    tradeoff: "This plan adds variety while preserving a conservative transition allowance.",
  },
  {
    tier: "special-occasion",
    label: "Special-occasion date",
    ratio: 1,
    targetItems: 3,
    title: "A fuller day in three acts",
    tradeoff: "This is the fullest plan and uses more of the available budget and day.",
  },
] as const;

const SUPPORTED_CONSTRAINT_KINDS = new Set([
  "location",
  "date-range",
  "party-size",
  "availability",
  "avoid",
]);
const PREFERENCE_FACT_KINDS = new Set<ProfileFact["kind"]>([
  "interest",
  "liked-experience",
  "fond-memory-signal",
]);
const DISLIKE_FACT_KINDS = new Set<ProfileFact["kind"]>([
  "avoidance",
  "disliked-experience",
]);
const STOP_WORDS = new Set([
  "about",
  "after",
  "already",
  "and",
  "for",
  "from",
  "into",
  "near",
  "that",
  "the",
  "their",
  "they",
  "this",
  "together",
  "with",
]);
const TERM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  art: ["sketch"],
  food: ["tasting"],
  ocean: ["coastal", "shore", "surf"],
  photography: ["composition", "photo"],
  quiet: ["calm"],
  stories: ["history", "story"],
  storytelling: ["history", "story"],
  walks: ["walk"],
};

function terms(value: string): string[] {
  return [...new Set(value
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term)))];
}

function factTerms(fact: ProfileFact): string[] {
  return terms(profileFactText(fact));
}

function termMatches(haystack: string, term: string): boolean {
  return haystack.includes(term) || (TERM_ALIASES[term]?.some((alias) => haystack.includes(alias)) ?? false);
}

function offerText(offer: Offer): string {
  const service = offer.service!;
  return [
    offer.title,
    offer.description,
    service.category,
    service.location.city,
    service.location.region,
    service.location.venue,
    service.provider.displayName,
  ].join(" ").toLocaleLowerCase();
}

function constraintText(constraint: DecisionConstraint): string {
  return Array.isArray(constraint.value) ? constraint.value.join(" ") : String(constraint.value);
}

function preferenceText(preference: DecisionPreference): string {
  return Array.isArray(preference.value) ? preference.value.join(" ") : String(preference.value);
}

function localDate(value: string | null): string | null {
  return value?.slice(0, 10) ?? null;
}

function localClock(value: string | null, fallback: string): string {
  const match = value?.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? fallback;
}

function weekday(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

function partySize(context: DecisionContext): number {
  const constraint = context.brief.hardConstraints.find((item) => item.kind === "party-size");
  const value = constraint?.value;
  const parsed = typeof value === "number" ? value : Number(Array.isArray(value) ? value[0] : value ?? 2);
  if (!Number.isInteger(parsed) || parsed !== 2) throw new RangeError("Personalized date planning currently requires a party size of 2.");
  return parsed;
}

function maximumBudgetCents(context: DecisionContext): number {
  const budget = context.brief.budget;
  if (!budget || budget.currencyCode !== "USD") throw new RangeError("Personalized date planning currently requires a USD budget.");
  const amount = Number(budget.maximumAmount ?? budget.targetAmount);
  if (!Number.isFinite(amount) || amount < 25 || amount > 100_000) {
    throw new RangeError("Personalized date planning requires a valid maximum budget.");
  }
  return Math.round(amount * 100);
}

function locationMatches(offer: Offer, context: DecisionContext): boolean {
  const location = context.brief.location;
  if (!location || !offer.service) return false;
  if (location.countryCode && location.countryCode !== offer.service.location.countryCode) return false;
  const haystack = `${offer.service.location.city} ${offer.service.location.region}`.toLocaleLowerCase();
  const required = terms([location.label, location.city ?? "", location.region ?? ""].join(" "));
  return required.length === 0 || required.every((term) => termMatches(haystack, term));
}

function combinations<T>(values: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const output: T[][] = [];
  for (let index = 0; index <= values.length - size; index += 1) {
    for (const tail of combinations(values.slice(index + 1), size - 1)) {
      output.push([values[index]!, ...tail]);
    }
  }
  return output;
}

function estimateHighCents(publishedCents: number, context: DecisionContext): number {
  const budget = context.brief.budget!;
  if (budget.includesTaxes === true && budget.includesFees === true) return publishedCents;
  return Math.ceil((publishedCents * (100 + budget.contingencyPercent)) / 100);
}

function preferenceFacts(context: DecisionContext): ProfileFact[] {
  return context.selectedFacts.filter((fact) => PREFERENCE_FACT_KINDS.has(fact.kind));
}

function previousFacts(context: DecisionContext): ProfileFact[] {
  return context.selectedFacts.filter((fact) => fact.kind === "previous-activity");
}

function dislikeFacts(context: DecisionContext): ProfileFact[] {
  return context.selectedFacts.filter((fact) => DISLIKE_FACT_KINDS.has(fact.kind));
}

function noveltyValue(context: DecisionContext): string {
  return context.brief.softPreferences
    .filter((preference) => preference.kind === "novelty")
    .map(preferenceText)
    .join(" ")
    .toLocaleLowerCase();
}

function moodTerms(context: DecisionContext): string[] {
  return context.brief.softPreferences
    .filter((preference) => preference.kind === "theme")
    .flatMap((preference) => terms(preferenceText(preference)));
}

function matchedFactsForOffers(facts: readonly ProfileFact[], offers: readonly Offer[]): DateMatchedFact[] {
  const haystack = offers.map(offerText).join(" ");
  return facts.flatMap((fact) => {
    const matchedTerms = factTerms(fact).filter((term) => termMatches(haystack, term));
    if (!matchedTerms.length) return [];
    return [{
      factId: fact.id,
      subjectId: fact.subjectId,
      kind: fact.kind,
      summary: profileFactText(fact),
      matchedTerms: matchedTerms.slice(0, 5),
      explanation: `Source descriptions match ${matchedTerms.slice(0, 3).join(", ")}.`,
    }];
  });
}

function participantCoverage(context: DecisionContext, matches: readonly DateMatchedFact[]): DateParticipantCoverage[] {
  return context.brief.subjectIds.map((subjectId) => {
    const subjectMatches = matches.filter((match) => match.subjectId === subjectId);
    return {
      subjectId,
      matchedFactIds: [...new Set(subjectMatches.map((match) => match.factId))],
      matchedTerms: [...new Set(subjectMatches.flatMap((match) => match.matchedTerms))],
    };
  });
}

function repeatedMatches(context: DecisionContext, offers: readonly Offer[]): string[] {
  if (!noveltyValue(context).includes("new")) return [];
  const haystack = offers.map(offerText).join(" ");
  return [...new Set(previousFacts(context)
    .flatMap(factTerms)
    .filter((term) => termMatches(haystack, term)))].slice(0, 8);
}

function scoreCandidate(
  context: DecisionContext,
  offers: readonly Offer[],
  matches: readonly DateMatchedFact[],
  coverage: readonly DateParticipantCoverage[],
  repeats: readonly string[],
  itinerary: ActivityItinerary,
  targetItems: number,
  tierCeilingCents: number,
): number {
  const matchedTermCount = new Set(matches.flatMap((match) => match.matchedTerms)).size;
  const coveredParticipants = coverage.filter((item) => item.matchedFactIds.length).length;
  const moodMatchCount = moodTerms(context).filter((term) => offers.some((offer) => termMatches(offerText(offer), term))).length;
  const verifiedCount = offers.filter((offer) => offer.provenance.verification.state === "verified").length;
  const publishedCents = Math.round(Number(itinerary.publishedPriceTotal.amount) * 100);
  const budgetUse = tierCeilingCents > 0 ? Math.min(1, publishedCents / tierCeilingCents) : 0;
  const transitions = itinerary.items.reduce((sum, item) => sum + item.transitionBufferMinutes, 0);
  const raw = 18
    + Math.min(34, matchedTermCount * 6)
    + (coveredParticipants === context.brief.subjectIds.length ? 22 : coveredParticipants ? 10 : 0)
    + Math.min(8, moodMatchCount * 4)
    + Math.min(8, verifiedCount * 3)
    + (offers.length === targetItems ? 7 : 0)
    + budgetUse * 6
    - repeats.length * 7
    - Math.min(5, transitions / 30);
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

function candidateFor(
  context: DecisionContext,
  offers: Offer[],
  date: string,
  targetItems: number,
  tierCeilingCents: number,
): ScoredCandidate | null {
  const itinerary = createActivityItinerary({
    goal: context.brief.goal,
    date,
    days: 1,
    partySize: partySize(context),
    budget: tierCeilingCents / 100,
    pace: offers.length >= 3 ? "full" : "balanced",
    earliestStart: localClock(context.brief.timeWindow?.start ?? null, "08:00"),
    latestEnd: localClock(context.brief.timeWindow?.end ?? null, "20:00"),
  }, offers);
  if (itinerary.conflicts.length || itinerary.items.filter((item) => item.status === "scheduled").length !== offers.length) return null;
  const publishedCents = Math.round(Number(itinerary.publishedPriceTotal.amount) * 100);
  const estimatedHighCents = estimateHighCents(publishedCents, context);
  if (estimatedHighCents > tierCeilingCents) return null;
  const matches = matchedFactsForOffers(preferenceFacts(context), offers);
  const coverage = participantCoverage(context, matches);
  const repeats = repeatedMatches(context, offers);
  const covered = coverage.filter((item) => item.matchedFactIds.length).length;
  const balance: PersonalizedDatePlan["balance"] = covered === context.brief.subjectIds.length
    ? "both-participants"
    : covered ? "one-person-stretch" : "no-source-match";
  return {
    signature: offers.map((offer) => offer.handle).sort().join("|"),
    offers,
    itinerary,
    matchedFacts: matches,
    participantCoverage: coverage,
    repeatedActivityMatches: repeats,
    balance,
    score: scoreCandidate(context, offers, matches, coverage, repeats, itinerary, targetItems, tierCeilingCents),
    estimatedHighCents,
  };
}

function bestCandidate(
  context: DecisionContext,
  offers: Offer[],
  date: string,
  policy: TierPolicy,
  tierCeilingCents: number,
): ScoredCandidate | null {
  if (offers.length < policy.targetItems) return null;
  const candidates = combinations(offers, policy.targetItems)
    .flatMap((combination) => {
      const candidate = candidateFor(context, combination, date, policy.targetItems, tierCeilingCents);
      return candidate ? [candidate] : [];
    })
    .sort((left, right) => (
      right.score - left.score
      || Number(left.itinerary.publishedPriceTotal.amount) - Number(right.itinerary.publishedPriceTotal.amount)
      || left.signature.localeCompare(right.signature)
    ));
  return candidates[0] ?? null;
}

function appliedFact(fact: ProfileFact, context: DecisionContext) {
  return {
    id: fact.id,
    subjectId: fact.subjectId,
    kind: fact.kind,
    summary: profileFactText(fact),
    confidence: fact.confidence,
    decisionOnly: context.brief.decisionOnlyFacts.some((candidate) => candidate.id === fact.id),
  };
}

function unavailableResult(
  context: DecisionContext,
  unsupportedConstraints: UnsupportedDateConstraint[],
  excludedByDislike: DatePersonalization["excludedByDislike"],
  warning: string,
): PersonalizedDateResult {
  return {
    status: "needs-attention",
    plans: [],
    warning,
    personalization: {
      status: context.selectedFacts.length ? "partial" : "not-applied",
      actionEligible: false,
      briefId: context.brief.id,
      vertical: "date",
      handling: "request-only",
      appliedFacts: [],
      deferredFacts: context.selectedFacts.map((fact) => ({
        ...appliedFact(fact, context),
        reason: "No complete date plan could apply this fact under the current constraints.",
      })),
      unsupportedConstraints,
      excludedByDislike,
      note: warning,
    },
  };
}

export function createPersonalizedDatePlans(
  context: DecisionContext,
  offers: Offer[],
  generatedAt = new Date().toISOString(),
): PersonalizedDateResult {
  if (context.brief.vertical !== "date") throw new RangeError("Personalized date planning requires a date decision brief.");
  if (context.brief.subjectIds.length !== 2) throw new RangeError("Personalized date planning currently requires exactly two profile subjects.");
  if (context.brief.output !== "package") throw new RangeError("Personalized date planning requires package output.");
  const date = localDate(context.brief.timeWindow?.start ?? null);
  if (!date || date !== localDate(context.brief.timeWindow?.end ?? null)) {
    throw new RangeError("Personalized date planning requires one calendar date in the decision time window.");
  }
  const maximumCents = maximumBudgetCents(context);
  const party = partySize(context);
  const unsupportedConstraints = context.brief.hardConstraints
    .filter((constraint) => !SUPPORTED_CONSTRAINT_KINDS.has(constraint.kind))
    .map((constraint) => ({
      id: constraint.id,
      kind: constraint.kind,
      label: constraint.label,
      reason: "The current service Offer contract does not expose evidence for this hard constraint yet.",
    }));
  if (unsupportedConstraints.length) {
    return unavailableResult(
      context,
      unsupportedConstraints,
      [],
      "Date plans are withheld because at least one hard constraint cannot be verified from current Offer evidence.",
    );
  }
  if (offers.some((offer) => offer.vertical !== "services" || !offer.service)) {
    throw new RangeError("Personalized date planning requires normalized service Offers.");
  }
  const day = weekday(date);
  const candidateOffers = offers.filter((offer) => (
    offer.service!.itineraryEligible
    && (offer.service!.category === "activity" || offer.service!.category === "wellness")
    && offer.source.live
    && offer.provenance.verification.state !== "conflict"
    && offer.constraints.available
    && locationMatches(offer, context)
    && party >= offer.service!.partySize.min
    && party <= offer.service!.partySize.max
    && offer.service!.scheduling.windows.some((window) => window.weekday === day)
  ));
  const dislikes = dislikeFacts(context);
  const hardAvoidTerms = [
    ...dislikes.flatMap(factTerms),
    ...context.brief.hardConstraints.filter((constraint) => constraint.kind === "avoid").flatMap((constraint) => terms(constraintText(constraint))),
  ];
  const excludedByDislike = candidateOffers.flatMap((offer) => {
    const matchedTerms = [...new Set(hardAvoidTerms.filter((term) => termMatches(offerText(offer), term)))];
    return matchedTerms.length ? [{ handle: offer.handle, title: offer.title, matchedTerms }] : [];
  });
  const excludedHandles = new Set(excludedByDislike.map((item) => item.handle));
  const eligibleOffers = candidateOffers.filter((offer) => !excludedHandles.has(offer.handle));
  if (!eligibleOffers.length) {
    return unavailableResult(
      context,
      [],
      excludedByDislike,
      "No source-backed services remain after location, schedule, party-size, and hard-dislike filtering.",
    );
  }
  const plans: PersonalizedDatePlan[] = [];
  for (const policy of TIER_POLICIES) {
    const tierCeilingCents = Math.max(2500, Math.floor(maximumCents * policy.ratio));
    const candidate = bestCandidate(context, eligibleOffers, date, policy, tierCeilingCents);
    if (!candidate) continue;
    const publishedCents = Math.round(Number(candidate.itinerary.publishedPriceTotal.amount) * 100);
    const matchedParticipants = candidate.participantCoverage.filter((item) => item.matchedFactIds.length).length;
    const matchDescription = matchedParticipants === context.brief.subjectIds.length
      ? "Source descriptions include selected interests from both participants"
      : matchedParticipants ? "The plan matches one participant directly and leaves the other as a visible stretch" : "No selected interest matched source text";
    plans.push({
      id: `${context.brief.id}-${policy.tier}`,
      tier: policy.tier,
      label: policy.label,
      title: policy.title,
      score: candidate.score,
      budgetCeiling: money(tierCeilingCents / 100, "USD"),
      costRange: {
        min: money(publishedCents / 100, "USD"),
        max: money(candidate.estimatedHighCents / 100, "USD"),
        basis: context.brief.budget!.includesTaxes === true && context.brief.budget!.includesFees === true
          ? "Published service total"
          : `Published total plus ${context.brief.budget!.contingencyPercent}% planning contingency; unknown taxes or fees are not treated as zero`,
      },
      itemHandles: candidate.offers.map((offer) => offer.handle),
      matchedFacts: candidate.matchedFacts,
      participantCoverage: candidate.participantCoverage,
      balance: candidate.balance,
      repeatedActivityMatches: candidate.repeatedActivityMatches,
      why: `${matchDescription}. The estimated high total stays within the ${money(tierCeilingCents / 100, "USD").amount} USD tier ceiling.`,
      tradeoff: candidate.repeatedActivityMatches.length
        ? `${policy.tradeoff} Novelty tradeoff: source text overlaps a previous activity on ${candidate.repeatedActivityMatches.join(", ")}.`
        : policy.tradeoff,
      evidenceConfidence: candidate.offers.every((offer) => offer.provenance.verification.state === "verified")
        ? "Verified across service JSON and page data"
        : "Current controlled service source",
      itinerary: { ...candidate.itinerary, generatedAt },
    });
  }
  if (!plans.length) {
    return unavailableResult(
      context,
      [],
      excludedByDislike,
      "No complete date plan fits the selected day, published windows, and budget ceilings.",
    );
  }
  const appliedIds = new Set([
    ...plans.flatMap((plan) => plan.matchedFacts.map((match) => match.factId)),
    ...(noveltyValue(context).includes("new") ? previousFacts(context).map((fact) => fact.id) : []),
    ...dislikes.filter((fact) => excludedByDislike.some((item) => factTerms(fact).some((term) => item.matchedTerms.includes(term)))).map((fact) => fact.id),
  ]);
  const applied = context.selectedFacts.filter((fact) => appliedIds.has(fact.id));
  const deferred = context.selectedFacts.filter((fact) => !appliedIds.has(fact.id));
  const status = applied.length === 0 ? "not-applied" : deferred.length ? "partial" : "applied";
  return {
    status: plans.length === TIER_POLICIES.length ? "planned" : "needs-attention",
    plans,
    ...(plans.length < TIER_POLICIES.length ? { warning: "Some cost bands had no complete plan under the selected constraints." } : {}),
    personalization: {
      status,
      actionEligible: true,
      briefId: context.brief.id,
      vertical: "date",
      handling: "request-only",
      appliedFacts: applied.map((fact) => appliedFact(fact, context)),
      deferredFacts: deferred.map((fact) => ({
        ...appliedFact(fact, context),
        reason: PREFERENCE_FACT_KINDS.has(fact.kind)
          ? "No selected plan had matching source terms for this fact."
          : "This fact type is validated but is not part of the current date scoring strategy.",
      })),
      unsupportedConstraints: [],
      excludedByDislike,
      note: "Only the two participants' selected facts were used. Nothing was saved by the Worker, and every plan remains planning-only.",
    },
  };
}
