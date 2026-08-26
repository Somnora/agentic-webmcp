const TOOL_STORIES = Object.freeze({
  list_origins: {
    selector: ".origin-control",
    detail: "The Worker reads origin records from one static allowlist. No tool can supply an arbitrary hostname.",
  },
  select_origin: {
    selector: ".origin-control",
    detail: "Selection changes page-local state. Every later read carries the stable origin id and is validated again on the Worker.",
  },
  search_products: {
    selector: "#product-grid",
    detail: "The adapter fetches bounded product JSON over HTTPS and normalizes every result into the shared Offer protocol.",
  },
  get_product: {
    selector: "#product-grid",
    detail: "A stable handle resolves to compact offer facts, variants, availability, and field-level provenance.",
  },
  interpolate_page: {
    selector: "#interpolate-view",
    detail: "The exact allowlisted page is stripped of navigation, scripts, styles, frames, and forms, then paired with a normalized Offer.",
  },
  compare_products: {
    selector: "#product-grid",
    detail: "Comparison consumes the same normalized Offer graph, so adapters do not create competing catalog models.",
  },
  create_catalog_brief: {
    selector: "#product-grid",
    detail: "The brief is compact Markdown grounded only in the selected offers and their visible provenance.",
  },
  propose_add_to_cart: {
    selector: "#confirm-panel",
    detail: "The proposal creates a short-lived quote with awaiting_human_confirmation status. It does not change the cart.",
  },
  human_confirm_add_to_cart: {
    selector: "#cart-panel",
    detail: "Only the visible human button calls the commit route. There is no WebMCP commit tool, checkout, payment, or merchant cart.",
  },
});

const REHEARSAL_STEPS = Object.freeze([
  {
    phase: "01 / 09  THE IDEA",
    tool: "document.modelContext.registerTool",
    selector: ".status-cluster",
    duration: 12000,
    caption: "Most websites make agents reverse engineer a visual interface. Agentic adds an explicit capability layer while keeping the human on the same page.",
    detail: "The top-level document registers eight bounded tools. Seven are read-only, and one can only stage a proposal.",
  },
  {
    phase: "02 / 09  ALLOWLIST",
    tool: "list_origins",
    selector: ".origin-control",
    duration: 10000,
    args: {},
    caption: "The agent begins by discovering the exact public origins and adapters this page permits.",
    detail: TOOL_STORIES.list_origins.detail,
    action: "listOrigins",
  },
  {
    phase: "03 / 09  SELECT",
    tool: "select_origin",
    selector: ".origin-control",
    duration: 8000,
    args: { originId: "catalog-lab" },
    caption: "It selects the controlled public catalog. The source mode and live adapter remain visible to the human.",
    detail: TOOL_STORIES.select_origin.detail,
    action: "selectOrigin",
  },
  {
    phase: "04 / 09  SEARCH",
    tool: "search_products",
    selector: "#search-form",
    resultSelector: "#product-grid",
    duration: 18000,
    args: { query: "notebook", maxResults: 6 },
    caption: "A natural language goal becomes a typed search call. Stable handles and source-grounded facts appear in the shared workspace.",
    detail: TOOL_STORIES.search_products.detail,
    action: "search",
  },
  {
    phase: "05 / 09  INTERPOLATE",
    tool: "interpolate_page",
    selector: "#interpolate-form",
    resultSelector: "#interpolate-view",
    duration: 30000,
    args: { path: "/products/field-notebook" },
    caption: "This is the converter: one real HTTPS page becomes compact Markdown plus a structured Offer, with its canonical URL and provenance intact.",
    detail: TOOL_STORIES.interpolate_page.detail,
    action: "interpolate",
  },
  {
    phase: "06 / 09  COMPARE",
    tool: "compare_products",
    selector: "#product-grid",
    duration: 20000,
    args: { handles: ["field-notebook", "modular-desk-tray"] },
    caption: "Because every adapter produces the same Offer shape, the agent can compare products without learning a second catalog model.",
    detail: TOOL_STORIES.compare_products.detail,
    action: "compare",
  },
  {
    phase: "07 / 09  PROPOSE",
    tool: "propose_add_to_cart",
    selector: ".agent-panel",
    resultSelector: "#confirm-panel",
    duration: 22000,
    args: { handle: "field-notebook", variantTitle: "Sand", quantity: 1 },
    caption: "The agent stages one available variant, then stops. The empty cart and the confirmation boundary are both visible.",
    detail: TOOL_STORIES.propose_add_to_cart.detail,
    action: "propose",
    waitForHuman: true,
  },
  {
    phase: "08 / 09  HUMAN CONTROL",
    tool: "human_confirm_add_to_cart",
    selector: "#cart-panel",
    duration: 20000,
    args: { action: "visible button only" },
    caption: "The human confirms. Only that button commits the page-local receipt, and the activity rail records the boundary.",
    detail: TOOL_STORIES.human_confirm_add_to_cart.detail,
    humanResult: true,
  },
  {
    phase: "09 / 09  TRUST",
    tool: "exact host + path + byte limits",
    selector: ".trust-note",
    duration: 8000,
    args: { redirects: "same host only", content: "untrusted" },
    caption: "Agents get a useful open-web interface, while people retain source visibility and final control over writes.",
    detail: "Every upstream request is HTTPS, exact-host allowlisted, path checked, off-host redirect rejected, and response-byte bounded.",
  },
]);

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function createPresenter(actions) {
  const elements = {
    toggle: document.querySelector("#presenter-toggle"),
    layer: document.querySelector("#presenter-layer"),
    focus: document.querySelector("#presenter-focus"),
    cursor: document.querySelector("#presenter-cursor"),
    cursorLabel: document.querySelector("#presenter-cursor-label"),
    hud: document.querySelector("#presenter-hud"),
    phase: document.querySelector("#presenter-phase"),
    time: document.querySelector("#presenter-time"),
    tool: document.querySelector("#presenter-tool"),
    caption: document.querySelector("#presenter-caption"),
    args: document.querySelector("#presenter-args"),
    detail: document.querySelector("#presenter-underhood"),
    progress: document.querySelector("#presenter-progress"),
    rehearse: document.querySelector("#presenter-rehearse"),
    pause: document.querySelector("#presenter-pause"),
    next: document.querySelector("#presenter-next"),
    exit: document.querySelector("#presenter-exit"),
  };

  let active = false;
  let running = false;
  let paused = false;
  let stepIndex = -1;
  let timerId;
  let deadline = 0;
  let remaining = 0;
  let activeTarget;
  let waitingForHuman = false;
  let cursorRole = "AGENT";

  function setCursor(x, y, label = "AGENT") {
    const safeX = Math.max(8, Math.min(innerWidth - 104, x));
    const safeY = Math.max(8, Math.min(innerHeight - 48, y));
    elements.cursor.style.transform = `translate3d(${Math.round(safeX)}px, ${Math.round(safeY)}px, 0)`;
    elements.cursorLabel.textContent = label;
  }

  function placeTarget(target, immediate = false) {
    if (!(target instanceof HTMLElement) || target.hidden) return;
    activeTarget = target;
    const rect = target.getBoundingClientRect();
    const padding = 7;
    const radius = Math.min(24, Math.max(10, Number.parseFloat(getComputedStyle(target).borderRadius) || 12));
    if (immediate) elements.focus.classList.add("immediate");
    const left = Math.max(6, rect.left - padding);
    const top = Math.max(6, rect.top - padding);
    elements.focus.style.left = `${left}px`;
    elements.focus.style.top = `${top}px`;
    elements.focus.style.width = `${Math.min(innerWidth - left - 6, rect.width + padding * 2)}px`;
    elements.focus.style.height = `${Math.min(innerHeight - top - 6, rect.height + padding * 2)}px`;
    elements.focus.style.borderRadius = `${radius}px`;
    elements.focus.classList.add("visible");
    setCursor(
      Math.min(innerWidth - 38, rect.right - Math.min(26, rect.width * 0.18)),
      Math.min(innerHeight - 42, rect.top + Math.min(34, rect.height * 0.3)),
      cursorRole,
    );
    if (immediate) requestAnimationFrame(() => elements.focus.classList.remove("immediate"));
    const targetOnRight = rect.left > innerWidth * 0.55;
    elements.hud.classList.toggle("hud-left", targetOnRight);
    elements.hud.classList.toggle("hud-top", !targetOnRight && rect.top > innerHeight * 0.52);
  }

  async function focusSelector(selector, immediate = false) {
    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement) || target.hidden) return;
    target.scrollIntoView({ behavior: immediate ? "auto" : "smooth", block: "center", inline: "nearest" });
    if (!immediate) await delay(520);
    placeTarget(target, immediate);
  }

  function renderStory({ phase, tool, args = {}, caption, detail, duration = 0 }) {
    elements.phase.textContent = phase;
    elements.tool.textContent = tool;
    elements.args.textContent = JSON.stringify(args);
    elements.caption.textContent = caption;
    elements.detail.textContent = detail;
    elements.time.textContent = duration ? `${formatTime(duration)} VO` : "LIVE TOOL CALL";
  }

  function clearTimer() {
    if (timerId) clearInterval(timerId);
    timerId = undefined;
  }

  function startTimer(milliseconds, initialRatio = 1) {
    clearTimer();
    remaining = milliseconds;
    deadline = performance.now() + milliseconds;
    elements.progress.style.transition = "none";
    elements.progress.style.transform = `scaleX(${initialRatio})`;
    requestAnimationFrame(() => {
      elements.progress.style.transition = `transform ${milliseconds}ms linear`;
      elements.progress.style.transform = "scaleX(0)";
    });
    timerId = setInterval(() => {
      remaining = Math.max(0, deadline - performance.now());
      elements.time.textContent = `${formatTime(remaining)} VO`;
      if (remaining <= 0) {
        clearTimer();
        if (waitingForHuman) {
          paused = true;
          cursorRole = "HUMAN";
          document.body.classList.add("presenter-waiting");
          elements.pause.disabled = true;
          elements.time.textContent = "WAITING FOR HUMAN";
          elements.caption.textContent = "The agent has stopped. Click Confirm add to cart when the narration reaches the human control boundary.";
          focusSelector("#confirm-cart").catch(() => undefined);
        } else {
          advance().catch(showPresenterError);
        }
      }
    }, 100);
  }

  async function showStep(step) {
    waitingForHuman = step.waitForHuman === true;
    cursorRole = step.humanResult === true ? "HUMAN" : "AGENT";
    elements.next.disabled = waitingForHuman;
    document.body.classList.toggle("presenter-waiting", false);
    renderStory(step);
    await focusSelector(step.selector);
    if (step.action) {
      elements.cursor.classList.add("clicking");
      await delay(180);
      elements.cursor.classList.remove("clicking");
      await actions[step.action](step.args);
      if (!running) return;
      if (step.resultSelector) await focusSelector(step.resultSelector);
      renderStory(step);
    }
    if (!running) return;
    startTimer(step.duration);
  }

  async function advance() {
    if (!running) return;
    clearTimer();
    paused = false;
    elements.pause.textContent = "Pause";
    elements.pause.disabled = false;
    stepIndex += 1;
    if (stepIndex >= REHEARSAL_STEPS.length) {
      running = false;
      document.body.classList.remove("presenter-running", "presenter-waiting");
      elements.pause.disabled = true;
      elements.next.disabled = true;
      elements.rehearse.disabled = false;
      elements.rehearse.textContent = "Run rehearsal again";
      renderStory({
        phase: "REHEARSAL COMPLETE",
        tool: "2:28 target sequence",
        args: { readyToRecord: true },
        caption: "The converter, provenance, comparison, and human confirmation boundary are all visible in one coherent sequence.",
        detail: "Use presenter mode with the real agent. Every actual tool call will update this overlay and move the focus frame.",
      });
      await focusSelector(".workspace");
      return;
    }
    await showStep(REHEARSAL_STEPS[stepIndex]);
  }

  function showPresenterError(error) {
    clearTimer();
    paused = true;
    elements.time.textContent = "REHEARSAL PAUSED";
    elements.caption.textContent = error instanceof Error ? error.message : "The rehearsal step failed.";
    elements.detail.textContent = "The live app remains usable. Check the visible origin health, then press Next to retry the narrative flow manually.";
  }

  function enable() {
    if (active) return;
    active = true;
    elements.layer.hidden = false;
    elements.toggle.setAttribute("aria-pressed", "true");
    elements.toggle.textContent = "Presenter on";
    document.body.classList.add("presenter-active");
    history.replaceState(null, "", `${location.pathname}?present=1`);
    focusSelector(".workspace", true).catch(() => undefined);
  }

  function exit() {
    clearTimer();
    active = false;
    running = false;
    paused = false;
    waitingForHuman = false;
    stepIndex = -1;
    activeTarget = undefined;
    elements.layer.hidden = true;
    elements.focus.classList.remove("visible");
    elements.toggle.setAttribute("aria-pressed", "false");
    elements.toggle.textContent = "Presenter mode";
    elements.rehearse.disabled = false;
    elements.pause.disabled = true;
    elements.next.disabled = true;
    document.body.classList.remove("presenter-active", "presenter-running", "presenter-waiting");
    history.replaceState(null, "", location.pathname);
  }

  async function start() {
    enable();
    await actions.reset?.();
    running = true;
    paused = false;
    waitingForHuman = false;
    stepIndex = -1;
    elements.rehearse.disabled = true;
    elements.pause.disabled = false;
    elements.next.disabled = false;
    document.body.classList.add("presenter-running");
    await advance();
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    elements.pause.textContent = paused ? "Resume" : "Pause";
    if (paused) {
      remaining = Math.max(0, deadline - performance.now());
      clearTimer();
      elements.progress.style.transition = "none";
      const step = REHEARSAL_STEPS[stepIndex];
      elements.progress.style.transform = `scaleX(${step ? remaining / step.duration : 0})`;
      elements.time.textContent = `${formatTime(remaining)} PAUSED`;
    } else {
      const step = REHEARSAL_STEPS[stepIndex];
      startTimer(remaining, step ? remaining / step.duration : 1);
    }
  }

  function toolEvent(tool, args, actor) {
    if (!active) return;
    if (actor === "page initialization") return;
    const story = TOOL_STORIES[tool];
    if (!story) return;
    if (!running) {
      cursorRole = actor.includes("human") ? "HUMAN" : "AGENT";
      renderStory({
        phase: `${actor.toUpperCase()} | LIVE`,
        tool,
        args,
        caption: `The ${tool} call completed and updated the shared visible workspace.`,
        detail: story.detail,
      });
      focusSelector(story.selector).catch(() => undefined);
    }
  }

  function humanConfirmed() {
    if (!running || !waitingForHuman) return;
    waitingForHuman = false;
    paused = false;
    elements.next.disabled = false;
    document.body.classList.remove("presenter-waiting");
    advance().catch(showPresenterError);
  }

  elements.toggle.addEventListener("click", () => active ? exit() : enable());
  elements.exit.addEventListener("click", exit);
  elements.rehearse.addEventListener("click", () => start().catch(showPresenterError));
  elements.pause.addEventListener("click", togglePause);
  elements.next.addEventListener("click", () => advance().catch(showPresenterError));
  addEventListener("resize", () => activeTarget && placeTarget(activeTarget, true));
  addEventListener("scroll", () => activeTarget && placeTarget(activeTarget), true);
  addEventListener("pointermove", (event) => {
    if (active) setCursor(event.clientX, event.clientY, "HUMAN");
  }, { passive: true });
  addEventListener("pointerdown", () => {
    if (!active) return;
    elements.cursor.classList.add("clicking");
    setTimeout(() => elements.cursor.classList.remove("clicking"), 220);
  }, { passive: true });

  if (new URLSearchParams(location.search).get("present") === "1") enable();

  return { toolEvent, humanConfirmed, enable, exit };
}
