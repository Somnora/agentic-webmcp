import { describe, expect, it, vi } from "vitest";
import {
  compareProducts,
  createCatalogBrief,
  getProduct,
  normalizeProductsJsonOffer,
  normalizeStorefrontOffer,
  searchProducts,
  validateHandle,
  validateHandles,
  validateLimit,
  validateQuery,
} from "../src/catalog";
import { getOrigin } from "../src/origins";

const origin = getOrigin("review-shop");
const controlledOrigin = getOrigin("catalog-lab");

const rawStorefrontProduct = {
  handle: "the-complete-snowboard",
  title: "The Complete Snowboard",
  description: "A complete board with selectable colors.",
  vendor: "Review Shop",
  productType: "snowboard",
  featuredImage: { url: "https://cdn.example.test/complete.jpg", altText: "A snowboard" },
  priceRange: {
    minVariantPrice: { amount: "699.95", currencyCode: "USD" },
    maxVariantPrice: { amount: "700.95", currencyCode: "USD" },
  },
  variants: {
    nodes: [{
      id: "gid://shopify/ProductVariant/1",
      title: "Ice",
      availableForSale: true,
      quantityAvailable: 8,
      price: { amount: "700.95", currencyCode: "USD" },
      selectedOptions: [{ name: "Color", value: "Ice" }],
    }],
  },
};

const rawProductsJsonProduct = {
  id: 1,
  handle: "selling-plans-ski-wax",
  title: "Selling Plans Ski Wax",
  body_html: "<p>A bar of wax.</p>",
  vendor: "Review Shop",
  product_type: "accessories",
  options: [{ name: "Color" }],
  image: { src: "https://cdn.example.test/wax.jpg", alt: "Wax" },
  variants: [{ id: 2, title: "Gold", available: true, price: "9.95", option1: "Gold" }],
};

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("offer normalization and validation", () => {
  it("normalizes Storefront GraphQL into the Offer protocol", () => {
    const offer = normalizeStorefrontOffer(rawStorefrontProduct, origin);
    expect(offer).toMatchObject({ originId: "review-shop", handle: "the-complete-snowboard", title: "The Complete Snowboard" });
    expect(offer?.priceRange.min.amount).toBe("699.95");
    expect(offer?.variants[0]?.available).toBe(true);
    expect(offer?.source).toMatchObject({ adapter: "shopify-storefront", live: true, untrusted: true });
  });

  it("normalizes public products JSON into the same Offer protocol", () => {
    const offer = normalizeProductsJsonOffer(rawProductsJsonProduct, origin);
    expect(offer?.handle).toBe("selling-plans-ski-wax");
    expect(offer?.description).toBe("A bar of wax.");
    expect(offer?.variants[0]?.options).toEqual([{ name: "Color", value: "Gold" }]);
    expect(offer?.source.adapter).toBe("shopify-products-json");
  });

  it("rejects unsafe handles and bounds inputs", () => {
    expect(normalizeStorefrontOffer({ ...rawStorefrontProduct, handle: "../unsafe" }, origin)).toBeNull();
    expect(() => validateHandle("BAD HANDLE")).toThrow("invalid");
    expect(validateHandle("the-complete-snowboard")).toBe("the-complete-snowboard");
    expect(validateQuery(" Ice ")).toBe("Ice");
    expect(() => validateQuery("x".repeat(81))).toThrow("80 characters");
    expect(validateLimit("8")).toBe(8);
    expect(() => validateLimit("9")).toThrow("1 to 8");
  });

  it("requires two to four unique comparison handles", () => {
    expect(validateHandles("the-complete-snowboard,selling-plans-ski-wax")).toEqual([
      "the-complete-snowboard",
      "selling-plans-ski-wax",
    ]);
    expect(() => validateHandles("selling-plans-ski-wax,selling-plans-ski-wax")).toThrow("2 and 4");
  });
});

describe("catalog adapter chain", () => {
  it("uses Storefront GraphQL when a read-only token is present", async () => {
    const fetcher = vi.fn(async () => response({ data: { products: { nodes: [rawStorefrontProduct] } } })) as typeof fetch;
    const result = await searchProducts("complete", 6, origin, fetcher, { CATALOG_STOREFRONT_TOKEN: "read-only-test-token" });
    expect(result.live).toBe(true);
    expect(result.source).toBe("shopify-storefront");
    expect(result.offers.map((offer) => offer.handle)).toEqual(["the-complete-snowboard"]);
  });

  it("uses public products JSON when the token is absent", async () => {
    const fetcher = vi.fn(async () => response({ products: [rawProductsJsonProduct] })) as typeof fetch;
    const result = await searchProducts("wax", 6, origin, fetcher);
    expect(result.live).toBe(true);
    expect(result.source).toBe("shopify-products-json");
    expect(result.offers[0]?.handle).toBe("selling-plans-ski-wax");
  });

  it("labels the controlled origin public JSON without Shopify identifiers", async () => {
    const fetcher = vi.fn(async () => response({ products: [rawProductsJsonProduct] })) as typeof fetch;
    const result = await searchProducts("wax", 6, controlledOrigin, fetcher, { CATALOG_SHOP: origin.hostname });
    expect(result).toMatchObject({ live: true, source: "public-products-json", origin: { mode: "controlled-demo" } });
    expect(result.offers[0]?.source.adapter).toBe("public-products-json");
    expect(result.offers[0]?.variants[0]?.id).toBe("urn:agentic-catalog-lab:variant:2");
  });

  it("uses a clearly labeled bundled snapshot when both live adapters fail", async () => {
    const fetcher = vi.fn(async () => response({}, 503)) as typeof fetch;
    const result = await searchProducts("wax", 6, origin, fetcher);
    expect(result.live).toBe(false);
    expect(result.source).toBe("bundled-snapshot");
    expect(result.warning).toContain("clearly labeled bundled snapshot");
    expect(result.offers[0]?.handle).toBe("selling-plans-ski-wax");
    expect(result.offers[0]?.source.live).toBe(false);
    expect(result.offers[0]?.source.adapter).toBe("bundled-snapshot");
    expect(result.offers[0]?.provenance).toMatchObject({ pricing: "bundled-snapshot", variants: "bundled-snapshot" });
  });

  it("returns an exact product through the products JSON adapter", async () => {
    const fetcher = vi.fn(async () => response(rawProductsJsonProduct)) as typeof fetch;
    const result = await getProduct("selling-plans-ski-wax", origin, fetcher);
    expect(result.offers[0]?.title).toBe("Selling Plans Ski Wax");
  });

  it("compares independent handles on one origin", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const pathname = new URL(String(input)).pathname;
      const handle = pathname.split("/").pop()?.replace(/\.js$/, "") ?? "unknown";
      return response({ ...rawProductsJsonProduct, handle, title: handle });
    }) as typeof fetch;
    const result = await compareProducts(["first-snowboard", "second-snowboard"], origin, fetcher);
    expect(result.offers).toHaveLength(2);
    expect(result.live).toBe(true);
  });

  it("creates a bounded source-only Markdown brief", () => {
    const offer = normalizeStorefrontOffer(rawStorefrontProduct, origin)!;
    const brief = createCatalogBrief("Find a board with available variants.", [offer]);
    expect(brief).toContain("# Catalog brief");
    expect(brief).toContain("The Complete Snowboard");
    expect(brief.length).toBeLessThanOrEqual(1400);
  });
});
