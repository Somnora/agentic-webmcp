import { describe, expect, it } from "vitest";
import { assertOfferHandoffEligible, MAX_HANDOFF_OFFER_AGE_MS } from "../src/cart";
import { normalizeProductsJsonOffer } from "../src/catalog";
import { inspectOrigin } from "../src/origins";

const origin = inspectOrigin("review-shop");
const product = {
  handle: "the-complete-snowboard",
  title: "The Complete Snowboard",
  body_html: "<p>A complete board.</p>",
  options: [{ name: "Color" }],
  variants: [{ id: 2, title: "Ice", available: true, price: "700.95", option1: "Ice" }],
};

describe("merchant handoff eligibility", () => {
  it("accepts a fresh live offer", () => {
    const now = Date.parse("2026-08-30T20:00:00.000Z");
    const offer = normalizeProductsJsonOffer(product, origin, new Date(now).toISOString())!;
    expect(() => assertOfferHandoffEligible(offer, now)).not.toThrow();
  });

  it("rejects fallback, stale, invalid, future, and unavailable offers", () => {
    const now = Date.parse("2026-08-30T20:00:00.000Z");
    const fresh = normalizeProductsJsonOffer(product, origin, new Date(now).toISOString())!;
    expect(() => assertOfferHandoffEligible({
      ...fresh,
      source: { ...fresh.source, live: false, adapter: "bundled-snapshot" },
    }, now)).toThrow("source is not live");
    expect(() => assertOfferHandoffEligible({
      ...fresh,
      source: { ...fresh.source, fetchedAt: new Date(now - MAX_HANDOFF_OFFER_AGE_MS - 1).toISOString() },
    }, now)).toThrow("stale or invalid");
    expect(() => assertOfferHandoffEligible({
      ...fresh,
      source: { ...fresh.source, fetchedAt: "not-a-date" },
    }, now)).toThrow("stale or invalid");
    expect(() => assertOfferHandoffEligible({
      ...fresh,
      source: { ...fresh.source, fetchedAt: new Date(now + 60_001).toISOString() },
    }, now)).toThrow("stale or invalid");
    expect(() => assertOfferHandoffEligible({
      ...fresh,
      constraints: { ...fresh.constraints, available: false },
    }, now)).toThrow("unavailable");
  });
});
