import { searchProducts, validateLimit, validateQuery, type CatalogEnv, type CatalogResult } from "./catalog";
import type { MarketplaceCondition, Offer } from "./offers";
import { getOrigin, type Origin } from "./origins";
import type { Fetcher } from "./upstream";

export type ShoppingFor = "self" | "gift";
export type RecommendationMode = "decide" | "explore";
export type RecommendationPriority = "match" | "taste" | "condition" | "price" | "returns" | "delivery";

export type RecommendationIntent = {
  shoppingFor: ShoppingFor;
  mode: RecommendationMode;
  priorities: RecommendationPriority[];
  refinementChoice: RecommendationPriority | null;
  tasteContext: string | null;
  mustHave: string | null;
  avoid: string | null;
};

export type RecommendationFactors = {
  relevance: number;
  preferenceFit: number;
  condition: number;
  deliveredPrice: number;
  sellerConfidence: number;
  returns: number;
  delivery: number;
};

export type RecommendationLabel = "Best fit" | "Best value" | "Worth a look" | "Strong alternative";

export type Recommendation = {
  rank: number;
  handle: string;
  score: number;
  factors: RecommendationFactors;
  label: RecommendationLabel;
  why: string;
  tradeoff: string;
  evidenceConfidence: string;
  summary: string;
};

export type RefinementChoice = {
  id: RecommendationPriority;
  label: string;
  impact: string;
};

export type RecommendationRefinement = {
  status: "not-needed" | "needs-clarification" | "resolved";
  reason: "clear-leader" | "competing-tradeoffs" | "answered" | "insufficient-options";
  margin: number | null;
  question: string | null;
  choices: RefinementChoice[];
  selectedChoice: RefinementChoice | null;
  beforeHandle: string | null;
  afterHandle: string | null;
  changed: boolean;
  explanation: string;
};

export type RecommendationResult = CatalogResult & {
  goal: { query: string; maxDeliveredPrice: number | null; intent: RecommendationIntent };
  rubric: RecommendationFactors;
  recommendations: Recommendation[];
  refinement: RecommendationRefinement;
};

const CONDITION_RATIO: Record<MarketplaceCondition, number> = {
  new: 1,
  "open-box": 0.96,
  excellent: 0.92,
  "very-good": 0.8,
  good: 0.64,
  fair: 0.4,
};

const BASE_RUBRIC: RecommendationFactors = {
  relevance: 25,
  preferenceFit: 10,
  condition: 20,
  deliveredPrice: 20,
  sellerConfidence: 10,
  returns: 10,
  delivery: 5,
};

const PRIORITY_FACTORS: Record<RecommendationPriority, keyof RecommendationFactors> = {
  match: "relevance",
  taste: "preferenceFit",
  condition: "condition",
  price: "deliveredPrice",
  returns: "returns",
  delivery: "delivery",
};

const PRIORITY_VALUES = new Set<RecommendationPriority>(Object.keys(PRIORITY_FACTORS) as RecommendationPriority[]);
const FACTOR_ORDER = Object.keys(BASE_RUBRIC) as Array<keyof RecommendationFactors>;
const REFINEMENT_MARGIN = 12;
const REFINEMENT_CHOICES: Record<RecommendationPriority, Omit<RefinementChoice, "id">> = {
  match: { label: "Closer product match", impact: "Gives more weight to the requested product terms." },
  taste: { label: "Closer taste match", impact: "Gives more weight to taste or recipient context." },
  condition: { label: "Better condition", impact: "Gives more weight to the reported item condition." },
  price: { label: "Lower delivered price", impact: "Gives more weight to the price including shipping." },
  returns: { label: "Safer returns", impact: "Gives more weight to the return window and who pays." },
  delivery: { label: "Faster delivery", impact: "Gives more weight to the estimated delivery window." },
};
const QUERY_STOP_WORDS = new Set(["a", "an", "and", "best", "condition", "find", "for", "good", "in", "me", "of", "on", "options", "price", "the", "under", "with"]);

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function boundedText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new RangeError(`${field} must be a string.`);
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new RangeError(`${field} must be ${maxLength} characters or fewer.`);
  return normalized || null;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RangeError(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

export function validateRecommendationIntent(input: Record<string, unknown> = {}): RecommendationIntent {
  const rawPriorities = input.priorities ?? [];
  if (!Array.isArray(rawPriorities) || rawPriorities.length > 3) {
    throw new RangeError("priorities must contain no more than three values.");
  }
  const priorities = [...new Set(rawPriorities.map((priority) => {
    if (typeof priority !== "string" || !PRIORITY_VALUES.has(priority as RecommendationPriority)) {
      throw new RangeError("priorities contains an unsupported value.");
    }
    return priority as RecommendationPriority;
  }))];
  return {
    shoppingFor: enumValue(input.shoppingFor, "shoppingFor", ["self", "gift"] as const, "self"),
    mode: enumValue(input.mode, "mode", ["decide", "explore"] as const, "decide"),
    priorities,
    refinementChoice: input.refinementChoice === undefined || input.refinementChoice === null || input.refinementChoice === ""
      ? null
      : enumValue(input.refinementChoice, "refinementChoice", [...PRIORITY_VALUES], "match"),
    tasteContext: boundedText(input.tasteContext, "tasteContext", 120),
    mustHave: boundedText(input.mustHave, "mustHave", 80),
    avoid: boundedText(input.avoid, "avoid", 80),
  };
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !QUERY_STOP_WORDS.has(term) && !/^\d+$/.test(term)))];
}

function offerText(offer: Offer): string {
  const market = offer.marketplace;
  const returns = market?.returns.accepted
    ? `${market.returns.windowDays ?? "unknown"} day returns ${market.returns.paidBy} paid return shipping`
    : "final sale no returns";
  const delivery = market ? `${market.shipping.estimatedDays.min} to ${market.shipping.estimatedDays.max} day delivery ${market.shipping.method}` : "";
  return [offer.title, offer.handle, offer.description, offer.vendor ?? "", offer.productType ?? "", market?.condition ?? "", market?.conditionDescription ?? "", returns, delivery]
    .join(" ")
    .toLocaleLowerCase();
}

function matchRatio(haystack: string, terms: string[]): number {
  if (!terms.length) return 1;
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

function deliveredPriceRatio(deliveredPrice: number, budget: number | null): number {
  if (!budget) return 0.72;
  if (deliveredPrice > budget) return 0;
  return 1 - (deliveredPrice / budget) * 0.45;
}

function sellerRatio(positivePercent: number, feedbackCount: number): number {
  const quality = Math.max(0, Math.min(0.6, ((positivePercent - 95) / 5) * 0.6));
  const history = Math.max(0, Math.min(0.4, Math.log10(feedbackCount + 1) / 4 * 0.4));
  return quality + history;
}

function returnsRatio(offer: Offer): number {
  const policy = offer.marketplace?.returns;
  if (!policy?.accepted) return 0;
  const window = policy.windowDays ?? 0;
  if (window >= 30) return policy.paidBy === "seller" ? 1 : 0.8;
  if (window >= 14) return 0.6;
  return 0.4;
}

function deliveryRatio(offer: Offer): number {
  const maximumDays = offer.marketplace?.shipping.estimatedDays.max;
  if (maximumDays === undefined) return 0.5;
  if (maximumDays <= 3) return 1;
  if (maximumDays <= 5) return 0.85;
  if (maximumDays <= 7) return 0.65;
  return 0.35;
}

function rubricFor(priorities: RecommendationPriority[], refinementChoice: RecommendationPriority | null): RecommendationFactors {
  const rubric = { ...BASE_RUBRIC };
  const emphasized = new Set(priorities.map((priority) => PRIORITY_FACTORS[priority]));
  for (const factor of emphasized) rubric[factor] += 5;
  const refinementFactor = refinementChoice ? PRIORITY_FACTORS[refinementChoice] : null;
  if (refinementFactor) rubric[refinementFactor] += 10;
  let reduction = emphasized.size * 5 + (refinementFactor ? 10 : 0);
  const protectedFactors = new Set(emphasized);
  if (refinementFactor) protectedFactors.add(refinementFactor);
  const donors = FACTOR_ORDER.filter((factor) => !protectedFactors.has(factor));
  const reduceFrom = (factors: Array<keyof RecommendationFactors>, minimum: (factor: keyof RecommendationFactors) => number) => {
    let changed = true;
    while (reduction > 0 && changed) {
      changed = false;
      for (const factor of factors) {
        if (reduction === 0) break;
        if (rubric[factor] > minimum(factor)) {
          rubric[factor] -= 1;
          reduction -= 1;
          changed = true;
        }
      }
    }
  };
  reduceFrom(donors, () => 3);
  const emphasizedDonors = [...emphasized].filter((factor) => factor !== refinementFactor);
  reduceFrom(emphasizedDonors, (factor) => BASE_RUBRIC[factor] + 2);
  if (reduction > 0) throw new RangeError("The selected priorities cannot be normalized into a 100-point rubric.");
  return rubric;
}

function choiceFor(id: RecommendationPriority): RefinementChoice {
  return { id, ...REFINEMENT_CHOICES[id] };
}

function refinementChoices(
  first: Recommendation,
  second: Recommendation,
  rubric: RecommendationFactors,
  intent: RecommendationIntent,
): RefinementChoice[] {
  const candidates = (Object.entries(PRIORITY_FACTORS) as Array<[RecommendationPriority, keyof RecommendationFactors]>)
    .filter(([priority]) => priority !== "taste" || Boolean(intent.tasteContext))
    .map(([priority, factor]) => ({
      priority,
      difference: rubric[factor] > 0 ? (second.factors[factor] - first.factors[factor]) / rubric[factor] : 0,
    }));
  const challengerStrengths = candidates
    .filter(({ difference }) => difference > 0)
    .sort((left, right) => right.difference - left.difference || left.priority.localeCompare(right.priority));
  const leaderStrengths = candidates
    .filter(({ difference }) => difference < 0)
    .sort((left, right) => left.difference - right.difference || left.priority.localeCompare(right.priority));
  const selected = [...challengerStrengths.slice(0, 1), ...leaderStrengths, ...challengerStrengths.slice(1)]
    .slice(0, 3)
    .map(({ priority }) => choiceFor(priority));
  return selected;
}

function refinementFor(
  baseline: Recommendation[],
  recommendations: Recommendation[],
  baselineRubric: RecommendationFactors,
  intent: RecommendationIntent,
): RecommendationRefinement {
  const before = baseline[0] ?? null;
  const second = baseline[1] ?? null;
  const after = recommendations[0] ?? null;
  if (!before || !second) {
    if (intent.refinementChoice) throw new RangeError("refinementChoice is not accepted without two eligible options.");
    return {
      status: "not-needed",
      reason: "insufficient-options",
      margin: null,
      question: null,
      choices: [],
      selectedChoice: null,
      beforeHandle: before?.handle ?? null,
      afterHandle: after?.handle ?? null,
      changed: false,
      explanation: "There are not two eligible options to distinguish with a refinement question.",
    };
  }
  const valueAlternative = baseline.find((item) => item.handle !== before.handle && item.label === "Best value");
  const closeSecond = before.score - second.score <= REFINEMENT_MARGIN;
  const secondHasDistinctStrength = FACTOR_ORDER.some((factor) => second.factors[factor] > before.factors[factor]);
  const valueHasDistinctStrength = Boolean(valueAlternative && FACTOR_ORDER.some((factor) => valueAlternative.factors[factor] > before.factors[factor]));
  const challenger = closeSecond && secondHasDistinctStrength
    ? second
    : valueHasDistinctStrength
      ? valueAlternative!
      : second;
  const margin = roundScore(before.score - challenger.score);
  const challengerHasDistinctStrength = FACTOR_ORDER.some((factor) => challenger.factors[factor] > before.factors[factor]);
  const needsClarification = challengerHasDistinctStrength && margin <= 25;
  if (!needsClarification) {
    if (intent.refinementChoice) throw new RangeError("refinementChoice is not accepted when the evidence has a clear leader.");
    return {
      status: "not-needed",
      reason: "clear-leader",
      margin,
      question: null,
      choices: [],
      selectedChoice: null,
      beforeHandle: before.handle,
      afterHandle: after?.handle ?? null,
      changed: false,
      explanation: `The leading option is ahead by ${margin} points, so no clarification is needed.`,
    };
  }
  const choices = refinementChoices(before, challenger, baselineRubric, intent);
  const question = `Best fit and ${challenger.label} reflect different strengths. Which consideration should guide the final ranking?`;
  if (intent.refinementChoice) {
    if (!choices.some((choice) => choice.id === intent.refinementChoice)) {
      throw new RangeError("refinementChoice must match one of the choices returned by the checkpoint.");
    }
    const selectedChoice = choiceFor(intent.refinementChoice);
    const changed = Boolean(after && after.handle !== before.handle);
    const outcome = changed
      ? `Best fit changed from ${before.handle} to ${after!.handle}.`
      : `Best fit stayed ${before.handle}.`;
    return {
      status: "resolved",
      reason: "answered",
      margin,
      question,
      choices,
      selectedChoice,
      beforeHandle: before.handle,
      afterHandle: after?.handle ?? null,
      changed,
      explanation: `${outcome} ${selectedChoice.label} received an explicit 10-point rubric boost.`,
    };
  }
  return {
    status: "needs-clarification",
    reason: "competing-tradeoffs",
    margin,
    question,
    choices,
    selectedChoice: null,
    beforeHandle: before.handle,
    afterHandle: before.handle,
    changed: false,
    explanation: `${before.handle} leads overall, while ${challenger.handle} is stronger on at least one decision factor. The agent is asking instead of hiding that tradeoff.`,
  };
}

function factorScores(offer: Offer, query: string, budget: number | null, intent: RecommendationIntent, rubric: RecommendationFactors): RecommendationFactors | null {
  const market = offer.marketplace;
  if (!market || !offer.constraints.available) return null;
  const delivered = Number.parseFloat(market.deliveredPrice.amount);
  if (!Number.isFinite(delivered) || (budget !== null && delivered > budget)) return null;
  const haystack = offerText(offer);
  const terms = queryTerms(query);
  const queryMatch = matchRatio(haystack, terms);
  if (terms.length > 1 && queryMatch < 0.7) return null;
  if (terms.length === 1 && queryMatch === 0) return null;
  const mustTerms = queryTerms(intent.mustHave ?? "");
  if (mustTerms.some((term) => !haystack.includes(term))) return null;
  const avoidTerms = queryTerms(intent.avoid ?? "");
  if (avoidTerms.some((term) => haystack.includes(term))) return null;
  const tasteTerms = queryTerms(intent.tasteContext ?? "");
  const rawTasteMatch = matchRatio(haystack, tasteTerms);
  const tasteMatch = !tasteTerms.length ? 0.5 : rawTasteMatch >= 0.5 ? rawTasteMatch : 0;
  return {
    relevance: roundScore(queryMatch * rubric.relevance),
    preferenceFit: roundScore(tasteMatch * rubric.preferenceFit),
    condition: roundScore(CONDITION_RATIO[market.condition] * rubric.condition),
    deliveredPrice: roundScore(deliveredPriceRatio(delivered, budget) * rubric.deliveredPrice),
    sellerConfidence: roundScore(sellerRatio(market.seller.positiveFeedbackPercent, market.seller.feedbackCount) * rubric.sellerConfidence),
    returns: roundScore(returnsRatio(offer) * rubric.returns),
    delivery: roundScore(deliveryRatio(offer) * rubric.delivery),
  };
}

function summaryFor(offer: Offer): string {
  const market = offer.marketplace!;
  const returnLabel = market.returns.accepted ? `${market.returns.windowDays}-day returns` : "final sale";
  return `${market.condition.replaceAll("-", " ")} condition, ${market.deliveredPrice.amount} ${market.deliveredPrice.currencyCode} delivered, ${market.seller.positiveFeedbackPercent.toFixed(1)}% positive seller, ${returnLabel}.`;
}

function whyFor(offer: Offer, factors: RecommendationFactors, intent: RecommendationIntent): string {
  const context = intent.shoppingFor === "gift" ? "recipient context" : "taste context";
  if (intent.tasteContext && factors.preferenceFit > 0) return `Matches ${context} with strong listing evidence.`;
  if (intent.priorities.includes("price")) return "Balances price with condition, seller, and return evidence.";
  if (intent.priorities.includes("condition")) return `The ${offer.marketplace!.condition.replaceAll("-", " ")} condition scores strongly against the other matching offers.`;
  return "Balances match, condition, price, seller, returns, and delivery evidence.";
}

function tradeoffFor(offer: Offer, budget: number | null): string {
  const market = offer.marketplace!;
  if (!market.returns.accepted) return "Final sale with no return window.";
  if (market.condition === "fair" || market.condition === "good") return `${market.condition.replaceAll("-", " ")} condition means more visible wear than higher-ranked alternatives.`;
  if ((market.shipping.estimatedDays.max ?? 0) > 5) return `Delivery may take up to ${market.shipping.estimatedDays.max} days.`;
  const delivered = Number.parseFloat(market.deliveredPrice.amount);
  if (budget && delivered / budget > 0.85) return "The delivered total uses most of the stated budget.";
  if (market.returns.paidBy === "buyer") return "Returns are accepted, but return shipping is paid by the buyer.";
  return "No major evidence tradeoff.";
}

function labelRecommendations(items: Recommendation[], intent: RecommendationIntent): Recommendation[] {
  if (!items.length) return items;
  const valueCandidate = items.slice(1).reduce<Recommendation | undefined>((best, item) => {
    if (!best || item.factors.deliveredPrice > best.factors.deliveredPrice) return item;
    return best;
  }, undefined);
  let worthAssigned = false;
  return items.map((item, index) => {
    let label: RecommendationLabel = "Strong alternative";
    if (index === 0) label = "Best fit";
    else if (item === valueCandidate) label = "Best value";
    else if (intent.mode === "explore" && !worthAssigned) {
      label = "Worth a look";
      worthAssigned = true;
    }
    return { ...item, label };
  });
}

export function validateBudget(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 25 || value > 100_000) {
    throw new RangeError("Maximum delivered price must be between 25 and 100000.");
  }
  return Math.round(value * 100) / 100;
}

export function rankOffers(
  offers: Offer[],
  query: string,
  maxDeliveredPrice: number | null,
  intentInput: Record<string, unknown> = {},
): Recommendation[] {
  const intent = validateRecommendationIntent(intentInput);
  const rubric = rubricFor(intent.priorities, intent.refinementChoice);
  const scored = offers.flatMap((offer) => {
    const factors = factorScores(offer, query, maxDeliveredPrice, intent, rubric);
    if (!factors) return [];
    const score = roundScore(Object.values(factors).reduce((sum, value) => sum + value, 0));
    return [{
      rank: 0,
      handle: offer.handle,
      score,
      factors,
      label: "Strong alternative" as RecommendationLabel,
      why: whyFor(offer, factors, intent),
      tradeoff: tradeoffFor(offer, maxDeliveredPrice),
      evidenceConfidence: offer.provenance.verification?.label ?? `Single source: ${offer.source.adapter}`,
      summary: summaryFor(offer),
    }];
  })
    .sort((left, right) => right.score - left.score || left.handle.localeCompare(right.handle))
    .map((item, index) => ({ ...item, rank: index + 1 }));
  return labelRecommendations(scored, intent);
}

export async function findBestOptions(
  queryInput: string,
  limitInput: string | null,
  budgetInput: string | null,
  origin: Origin = getOrigin(),
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
  intentInput: Record<string, unknown> = {},
): Promise<RecommendationResult> {
  const query = validateQuery(queryInput);
  if (!query) throw new RangeError("Recommendation query is required.");
  const limit = validateLimit(limitInput);
  const maxDeliveredPrice = validateBudget(budgetInput);
  const intent = validateRecommendationIntent(intentInput);
  const baselineIntent: RecommendationIntent = { ...intent, refinementChoice: null };
  const baselineRubric = rubricFor(baselineIntent.priorities, null);
  const rubric = rubricFor(intent.priorities, intent.refinementChoice);
  const catalog = await searchProducts("", 8, origin, fetcher, env);
  const baseline = rankOffers(catalog.offers, query, maxDeliveredPrice, baselineIntent);
  const recommendations = rankOffers(catalog.offers, query, maxDeliveredPrice, intent).slice(0, limit);
  const offersByHandle = new Map(catalog.offers.map((offer) => [offer.handle, offer]));
  const rankedOffers = recommendations.flatMap((item) => {
    const offer = offersByHandle.get(item.handle);
    return offer ? [offer] : [];
  });
  return {
    ...catalog,
    offers: rankedOffers,
    goal: { query, maxDeliveredPrice, intent },
    rubric,
    recommendations,
    refinement: refinementFor(baseline, recommendations, baselineRubric, intent),
    ...(!recommendations.length && !catalog.warning
      ? { warning: "No marketplace offers matched the query, intent, and delivered-price limit." }
      : {}),
  };
}
