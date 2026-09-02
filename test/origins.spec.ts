import { describe, expect, it } from "vitest";
import { normalizeProductsJsonOffer } from "../src/catalog";
import { assertOfferAdapterContract, assertOriginRegistry, validateOriginManifest } from "../src/origin-contract";
import { getOrigin, inspectOrigin, ORIGINS, publicOrigin, runtimeOrigins, type Origin } from "../src/origins";

const origin = inspectOrigin("catalog-lab");
const product = {
  handle: "contract-test-guitar",
  title: "Contract Test Guitar",
  description: "A first-party contract fixture.",
  variants: [{ id: "contract-1", title: "As listed", available: true, price: "500.00" }],
};

describe("origin manifest contract", () => {
  it("validates every registered origin and exposes only public contract fields", () => {
    expect(() => assertOriginRegistry(ORIGINS)).not.toThrow();
    for (const item of ORIGINS) expect(validateOriginManifest(item)).toEqual([]);
    expect(publicOrigin(getOrigin("review-shop", Date.parse("2026-09-01T12:00:00.000Z")))).toMatchObject({
      authorization: { status: "operator-authorized", dataRights: "operator-controlled-store" },
      capabilities: { merchantHandoff: "live-fresh-offer-only", checkout: false, payment: false },
      policy: { maxOfferAgeSeconds: 300, upstreamTimeoutMs: 4000 },
    });
  });

  it("fails closed after reviewAfter while retaining inspection access", () => {
    const beforeReview = Date.parse("2026-09-04T19:59:59.999Z");
    const atReview = Date.parse("2026-09-04T20:00:00.000Z");
    expect(getOrigin("review-shop", beforeReview).id).toBe("review-shop");
    expect(() => getOrigin("review-shop", atReview)).toThrow("authorization expired");
    expect(runtimeOrigins(atReview).map((item) => item.id)).toEqual(["catalog-lab"]);
    expect(inspectOrigin("review-shop").authorization.reviewAfter).toBe("2026-09-04T20:00:00.000Z");
  });

  it("rejects origin policies without a bounded upstream timeout", () => {
    const invalid = { ...origin, policy: { ...origin.policy, upstreamTimeoutMs: 20_000 } } satisfies Origin;
    expect(validateOriginManifest(invalid)).toContain("upstreamTimeoutMs must be between 250 and 10000");
  });

  it("rejects an authorization review date that does not follow attestation", () => {
    const invalid = {
      ...origin,
      authorization: { ...origin.authorization, reviewAfter: origin.authorization.attestedAt },
    } satisfies Origin;
    expect(validateOriginManifest(invalid)).toContain("authorization reviewAfter must be later than attestedAt");
  });

  it("rejects an insecure hostname root, an overbroad path, and disabled authorization", () => {
    const invalid = {
      ...origin,
      canonicalUrl: "http://agentic-webmcp-origin.somnora.workers.dev/catalog",
      productPathPattern: "/products/(.*)",
      authorization: { ...origin.authorization, status: "inactive" },
    } satisfies Origin;
    expect(validateOriginManifest(invalid)).toEqual(expect.arrayContaining([
      "canonicalUrl must be the exact HTTPS hostname root",
      "productPathPattern must be anchored and bounded",
      "authorization must be active",
    ]));
  });

  it("rejects anchored catch-all and nested product path patterns", () => {
    const catchAll = {
      ...origin,
      productPathPattern: "^.*$",
      interpolatePathPatterns: ["^.*$"],
    } satisfies Origin;
    expect(validateOriginManifest(catchAll)).toEqual(expect.arrayContaining([
      "productPathPattern must capture exactly one bounded product handle",
      "productPathPattern must reject non-product and nested paths",
      "interpolatePathPatterns must reject non-product and nested paths",
    ]));

    const nested = {
      ...origin,
      productPathPattern: "^/products/(.+)$",
      interpolatePathPatterns: ["^/products/.+$"],
    } satisfies Origin;
    expect(validateOriginManifest(nested)).toEqual(expect.arrayContaining([
      "productPathPattern must reject non-product and nested paths",
      "interpolatePathPatterns must reject non-product and nested paths",
    ]));
  });

  it("rejects duplicated manifest hostnames", () => {
    const duplicate = { ...origin, id: "duplicate-origin" } satisfies Origin;
    expect(() => assertOriginRegistry([origin, duplicate])).toThrow("hostname");
  });

  it("validates normalized Offers against the selected adapter, URL, currency, and freshness policy", () => {
    const offer = normalizeProductsJsonOffer(product, origin)!;
    expect(() => assertOfferAdapterContract(origin, offer)).not.toThrow();
    expect(() => assertOfferAdapterContract(origin, { ...offer, originId: "review-shop" })).toThrow("origin id mismatch");
    expect(() => assertOfferAdapterContract(origin, {
      ...offer,
      handoff: { ...offer.handoff, maxAgeSeconds: 30 },
    })).toThrow("freshness policy mismatch");
  });
});
