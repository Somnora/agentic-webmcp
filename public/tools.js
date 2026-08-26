const READ_ONLY_ANNOTATIONS = Object.freeze({ readOnlyHint: true, untrustedContentHint: true });

export function createAgenticTools(actions) {
  return [
    {
      name: "search_products",
      description: "Search the commerce catalog by natural-language product terms and show matching products in the shared page interface.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product words to match, such as hoodie, cotton, or slides." },
          maxResults: { type: "integer", minimum: 1, maximum: 8, description: "Maximum number of results to return." },
        },
        required: ["query"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.search(args, signal),
    },
    {
      name: "get_product",
      description: "Get current catalog facts and sampled variants for one product handle, then show that product in the shared interface.",
      inputSchema: {
        type: "object",
        properties: { handle: { type: "string", description: "Stable lowercase product handle returned by search_products." } },
        required: ["handle"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.get(args, signal),
    },
    {
      name: "compare_products",
      description: "Compare catalog facts for two to four product handles and display a transparent side-by-side view for the human.",
      inputSchema: {
        type: "object",
        properties: {
          handles: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" }, description: "Two to four unique handles from search results." },
        },
        required: ["handles"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.compare(args, signal),
    },
    {
      name: "create_catalog_brief",
      description: "Create a compact Markdown brief grounded in one to four selected catalog products and show the source selection to the human.",
      inputSchema: {
        type: "object",
        properties: {
          goal: { type: "string", description: "The shopper or catalog-research goal to ground the brief." },
          handles: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" }, description: "One to four unique product handles." },
        },
        required: ["goal", "handles"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.brief(args, signal),
    },
  ];
}

export async function registerAgenticTools(modelContext, actions) {
  if (!modelContext?.registerTool) throw new TypeError("WebMCP registerTool is unavailable.");
  const tools = createAgenticTools(actions);
  await Promise.all(tools.map((tool) => modelContext.registerTool(tool)));
  return tools;
}
