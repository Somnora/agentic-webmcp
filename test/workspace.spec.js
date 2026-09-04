import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLocalGiftProfile } from "../public/workspace-profile.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("personalized decisions workspace", () => {
  it("normalizes and bounds the optional on-device recipient profile", () => {
    const profile = normalizeLocalGiftProfile({
      id: "recipient-1",
      recipientLabel: "  My   nephew ",
      ageBand: "child",
      interests: ["drawing", "drawing", "animation"],
      memorySignal: "sketching together",
      avoid: "already owns pencils",
      createdAt: "2026-09-03T18:00:00.000Z",
    });
    expect(profile).toMatchObject({
      version: "1",
      id: "recipient-1",
      recipientLabel: "My nephew",
      ageBand: "child",
      interests: ["drawing", "animation"],
      memorySignal: "sketching together",
      avoid: "already owns pencils",
      createdAt: "2026-09-03T18:00:00.000Z",
    });
    expect(normalizeLocalGiftProfile({ ageBand: "exact-birthdate" }).ageBand).toBe("not-provided");
  });

  it("ships a visible use-once default, exact context projection, and deletion control", () => {
    const page = read("public/workspace.html");
    const runtime = read("public/workspace.js");
    const profileStore = read("public/workspace-profile.js");
    expect(page).toContain('<option value="decision-only">Use once</option>');
    expect(page).toContain('id="context-list"');
    expect(page).toContain('id="delete-profile"');
    expect(page).toContain("The Worker stores nothing");
    expect(runtime).toContain("selectedFactIds");
    expect(runtime).toContain("decisionOnlyFacts");
    expect(runtime).toContain("deleteLocalGiftProfile");
    expect(profileStore).toContain("indexedDB");
    expect(profileStore).not.toContain("localStorage");
  });

  it("registers one read-only gift tool and no profile mutation tool", () => {
    const runtime = read("public/workspace.js");
    expect(runtime).toContain('name: "recommend_gift"');
    expect(runtime).toContain("readOnlyHint: true");
    expect(runtime).not.toMatch(/name: ["'](?:save|update|delete)_profile/);
    expect(runtime).toContain('persistence: "decision-only"');
  });

  it("documents local storage and request-only Worker handling", () => {
    const privacy = read("public/privacy.html");
    expect(privacy).toContain("IndexedDB");
    expect(privacy).toContain("Use once is the default");
    expect(privacy).toContain("never reads or saves the on-device profile");
    expect(privacy).toContain("not end-to-end encryption");
  });
});
