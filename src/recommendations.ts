import { searchProducts, validateLimit, validateQuery, type CatalogEnv, type CatalogResult } from "./catalog";
import type { MarketplaceCondition, Offer } from "./offers";
import { getOrigin, type Origin } from "./origins";
import type { Fetcher } from "./upstream";

export type RecommendationFactors = {
  relevance: number;
  condition: number;
  deliveredPrice: number;
  sellerConfidence: number;
  returns: number;
};

export type Recommendation = {
  rank: number;
  handle: string;
  score: number;
  factors: RecommendationFactors;
  summary: string;
};

export type RecommendationResult = CatalogResult & {
  goal: { query: string; maxDeliveredPrice: number | null };
  rubric: RecommendationFactors;
  recommendations: Recommendation[];
};

const CONDITION_SCORE: Record<MarketplaceCondition, number> = {
  new: 25,
  "open-box": 24,
  excellent: 23,
  "very-good": 20,
  good: 16,
  fair: 10,
};

const QUERY_STOP_WORDS = new Set(["a", "an", "and", "best", "condition", "find", "for", "good", "in", "me", "of", "on", "options", "price", "the", "under", "with"]);

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function queryTerms(query: string): string[] {
  return [...new Set(query.toLocaleLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !QUERY_STOP_WORDS.has(term) && !/^\d+$/.test(term)))];
}

function relevanceScore(offer: Offer, terms: string[]): number {
  if (!terms.length) return 30;
  const haystack = [offer.title, offer.handle, offer.description, offer.productType ?? ""].join(" ").toLocaleLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  if (terms.length > 1 && matches < Math.ceil(terms.length * 0.7)) return 0;
  return roundScore((matches / terms.length) * 30);
}

function deliveredPriceScore(deliveredPrice: number, budget: number | null): number {
  if (!budget) return 18;
  if (deliveredPrice > budget) return 0;
  return roundScore(25 * (1 - (deliveredPrice / budget) * 0.45));
}

function sellerScore(positivePercent: number, feedbackCount: number): number {
  const quality = Math.max(0, Math.min(6, ((positivePercent - 95) / 5) * 6));
  const history = Math.max(0, Math.min(4, Math.log10(feedbackCount + 1) / 4 * 4));
  return roundScore(quality + history);
}

function returnsScore(offer: Offer): number {
  const policy = offer.marketplace?.returns;
  if (!policy?.accepted) return 0;
  const window = policy.windowDays ?? 0;
  if (window >= 30) return policy.paidBy === "seller" ? 10 : 8;
  if (window >= 14) return 6;
  return 4;
}

function summaryFor(offer: Offer, factors: RecommendationFactors): string {
  const market = offer.marketplace!;
  const returnLabel = market.returns.accepted ? `${market.returns.windowDays}-day returns` : "final sale";
  return `${market.condition.replaceAll("-", " ")} condition, ${market.deliveredPrice.amount} ${market.deliveredPrice.currencyCode} delivered, ${market.seller.positiveFeedbackPercent.toFixed(1)}% positive seller, ${returnLabel}. Relevance ${factors.relevance}/30.`;
}

export function validateBudget(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 25 || value > 100_000) {
    throw new RangeError("Maximum delivered price must be between 25 and 100000.");
  }
  return Math.round(value * 100) / 100;
}

export function rankOffers(offers: Offer[], query: string, maxDeliveredPrice: number | null): Recommendation[] {
  const terms = queryTerms(query);
  return offers
    .flatMap((offer) => {
      const market = offer.marketplace;
      if (!market || !offer.constraints.available) return [];
      const delivered = Number.parseFloat(market.deliveredPrice.amount);
      if (!Number.isFinite(delivered) || (maxDeliveredPrice !== null && delivered > maxDeliveredPrice)) return [];
      const relevance = relevanceScore(offer, terms);
      if (terms.length && relevance === 0) return [];
      const factors: RecommendationFactors = {
        relevance,
        condition: CONDITION_SCORE[market.condition],
        deliveredPrice: deliveredPriceScore(delivered, maxDeliveredPrice),
        sellerConfidence: sellerScore(market.seller.positiveFeedbackPercent, market.seller.feedbackCount),
        returns: returnsScore(offer),
      };
      const score = roundScore(Object.values(factors).reduce((sum, value) => sum + value, 0));
      return [{ rank: 0, handle: offer.handle, score, factors, summary: summaryFor(offer, factors) }];
    })
    .sort((left, right) => right.score - left.score || left.handle.localeCompare(right.handle))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function findBestOptions(
  queryInput: string,
  limitInput: string | null,
  budgetInput: string | null,
  origin: Origin = getOrigin(),
  fetcher: Fetcher = fetch,
  env: CatalogEnv = {},
): Promise<RecommendationResult> {
  const query = validateQuery(queryInput);
  if (!query) throw new RangeError("Recommendation query is required.");
  const limit = validateLimit(limitInput);
  const maxDeliveredPrice = validateBudget(budgetInput);
  const catalog = await searchProducts("", 8, origin, fetcher, env);
  const recommendations = rankOffers(catalog.offers, query, maxDeliveredPrice).slice(0, limit);
  const offersByHandle = new Map(catalog.offers.map((offer) => [offer.handle, offer]));
  const rankedOffers = recommendations.flatMap((item) => {
    const offer = offersByHandle.get(item.handle);
    return offer ? [offer] : [];
  });
  return {
    ...catalog,
    offers: rankedOffers,
    goal: { query, maxDeliveredPrice },
    rubric: { relevance: 30, condition: 25, deliveredPrice: 25, sellerConfidence: 10, returns: 10 },
    recommendations,
    ...(!recommendations.length && !catalog.warning
      ? { warning: "No marketplace offers matched the query and delivered-price limit." }
      : {}),
  };
}
