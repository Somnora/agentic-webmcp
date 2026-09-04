import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/index";
import { proposeProfileUpdate, supportsOutcomeMemory } from "../src/profile-updates";

const timestamp = "2026-09-03T18:00:00.000Z";

function input(overrides: Record<string, unknown> = {}) {
  return {
    decisionId: "decision-vacation-1",
    vertical: "vacation",
    optionId: "vacation-balanced-1",
    optionTitle: "Quiet Oahu with two anchor experiences",
    outcome: "completed",
    feedback: "The quiet mornings and coastal photography felt exactly right.",
    allowedUses: ["vacation", "date"],
    ...overrides,
  };
}

const assetFetcher: Fetcher = {
  fetch: async () => new Response("<!doctype html><title>Profile update</title>"),
  connect: () => { throw new Error("Asset sockets are not used in tests."); },
};
const env: Env = {
  ASSETS: assetFetcher,
  VERSION_METADATA: { id: "test-version", tag: "", timestamp },
  CATALOG_SHOP: "agentic-app-review-test.myshopify.com",
  APP_COMMIT: "local",
  DEMO_ORIGIN: assetFetcher,
};

function request(body: Record<string, unknown>): Request {
  return new Request("https://example.test/api/profile-updates/propose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("profile update proposals", () => {
  it("creates a tentative no-store proposal without persisting a fact", () => {
    const proposal = proposeProfileUpdate(input(), new Date(timestamp));
    expect(proposal).toMatchObject({
      version: "1",
      decisionId: "decision-vacation-1",
      vertical: "vacation",
      outcome: "completed",
      operation: "add",
      factDraft: {
        subjectId: "profile-self",
        kind: "liked-experience",
        source: "inferred-pending-confirmation",
        confidence: "tentative",
        sensitivity: "private",
        allowedUses: ["vacation", "date"],
        lastConfirmedAt: null,
      },
      handling: {
        persistence: "none",
        cache: "no-store",
        approvalStatus: "awaiting-human-confirmation",
        availableActions: ["approve", "edit", "reject"],
      },
    });
    expect(proposal.factDraft.value).toContain("quiet mornings");
  });

  it("turns negative outcomes into explicit disliked-experience drafts", () => {
    expect(proposeProfileUpdate(input({ outcome: "not-for-me" }), new Date(timestamp))).toMatchObject({
      factDraft: { kind: "disliked-experience", value: expect.stringContaining("Did not enjoy") },
    });
  });

  it("limits memory to self-oriented date and vacation decisions", () => {
    expect(supportsOutcomeMemory("date")).toBe(true);
    expect(supportsOutcomeMemory("vacation")).toBe(true);
    expect(supportsOutcomeMemory("gift")).toBe(false);
    expect(() => proposeProfileUpdate(input({ vertical: "gift", allowedUses: ["gift"] }), new Date(timestamp))).toThrow("vertical must be one of: date, vacation");
    expect(() => proposeProfileUpdate(input({ allowedUses: ["date"] }), new Date(timestamp))).toThrow("must include the source vacation");
  });

  it("rejects unknown fields and empty feedback", () => {
    expect(() => proposeProfileUpdate(input({ hiddenMemory: true }), new Date(timestamp))).toThrow("unsupported fields");
    expect(() => proposeProfileUpdate(input({ feedback: "" }), new Date(timestamp))).toThrow("feedback must be between 1 and 180");
  });

  it("serves the proposal through a bounded no-store endpoint", async () => {
    const response = await handleRequest(request(input()), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      decisionId: "decision-vacation-1",
      handling: { persistence: "none", approvalStatus: "awaiting-human-confirmation" },
    });

    const oversized = await handleRequest(request({ ...input(), padding: "x".repeat(5000) }), env);
    expect(oversized.status).toBe(400);
    expect(await oversized.json()).toMatchObject({ error: "Request body is too large." });
  });
});
