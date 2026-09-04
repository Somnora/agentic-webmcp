import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("personalized date workspace", () => {
  it("ships an explicit two-person, use-once planning surface", () => {
    const page = read("public/date.html");
    expect(page).toContain('id="date-profile-form"');
    expect(page).toContain('id="date-context-list"');
    expect(page).toContain("low-cost, balanced, and special-occasion plans");
    expect(page).toContain("Use once. Date-profile context is not saved");
    expect(page).toContain("Nothing is booked, messaged, or saved");
  });

  it("projects decision-only facts and registers one read-only date tool", () => {
    const runtime = read("public/date.js");
    expect(runtime).toContain("selectedFactIds");
    expect(runtime).toContain("decisionOnlyFacts");
    expect(runtime).toContain('name: "plan_personalized_date"');
    expect(runtime).toContain("readOnlyHint: true");
    expect(runtime).toContain('api("/api/date-plans?originId=services-lab"');
    expect(runtime).not.toMatch(/name: ["'](?:save|update|delete)_profile/);
    expect(runtime).toContain("textContent = value");
  });

  it("documents the date workspace storage and action boundary", () => {
    const privacy = read("public/privacy.html");
    expect(privacy).toContain("date planner is use-once only");
    expect(privacy).toContain("plan_personalized_date");
    expect(privacy).toContain("does not save a profile");
    expect(privacy).toContain("contact a provider, book, or pay");
  });
});
