import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRequest } from "../src/index";

const rawProduct = {
  id: 1,
  handle: "the-complete-snowboard",
  title: "The Complete Snowboard",
  body_html: "<p>A complete board.</p>",
  vendor: "Review Shop",
  product_type: "snowboard",
  options: [{ name: "Color" }],
  image: null,
  variants: [{ id: 2, title: "Ice", available: true, price: "700.95", option1: "Ice" }],
};

const secondProduct = {
  ...rawProduct,
  id: 3,
  handle: "selling-plans-ski-wax",
  title: "Selling Plans Ski Wax",
  variants: [{ id: 4, title: "Gold", available: true, price: "9.95", option1: "Gold" }],
};

const assetFetcher: Fetcher = {
  fetch: vi.fn(async () => new Response("<!doctype html><title>Agentic</title>", {
    headers: { "Content-Type": "text/html" },
  })),
  connect: () => {
    throw new Error("Asset socket connections are not used in tests.");
  },
};
const env: Env = {
  ASSETS: assetFetcher,
  CATALOG_SHOP: "agentic-app-review-test.myshopify.com",
  APP_COMMIT: "local",
  VERSION_METADATA: { id: "test-version", tag: "", timestamp: "2026-08-26T00:00:00.000Z" },
};

afterEach(() => vi.unstubAllGlobals());

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function productForHandle(handle: string): typeof rawProduct {
  return handle === secondProduct.handle ? secondProduct : { ...rawProduct, handle };
}

function mockUpstream(): void {
  vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (url.pathname === "/products.json") return json({ products: [rawProduct, secondProduct] });
    if (url.pathname.endsWith(".js")) {
      const handle = url.pathname.split("/").pop()?.replace(/\.js$/, "") ?? rawProduct.handle;
      return json(productForHandle(handle));
    }
    if (url.pathname.startsWith("/products/")) {
      return new Response(`<!doctype html><html><body><nav>Remove navigation</nav><main><h1>The Complete Snowboard</h1><p>Page body fact.</p><script type="application/ld+json">${JSON.stringify({
        "@type": "Product",
        name: "The Complete Snowboard",
        description: "JSON-LD page fact.",
        offers: { "@type": "Offer", price: "700.95", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      })}</script></main><footer>Remove footer</footer></body></html>`, { headers: { "Content-Type": "text/html" } });
    }
    return json({}, 404);
  }));
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Worker routes", () => {
  it("serves health with the required WebMCP security headers", async () => {
    const response = await handleRequest(new Request("https://example.test/health"), env);
    expect(response.status).toBe(200);
    expect(await response.clone().json()).toMatchObject({ deployment: { commit: "local", versionId: "test-version" } });
    expect(response.headers.get("Origin-Agent-Cluster")).toBe("?1");
    expect(response.headers.get("Permissions-Policy")).toContain("tools=(self)");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("serves static assets through the isolated Worker boundary", async () => {
    const response = await handleRequest(new Request("https://example.test/"), env);
    expect(await response.text()).toContain("Agentic");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("lists and selects the default allowlisted origin", async () => {
    const listed = await handleRequest(new Request("https://example.test/api/origins"), env);
    const listBody = await listed.json() as { defaultOriginId: string; origins: Array<{ id: string; hostname: string }> };
    expect(listBody.defaultOriginId).toBe("review-shop");
    expect(listBody.origins).toEqual([expect.objectContaining({ id: "review-shop", hostname: "agentic-app-review-test.myshopify.com" })]);

    const selected = await handleRequest(jsonRequest("https://example.test/api/origins/select", { originId: "review-shop" }), env);
    expect(selected.status).toBe(200);
    expect(await selected.json()).toMatchObject({ selected: { id: "review-shop" }, sessionless: true });
  });

  it("reports the active catalog adapter and page health", async () => {
    mockUpstream();
    const response = await handleRequest(new Request("https://example.test/api/origins/health?originId=review-shop"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "live",
      catalog: { live: true, adapter: "shopify-products-json" },
      page: { live: true, path: "/products/the-complete-snowboard" },
    });
  });

  it("returns live products JSON catalog offers", async () => {
    mockUpstream();
    const response = await handleRequest(new Request("https://example.test/api/catalog?query=complete&limit=4&originId=review-shop"), env);
    const body = await response.json() as { live: boolean; source: string; offers: Array<{ handle: string }> };
    expect(response.status).toBe(200);
    expect(body.live).toBe(true);
    expect(body.source).toBe("shopify-products-json");
    expect(body.offers[0]?.handle).toBe("the-complete-snowboard");
  });

  it("rejects unknown origins and configured hostname mismatches", async () => {
    const unknown = await handleRequest(new Request("https://example.test/api/catalog?originId=unknown-shop"), env);
    expect(unknown.status).toBe(400);

    mockUpstream();
    const mismatchedEnv: Env = Object.assign({}, env);
    Reflect.set(mismatchedEnv, "CATALOG_SHOP", "different-shop.myshopify.com");
    const mismatch = await handleRequest(new Request("https://example.test/api/catalog?originId=review-shop"), mismatchedEnv);
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toMatchObject({ error: expect.stringContaining("does not match"), code: "ORIGIN_MISMATCH", retryable: false });
  });

  it("returns a product by validated handle", async () => {
    mockUpstream();
    const response = await handleRequest(new Request("https://example.test/api/products/the-complete-snowboard?originId=review-shop"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ offers: [{ handle: "the-complete-snowboard" }] });
  });

  it("rejects path traversal handles and duplicate comparisons", async () => {
    const traversal = await handleRequest(new Request("https://example.test/api/products/%2E%2E%2Fsecret"), env);
    expect(traversal.status).toBe(400);
    const comparison = await handleRequest(new Request("https://example.test/api/compare?handles=selling-plans-ski-wax,selling-plans-ski-wax"), env);
    expect(comparison.status).toBe(400);
  });

  it("interpolates one allowlisted product path into Offer plus stripped Markdown", async () => {
    mockUpstream();
    const response = await handleRequest(new Request("https://example.test/api/interpolate?originId=review-shop&path=%2Fproducts%2Fthe-complete-snowboard"), env);
    const body = await response.json() as { canonicalUrl: string; pageLive: boolean; offer: { handle: string }; markdown: string };
    expect(response.status).toBe(200);
    expect(body.pageLive).toBe(true);
    expect(body.canonicalUrl).toBe("https://agentic-app-review-test.myshopify.com/products/the-complete-snowboard");
    expect(body.offer.handle).toBe("the-complete-snowboard");
    expect(body.markdown).toContain("Page body fact.");
    expect(body.markdown).not.toContain("Remove navigation");
    expect(body.markdown).not.toContain("Remove footer");
  });

  it("rejects interpolation outside the origin path allowlist", async () => {
    const collection = await handleRequest(new Request("https://example.test/api/interpolate?originId=review-shop&path=%2Fcollections%2Fall"), env);
    expect(collection.status).toBe(400);
    expect(await collection.json()).toMatchObject({ code: "PATH_NOT_ALLOWED", retryable: false });
    const external = await handleRequest(new Request("https://example.test/api/interpolate?originId=review-shop&path=https%3A%2F%2Fevil.example%2Fproducts%2Fx"), env);
    expect(external.status).toBe(400);
  });

  it("creates a catalog brief and rejects query-body origin mismatches", async () => {
    mockUpstream();
    const response = await handleRequest(jsonRequest("https://example.test/api/brief?originId=review-shop", {
      originId: "review-shop",
      goal: "Find an available board.",
      handles: ["the-complete-snowboard"],
    }), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ brief: expect.stringContaining("Catalog brief") });

    const mismatch = await handleRequest(jsonRequest("https://example.test/api/brief?originId=review-shop", {
      originId: "unknown-shop",
      goal: "Find an available board.",
      handles: ["the-complete-snowboard"],
    }), env);
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toMatchObject({ error: expect.stringContaining("does not match") });
  });

  it("stages a quote without committing and commits only with the human header", async () => {
    mockUpstream();
    const proposal = await handleRequest(jsonRequest("https://example.test/api/cart/propose?originId=review-shop", {
      originId: "review-shop",
      handle: "the-complete-snowboard",
      variantTitle: "Ice",
      quantity: 1,
    }), env);
    const proposed = await proposal.json() as { quote: { quoteId: string; expiresAt: string }; confirmation: { status: string }; receipt?: unknown };
    expect(proposal.status).toBe(200);
    expect(proposed.confirmation.status).toBe("awaiting_human_confirmation");
    expect(proposed.receipt).toBeUndefined();

    const commitBody = {
      originId: "review-shop",
      quoteId: proposed.quote.quoteId,
      expiresAt: proposed.quote.expiresAt,
      handle: "the-complete-snowboard",
      variantTitle: "Ice",
      quantity: 1,
    };
    const blocked = await handleRequest(jsonRequest("https://example.test/api/cart/commit?originId=review-shop", commitBody), env);
    expect(blocked.status).toBe(400);

    const confirmed = await handleRequest(jsonRequest(
      "https://example.test/api/cart/commit?originId=review-shop",
      commitBody,
      { "X-Agentic-Human-Confirm": "true" },
    ), env);
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ receipt: { status: "in_cart" }, confirmation: { status: "confirmed" } });
  });

  it("rejects invalid result counts, media types, oversized bodies, and unknown routes", async () => {
    expect((await handleRequest(new Request("https://example.test/api/catalog?limit=99"), env)).status).toBe(400);
    expect((await handleRequest(new Request("https://example.test/api/brief", { method: "POST", body: "x" }), env)).status).toBe(415);
    expect((await handleRequest(jsonRequest("https://example.test/api/brief", { goal: "x".repeat(5000), handles: ["the-complete-snowboard"] }), env)).status).toBe(400);
    expect((await handleRequest(new Request("https://example.test/api/missing"), env)).status).toBe(404);
    expect((await handleRequest(new Request("https://example.test/health", { method: "POST" }), env)).status).toBe(405);
  });
});
