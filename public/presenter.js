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
  find_best_options: {
    selector: "#refinement-panel",
    detail: "Session-only taste and intent rebalance a deterministic seven-factor rubric. When credible options win on different evidence, the agent pauses for one human priority before finalizing the ranking.",
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
  create_activity_itinerary: {
    selector: "#itinerary-view",
    detail: "The same Offer protocol supplies service evidence. The planner checks destination, published windows, party size, budget, pace, and transition allowances without booking or contacting providers.",
  },
  human_download_button: {
    selector: "#download-dossier",
    detail: "The human downloads a browser-generated decision dossier. No agent tool, account, or server storage is needed.",
  },
  propose_add_to_cart: {
    selector: "#confirm-panel",
    detail: "The proposal creates a short-lived review with awaiting_human_confirmation status. It cannot create an order or charge.",
  },
  human_approval_button: {
    selector: "#cart-panel",
    detail: "Only the visible human button calls the commit route. It creates a decision record, not a merchant order. There is no WebMCP commit tool or payment access.",
  },
});

export async function loadRehearsalSteps(fetcher = fetch) {
  const response = await fetcher("/demo-sequence.json", { cache: "no-store" });
  if (!response.ok) throw new Error("The Ribband demo sequence could not be loaded.");
  const sequence = await response.json();
  const actions = new Set(["listOrigins", "selectOrigin", "search", "recommend", "interpolate", "compare", "propose", "itinerary"]);
  if (!Array.isArray(sequence.steps) || sequence.steps.length < 1 || sequence.steps.length > 24) {
    throw new Error("The Ribband demo sequence is invalid.");
  }
  for (const step of sequence.steps) {
    if (typeof step.id !== "string" || typeof step.tool !== "string" || typeof step.selector !== "string"
      || !Number.isFinite(step.duration) || step.duration < 1000 || step.duration > 60000
      || (step.action && !actions.has(step.action))) {
      throw new Error("The Ribband demo contains an unsupported step.");
    }
  }
  return sequence.steps;
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createPresenter(actions) {
  const elements = {
    toggle: document.querySelector("#presenter-toggle"),
    layer: document.querySelector("#presenter-layer"),
    focus: document.querySelector("#presenter-focus"),
    cursor: document.querySelector("#presenter-cursor"),
    cursorLabel: document.querySelector("#presenter-cursor-label"),
    hud: document.querySelector("#presenter-hud"),
    tool: document.querySelector("#presenter-tool"),
    args: document.querySelector("#presenter-args"),
    detail: document.querySelector("#presenter-underhood"),
    rehearse: document.querySelector("#presenter-rehearse"),
    pause: document.querySelector("#presenter-pause"),
    next: document.querySelector("#presenter-next"),
    exit: document.querySelector("#presenter-exit"),
    export: document.querySelector("#presenter-export"),
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
  let waitingKind = null;
  let cursorRole = "AGENT";
  let rehearsalSteps = [];
  let transitioning = false;
  let starting = false;
  let runVersion = 0;
  let runStartedAt = 0;
  let timingCues = [];

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
    if (active) placeTarget(target, immediate);
  }

  function renderStory({ tool, args = {}, detail }) {
    elements.tool.textContent = tool;
    elements.args.textContent = JSON.stringify(args);
    elements.detail.textContent = detail;
  }

  function clearTimer() {
    if (timerId) clearInterval(timerId);
    timerId = undefined;
  }

  function startTimer(milliseconds) {
    clearTimer();
    remaining = milliseconds;
    deadline = performance.now() + milliseconds;
    timerId = setInterval(() => {
      remaining = Math.max(0, deadline - performance.now());
      if (remaining <= 0) {
        clearTimer();
        if (waitingForHuman) {
          paused = true;
          cursorRole = "HUMAN";
          document.body.classList.add("presenter-waiting");
          elements.pause.disabled = true;
          if (waitingKind === "refinement") {
            elements.detail.textContent = "The agent has stopped at genuine uncertainty. Choose one visible priority to finalize the ranking.";
            focusSelector("#refinement-panel").catch(() => undefined);
          } else if (waitingKind === "dossier") {
            elements.detail.textContent = "Download the goods dossier before switching origins. The report is generated locally in this browser.";
            focusSelector("#download-dossier").catch(() => undefined);
          } else {
            elements.detail.textContent = "The agent has stopped. Only the visible human button can approve the selection for handoff.";
            focusSelector("#confirm-cart").catch(() => undefined);
          }
        } else {
          advance().catch(showPresenterError);
        }
      }
    }, 100);
  }

  async function showStep(step) {
    const startedAt = performance.now();
    timingCues.push({ id: step.id, start: (startedAt - runStartedAt) / 1000 });
    waitingKind = step.waitForRefinement === true ? "refinement" : step.waitForHuman === true ? "approval" : step.waitForDossier === true ? "dossier" : null;
    waitingForHuman = waitingKind !== null;
    cursorRole = step.humanResult === true ? "HUMAN" : "AGENT";
    elements.next.disabled = waitingForHuman;
    document.body.classList.toggle("presenter-waiting", false);
    renderStory(step);
    await focusSelector(step.selector);
    if (!running) return;
    if (step.action) {
      elements.cursor.classList.add("clicking");
      await delay(180);
      elements.cursor.classList.remove("clicking");
      if (!running) return;
      await actions[step.action](step.args);
      if (!running) return;
      if (step.resultSelector) await focusSelector(step.resultSelector);
      renderStory(step);
    }
    if (!running) return;
    if (waitingKind === "refinement" && document.querySelector("#refinement-panel")?.hidden) {
      waitingForHuman = false;
      waitingKind = null;
      elements.next.disabled = false;
    }
    startTimer(Math.max(0, step.duration - (performance.now() - startedAt)));
  }

  async function advance() {
    if (!running || waitingForHuman || transitioning) return;
    transitioning = true;
    try {
      clearTimer();
      if (timingCues.length) timingCues[timingCues.length - 1].end = (performance.now() - runStartedAt) / 1000;
      paused = false;
      elements.pause.textContent = "Pause";
      elements.pause.disabled = false;
      stepIndex += 1;
      if (stepIndex >= rehearsalSteps.length) {
        running = false;
        document.body.classList.remove("presenter-running", "presenter-waiting");
        elements.pause.disabled = true;
        elements.next.disabled = true;
        elements.pause.hidden = true;
        elements.next.hidden = true;
        elements.export.hidden = false;
        elements.rehearse.disabled = false;
        elements.rehearse.textContent = "Run guided demo again";
        renderStory({
          tool: "Guided demo complete",
          args: { product: "Ribband", approval: "human only" },
          detail: "Export edit cues for narration alignment. The recording still needs review before publication. Actual agent calls continue to update the same overlay.",
        });
        await focusSelector(".workspace");
        return;
      }
      await showStep(rehearsalSteps[stepIndex]);
    } finally {
      transitioning = false;
    }
  }

  function showPresenterError(error) {
    clearTimer();
    paused = true;
    const message = error instanceof Error ? error.message : "The guided demo step failed.";
    elements.detail.textContent = `${message} The app remains usable. Exit presenter mode, check the visible origin health, and run the demo again.`;
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
    runVersion += 1;
    clearTimer();
    active = false;
    running = false;
    paused = false;
    waitingForHuman = false;
    waitingKind = null;
    stepIndex = -1;
    activeTarget = undefined;
    elements.layer.hidden = true;
    elements.focus.classList.remove("visible");
    elements.toggle.setAttribute("aria-pressed", "false");
    elements.toggle.textContent = "Presenter mode";
    elements.rehearse.disabled = false;
    elements.pause.disabled = true;
    elements.next.disabled = true;
    elements.pause.hidden = false;
    elements.next.hidden = false;
    elements.export.hidden = true;
    document.body.classList.remove("presenter-active", "presenter-running", "presenter-waiting");
    history.replaceState(null, "", location.pathname);
  }

  async function start() {
    if (running || transitioning || starting) return;
    starting = true;
    const version = ++runVersion;
    enable();
    elements.rehearse.disabled = true;
    try {
      rehearsalSteps = await loadRehearsalSteps();
      if (!active || version !== runVersion) return;
      await actions.reset?.();
      if (!active || version !== runVersion) return;
    } catch (error) {
      elements.rehearse.disabled = false;
      if (version === runVersion) throw error;
      return;
    } finally {
      starting = false;
    }
    timingCues = [];
    runStartedAt = performance.now();
    running = true;
    paused = false;
    waitingForHuman = false;
    waitingKind = null;
    stepIndex = -1;
    elements.rehearse.disabled = true;
    elements.pause.disabled = false;
    elements.next.disabled = false;
    elements.pause.hidden = false;
    elements.next.hidden = false;
    elements.export.hidden = true;
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
    } else {
      startTimer(remaining);
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
        tool,
        args,
        detail: story.detail,
      });
      focusSelector(story.selector).catch(() => undefined);
    }
  }

  function completeHumanStep(kind) {
    if (!running || !waitingForHuman || waitingKind !== kind) return;
    waitingForHuman = false;
    waitingKind = null;
    paused = false;
    elements.next.disabled = false;
    document.body.classList.remove("presenter-waiting");
    if (!timerId && !transitioning) advance().catch(showPresenterError);
  }

  function downloadTimings() {
    if (running || timingCues.length !== rehearsalSteps.length || !timingCues.at(-1)?.end) return;
    const blob = new Blob([JSON.stringify({ version: 1, title: "Ribband", cues: timingCues }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ribband-demo-timing.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const humanConfirmed = () => completeHumanStep("approval");
  const humanRefined = () => completeHumanStep("refinement");
  const humanDossierDownloaded = () => completeHumanStep("dossier");

  elements.toggle.addEventListener("click", () => active ? exit() : enable());
  elements.exit.addEventListener("click", exit);
  elements.export.addEventListener("click", downloadTimings);
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

  return { toolEvent, humanConfirmed, humanRefined, humanDossierDownloaded, enable, exit };
}
