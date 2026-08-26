import { registerAgenticTools } from "./tools.js";

const state = {
  selected: new Set(),
  products: [],
  activity: [],
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
};

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function price(product) {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  return min.amount === max.amount
    ? `${min.amount} ${min.currencyCode}`
    : `${min.amount}–${max.amount} ${min.currencyCode}`;
}

function compactProduct(product, withVariants = false) {
  const summary = {
    handle: product.handle,
    title: product.title,
    description: product.description.slice(0, 180),
    price: price(product),
    sampledVariants: product.variants.length,
    availableVariants: product.variants.filter((variant) => variant.availableForSale).length,
  };
  if (withVariants) {
    summary.variants = product.variants.slice(0, 6).map((variant) => ({
      title: variant.title,
      price: `${variant.price.amount} ${variant.price.currencyCode}`,
      available: variant.availableForSale,
    }));
  }
  return summary;
}

function compactOutput(payload, withVariants = false) {
  const products = payload.products.map((product) => compactProduct(product, withVariants));
  const envelope = { source: payload.source, live: payload.live, products };
  let result = JSON.stringify(envelope);
  while (result.length > 1450 && products.length > 1) {
    products.pop();
    envelope.truncated = true;
    result = JSON.stringify(envelope);
  }
  if (result.length > 1450) {
    for (const product of products) {
      delete product.variants;
      product.description = product.description.slice(0, 80);
    }
    envelope.truncated = true;
    result = JSON.stringify(envelope);
  }
  return result;
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

function updateSource(payload) {
  elements.source.textContent = payload.live ? "Live Shopify Mock Shop" : "Labeled fallback snapshot";
  elements.source.classList.toggle("fallback", !payload.live);
  elements.message.textContent = payload.warning || `${payload.products.length} product result${payload.products.length === 1 ? "" : "s"}; externally sourced catalog text is treated as untrusted.`;
}

function recordActivity(tool, args, origin, resultText) {
  state.activity.unshift({ tool, args, origin, resultText, time: new Date() });
  state.activity = state.activity.slice(0, 7);
  elements.activity.replaceChildren();
  for (const item of state.activity) {
    const row = node("li", "activity-item");
    const header = node("header");
    const toolName = node("code", "", item.tool);
    const stamp = node("time", "", item.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    header.append(toolName, stamp);
    row.append(header, node("span", "activity-origin", item.origin), node("p", "", JSON.stringify(item.args)));
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

function renderProducts(products) {
  state.products = products;
  for (const handle of [...state.selected]) {
    if (!products.some((product) => product.handle === handle)) state.selected.delete(handle);
  }
  elements.grid.replaceChildren();
  if (products.length === 0) {
    elements.grid.append(node("p", "catalog-message", "No products matched. Try a broader catalog term."));
    updateSelection();
    return;
  }
  for (const product of products) {
    const card = node("article", `product-card${state.selected.has(product.handle) ? " selected" : ""}`);
    const meta = node("div", "product-meta");
    meta.append(node("span", "", price(product)), node("span", "", `${product.variants.filter((variant) => variant.availableForSale).length}/${product.variants.length} available`));
    const actions = node("div", "product-actions");
    const label = node("label", "select-label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(product.handle);
    checkbox.setAttribute("aria-label", `Select ${product.title} for comparison`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(product.handle); else state.selected.delete(product.handle);
      card.classList.toggle("selected", checkbox.checked);
      updateSelection();
    });
    label.append(checkbox, document.createTextNode("Select"));
    const details = node("button", "", "Inspect");
    details.type = "button";
    details.addEventListener("click", () => runGetProduct({ handle: product.handle }, "human preview"));
    actions.append(label, details);
    card.append(node("h3", "", product.title), meta, node("p", "", product.description || "No catalog description supplied."), actions);
    elements.grid.append(card);
  }
  updateSelection();
}

function renderComparison(products) {
  elements.grid.replaceChildren();
  for (const product of products) {
    const card = node("article", "product-card selected");
    const available = product.variants.filter((variant) => variant.availableForSale).length;
    card.append(
      node("span", "kicker", "COMPARISON"),
      node("h3", "", product.title),
      node("div", "product-meta", price(product)),
      node("p", "", `${available} of ${product.variants.length} sampled variants available. ${product.description}`),
    );
    elements.grid.append(card);
  }
}

async function runSearch({ query = "", maxResults = 6 }, origin = "agent", signal) {
  const payload = await api(`/api/catalog?query=${encodeURIComponent(query)}&limit=${encodeURIComponent(maxResults)}`, { signal });
  updateSource(payload);
  renderProducts(payload.products);
  const output = compactOutput(payload);
  recordActivity("search_products", { query, maxResults }, origin, output);
  return output;
}

async function runGetProduct({ handle }, origin = "agent", signal) {
  const payload = await api(`/api/products/${encodeURIComponent(handle)}`, { signal });
  updateSource(payload);
  renderProducts(payload.products);
  const output = compactOutput(payload, true);
  recordActivity("get_product", { handle }, origin, output);
  return output;
}

async function runCompare({ handles }, origin = "agent", signal) {
  const normalized = [...new Set(handles)].slice(0, 4);
  const payload = await api(`/api/compare?handles=${encodeURIComponent(normalized.join(","))}`, { signal });
  updateSource(payload);
  renderComparison(payload.products);
  const output = compactOutput(payload);
  recordActivity("compare_products", { handles: normalized }, origin, output);
  return output;
}

async function runBrief({ goal, handles }, origin = "agent", signal) {
  const payload = await api("/api/brief", { method: "POST", signal, body: JSON.stringify({ goal, handles: [...new Set(handles)].slice(0, 4) }) });
  updateSource(payload);
  renderComparison(payload.products);
  recordActivity("create_catalog_brief", { goal, handles }, origin, payload.brief);
  return payload.brief;
}

async function registerWebMcpTools() {
  if (!document.modelContext?.registerTool) {
    elements.status.textContent = "Manual preview ready · WebMCP API not detected";
    return;
  }
  const tools = await registerAgenticTools(document.modelContext, {
    search: (args, signal) => runSearch(args, "agent via WebMCP", signal),
    get: (args, signal) => runGetProduct(args, "agent via WebMCP", signal),
    compare: (args, signal) => runCompare(args, "agent via WebMCP", signal),
    brief: (args, signal) => runBrief(args, "agent via WebMCP", signal),
  });
  elements.status.textContent = `${tools.length} WebMCP tools registered`;
  elements.statusCluster.classList.add("ready");
}

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

elements.briefForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runBrief({ goal: elements.briefGoal.value, handles: [...state.selected] }, "human preview").catch(showError);
});

function showError(error) {
  const message = error instanceof Error ? error.message : "The tool request failed.";
  elements.message.textContent = message;
  recordActivity("tool_error", {}, "system", message);
}

await registerWebMcpTools().catch(showError);
await runSearch({ query: "", maxResults: 6 }, "page initialization").catch(showError);
