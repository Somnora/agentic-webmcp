import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("personalized vacation workspace", () => {
  it("ships a memory-aware, use-once package surface", () => {
    const page = read("public/vacation.html");
    expect(page).toContain('id="vacation-profile-form"');
    expect(page).toContain('id="vacation-context-list"');
    expect(page).toContain("value, balanced, and signature packages");
    expect(page).toContain("Use once. Vacation-profile context is not saved");
    expect(page).toContain("Nothing is booked, contacted, paid for, or saved");
  });

  it("projects decision-only memories and registers one read-only vacation tool", () => {
    const runtime = read("public/vacation.js");
    expect(runtime).toContain("decisionOnlyFacts");
    expect(runtime).toContain('kind: "fond-memory-signal"');
    expect(runtime).toContain('name: "plan_personalized_vacation"');
    expect(runtime).toContain("readOnlyHint: true");
    expect(runtime).toContain('api("/api/vacation-packages?originId=services-lab"');
    expect(runtime).not.toMatch(/name: ["'](?:save|update|delete)_profile/);
    expect(runtime).toContain("textContent = value");
  });

  it("keeps package categories and unknown costs visible", () => {
    const runtime = read("public/vacation.js");
    expect(runtime).toContain('totalRow("Lodging"');
    expect(runtime).toContain('totalRow("Transport"');
    expect(runtime).toContain('totalRow("Dining"');
    expect(runtime).toContain('totalRow("Activities"');
    expect(runtime).toContain("trip.totals.unknownCosts");
  });
});
