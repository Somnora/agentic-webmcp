import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPresenter } from "../public/presenter.js";

class Element {
  hidden = false;
  disabled = false;
  textContent = "";
  style = {};
  listeners = new Map();
  classes = new Set();
  classList = {
    add: (...names) => names.forEach((name) => this.classes.add(name)),
    remove: (...names) => names.forEach((name) => this.classes.delete(name)),
    toggle: (name, force) => (force ?? !this.classes.has(name)) ? this.classes.add(name) : this.classes.delete(name),
  };
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { return this.listeners.get("click")?.(); }
  setAttribute() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 20, top: 20, right: 620, width: 600, height: 100 }; }
}

let elements;
const element = (selector) => {
  if (!elements.has(selector)) elements.set(selector, new Element());
  return elements.get(selector);
};
const step = (id, flags = {}) => ({ id, tool: id, selector: ".workspace", duration: 3000, detail: id, ...flags });
const load = (steps) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ steps }) })));

beforeEach(() => {
  vi.useFakeTimers();
  elements = new Map();
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("document", { querySelector: element, body: new Element() });
  vi.stubGlobal("innerWidth", 1280);
  vi.stubGlobal("innerHeight", 720);
  vi.stubGlobal("getComputedStyle", () => ({ borderRadius: "12px" }));
  vi.stubGlobal("requestAnimationFrame", (callback) => callback());
  vi.stubGlobal("addEventListener", vi.fn());
  vi.stubGlobal("history", { replaceState: vi.fn() });
  vi.stubGlobal("location", { search: "", pathname: "/" });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const gates = [
  ["refinement", "waitForRefinement", "humanRefined"],
  ["approval", "waitForHuman", "humanConfirmed"],
  ["dossier", "waitForDossier", "humanDossierDownloaded"],
];

describe("presenter human gates", () => {
  it.each(gates)("cannot skip the %s gate, even after its timer expires", async (id, flag, complete) => {
    load([step(id, { [flag]: true }), step("after")]);
    const presenter = createPresenter({});
    const started = element("#presenter-rehearse").click();
    await vi.advanceTimersByTimeAsync(600);
    await started;
    expect(element("#presenter-next").disabled).toBe(true);
    await element("#presenter-next").click();
    await vi.advanceTimersByTimeAsync(5000);
    expect(element("#presenter-tool").textContent).toBe(id);
    presenter[complete]();
    await vi.advanceTimersByTimeAsync(600);
    expect(element("#presenter-tool").textContent).toBe("after");
    presenter.exit();
  });

  it.each(gates)("retains the narration hold after early %s completion", async (id, flag, complete) => {
    load([step(id, { [flag]: true }), step("after")]);
    const presenter = createPresenter({});
    const started = element("#presenter-rehearse").click();
    await vi.advanceTimersByTimeAsync(600);
    await started;
    presenter[complete]();
    await vi.advanceTimersByTimeAsync(1000);
    expect(element("#presenter-tool").textContent).toBe(id);
    await vi.advanceTimersByTimeAsync(2000);
    expect(element("#presenter-tool").textContent).toBe("after");
    presenter.exit();
  });

  it("does not restart after Exit while the sequence fetch is pending", async () => {
    let resolve;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((done) => { resolve = done; })));
    const reset = vi.fn();
    const presenter = createPresenter({ reset });
    const started = element("#presenter-rehearse").click();
    presenter.exit();
    resolve({ ok: true, json: async () => ({ steps: [step("opening")] }) });
    await started;
    await vi.advanceTimersByTimeAsync(5000);
    expect(reset).not.toHaveBeenCalled();
    expect(element("#presenter-layer").hidden).toBe(true);
    expect(element("#presenter-tool").textContent).toBe("");
  });

  it("does not invoke an action if Exit is clicked during its focus transition", async () => {
    load([step("read", { action: "listOrigins" })]);
    const listOrigins = vi.fn();
    const presenter = createPresenter({ listOrigins });
    const started = element("#presenter-rehearse").click();
    await vi.advanceTimersByTimeAsync(200);
    presenter.exit();
    await vi.advanceTimersByTimeAsync(1000);
    await started;
    expect(listOrigins).not.toHaveBeenCalled();
  });
});
