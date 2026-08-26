import { describe, expect, it, vi } from "vitest";
import { createAgenticTools, registerAgenticTools } from "../public/tools.js";

function actions() {
  return {
    listOrigins: vi.fn(async () => "origins"),
    selectOrigin: vi.fn(async () => "selected"),
    search: vi.fn(async () => "search"),
    get: vi.fn(async () => "get"),
    compare: vi.fn(async () => "compare"),
    interpolate: vi.fn(async () => "interpolate"),
    brief: vi.fn(async () => "brief"),
    proposeCart: vi.fn(async () => "proposal"),
  };
}

const toolNames = [
  "list_origins",
  "select_origin",
  "search_products",
  "get_product",
  "compare_products",
  "interpolate_page",
  "create_catalog_brief",
  "propose_add_to_cart",
];

describe("WebMCP tool contract", () => {
  it("defines the coherent eight-tool origin and offer surface", () => {
    expect(createAgenticTools(actions()).map((tool) => tool.name)).toEqual(toolNames);
  });

  it("marks seven read tools and one human-confirmed proposal tool", () => {
    const tools = createAgenticTools(actions());
    for (const tool of tools.slice(0, 7)) {
      expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeLessThanOrEqual(500);
    }
    expect(tools[7].annotations).toEqual({ readOnlyHint: false, untrustedContentHint: true, destructiveHint: false });
    expect(tools[7].description.length).toBeLessThanOrEqual(500);
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
    expect(registerTool).toHaveBeenCalledTimes(8);
    const signal = new AbortController().signal;
    await tools[2].execute({ query: "wax" }, { signal });
    expect(handlers.search).toHaveBeenCalledWith({ query: "wax" }, signal);
  });

  it("does not register a cart commit or checkout tool", () => {
    expect(createAgenticTools(actions()).map((tool) => tool.name)).not.toContain("commit_add_to_cart");
    expect(createAgenticTools(actions()).map((tool) => tool.name)).not.toContain("checkout");
  });

  it("fails closed when WebMCP registration is unavailable", async () => {
    await expect(registerAgenticTools({}, actions())).rejects.toThrow("registerTool is unavailable");
  });
});
