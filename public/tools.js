const READ_ONLY_ANNOTATIONS = Object.freeze({ readOnlyHint: true, untrustedContentHint: true });
const CONFIRM_WRITE_ANNOTATIONS = Object.freeze({
  readOnlyHint: false,
  untrustedContentHint: true,
  destructiveHint: false,
});

export function createAgenticTools(actions) {
  return [
    {
      name: "list_origins",
      description: "List the exact HTTPS product origins this page is allowed to read and show their data mode and configured adapters in the shared interface.",
      inputSchema: { type: "object", properties: {} },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.listOrigins(args, signal),
    },
    {
      name: "select_origin",
      description: "Select one allowlisted origin for later tools and update the visible origin badge. Selection is page-local and does not create a server session.",
      inputSchema: {
        type: "object",
        properties: { originId: { type: "string", description: "Stable origin id returned by list_origins." } },
        required: ["originId"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.selectOrigin(args, signal),
    },
    {
      name: "search_products",
      description: "Search offers on the selected allowlisted origin and show matching products or listings in the shared page interface.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product words to match, such as electric guitar or acoustic guitar." },
          maxResults: { type: "integer", minimum: 1, maximum: 8, description: "Maximum number of results to return." },
        },
        required: ["query"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.search(args, signal),
    },
    {
      name: "find_best_options",
      description: "Rank marketplace offers by query relevance, condition, delivered price, seller confidence, and returns. Show the scored shortlist in the shared interface.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What the shopper wants, such as electric guitar." },
          maxDeliveredPrice: { type: "number", minimum: 25, maximum: 100000, description: "Optional budget including listed shipping." },
          maxResults: { type: "integer", minimum: 1, maximum: 8, description: "Maximum ranked options to return." },
        },
        required: ["query"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.recommend(args, signal),
    },
    {
      name: "get_product",
      description: "Get normalized offer facts and sampled variants for one product handle on the selected origin, then show it in the shared interface.",
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
      description: "Compare normalized facts for two to four handles on one selected origin and display a side-by-side view for the human.",
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
      name: "interpolate_page",
      description: "Read one allowlisted product path on the selected origin, remove page chrome, and show compact Markdown plus the normalized Offer and canonical origin URL.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Allowlisted product path only, such as /products/sunburst-s-style-electric." } },
        required: ["path"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.interpolate(args, signal),
    },
    {
      name: "create_catalog_brief",
      description: "Create compact Markdown grounded in one to four selected offers from the selected origin and show the source selection to the human.",
      inputSchema: {
        type: "object",
        properties: {
          goal: { type: "string", description: "The shopper or catalog research goal to ground the brief." },
          handles: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" }, description: "One to four unique product handles." },
        },
        required: ["goal", "handles"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.brief(args, signal),
    },
    {
      name: "propose_add_to_cart",
      description: "Stage one available listing as a visible purchase review. Nothing changes until the human clicks Approve for handoff. This never checks out, places an order, or charges.",
      inputSchema: {
        type: "object",
        properties: {
          handle: { type: "string", description: "Product handle from search_products or get_product." },
          variantTitle: { type: "string", description: "Optional variant title returned by get_product, such as As listed." },
          quantity: { type: "integer", minimum: 1, maximum: 4, description: "Quantity to propose, from 1 to 4." },
        },
        required: ["handle"],
      },
      annotations: CONFIRM_WRITE_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.proposeCart(args, signal),
    },
  ];
}

export async function registerAgenticTools(modelContext, actions) {
  if (!modelContext?.registerTool) throw new TypeError("WebMCP registerTool is unavailable.");
  const tools = createAgenticTools(actions);
  await Promise.all(tools.map((tool) => modelContext.registerTool(tool)));
  return tools;
}
