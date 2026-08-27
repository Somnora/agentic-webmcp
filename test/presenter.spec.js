import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const presenter = readFileSync(new URL("../public/presenter.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

describe("recording presenter", () => {
  it("includes the converter, core WebMCP calls, and human-only commit boundary", () => {
    for (const name of [
      "document.modelContext.registerTool",
      "list_origins",
      "select_origin",
      "search_products",
      "interpolate_page",
      "compare_products",
      "propose_add_to_cart",
      "human_confirm_add_to_cart",
    ]) {
      expect(presenter).toContain(name);
    }
    expect(presenter).not.toContain('action: "commitCart"');
  });

  it("provides explicit presenter controls and under-the-hood copy", () => {
    expect(page).toContain('id="presenter-toggle"');
    expect(page).toContain('id="presenter-rehearse"');
    expect(page).toContain('id="presenter-next"');
    expect(page).toContain("UNDER THE HOOD");
    expect(page).toContain("Run guided demo");
    expect(page).not.toContain("2:28 TARGET");
    expect(page).not.toContain("presenter-time");
    expect(page).not.toContain("presenter-progress");
    expect(page).not.toContain("presenter-caption");
  });

  it("uses one non-interactive morphing frame and a precise SVG cursor", () => {
    expect(page).toContain('id="presenter-focus"');
    expect(page).toContain('id="presenter-cursor"');
    expect(styles).toContain("pointer-events: none");
    expect(styles).toContain("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(styles).toContain("body.presenter-active, body.presenter-active * { cursor: none !important; }");
  });
});
