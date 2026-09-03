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
      description: "List the exact HTTPS product and service origin scopes this page is allowed to read and show their data mode and configured adapters in the shared interface.",
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
      description: "Search normalized Offers on the selected allowlisted origin and show matching products or services in the shared page interface.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Words to match, such as electric guitar, surf lesson, archery lesson, or massage." },
          maxResults: { type: "integer", minimum: 1, maximum: 8, description: "Maximum number of results to return." },
        },
        required: ["query"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.search(args, signal),
    },
    {
      name: "find_best_options",
      description: "Rank marketplace offers with session-only taste and priorities. If strong options depend on different tradeoffs, ask one refinement question before presenting the final ranking.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What the shopper wants, such as electric guitar." },
          maxDeliveredPrice: { type: "number", minimum: 25, maximum: 100000, description: "Optional budget including listed shipping." },
          maxResults: { type: "integer", minimum: 1, maximum: 8, description: "Maximum ranked options to return." },
          shoppingFor: { type: "string", enum: ["self", "gift"], description: "Whether this decision is for the shopper or a gift recipient." },
          mode: { type: "string", enum: ["decide", "explore"], description: "Choose a narrow decision or a broader set worth exploring." },
          priorities: { type: "array", maxItems: 3, uniqueItems: true, items: { type: "string", enum: ["match", "taste", "condition", "price", "returns", "delivery"] }, description: "Up to three factors to emphasize in the visible rubric." },
          tasteContext: { type: "string", maxLength: 120, description: "Optional taste or recipient context matched against source facts." },
          mustHave: { type: "string", maxLength: 80, description: "Optional source-backed words every result must include." },
          avoid: { type: "string", maxLength: 80, description: "Optional source-backed words that exclude a result." },
          refinementChoice: { type: "string", enum: ["match", "taste", "condition", "price", "returns", "delivery"], description: "Answer to a returned refinement checkpoint. Omit on the first pass." },
        },
        required: ["query"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.recommend(args, signal),
    },
    {
      name: "get_product",
      description: "Get normalized facts for one product or service handle on the selected origin, then show it in the shared interface.",
      inputSchema: {
        type: "object",
        properties: { handle: { type: "string", description: "Stable lowercase Offer handle returned by search_products." } },
        required: ["handle"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.get(args, signal),
    },
    {
      name: "compare_products",
      description: "Compare normalized facts for two to four product or service handles on one selected origin and display a side-by-side view for the human.",
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
      description: "Read one allowlisted product or service path, remove page chrome, and show compact Markdown plus the normalized Offer and canonical origin URL.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Allowlisted product or service path, such as /products/sunburst-s-style-electric or /services/north-shore-surf-foundations." } },
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
          handles: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" }, description: "One to four unique Offer handles." },
        },
        required: ["goal", "handles"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.brief(args, signal),
    },
    {
      name: "create_activity_itinerary",
      description: "Build a constraint-aware, planning-only itinerary from one to four service Offers. It checks destination, date, published windows, party size, budget, pace, day hours, evidence, and transition buffers. This never reserves, contacts, or pays a provider.",
      inputSchema: {
        type: "object",
        properties: {
          goal: { type: "string", maxLength: 160, description: "The activity or trip-planning goal." },
          handles: { type: "array", minItems: 1, maxItems: 4, uniqueItems: true, items: { type: "string" }, description: "One to four itinerary-eligible service handles." },
          date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$", description: "Optional planning date in YYYY-MM-DD format." },
          days: { type: "integer", minimum: 1, maximum: 3, description: "Number of consecutive planning days, from one to three." },
          partySize: { type: "integer", minimum: 1, maximum: 20, description: "Number of people for party-size and per-person price checks." },
          budget: { type: "number", minimum: 25, maximum: 100000, description: "Optional total activity budget in the selected origin currency." },
          pace: { type: "string", enum: ["relaxed", "balanced", "full"], description: "Daily activity density and transition-buffer policy." },
          earliestStart: { type: "string", pattern: "^[0-9]{2}:[0-9]{2}$", description: "Earliest proposed local start in 24-hour HH:MM format." },
          latestEnd: { type: "string", pattern: "^[0-9]{2}:[0-9]{2}$", description: "Latest proposed local end in 24-hour HH:MM format." },
        },
        required: ["goal", "handles"],
      },
      annotations: READ_ONLY_ANNOTATIONS,
      execute: (args, { signal } = {}) => actions.itinerary(args, signal),
    },
    {
      name: "propose_add_to_cart",
      description: "Stage one fresh, live, eligible listing as a visible purchase review. Fallback or stale offers are rejected. Nothing changes until the human clicks Approve for handoff. This never checks out, places an order, or charges.",
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
