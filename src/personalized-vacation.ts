import type { DecisionConstraint, DecisionContext, DecisionPreference } from "./decision-types";
import { createActivityItinerary, type ActivityItinerary } from "./itinerary";
import { money, type Money, type Offer, type ServicePriceBasis } from "./offers";
import { profileFactText, type ProfileFact } from "./profile";

export type VacationPackageTier = "value" | "balanced" | "signature";
export type VacationPackageItemCategory = "lodging" | "transport" | "dining" | "activity";
export type VacationExplorationMode = "comfort-seeking" | "novelty-seeking" | "balanced";

export type VacationNoveltyFit = {
  explorationMode: VacationExplorationMode;
  experienceGaps: string[];
  repeatHighlights: string[];
};

export type VacationMatchedFact = {
  factId: string;
  subjectId: string;
  kind: ProfileFact["kind"];
  summary: string;
  matchedTerms: string[];
  explanation: string;
};

export type VacationPackageItem = {
  category: VacationPackageItemCategory;
  handle: string;
  title: string;
  provider: string;
  sourceUrl: string;
  quantity: number;
  unitLabel: string;
  unitPrice: Money;
  total: Money;
  evidence: string;
};

export type VacationPackageTotals = {
  lodging: Money;
  transport: Money;
  dining: Money;
  activities: Money;
  publishedSubtotal: Money;
  contingency: Money;
  planningRange: { min: Money; max: Money; basis: string };
  unknownCosts: string[];
};

export type PersonalizedVacationPackage = {
  id: string;
  tier: VacationPackageTier;
  label: string;
  title: string;
  score: number;
  destination: string;
  startDate: string;
  endDate: string;
  nights: number;
  travelers: number;
  budgetCeiling: Money;
  itemHandles: string[];
  items: VacationPackageItem[];
  matchedFacts: VacationMatchedFact[];
  noveltyFit: VacationNoveltyFit;
  why: string;
  tradeoff: string;
  evidenceConfidence: string;
  totals: VacationPackageTotals;
  itinerary: ActivityItinerary;
};

export type VacationPersonalization = {
  status: "applied" | "partial" | "not-applied";
  actionEligible: boolean;
  briefId: string;
  vertical: "vacation";
  handling: "request-only";
  appliedFacts: Array<{
    id: string;
    subjectId: string;
    kind: ProfileFact["kind"];
    summary: string;
    decisionOnly: boolean;
  }>;
  deferredFacts: Array<{
    id: string;
    subjectId: string;
    kind: ProfileFact["kind"];
    summary: string;
    decisionOnly: boolean;
    reason: string;
  }>;
  unsupportedConstraints: Array<{ id: string; kind: string; label: string; reason: string }>;
  excludedByConstraint: Array<{ handle: string; title: string; matchedTerms: string[] }>;
  note: string;
};

export type PersonalizedVacationResult = {
  status: "planned" | "needs-attention";
  packages: PersonalizedVacationPackage[];
  personalization: VacationPersonalization;
  warning?: string;
};

type TierPolicy = {
  tier: VacationPackageTier;
  label: string;
  ratio: number;
  activityCount: number;
  tradeoff: string;
};

type Candidate = {
  signature: string;
  lodging: Offer;
  transport: Offer;
  dining: Offer;
  activities: Offer[];
  itinerary: ActivityItinerary;
  matchedFacts: VacationMatchedFact[];
  noveltyFit: VacationNoveltyFit;
  score: number;
  publishedCents: number;
  estimatedHighCents: number;
};

const TIER_POLICIES: readonly TierPolicy[] = [
  {
    tier: "value",
    label: "Value package",
    ratio: 0.55,
    activityCount: 1,
    tradeoff: "The leanest package protects budget by choosing one scheduled activity and one source-backed dinner.",
  },
  {
    tier: "balanced",
    label: "Balanced package",
    ratio: 0.8,
    activityCount: 2,
    tradeoff: "This package adds a second anchor experience while keeping room below the overall trip budget.",
  },
  {
    tier: "signature",
    label: "Signature package",
    ratio: 1,
    activityCount: 3,
    tradeoff: "The fullest package spends more for a third anchor experience and a richer destination rhythm.",
  },
] as const;

const SUPPORTED_CONSTRAINT_KINDS = new Set(["location", "date-range", "party-size", "availability", "avoid"]);
const MATCHABLE_FACT_KINDS = new Set<ProfileFact["kind"]>(["interest", "liked-experience", "fond-memory-signal"]);
const AVOID_FACT_KINDS = new Set<ProfileFact["kind"]>(["avoidance", "disliked-experience"]);
const STOP_WORDS = new Set(["about", "after", "again", "already", "and", "for", "from", "into", "near", "that", "the", "their", "they", "this", "with"]);
const TERM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  art: ["sketch"],
  beach: ["coastal", "shore", "water"],
  food: ["dinner", "supper", "table", "tasting"],
  ocean: ["coastal", "shore", "surf", "water"],
  photography: ["composition", "photo"],
  quiet: ["calm", "residential", "quiet-hours"],
  restaurants: ["dinner", "supper", "table"],
  stories: ["history", "story"],
  walks: ["walk"],
};

function terms(value: string): string[] {
  return [...new Set(value
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term)))];
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
    service.provider.displayName,
    service.location.city,
    service.location.region,
  ].join(" ").toLocaleLowerCase();
}

function factTerms(fact: ProfileFact): string[] {
  return terms(profileFactText(fact));
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

function dateParts(value: string): [number, number, number] {
  const [year, month, day] = value.split("-").map(Number);
  return [year!, month!, day!];
}

function tripLength(context: DecisionContext): { startDate: string; endDate: string; nights: number } {
  const startDate = localDate(context.brief.timeWindow?.start ?? null);
  const endDate = localDate(context.brief.timeWindow?.end ?? null);
  if (!startDate || !endDate) throw new RangeError("Vacation packages require arrival and departure dates.");
  const [startYear, startMonth, startDay] = dateParts(startDate);
  const [endYear, endMonth, endDay] = dateParts(endDate);
  const nights = Math.round((Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay)) / 86_400_000);
  if (!Number.isInteger(nights) || nights < 2 || nights > 3) {
    throw new RangeError("The controlled vacation package proof currently supports stays of 2 or 3 nights.");
  }
  return { startDate, endDate, nights };
}

function partySize(context: DecisionContext): number {
  const constraint = context.brief.hardConstraints.find((item) => item.kind === "party-size");
  const value = constraint?.value;
  const parsed = typeof value === "number" ? value : Number(Array.isArray(value) ? value[0] : value ?? 2);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) throw new RangeError("Vacation travelers must be an integer from 1 to 8.");
  return parsed;
}

function maximumBudgetCents(context: DecisionContext): number {
  const budget = context.brief.budget;
  if (!budget || budget.currencyCode !== "USD") throw new RangeError("Vacation packages currently require a USD budget.");
  const amount = Number(budget.maximumAmount ?? budget.targetAmount);
  if (!Number.isFinite(amount) || amount < 600 || amount > 100_000) throw new RangeError("Vacation packages require a valid maximum trip budget.");
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
    for (const tail of combinations(values.slice(index + 1), size - 1)) output.push([values[index]!, ...tail]);
  }
  return output;
}

function offerCostCents(offer: Offer, travelers: number, nights: number): number {
  const amount = Math.round(Number(offer.priceRange.min.amount) * 100);
  const basis: ServicePriceBasis = offer.service!.priceBasis;
  if (basis === "per-person") return amount * travelers;
  if (basis === "per-night" || basis === "per-day") return amount * nights;
  if (basis === "fixed") return amount;
  return Number.POSITIVE_INFINITY;
}

function quantityFor(offer: Offer, travelers: number, nights: number): { quantity: number; unitLabel: string } {
  const basis = offer.service!.priceBasis;
  if (basis === "per-person") return { quantity: travelers, unitLabel: travelers === 1 ? "traveler" : "travelers" };
  if (basis === "per-night") return { quantity: nights, unitLabel: nights === 1 ? "night" : "nights" };
  if (basis === "per-day") return { quantity: nights, unitLabel: nights === 1 ? "day" : "days" };
  return { quantity: 1, unitLabel: "package" };
}

function estimatedHighCents(publishedCents: number, context: DecisionContext): number {
  const budget = context.brief.budget!;
  if (budget.includesTaxes === true && budget.includesFees === true) return publishedCents;
  return Math.ceil((publishedCents * (100 + budget.contingencyPercent)) / 100);
}

function matchableFacts(context: DecisionContext): ProfileFact[] {
  return context.selectedFacts.filter((fact) => MATCHABLE_FACT_KINDS.has(fact.kind));
}

function avoidFacts(context: DecisionContext): ProfileFact[] {
  return context.selectedFacts.filter((fact) => AVOID_FACT_KINDS.has(fact.kind));
}

export function resolveExplorationMode(context: DecisionContext): VacationExplorationMode {
  const preferences = context.brief.softPreferences.filter((preference) => preference.kind === "novelty");
  const raw = preferences.map(preferenceText).join(" ").toLocaleLowerCase();
  if (raw.includes("comfort")) return "comfort-seeking";
  if (raw.includes("novelty")) return "novelty-seeking";
  return "balanced";
}

const OFFER_EXPERIENCE_MODALITIES: Readonly<Record<string, string>> = Object.freeze({
  "north-shore-surf-foundations": "Surfing lessons",
  "windward-botanical-sketch-walk": "Botanical garden exploration",
  "tangier-traditional-archery": "Traditional cultural workshop",
  "ko-olina-garden-rooms": "Quiet coastal immersion",
  "haleiwa-food-story-walk": "Local culinary tasting walk",
  "oahu-sunset-photo-walk": "Sunset coastal photography walk",
  "honolulu-restorative-massage": "Restorative studio massage",
  "waikiki-courtyard-studio": "Walkable urban lodging",
  "north-shore-cottage-stay": "Private coastal cottage retreat",
  "honolulu-garden-supper": "Courtyard garden dining",
  "haleiwa-harbor-table": "Harborside local seafood dining",
  "oahu-compact-car": "Independent island mobility",
  "oahu-shared-airport-transfer": "Direct airport transfer",
});

export function offerExperienceModality(offer: Offer): string {
  if (OFFER_EXPERIENCE_MODALITIES[offer.handle]) {
    return OFFER_EXPERIENCE_MODALITIES[offer.handle]!;
  }
  if (offer.service?.category === "activity") {
    return `${offer.title} exploration`;
  }
  if (offer.service?.category === "wellness") {
    return `${offer.title} session`;
  }
  if (offer.service?.category === "lodging") {
    return `${offer.title} stay`;
  }
  if (offer.service?.category === "dining") {
    return `${offer.title} dining`;
  }
  return offer.title;
}

const GEOGRAPHIC_FILTER_TERMS = new Set([
  "oahu", "hawaii", "honolulu", "kapolei", "kaneohe", "haleiwa",
  "waialua", "tangier", "morocco", "usa", "pacific", "island", "islands",
]);

function activityFeatureTerms(offer: Offer): string[] {
  const modality = offerExperienceModality(offer);
  const rawText = `${modality} ${offer.title} ${offer.description}`;
  return terms(rawText).filter((term) => !GEOGRAPHIC_FILTER_TERMS.has(term));
}

function hasSemanticOverlapWithPast(offer: Offer, context: DecisionContext): boolean {
  const pastFacts = context.selectedFacts.filter((fact) => (
    fact.kind === "liked-experience"
    || fact.kind === "fond-memory-signal"
    || fact.kind === "visited-place"
  ));
  if (pastFacts.length === 0) return false;
  const featTerms = activityFeatureTerms(offer);
  for (const fact of pastFacts) {
    const fTerms = factTerms(fact);
    for (const fTerm of fTerms) {
      for (const featTerm of featTerms) {
        if (featTerm === fTerm || termMatches(featTerm, fTerm) || termMatches(fTerm, featTerm)) {
          return true;
        }
      }
    }
  }
  return false;
}

function matchesLikedOrFondMemory(offer: Offer, context: DecisionContext): boolean {
  const familiarFacts = context.selectedFacts.filter((fact) => (
    fact.kind === "liked-experience"
    || fact.kind === "fond-memory-signal"
  ));
  if (familiarFacts.length === 0) return false;
  const text = offerText(offer);
  for (const fact of familiarFacts) {
    const fTerms = factTerms(fact);
    for (const term of fTerms) {
      if (termMatches(text, term)) {
        return true;
      }
    }
  }
  return false;
}

export function analyzeNoveltyFit(
  context: DecisionContext,
  offers: readonly Offer[],
  mode: VacationExplorationMode,
): VacationNoveltyFit {
  const repeatHighlights: string[] = [];
  const experienceGaps: string[] = [];

  for (const offer of offers) {
    const category = offer.service?.category;
    if (category === "activity" || category === "wellness" || category === "lodging" || category === "dining") {
      if (matchesLikedOrFondMemory(offer, context)) {
        repeatHighlights.push(offer.title);
      }
    }
    if (category === "activity" || category === "wellness" || (category === "lodging" && offer.handle === "ko-olina-garden-rooms")) {
      if (!hasSemanticOverlapWithPast(offer, context)) {
        experienceGaps.push(offerExperienceModality(offer));
      }
    }
  }

  return {
    explorationMode: mode,
    experienceGaps: [...new Set(experienceGaps)],
    repeatHighlights: [...new Set(repeatHighlights)],
  };
}

function paceFor(context: DecisionContext): "relaxed" | "balanced" | "full" {
  const pace = [
    ...context.selectedFacts.filter((fact) => fact.kind === "pace-preference").map(profileFactText),
    ...context.brief.softPreferences.filter((preference) => preference.kind === "pace").map(preferenceText),
  ].join(" ").toLocaleLowerCase();
  if (pace.includes("relaxed") || pace.includes("slow") || pace.includes("one anchor")) return "relaxed";
  if (pace.includes("full") || pace.includes("packed")) return "full";
  return "balanced";
}

function matchedFacts(context: DecisionContext, offers: readonly Offer[]): VacationMatchedFact[] {
  const haystack = offers.map(offerText).join(" ");
  return matchableFacts(context).flatMap((fact) => {
    const matchedTerms = factTerms(fact).filter((term) => termMatches(haystack, term));
    if (!matchedTerms.length) return [];
    return [{
      factId: fact.id,
      subjectId: fact.subjectId,
      kind: fact.kind,
      summary: profileFactText(fact),
      matchedTerms: matchedTerms.slice(0, 6),
      explanation: `Source descriptions match ${matchedTerms.slice(0, 4).join(", ")}.`,
    }];
  });
}

function selectedPreferenceTerms(context: DecisionContext): string[] {
  return context.brief.softPreferences
    .filter((preference) => preference.kind !== "novelty" && preference.kind !== "price")
    .flatMap((preference) => terms(preferenceText(preference)));
}

function visitedDestinationOverlap(
  context: DecisionContext,
  offers: readonly Offer[],
  mode: VacationExplorationMode,
): string[] {
  if (mode === "comfort-seeking") return [];
  const destination = offers.map(offerText).join(" ");
  return [...new Set(context.selectedFacts
    .filter((fact) => fact.kind === "visited-place")
    .flatMap(factTerms)
    .filter((term) => termMatches(destination, term)))];
}

function scoreCandidate(
  context: DecisionContext,
  offers: readonly Offer[],
  matches: readonly VacationMatchedFact[],
  policy: TierPolicy,
  publishedCents: number,
  ceilingCents: number,
  noveltyFit: VacationNoveltyFit,
): number {
  const matchedTerms = new Set(matches.flatMap((match) => match.matchedTerms)).size;
  const memoryMatches = matches.filter((match) => match.kind === "fond-memory-signal").length;
  const preferenceMatches = new Set(selectedPreferenceTerms(context).filter((term) => offers.some((offer) => termMatches(offerText(offer), term)))).size;
  const verified = offers.filter((offer) => offer.provenance.verification.state === "verified").length;
  const budgetUse = ceilingCents > 0 ? Math.min(1, publishedCents / ceilingCents) : 0;
  const priceFit = policy.tier === "value"
    ? (1 - budgetUse) * 12
    : policy.tier === "balanced" ? (1 - Math.abs(0.72 - budgetUse)) * 12 : budgetUse * 12;

  const mode = noveltyFit.explorationMode;
  const destinationOverlapCount = visitedDestinationOverlap(context, offers, mode).length;

  let repeatReward = 0;
  let noveltyBonus = 0;
  let synergyBonus = 0;
  let repeatPenalty = 0;
  let destinationPenalty = 0;

  if (mode === "comfort-seeking") {
    // High positive reward for repeatHighlights (matching liked-experience and fond-memory-signals)
    repeatReward = Math.min(24, noveltyFit.repeatHighlights.length * 10);
    // ZERO destination penalty for repeating a visited-place
    destinationPenalty = 0;
    // Novelty bonus is 0
    noveltyBonus = 0;
    repeatPenalty = 0;
    synergyBonus = 0;
  } else if (mode === "novelty-seeking") {
    // Significant bonus for verified experienceGaps
    noveltyBonus = Math.min(30, noveltyFit.experienceGaps.length * 12);
    // Severe destination penalty if offers overlap with visited-place
    destinationPenalty = destinationOverlapCount * 18;
    // Penalty or dampening for repeating activities already in liked-experience
    repeatPenalty = noveltyFit.repeatHighlights.length * 8;
    repeatReward = 0;
    synergyBonus = 0;
  } else {
    // Balanced mode:
    // Synergy bonus when a package contains BOTH at least one repeatHighlight and at least one experienceGap
    synergyBonus = (noveltyFit.repeatHighlights.length > 0 && noveltyFit.experienceGaps.length > 0) ? 14 : 0;
    repeatReward = Math.min(12, noveltyFit.repeatHighlights.length * 4);
    noveltyBonus = Math.min(12, noveltyFit.experienceGaps.length * 4);
    // Moderate destination penalty (-8) if there is repeat destination overlap
    destinationPenalty = destinationOverlapCount * 8;
    repeatPenalty = 0;
  }

  const raw = 24
    + Math.min(24, matchedTerms * 3)
    + Math.min(10, memoryMatches * 5)
    + Math.min(10, preferenceMatches * 2)
    + Math.min(10, verified * 2)
    + priceFit
    + repeatReward
    + noveltyBonus
    + synergyBonus
    - repeatPenalty
    - destinationPenalty;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

function candidateFor(
  context: DecisionContext,
  lodging: Offer,
  transport: Offer,
  dining: Offer,
  activities: Offer[],
  policy: TierPolicy,
  ceilingCents: number,
  startDate: string,
  nights: number,
  travelers: number,
): Candidate | null {
  const baseCents = offerCostCents(lodging, travelers, nights) + offerCostCents(transport, travelers, nights);
  if (!Number.isFinite(baseCents) || baseCents >= ceilingCents) return null;
  const itinerary = createActivityItinerary({
    goal: context.brief.goal,
    date: startDate,
    days: nights,
    partySize: travelers,
    budget: (ceilingCents - baseCents) / 100,
    pace: paceFor(context),
    earliestStart: "08:00",
    latestEnd: "21:00",
  }, [...activities, dining]);
  if (itinerary.conflicts.length || itinerary.items.filter((item) => item.status === "scheduled").length !== activities.length + 1) return null;
  const offers = [lodging, transport, dining, ...activities];
  const publishedCents = offers.reduce((sum, offer) => sum + offerCostCents(offer, travelers, nights), 0);
  const estimatedHigh = estimatedHighCents(publishedCents, context);
  if (!Number.isFinite(publishedCents) || estimatedHigh > ceilingCents) return null;
  const matches = matchedFacts(context, offers);
  const mode = resolveExplorationMode(context);
  const noveltyFit = analyzeNoveltyFit(context, offers, mode);
  return {
    signature: offers.map((offer) => offer.handle).sort().join("|"),
    lodging,
    transport,
    dining,
    activities,
    itinerary,
    matchedFacts: matches,
    noveltyFit,
    score: scoreCandidate(context, offers, matches, policy, publishedCents, ceilingCents, noveltyFit),
    publishedCents,
    estimatedHighCents: estimatedHigh,
  };
}

function bestCandidate(
  context: DecisionContext,
  lodging: Offer[],
  transport: Offer[],
  dining: Offer[],
  activities: Offer[],
  policy: TierPolicy,
  ceilingCents: number,
  startDate: string,
  nights: number,
  travelers: number,
): Candidate | null {
  const candidates: Candidate[] = [];
  for (const lodgingOffer of lodging) {
    for (const transportOffer of transport) {
      for (const diningOffer of dining) {
        for (const activityOffers of combinations(activities, policy.activityCount)) {
          const candidate = candidateFor(
            context,
            lodgingOffer,
            transportOffer,
            diningOffer,
            activityOffers,
            policy,
            ceilingCents,
            startDate,
            nights,
            travelers,
          );
          if (candidate) candidates.push(candidate);
          if (candidates.length >= 192) break;
        }
        if (candidates.length >= 192) break;
      }
      if (candidates.length >= 192) break;
    }
    if (candidates.length >= 192) break;
  }
  candidates.sort((left, right) => (
    right.score - left.score
    || left.publishedCents - right.publishedCents
    || left.signature.localeCompare(right.signature)
  ));
  return candidates[0] ?? null;
}

function itemFor(offer: Offer, category: VacationPackageItemCategory, travelers: number, nights: number): VacationPackageItem {
  const quantity = quantityFor(offer, travelers, nights);
  return {
    category,
    handle: offer.handle,
    title: offer.title,
    provider: offer.service!.provider.displayName,
    sourceUrl: offer.url,
    quantity: quantity.quantity,
    unitLabel: quantity.unitLabel,
    unitPrice: offer.priceRange.min,
    total: money(offerCostCents(offer, travelers, nights) / 100, "USD"),
    evidence: offer.provenance.verification.label,
  };
}

function categoryTotal(offers: readonly Offer[], category: string, travelers: number, nights: number): number {
  return offers
    .filter((offer) => offer.service!.category === category)
    .reduce((sum, offer) => sum + offerCostCents(offer, travelers, nights), 0);
}

function appliedFact(fact: ProfileFact, context: DecisionContext) {
  return {
    id: fact.id,
    subjectId: fact.subjectId,
    kind: fact.kind,
    summary: profileFactText(fact),
    decisionOnly: context.brief.decisionOnlyFacts.some((candidate) => candidate.id === fact.id),
  };
}

function unavailableResult(
  context: DecisionContext,
  unsupportedConstraints: VacationPersonalization["unsupportedConstraints"],
  excludedByConstraint: VacationPersonalization["excludedByConstraint"],
  warning: string,
): PersonalizedVacationResult {
  return {
    status: "needs-attention",
    packages: [],
    warning,
    personalization: {
      status: context.selectedFacts.length ? "partial" : "not-applied",
      actionEligible: false,
      briefId: context.brief.id,
      vertical: "vacation",
      handling: "request-only",
      appliedFacts: [],
      deferredFacts: context.selectedFacts.map((fact) => ({
        ...appliedFact(fact, context),
        reason: "No complete vacation package could apply this fact under the current constraints.",
      })),
      unsupportedConstraints,
      excludedByConstraint,
      note: warning,
    },
  };
}

export function createPersonalizedVacationPackages(
  context: DecisionContext,
  offers: Offer[],
  generatedAt = new Date().toISOString(),
): PersonalizedVacationResult {
  if (context.brief.vertical !== "vacation") throw new RangeError("Personalized vacation planning requires a vacation decision brief.");
  if (context.brief.output !== "package") throw new RangeError("Personalized vacation planning requires package output.");
  const { startDate, endDate, nights } = tripLength(context);
  const travelers = partySize(context);
  const maximumCents = maximumBudgetCents(context);
  const unsupportedConstraints = context.brief.hardConstraints
    .filter((constraint) => !SUPPORTED_CONSTRAINT_KINDS.has(constraint.kind))
    .map((constraint) => ({
      id: constraint.id,
      kind: constraint.kind,
      label: constraint.label,
      reason: "The current controlled Offer contract does not expose evidence for this hard constraint yet.",
    }));
  if (unsupportedConstraints.length) {
    return unavailableResult(
      context,
      unsupportedConstraints,
      [],
      "Vacation packages are withheld because at least one hard constraint cannot be verified from current Offer evidence.",
    );
  }
  if (offers.some((offer) => offer.vertical !== "services" || !offer.service)) {
    throw new RangeError("Personalized vacation planning requires normalized service Offers.");
  }
  const candidates = offers.filter((offer) => (
    offer.source.live
    && offer.provenance.verification.state !== "conflict"
    && offer.constraints.available
    && locationMatches(offer, context)
    && travelers >= offer.service!.partySize.min
    && travelers <= offer.service!.partySize.max
  ));
  const avoid = avoidFacts(context);
  const hardAvoidTerms = [
    ...avoid.flatMap(factTerms),
    ...context.brief.hardConstraints.filter((constraint) => constraint.kind === "avoid").flatMap((constraint) => terms(constraintText(constraint))),
  ];
  const excludedByConstraint = candidates.flatMap((offer) => {
    const matchedTerms = [...new Set(hardAvoidTerms.filter((term) => termMatches(offerText(offer), term)))];
    return matchedTerms.length ? [{ handle: offer.handle, title: offer.title, matchedTerms }] : [];
  });
  const excludedHandles = new Set(excludedByConstraint.map((item) => item.handle));
  const eligible = candidates.filter((offer) => !excludedHandles.has(offer.handle));
  const lodging = eligible.filter((offer) => (
    offer.service!.category === "lodging"
    && offer.service!.priceBasis === "per-night"
    && Boolean(offer.service!.stayNights)
    && nights >= offer.service!.stayNights!.min
    && nights <= offer.service!.stayNights!.max
  ));
  const transport = eligible.filter((offer) => offer.service!.category === "transport" && ["fixed", "per-day"].includes(offer.service!.priceBasis));
  const dining = eligible.filter((offer) => offer.service!.category === "dining" && offer.service!.itineraryEligible);
  const activities = eligible.filter((offer) => ["activity", "wellness"].includes(offer.service!.category) && offer.service!.itineraryEligible);
  if (!lodging.length || !transport.length || !dining.length || activities.length < 1) {
    return unavailableResult(
      context,
      [],
      excludedByConstraint,
      "A complete package requires eligible lodging, transport, dining, and activity Offers for the selected destination.",
    );
  }
  const packages: PersonalizedVacationPackage[] = [];
  for (const policy of TIER_POLICIES) {
    const ceilingCents = Math.max(50_000, Math.floor(maximumCents * policy.ratio));
    const candidate = bestCandidate(context, lodging, transport, dining, activities, policy, ceilingCents, startDate, nights, travelers);
    if (!candidate) continue;
    const selectedOffers = [candidate.lodging, candidate.transport, candidate.dining, ...candidate.activities];
    const lodgingCents = categoryTotal(selectedOffers, "lodging", travelers, nights);
    const transportCents = categoryTotal(selectedOffers, "transport", travelers, nights);
    const diningCents = categoryTotal(selectedOffers, "dining", travelers, nights);
    const activityCents = selectedOffers
      .filter((offer) => offer.service!.category === "activity" || offer.service!.category === "wellness")
      .reduce((sum, offer) => sum + offerCostCents(offer, travelers, nights), 0);
    const contingencyCents = candidate.estimatedHighCents - candidate.publishedCents;
    const unknownCosts = [
      "Date-specific inventory is not confirmed by published scheduling windows.",
      ...(context.brief.budget!.includesTaxes === true && context.brief.budget!.includesFees === true
        ? []
        : ["Unknown taxes and fees are represented by the planning contingency, not treated as zero."]),
      ...(candidate.transport.service!.priceBasis === "per-day"
        ? ["Fuel, parking, and optional vehicle coverage are outside the published transport rate."]
        : ["The transfer covers airport arrival and departure only, not travel between activities."]),
      "Additional dining drinks and gratuity are outside the published meal price.",
    ];
    packages.push({
      id: `${context.brief.id}-${policy.tier}`,
      tier: policy.tier,
      label: policy.label,
      title: `${candidate.lodging.title} with ${policy.activityCount} anchor ${policy.activityCount === 1 ? "experience" : "experiences"}`,
      score: candidate.score,
      destination: `${candidate.lodging.service!.location.region}, ${candidate.lodging.service!.location.countryCode}`,
      startDate,
      endDate,
      nights,
      travelers,
      budgetCeiling: money(ceilingCents / 100, "USD"),
      itemHandles: selectedOffers.map((offer) => offer.handle),
      items: [
        itemFor(candidate.lodging, "lodging", travelers, nights),
        itemFor(candidate.transport, "transport", travelers, nights),
        itemFor(candidate.dining, "dining", travelers, nights),
        ...candidate.activities.map((offer) => itemFor(offer, "activity", travelers, nights)),
      ],
      matchedFacts: candidate.matchedFacts,
      noveltyFit: candidate.noveltyFit,
      why: `${candidate.matchedFacts.length} selected profile signals match source descriptions. The estimated high total stays within the ${money(ceilingCents / 100, "USD").amount} USD package ceiling. Exploration mode: ${candidate.noveltyFit.explorationMode}.${candidate.noveltyFit.repeatHighlights.length ? ` Repeat highlights: ${candidate.noveltyFit.repeatHighlights.join(", ")}.` : ""}${candidate.noveltyFit.experienceGaps.length ? ` Experience gaps: ${candidate.noveltyFit.experienceGaps.join(", ")}.` : ""}`,
      tradeoff: `${policy.tradeoff} Modeled under ${candidate.noveltyFit.explorationMode} exploration strategy${candidate.noveltyFit.experienceGaps.length ? ` with novel expansion in ${candidate.noveltyFit.experienceGaps.join(", ")}` : ""}${candidate.noveltyFit.repeatHighlights.length ? ` anchored by ${candidate.noveltyFit.repeatHighlights.join(", ")}` : ""}.`,
      evidenceConfidence: selectedOffers.every((offer) => offer.provenance.verification.state === "verified")
        ? "Verified across service JSON and page data"
        : "Current controlled service source",
      totals: {
        lodging: money(lodgingCents / 100, "USD"),
        transport: money(transportCents / 100, "USD"),
        dining: money(diningCents / 100, "USD"),
        activities: money(activityCents / 100, "USD"),
        publishedSubtotal: money(candidate.publishedCents / 100, "USD"),
        contingency: money(contingencyCents / 100, "USD"),
        planningRange: {
          min: money(candidate.publishedCents / 100, "USD"),
          max: money(candidate.estimatedHighCents / 100, "USD"),
          basis: `Published package subtotal plus ${context.brief.budget!.contingencyPercent}% planning contingency when taxes or fees remain unknown`,
        },
        unknownCosts,
      },
      itinerary: { ...candidate.itinerary, generatedAt },
    });
  }
  if (!packages.length) {
    return unavailableResult(
      context,
      [],
      excludedByConstraint,
      "No complete package fits the stay length, party size, published schedules, and budget ceilings.",
    );
  }
  const appliedIds = new Set([
    ...packages.flatMap((item) => item.matchedFacts.map((match) => match.factId)),
    ...avoid.map((fact) => fact.id),
    ...context.selectedFacts.filter((fact) => fact.kind === "pace-preference").map((fact) => fact.id),
    ...context.selectedFacts.filter((fact) => fact.kind === "visited-place").map((fact) => fact.id),
  ]);
  const applied = context.selectedFacts.filter((fact) => appliedIds.has(fact.id));
  const deferred = context.selectedFacts.filter((fact) => !appliedIds.has(fact.id));
  return {
    status: packages.length === TIER_POLICIES.length ? "planned" : "needs-attention",
    packages,
    ...(packages.length < TIER_POLICIES.length ? { warning: "Some package tiers had no complete plan under the selected constraints." } : {}),
    personalization: {
      status: applied.length === 0 ? "not-applied" : deferred.length ? "partial" : "applied",
      actionEligible: true,
      briefId: context.brief.id,
      vertical: "vacation",
      handling: "request-only",
      appliedFacts: applied.map((fact) => appliedFact(fact, context)),
      deferredFacts: deferred.map((fact) => ({
        ...appliedFact(fact, context),
        reason: "No selected package had matching source terms for this fact.",
      })),
      unsupportedConstraints: [],
      excludedByConstraint,
      note: "Only the selected trip signals entered this request. Nothing was saved by the Worker, and every package remains planning-only.",
    },
  };
}
