import { registerAgenticTools } from "./tools.js";

const state = {
  originId: "review-shop",
  origin: null,
  origins: [],
  selected: new Set(),
  offers: [],
  activity: [],
  proposal: null,
  receipts: [],
};

const elements = {
  status: document.querySelector("#webmcp-status"),
  statusCluster: document.querySelector(".status-cluster"),
  source: document.querySelector("#source-badge"),
  message: document.querySelector("#catalog-message"),
  grid: document.querySelector("#product-grid"),
  activity: document.querySelector("#activity-list"),
  result: document.querySelector("#result-panel"),
  searchForm: document.querySelector("#search-form"),
  searchInput: document.querySelector("#search-input"),
  compareButton: document.querySelector("#compare-button"),
  selectionCount: document.querySelector("#selection-count"),
  briefForm: document.querySelector("#brief-form"),
  briefGoal: document.querySelector("#brief-goal"),
  briefButton: document.querySelector("#brief-button"),
  originSelect: document.querySelector("#origin-select"),
  originMeta: document.querySelector("#origin-meta"),
  interpolateForm: document.querySelector("#interpolate-form"),
  interpolatePath: document.querySelector("#interpolate-path"),
  interpolateView: document.querySelector("#interpolate-view"),
  interpolateCanonical: document.querySelector("#interpolate-canonical"),
  interpolateMarkdown: document.querySelector("#interpolate-markdown"),
  confirmPanel: document.querySelector("#confirm-panel"),
  confirmCopy: document.querySelector("#confirm-copy"),
  confirmCart: document.querySelector("#confirm-cart"),
  dismissCart: document.querySelector("#dismiss-cart"),
  cartEmpty: document.querySelector("#cart-empty"),
  cartList: document.querySelector("#cart-list"),
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function price(offer) {
  const min = offer.priceRange.min;
  const max = offer.priceRange.max;
  return min.amount === max.amount
    ? `${min.amount} ${min.currencyCode}`
    : `${min.amount}-${max.amount} ${min.currencyCode}`;
}

function compactOffer(offer, withVariants = false) {
  const summary = {
    originId: offer.originId,
    handle: offer.handle,
    title: offer.title,
    description: offer.description.slice(0, 140),
    price: price(offer),
    available: offer.constraints.available,
    adapter: offer.source.adapter,
    live: offer.source.live,
  };
  if (withVariants) {
    summary.variants = offer.variants.slice(0, 5).map((variant) => ({
      title: variant.title,
      price: `${variant.price.amount} ${variant.price.currencyCode}`,
      available: variant.available,
    }));
  }
  return summary;
}

function boundedJson(value) {
  let output = JSON.stringify(value);
  if (output.length <= 1450) return output;
  if (Array.isArray(value.offers)) {
    while (output.length > 1450 && value.offers.length > 1) {
      value.offers.pop();
      value.truncated = true;
      output = JSON.stringify(value);
    }
  }
  if (output.length > 1450) {
    return JSON.stringify({
      originId: state.originId,
      truncated: true,
      message: "The full result is visible in the shared workspace.",
    });
  }
  return output;
}

function compactCatalog(payload, withVariants = false) {
  return boundedJson({
    origin: payload.origin,
    source: payload.source,
    live: payload.live,
    offers: payload.offers.map((offer) => compactOffer(offer, withVariants)),
    ...(payload.warning ? { warning: payload.warning.slice(0, 180) } : {}),
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

function originQuery() {
  return `originId=${encodeURIComponent(state.originId)}`;
}

function updateOrigin(origin, live, source) {
  if (origin) {
    state.origin = origin;
    state.originId = origin.id;
    elements.originSelect.value = origin.id;
  }
  if (!state.origin) return;
  const mode = live === undefined ? "status pending" : live ? "live" : "fallback";
  const activeSource = source || state.origin.adapter;
  elements.originMeta.textContent = `${state.origin.displayName} | ${state.origin.hostname} | ${state.origin.adapter} with ${state.origin.fallbackAdapters.join(", ")} fallback | ${mode}`;
  elements.source.textContent = `${live === undefined ? "PENDING" : live ? "LIVE" : "FALLBACK"} | ${activeSource}`;
  elements.source.classList.toggle("fallback", live === false);
}

function updateSource(payload) {
  updateOrigin(payload.origin, payload.live, payload.source);
  const count = payload.offers?.length ?? (payload.offer ? 1 : 0);
  elements.message.textContent = payload.warning || `${count} offer result${count === 1 ? "" : "s"}. External origin content is treated as untrusted.`;
}

function recordActivity(tool, args, actor, resultText) {
  state.activity.unshift({ tool, args, actor, originId: state.originId, time: new Date() });
  state.activity = state.activity.slice(0, 7);
  elements.activity.replaceChildren();
  for (const item of state.activity) {
    const row = node("li", "activity-item");
    const header = node("header");
    header.append(
      node("code", "", item.tool),
      node("time", "", item.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })),
    );
    row.append(header, node("span", "activity-origin", `${item.actor} | ${item.originId}`), node("p", "", JSON.stringify(item.args)));
    elements.activity.append(row);
  }
  elements.result.replaceChildren(node("span", "kicker", "LATEST RESULT"), node("pre", "", resultText));
}

function updateSelection() {
  const count = state.selected.size;
  elements.selectionCount.textContent = `${count} product${count === 1 ? "" : "s"} selected`;
  elements.compareButton.disabled = count < 2 || count > 4;
  elements.briefButton.disabled = count < 1 || count > 4;
}

function hideInterpolate() {
  elements.interpolateView.hidden = true;
}

function renderOffers(offers) {
  state.offers = offers;
  for (const handle of [...state.selected]) {
    if (!offers.some((offer) => offer.handle === handle)) state.selected.delete(handle);
  }
  elements.grid.replaceChildren();
  if (offers.length === 0) {
    elements.grid.append(node("p", "catalog-message", "No offers matched. Try a broader catalog term."));
    updateSelection();
    return;
  }
  for (const offer of offers) {
    const card = node("article", `product-card${state.selected.has(offer.handle) ? " selected" : ""}`);
    const available = offer.variants.filter((variant) => variant.available).length;
    const meta = node("div", "product-meta");
    meta.append(node("span", "", price(offer)), node("span", "", `${available}/${offer.variants.length} available`));
    const actions = node("div", "product-actions");
    const label = node("label", "select-label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(offer.handle);
    checkbox.setAttribute("aria-label", `Select ${offer.title} for comparison`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(offer.handle); else state.selected.delete(offer.handle);
      card.classList.toggle("selected", checkbox.checked);
      updateSelection();
    });
    label.append(checkbox, document.createTextNode("Select"));
    const inspect = node("button", "", "Inspect");
    inspect.type = "button";
    inspect.addEventListener("click", () => runGetProduct({ handle: offer.handle }, "human preview").catch(showError));
    const propose = node("button", "", "Propose");
    propose.type = "button";
    propose.disabled = !offer.constraints.available;
    propose.addEventListener("click", () => runProposeCart({ handle: offer.handle, quantity: 1 }, "human preview").catch(showError));
    actions.append(label, inspect, propose);
    card.append(node("h3", "", offer.title), meta, node("p", "", offer.description || "No origin description supplied."), actions);
    elements.grid.append(card);
  }
  updateSelection();
}

function renderComparison(offers) {
  elements.grid.replaceChildren();
  for (const offer of offers) {
    const available = offer.variants.filter((variant) => variant.available).length;
    const card = node("article", "product-card selected");
    card.append(
      node("span", "kicker", "COMPARISON"),
      node("h3", "", offer.title),
      node("div", "product-meta", price(offer)),
      node("p", "", `${available} of ${offer.variants.length} sampled variants available. ${offer.description}`),
    );
    elements.grid.append(card);
  }
}

async function runListOrigins(_args = {}, actor = "agent", signal, record = true) {
  const payload = await api("/api/origins", { signal });
  state.origins = payload.origins;
  state.originId = state.originId || payload.defaultOriginId;
  elements.originSelect.replaceChildren();
  for (const origin of payload.origins) {
    const option = node("option", "", `${origin.displayName} | ${origin.hostname}`);
    option.value = origin.id;
    elements.originSelect.append(option);
  }
  updateOrigin(payload.origins.find((origin) => origin.id === state.originId) || payload.origins[0]);
  const output = boundedJson(payload);
  if (record) recordActivity("list_origins", {}, actor, output);
  return output;
}

async function runSelectOrigin({ originId }, actor = "agent", signal) {
  const payload = await api("/api/origins/select", { method: "POST", signal, body: JSON.stringify({ originId }) });
  state.selected.clear();
  updateOrigin(payload.selected);
  updateSelection();
  hideInterpolate();
  const output = boundedJson(payload);
  recordActivity("select_origin", { originId }, actor, output);
  return output;
}

async function runSearch({ query = "", maxResults = 6 }, actor = "agent", signal) {
  const payload = await api(`/api/catalog?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(maxResults)}&${originQuery()}`, { signal });
  updateSource(payload);
  hideInterpolate();
  renderOffers(payload.offers);
  const output = compactCatalog(payload);
  recordActivity("search_products", { query, maxResults }, actor, output);
  return output;
}

async function runGetProduct({ handle }, actor = "agent", signal) {
  const payload = await api(`/api/products/${encodeURIComponent(handle)}?${originQuery()}`, { signal });
  updateSource(payload);
  hideInterpolate();
  renderOffers(payload.offers);
  const output = compactCatalog(payload, true);
  recordActivity("get_product", { handle }, actor, output);
  return output;
}

async function runCompare({ handles }, actor = "agent", signal) {
  const normalized = [...new Set(handles)].slice(0, 4);
  const payload = await api(`/api/compare?handles=${encodeURIComponent(normalized.join(","))}&${originQuery()}`, { signal });
  updateSource(payload);
  hideInterpolate();
  renderComparison(payload.offers);
  const output = compactCatalog(payload);
  recordActivity("compare_products", { handles: normalized }, actor, output);
  return output;
}

function normalizeInterpolateInput(input) {
  const value = input.trim();
  if (!value.startsWith("http://") && !value.startsWith("https://")) return value;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== state.origin.hostname || url.search || url.hash) {
    throw new Error("Product URL must match the selected HTTPS origin exactly.");
  }
  return url.pathname;
}

async function runInterpolate({ path }, actor = "agent", signal) {
  const normalizedPath = normalizeInterpolateInput(path);
  const payload = await api(`/api/interpolate?path=${encodeURIComponent(normalizedPath)}&${originQuery()}`, { signal });
  updateSource({ ...payload, offers: [payload.offer] });
  renderOffers([payload.offer]);
  elements.interpolateCanonical.textContent = payload.canonicalUrl;
  elements.interpolateMarkdown.textContent = payload.markdown;
  elements.interpolateView.hidden = false;
  elements.interpolateView.scrollIntoView({ block: "center" });
  const output = boundedJson({
    originId: payload.origin.id,
    canonicalUrl: payload.canonicalUrl,
    live: payload.live,
    pageLive: payload.pageLive,
    offer: compactOffer(payload.offer, true),
    markdown: payload.markdown.slice(0, 520),
    ...(payload.warning ? { warning: payload.warning.slice(0, 180) } : {}),
  });
  recordActivity("interpolate_page", { path: normalizedPath }, actor, output);
  return output;
}

async function runBrief({ goal, handles }, actor = "agent", signal) {
  const normalized = [...new Set(handles)].slice(0, 4);
  const payload = await api(`/api/brief?${originQuery()}`, {
    method: "POST",
    signal,
    body: JSON.stringify({ originId: state.originId, goal, handles: normalized }),
  });
  updateSource(payload);
  hideInterpolate();
  renderComparison(payload.offers);
  recordActivity("create_catalog_brief", { goal, handles: normalized }, actor, payload.brief);
  return payload.brief;
}

async function runProposeCart({ handle, variantTitle, quantity = 1 }, actor = "agent", signal) {
  const payload = await api(`/api/cart/propose?${originQuery()}`, {
    method: "POST",
    signal,
    body: JSON.stringify({ originId: state.originId, handle, variantTitle, quantity }),
  });
  updateSource(payload);
  state.proposal = payload.quote;
  const line = payload.quote.lines[0];
  elements.confirmCopy.textContent = `${line.quantity} x ${payload.offers[0].title}, ${line.variantTitle}, total ${payload.quote.total.amount} ${payload.quote.total.currencyCode}. The cart is still unchanged.`;
  elements.confirmPanel.hidden = false;
  elements.confirmPanel.scrollIntoView({ block: "center" });
  const output = boundedJson({
    quoteId: payload.quote.quoteId,
    originId: payload.quote.originId,
    status: payload.confirmation.status,
    line,
    total: payload.quote.total,
    cartChanged: false,
  });
  recordActivity("propose_add_to_cart", { handle, variantTitle, quantity }, actor, output);
  return output;
}

function renderCart() {
  elements.cartList.replaceChildren();
  elements.cartEmpty.hidden = state.receipts.length > 0;
  for (const receipt of state.receipts) {
    const line = receipt.lines[0];
    elements.cartList.append(node("li", "cart-line", `${line.quantity} x ${line.handle} | ${line.variantTitle} | ${receipt.total.amount} ${receipt.total.currencyCode} | in_cart`));
  }
}

async function confirmCart() {
  if (!state.proposal) return;
  const quote = state.proposal;
  const line = quote.lines[0];
  const payload = await api(`/api/cart/commit?${originQuery()}`, {
    method: "POST",
    headers: { "X-Agentic-Human-Confirm": "true" },
    body: JSON.stringify({
      originId: quote.originId,
      quoteId: quote.quoteId,
      expiresAt: quote.expiresAt,
      handle: line.handle,
      variantId: line.variantId,
      quantity: line.quantity,
    }),
  });
  state.receipts.unshift(payload.receipt);
  state.proposal = null;
  elements.confirmPanel.hidden = true;
  renderCart();
  recordActivity("human_confirm_add_to_cart", { quoteId: quote.quoteId }, "human button", boundedJson(payload.receipt));
}

function dismissCart() {
  if (!state.proposal) return;
  const quoteId = state.proposal.quoteId;
  state.proposal = null;
  elements.confirmPanel.hidden = true;
  recordActivity("human_dismiss_cart_proposal", { quoteId }, "human button", JSON.stringify({ quoteId, status: "dismissed", cartChanged: false }));
}

async function registerWebMcpTools() {
  if (!document.modelContext?.registerTool) {
    elements.status.textContent = "Manual preview ready | WebMCP API not detected";
    return;
  }
  const tools = await registerAgenticTools(document.modelContext, {
    listOrigins: (args, signal) => runListOrigins(args, "agent via WebMCP", signal),
    selectOrigin: (args, signal) => runSelectOrigin(args, "agent via WebMCP", signal),
    search: (args, signal) => runSearch(args, "agent via WebMCP", signal),
    get: (args, signal) => runGetProduct(args, "agent via WebMCP", signal),
    compare: (args, signal) => runCompare(args, "agent via WebMCP", signal),
    interpolate: (args, signal) => runInterpolate(args, "agent via WebMCP", signal),
    brief: (args, signal) => runBrief(args, "agent via WebMCP", signal),
    proposeCart: (args, signal) => runProposeCart(args, "agent via WebMCP", signal),
  });
  elements.status.textContent = `${tools.length} WebMCP tools registered`;
  elements.statusCluster.classList.add("ready");
}

elements.originSelect.addEventListener("change", () => {
  runSelectOrigin({ originId: elements.originSelect.value }, "human preview")
    .then(() => runSearch({ query: "", maxResults: 6 }, "human preview"))
    .catch(showError);
});

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch({ query: elements.searchInput.value, maxResults: 6 }, "human preview").catch(showError);
});

document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.searchInput.value = button.dataset.query;
    runSearch({ query: button.dataset.query, maxResults: 6 }, "human preview").catch(showError);
  });
});

elements.compareButton.addEventListener("click", () => {
  runCompare({ handles: [...state.selected] }, "human preview").catch(showError);
});

elements.interpolateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runInterpolate({ path: elements.interpolatePath.value }, "human preview").catch(showError);
});

elements.briefForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runBrief({ goal: elements.briefGoal.value, handles: [...state.selected] }, "human preview").catch(showError);
});

elements.confirmCart.addEventListener("click", () => confirmCart().catch(showError));
elements.dismissCart.addEventListener("click", dismissCart);

function showError(error) {
  const message = error instanceof Error ? error.message : "The tool request failed.";
  elements.message.textContent = message;
  recordActivity("tool_error", {}, "system", message);
}

await runListOrigins({}, "page initialization", undefined, false).catch(showError);
await registerWebMcpTools().catch(showError);
await runSearch({ query: "", maxResults: 6 }, "page initialization").catch(showError);
