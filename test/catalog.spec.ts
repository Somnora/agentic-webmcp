import { describe, expect, it, vi } from "vitest";
import {
  compareProducts,
  createCatalogBrief,
  getProduct,
  normalizeProduct,
  searchProducts,
  validateHandle,
  validateHandles,
  validateLimit,
  validateQuery,
} from "../src/catalog";

const rawProduct = {
  handle: "test-hoodie",
  title: "Test Hoodie",
  description: "Soft cotton layer",
  vendor: "Test Shop",
  productType: "Apparel",
  featuredImage: { url: "https://cdn.example.test/hoodie.jpg", altText: "A hoodie" },
  priceRange: {
    minVariantPrice: { amount: "50", currencyCode: "CAD" },
    maxVariantPrice: { amount: "60.5", currencyCode: "CAD" },
  },
  variants: {
    nodes: [{
      id: "gid://shopify/ProductVariant/1",
      title: "Small",
      availableForSale: true,
      quantityAvailable: 8,
      price: { amount: "50", currencyCode: "CAD" },
      selectedOptions: [{ name: "Size", value: "Small" }],
    }],
  },
};

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("catalog validation", () => {
  it("normalizes GraphQL products into bounded values", () => {
    const product = normalizeProduct(rawProduct);
    expect(product).toMatchObject({ handle: "test-hoodie", title: "Test Hoodie" });
    expect(product?.priceRange.minVariantPrice.amount).toBe("50.00");
    expect(product?.variants[0]?.quantityAvailable).toBe(8);
  });

  it("rejects products without a safe handle", () => {
    expect(normalizeProduct({ ...rawProduct, handle: "../unsafe" })).toBeNull();
  });

  it("rejects invalid handles", () => {
    expect(() => validateHandle("BAD HANDLE")).toThrow("invalid");
    expect(validateHandle("test-hoodie")).toBe("test-hoodie");
  });

  it("bounds search length and result count", () => {
    expect(validateQuery(" hoodie ")).toBe("hoodie");
    expect(() => validateQuery("x".repeat(81))).toThrow("80 characters");
    expect(validateLimit("8")).toBe(8);
    expect(() => validateLimit("9")).toThrow("1 to 8");
  });

  it("requires two to four unique comparison handles", () => {
    expect(validateHandles("slides,sweatpants")).toEqual(["slides", "sweatpants"]);
    expect(() => validateHandles("slides,slides")).toThrow("2 and 4");
  });
});

describe("catalog data access", () => {
  it("searches live Shopify-shaped product data", async () => {
    const fetcher = vi.fn(async () => response({ data: { products: { nodes: [rawProduct] } } })) as typeof fetch;
    const result = await searchProducts("cotton", 6, fetcher);
    expect(result.live).toBe(true);
    expect(result.source).toBe("shopify-mock-shop");
    expect(result.products.map((product) => product.handle)).toEqual(["test-hoodie"]);
  });

  it("uses a clearly labeled fallback on upstream failure", async () => {
    const fetcher = vi.fn(async () => response({}, 503)) as typeof fetch;
    const result = await searchProducts("slides", 6, fetcher);
    expect(result.live).toBe(false);
    expect(result.source).toBe("bundled-fallback");
    expect(result.warning).toContain("bundled demo snapshot");
    expect(result.products[0]?.handle).toBe("slides");
  });

  it("returns an exact product from GraphQL", async () => {
    const fetcher = vi.fn(async () => response({ data: { product: rawProduct } })) as typeof fetch;
    const result = await getProduct("test-hoodie", fetcher);
    expect(result.products[0]?.title).toBe("Test Hoodie");
  });

  it("compares independent product handles", async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const handle = body.variables.handle;
      return response({ data: { product: { ...rawProduct, handle, title: handle } } });
    }) as typeof fetch;
    const result = await compareProducts(["first-product", "second-product"], fetcher);
    expect(result.products).toHaveLength(2);
    expect(result.live).toBe(true);
  });

  it("creates a bounded source-only Markdown brief", () => {
    const product = normalizeProduct(rawProduct)!;
    const brief = createCatalogBrief("Find a comfortable layer.", [product]);
    expect(brief).toContain("# Catalog brief");
    expect(brief).toContain("Test Hoodie");
    expect(brief.length).toBeLessThanOrEqual(1400);
  });
});
