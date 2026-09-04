import { describe, expect, it } from "vitest";
import { handleDemoOriginRequest } from "../src/demo-origin";

const base = "https://agentic-webmcp-origin.somnora.workers.dev";

describe("controlled public demo origin", () => {
  it("reports a bounded health record", async () => {
    const response = handleDemoOriginRequest(new Request(`${base}/health`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "agentic-webmcp-origin", products: 4, services: 20 });
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("serves the original fixture catalog as public product JSON", async () => {
    const response = handleDemoOriginRequest(new Request(`${base}/products.json?limit=24`));
    const body = await response.json() as { products: Array<{ handle: string; image: null }> };
    expect(body.products.map((product) => product.handle)).toEqual([
      "sunburst-s-style-electric",
      "mahogany-single-cut-electric",
      "natural-dreadnought-acoustic",
      "offset-electric-ocean-blue",
    ]);
    expect(body.products.every((product) => product.image === null)).toBe(true);
  });

  it("serves one product as JSON and semantic HTML", async () => {
    const product = handleDemoOriginRequest(new Request(`${base}/products/sunburst-s-style-electric.json`));
    const productBody = await product.json() as { handle: string; condition: string; variants: Array<{ title: string; available: boolean }> };
    expect(productBody.handle).toBe("sunburst-s-style-electric");
    expect(productBody.condition).toBe("excellent");
    expect(productBody.variants[0]).toMatchObject({ title: "As listed", available: true });

    const page = handleDemoOriginRequest(new Request(`${base}/products/sunburst-s-style-electric`));
    const html = await page.text();
    expect(page.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("Sunburst S-Style Electric Guitar");
    expect(html).toContain("99.8% positive");
    expect(html).toContain("Demonstration data only");
    expect(html).not.toContain("<form");
  });

  it("serves original service fixtures as JSON and semantic HTML", async () => {
    const catalog = handleDemoOriginRequest(new Request(`${base}/services.json?limit=24`));
    const catalogBody = await catalog.json() as { services: Array<{ handle: string }> };
    expect(catalogBody.services.map((service) => service.handle)).toEqual([
      "north-shore-surf-foundations",
      "haleiwa-food-story-walk",
      "windward-botanical-sketch-walk",
      "oahu-sunset-photo-walk",
      "tangier-traditional-archery",
      "honolulu-restorative-massage",
      "home-repair-walkthrough",
      "waikiki-courtyard-studio",
      "ko-olina-garden-rooms",
      "north-shore-cottage-stay",
      "oahu-shared-airport-transfer",
      "oahu-compact-car",
      "honolulu-garden-supper",
      "haleiwa-harbor-table",
      "oahu-residential-electrician",
      "oahu-finish-carpenter",
      "oahu-paint-finish-lead",
      "oahu-gaffer-lighting-technician",
      "oahu-location-sound-mixer",
      "oahu-production-designer",
    ]);

    const service = handleDemoOriginRequest(new Request(`${base}/services/north-shore-surf-foundations.json`));
    expect(await service.json()).toMatchObject({
      handle: "north-shore-surf-foundations",
      location: { city: "Haleiwa", country_code: "US" },
      itinerary_eligible: true,
    });
    const page = handleDemoOriginRequest(new Request(`${base}/services/north-shore-surf-foundations`));
    expect(page.headers.get("Content-Type")).toContain("text/html");
    const html = await page.text();
    expect(html).toContain('"@type":"Service"');
    expect(html).toContain("Published scheduling windows");
    expect(html).toContain("does not create a booking");

    const lodging = handleDemoOriginRequest(new Request(`${base}/services/waikiki-courtyard-studio`));
    const lodgingHtml = await lodging.text();
    expect(lodgingHtml).toContain("Stay length: 2 to 7 nights");
    expect(lodgingHtml).toContain('"name":"stay_nights_min"');

    const professional = handleDemoOriginRequest(new Request(`${base}/services/oahu-residential-electrician`));
    const professionalHtml = await professional.text();
    expect(professionalHtml).toContain("Provider identity: provider-kai-line-electric");
    expect(professionalHtml).toContain("state electrical license");
    expect(professionalHtml).toContain('"name":"professional_credentials"');
  });

  it("rejects unknown products and write methods", async () => {
    expect(handleDemoOriginRequest(new Request(`${base}/products/unknown.json`)).status).toBe(404);
    expect(handleDemoOriginRequest(new Request(`${base}/services/unknown.json`)).status).toBe(404);
    expect(handleDemoOriginRequest(new Request(`${base}/products.json`, { method: "POST" })).status).toBe(405);
  });
});
