import { describe, expect, it } from "vitest";
import { profileFactText, projectProfileFacts, validateProfileFact, validateProfileSubject } from "../src/profile";

const timestamp = "2026-09-03T18:00:00.000Z";

function fact(overrides: Record<string, unknown> = {}) {
  return {
    version: "1",
    id: "fact-water",
    subjectId: "subject-self",
    kind: "fond-memory-signal",
    value: "quiet mornings near water",
    source: "user-stated",
    confidence: "confirmed",
    sensitivity: "private",
    lifeStage: "childhood",
    allowedUses: ["vacation", "date"],
    lastConfirmedAt: timestamp,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("profile contracts", () => {
  it("normalizes a minimal subject without requiring a legal identity", () => {
    expect(validateProfileSubject({
      version: "1",
      id: "subject-nephew",
      ownerId: null,
      kind: "recipient",
      displayLabel: "  my   nephew  ",
      relationship: "nephew",
      ageBand: "child",
      location: null,
      persistence: "decision-only",
      createdAt: timestamp,
      updatedAt: timestamp,
    })).toEqual({
      version: "1",
      id: "subject-nephew",
      ownerId: null,
      kind: "recipient",
      displayLabel: "my nephew",
      relationship: "nephew",
      ageBand: "child",
      location: null,
      persistence: "decision-only",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it("validates a compliant ProfileSubject with location and all valid SubjectKinds", () => {
    const kinds = ["self", "recipient", "partner", "collaborator"] as const;
    for (const kind of kinds) {
      const subject = validateProfileSubject({
        version: "1",
        id: `subject-${kind}`,
        ownerId: null,
        kind,
        displayLabel: `${kind} display`,
        relationship: kind === "self" ? null : "teammate",
        ageBand: "adult",
        location: "Honolulu, HI",
        persistence: "saved-on-device",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      expect(subject.kind).toBe(kind);
      expect(subject.location).toBe("Honolulu, HI");
      if (kind === "self") {
        expect(subject.relationship).toBeNull();
      }
    }
  });

  it("rejects ProfileSubject with unknown keys, invalid id characters, or invalid age bands", () => {
    expect(() => validateProfileSubject({
      version: "1",
      id: "subject-self",
      ownerId: null,
      kind: "self",
      displayLabel: "Me",
      relationship: null,
      ageBand: "adult",
      location: null,
      persistence: "decision-only",
      createdAt: timestamp,
      updatedAt: timestamp,
      secretNote: "do not accept",
    })).toThrow("unsupported fields");

    expect(() => validateProfileSubject({
      version: "1",
      id: "invalid id with spaces",
      ownerId: null,
      kind: "self",
      displayLabel: "Me",
      relationship: null,
      ageBand: "adult",
      location: null,
      persistence: "decision-only",
      createdAt: timestamp,
      updatedAt: timestamp,
    })).toThrow("Profile subject id");

    expect(() => validateProfileSubject({
      version: "1",
      id: "subject-self",
      ownerId: null,
      kind: "self",
      displayLabel: "Me",
      relationship: null,
      ageBand: "senior",
      location: null,
      persistence: "decision-only",
      createdAt: timestamp,
      updatedAt: timestamp,
    })).toThrow("Profile subject ageBand");
  });

  it("enforces that ProfileSubject relationship is null when kind is self", () => {
    const subject = validateProfileSubject({
      version: "1",
      id: "subject-self",
      ownerId: null,
      kind: "self",
      displayLabel: "Myself",
      relationship: "attempted-relationship",
      ageBand: "adult",
      location: "Oahu",
      persistence: "saved-on-device",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(subject.relationship).toBeNull();
  });

  it("rejects ProfileSubject when updatedAt is earlier than createdAt", () => {
    expect(() => validateProfileSubject({
      version: "1",
      id: "subject-self",
      ownerId: null,
      kind: "self",
      displayLabel: "Myself",
      relationship: null,
      ageBand: "adult",
      location: null,
      persistence: "saved-on-device",
      createdAt: "2026-09-03T18:00:00.000Z",
      updatedAt: "2026-09-03T17:00:00.000Z",
    })).toThrow("updatedAt cannot be earlier than createdAt");
  });

  it("projectProfileFacts strictly rejects facts with mismatched subjectIds", () => {
    const fact1 = validateProfileFact(fact({ id: "fact-1", subjectId: "subject-1" }));
    const fact2 = validateProfileFact(fact({ id: "fact-2", subjectId: "subject-2" }));
    expect(() => projectProfileFacts([fact1, fact2], ["fact-2"], ["subject-1"], "vacation", Date.parse(timestamp)))
      .toThrow("does not belong to a decision subject");
  });

  it("rejects unsupported fields and unbounded values", () => {
    expect(() => validateProfileSubject({
      version: "1",
      id: "subject-self",
      ownerId: null,
      kind: "self",
      displayLabel: "Me",
      relationship: null,
      ageBand: "adult",
      location: null,
      persistence: "decision-only",
      createdAt: timestamp,
      updatedAt: timestamp,
      secretNote: "do not accept",
    })).toThrow("unsupported fields");
    expect(() => validateProfileFact(fact({ value: "x".repeat(241) }))).toThrow("240 characters");
    expect(() => validateProfileFact(fact({ allowedUses: ["vacation", "vacation"] }))).toThrow("must not contain duplicates");
  });

  it("requires inferred facts to be confirmed before entering the profile", () => {
    expect(() => validateProfileFact(fact({ source: "inferred-and-confirmed", confidence: "tentative" })))
      .toThrow("must be confirmed");
    expect(validateProfileFact(fact({ source: "inferred-and-confirmed" }))).toMatchObject({
      source: "inferred-and-confirmed",
      confidence: "confirmed",
    });
  });

  it("projects only explicitly selected, subject-scoped, purpose-allowed facts", () => {
    const vacationFact = validateProfileFact(fact());
    const giftFact = validateProfileFact(fact({
      id: "fact-guitar",
      kind: "interest",
      value: ["electric guitar", "single coil"],
      allowedUses: ["gift"],
      sensitivity: "standard",
      lifeStage: null,
    }));
    expect(projectProfileFacts([vacationFact, giftFact], [giftFact.id], ["subject-self"], "gift", Date.parse(timestamp)))
      .toEqual([giftFact]);
    expect(() => projectProfileFacts([vacationFact], [vacationFact.id], ["subject-self"], "gift", Date.parse(timestamp)))
      .toThrow("not allowed for gift decisions");
    expect(() => projectProfileFacts([giftFact], [giftFact.id], ["another-subject"], "gift", Date.parse(timestamp)))
      .toThrow("does not belong to a decision subject");
  });

  it("rejects expired or missing selected facts rather than silently widening context", () => {
    const expired = validateProfileFact(fact({
      expiresAt: "2026-09-04T00:00:00.000Z",
    }));
    expect(() => projectProfileFacts([expired], [expired.id], ["subject-self"], "vacation", Date.parse("2026-09-05T00:00:00.000Z")))
      .toThrow("has expired");
    expect(() => projectProfileFacts([], ["unknown-fact"], ["subject-self"], "vacation"))
      .toThrow("was not found");
  });

  it("renders only the compact fact value for explanations", () => {
    expect(profileFactText(validateProfileFact(fact({ value: ["quiet", "walkable"] })))).toBe("quiet, walkable");
  });
});
