import { describe, expect, it } from "vitest";
import { handleDemoOriginRequest } from "../src/demo-origin";

const base = "https://agentic-webmcp-origin.somnora.workers.dev";

describe("controlled public demo origin", () => {
  it("reports a bounded health record", async () => {
    const response = handleDemoOriginRequest(new Request(`${base}/health`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "agentic-webmcp-origin", products: 4 });
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("serves the original fixture catalog as public product JSON", async () => {
    const response = handleDemoOriginRequest(new Request(`${base}/products.json?limit=24`));
    const body = await response.json() as { products: Array<{ handle: string; image: null }> };
    expect(body.products.map((product) => product.handle)).toEqual([
      "field-notebook",
      "travel-cable-organizer",
      "modular-desk-tray",
      "studio-tool-roll",
    ]);
    expect(body.products.every((product) => product.image === null)).toBe(true);
  });

  it("serves one product as JSON and semantic HTML", async () => {
    const product = handleDemoOriginRequest(new Request(`${base}/products/field-notebook.json`));
    const productBody = await product.json() as { handle: string; variants: Array<{ title: string; available: boolean }> };
    expect(productBody.handle).toBe("field-notebook");
    expect(productBody.variants[0]).toMatchObject({ title: "Sand", available: true });

    const page = handleDemoOriginRequest(new Request(`${base}/products/field-notebook`));
    const html = await page.text();
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("Field Notebook");
    expect(html).toContain("Demonstration data only");
    expect(html).not.toContain("<form");
  });

  it("rejects unknown products and write methods", async () => {
    expect(handleDemoOriginRequest(new Request(`${base}/products/unknown.json`)).status).toBe(404);
    expect(handleDemoOriginRequest(new Request(`${base}/products.json`, { method: "POST" })).status).toBe(405);
  });
});
