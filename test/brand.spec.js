import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDecisionDossier, dossierFilename } from "../public/dossier.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const readBytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));

function pngDimensions(bytes) {
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("Ribband public identity", () => {
  it("uses the same brand and self-hosted mark on the workspace and privacy page", () => {
    for (const file of ["public/index.html", "public/privacy.html"]) {
      const page = read(file);
      expect(page).toContain('aria-label="Ribband home"');
      expect(page).toContain('href="/ribband-symbol.png" type="image/png"');
      expect(page).toContain('href="/ribband-symbol.png"');
      expect(page).toContain('src="/ribband-lockup.png"');
      expect(page).not.toMatch(/Agentic WebMCP|>Agentic</);
      expect(page).not.toContain('/icon.webp');
      expect(page).not.toContain('/ribband-mark.svg');
    }
    expect(pngDimensions(readBytes("public/ribband-symbol.png"))).toEqual({ width: 512, height: 512 });
    expect(pngDimensions(readBytes("public/ribband-lockup.png"))).toEqual({ width: 980, height: 520 });
    expect(read("public/index.html")).toContain('href="/decide"');
  });

  it("brands exported evidence without changing the ten-tool contract", () => {
    expect(createDecisionDossier({})).toMatch(/^# Ribband decision dossier\n/);
    expect(dossierFilename("catalog-lab", "2026-09-03")).toBe("ribband-decision-dossier-catalog-lab-2026-09-03.md");
    expect(read("public/app.js")).toContain('"X-Agentic-Human-Confirm": "true"');
    expect(read("public/app.js")).toContain('response.headers.get("X-Agentic-Correlation-Id")');
    expect(JSON.parse(read("package.json")).name).toBe("agentic-webmcp");
  });

  it("keeps the current public docs and presenter on the Ribband name", () => {
    for (const file of ["README.md", "docs/JUDGE_GUIDE.md", "docs/DEMO_SCRIPT.md", "docs/SUBMISSION_COPY.md", "docs/BRAND.md", "public/presenter.js"]) {
      expect(read(file)).toContain("Ribband");
    }
    expect(read("docs/BRAND.md")).toContain("Blue Riband");
    expect(read("README.md")).not.toMatch(/^(?:\d+\. )?> /m);
  });
});
