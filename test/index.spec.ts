import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/index";

const rawProduct = {
  handle: "test-hoodie",
  title: "Test Hoodie",
  description: "Soft cotton layer",
  vendor: "Test Shop",
  productType: "Apparel",
  featuredImage: null,
  priceRange: {
    minVariantPrice: { amount: "50", currencyCode: "CAD" },
    maxVariantPrice: { amount: "50", currencyCode: "CAD" },
  },
  variants: { nodes: [] },
};

const assetFetcher = {
  fetch: vi.fn(async () => new Response("<!doctype html><title>Agentic</title>", {
    headers: { "Content-Type": "text/html" },
  })),
} as unknown as Fetcher;
const env: Env = { ASSETS: assetFetcher };

afterEach(() => vi.unstubAllGlobals());

function mockGraphql(): void {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(body.variables.handle
      ? { data: { product: { ...rawProduct, handle: body.variables.handle } } }
      : { data: { products: { nodes: [rawProduct] } } }), {
      headers: { "Content-Type": "application/json" },
    });
  }));
}

describe("Worker routes", () => {
  it("serves health with WebMCP security headers", async () => {
    const response = await handleRequest(new Request("https://example.test/health"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Origin-Agent-Cluster")).toBe("?1");
    expect(response.headers.get("Permissions-Policy")).toContain("tools=(self)");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("serves static assets through the isolated Worker boundary", async () => {
    const response = await handleRequest(new Request("https://example.test/"), env);
    expect(await response.text()).toContain("Agentic");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("returns live catalog JSON", async () => {
    mockGraphql();
    const response = await handleRequest(new Request("https://example.test/api/catalog?query=cotton&limit=4"), env);
    const body = await response.json() as { live: boolean; products: Array<{ handle: string }> };
    expect(response.status).toBe(200);
    expect(body.live).toBe(true);
    expect(body.products[0]?.handle).toBe("test-hoodie");
  });

  it("rejects excessive catalog result counts", async () => {
    const response = await handleRequest(new Request("https://example.test/api/catalog?limit=99"), env);
    expect(response.status).toBe(400);
  });

  it("returns a product by validated handle", async () => {
    mockGraphql();
    const response = await handleRequest(new Request("https://example.test/api/products/test-hoodie"), env);
    expect(response.status).toBe(200);
  });

  it("rejects path traversal handles", async () => {
    const response = await handleRequest(new Request("https://example.test/api/products/%2E%2E%2Fsecret"), env);
    expect(response.status).toBe(400);
  });

  it("requires multiple unique comparison handles", async () => {
    const response = await handleRequest(new Request("https://example.test/api/compare?handles=slides,slides"), env);
    expect(response.status).toBe(400);
  });

  it("creates a catalog brief from bounded JSON", async () => {
    mockGraphql();
    const request = new Request("https://example.test/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "Find a comfortable layer.", handles: ["test-hoodie"] }),
    });
    const response = await handleRequest(request, env);
    const body = await response.json() as { brief: string };
    expect(response.status).toBe(200);
    expect(body.brief).toContain("Catalog brief");
  });

  it("rejects non-JSON brief requests", async () => {
    const response = await handleRequest(new Request("https://example.test/api/brief", { method: "POST", body: "x" }), env);
    expect(response.status).toBe(415);
  });

  it("rejects oversized JSON bodies", async () => {
    const response = await handleRequest(new Request("https://example.test/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "x".repeat(5000), handles: ["test-hoodie"] }),
    }), env);
    expect(response.status).toBe(400);
  });

  it("fails closed on unknown API routes", async () => {
    const response = await handleRequest(new Request("https://example.test/api/missing"), env);
    expect(response.status).toBe(404);
  });

  it("rejects unsupported methods", async () => {
    const response = await handleRequest(new Request("https://example.test/health", { method: "POST" }), env);
    expect(response.status).toBe(405);
  });
});
