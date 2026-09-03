import { describe, expect, it, vi } from "vitest";
import { createAgenticTools, registerAgenticTools } from "../public/tools.js";

function actions() {
  return {
    listOrigins: vi.fn(async () => "origins"),
    selectOrigin: vi.fn(async () => "selected"),
    search: vi.fn(async () => "search"),
    recommend: vi.fn(async () => "recommend"),
    get: vi.fn(async () => "get"),
    compare: vi.fn(async () => "compare"),
    interpolate: vi.fn(async () => "interpolate"),
    brief: vi.fn(async () => "brief"),
    itinerary: vi.fn(async () => "itinerary"),
    proposeCart: vi.fn(async () => "proposal"),
  };
}

const toolNames = [
  "list_origins",
  "select_origin",
  "search_products",
  "find_best_options",
  "get_product",
  "compare_products",
  "interpolate_page",
  "create_catalog_brief",
  "create_activity_itinerary",
  "propose_add_to_cart",
];

describe("WebMCP tool contract", () => {
  it("defines the coherent ten-tool origin and Offer surface", () => {
    expect(createAgenticTools(actions()).map((tool) => tool.name)).toEqual(toolNames);
  });

  it("marks nine read tools and one human-confirmed proposal tool", () => {
    const tools = createAgenticTools(actions());
    for (const tool of tools.slice(0, 9)) {
      expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeLessThanOrEqual(500);
    }
    expect(tools[9].annotations).toEqual({ readOnlyHint: false, untrustedContentHint: true, destructiveHint: false });
    expect(tools[9].description.length).toBeLessThanOrEqual(500);
  });

  it("keeps tool and parameter metadata within compact browser budgets", () => {
    for (const tool of createAgenticTools(actions())) {
      expect(tool.name.length).toBeLessThanOrEqual(64);
      expect(tool.description.length).toBeLessThanOrEqual(500);
      for (const [name, schema] of Object.entries(tool.inputSchema.properties ?? {})) {
        expect(name.length).toBeLessThanOrEqual(64);
        expect(schema.description?.length ?? 0).toBeLessThanOrEqual(150);
      }
    }
  });

  it("registers every tool and forwards cancellation", async () => {
    const handlers = actions();
    const registerTool = vi.fn(async () => undefined);
    const tools = await registerAgenticTools({ registerTool }, handlers);
    expect(registerTool).toHaveBeenCalledTimes(10);
    const signal = new AbortController().signal;
    await tools[2].execute({ query: "wax" }, { signal });
    expect(handlers.search).toHaveBeenCalledWith({ query: "wax" }, signal);
    await tools[8].execute({ goal: "Plan a lesson", handles: ["north-shore-surf-foundations"] }, { signal });
    expect(handlers.itinerary).toHaveBeenCalledWith({ goal: "Plan a lesson", handles: ["north-shore-surf-foundations"] }, signal);
  });

  it("exposes bounded taste and intent without requiring a profile", () => {
    const recommendation = createAgenticTools(actions()).find((tool) => tool.name === "find_best_options");
    expect(recommendation.inputSchema.required).toEqual(["query"]);
    expect(recommendation.inputSchema.properties.shoppingFor.enum).toEqual(["self", "gift"]);
    expect(recommendation.inputSchema.properties.mode.enum).toEqual(["decide", "explore"]);
    expect(recommendation.inputSchema.properties.priorities).toMatchObject({ maxItems: 3, uniqueItems: true });
    expect(recommendation.inputSchema.properties.tasteContext.maxLength).toBe(120);
    expect(recommendation.inputSchema.properties.refinementChoice.enum).toEqual(["match", "taste", "condition", "price", "returns", "delivery"]);
  });

  it("exposes bounded itinerary constraints without a booking capability", () => {
    const itinerary = createAgenticTools(actions()).find((tool) => tool.name === "create_activity_itinerary");
    expect(itinerary.inputSchema.properties).toMatchObject({
      days: { minimum: 1, maximum: 3 },
      partySize: { minimum: 1, maximum: 20 },
      budget: { minimum: 25, maximum: 100000 },
      pace: { enum: ["relaxed", "balanced", "full"] },
      earliestStart: { pattern: expect.any(String) },
      latestEnd: { pattern: expect.any(String) },
    });
    expect(itinerary.description).toContain("never reserves");
  });

  it("does not register a cart commit or checkout tool", () => {
    expect(createAgenticTools(actions()).map((tool) => tool.name)).not.toContain("commit_add_to_cart");
    expect(createAgenticTools(actions()).map((tool) => tool.name)).not.toContain("checkout");
  });

  it("fails closed when WebMCP registration is unavailable", async () => {
    await expect(registerAgenticTools({}, actions())).rejects.toThrow("registerTool is unavailable");
  });
});
