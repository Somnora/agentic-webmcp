import { describe, expect, it, vi } from "vitest";
import { createAgenticTools, registerAgenticTools } from "../public/tools.js";

function actions() {
  return {
    search: vi.fn(async () => "search"),
    get: vi.fn(async () => "get"),
    compare: vi.fn(async () => "compare"),
    brief: vi.fn(async () => "brief"),
  };
}

describe("WebMCP tool contract", () => {
  it("defines the four focused commerce tools", () => {
    expect(createAgenticTools(actions()).map((tool) => tool.name)).toEqual([
      "search_products",
      "get_product",
      "compare_products",
      "create_catalog_brief",
    ]);
  });

  it("marks every tool as read-only with untrusted catalog content", () => {
    for (const tool of createAgenticTools(actions())) {
      expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.description.length).toBeLessThanOrEqual(500);
    }
  });

  it("registers every tool and forwards cancellation", async () => {
    const handlers = actions();
    const registerTool = vi.fn(async () => undefined);
    const tools = await registerAgenticTools({ registerTool }, handlers);
    expect(registerTool).toHaveBeenCalledTimes(4);
    const signal = new AbortController().signal;
    await tools[0].execute({ query: "hoodie" }, { signal });
    expect(handlers.search).toHaveBeenCalledWith({ query: "hoodie" }, signal);
  });

  it("fails closed when WebMCP registration is unavailable", async () => {
    await expect(registerAgenticTools({}, actions())).rejects.toThrow("registerTool is unavailable");
  });
});
