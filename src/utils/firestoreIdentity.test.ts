import { describe, expect, it } from "vitest";
import {
  createOwnedTextDocumentId,
  normalizeUniqueText,
} from "./firestoreIdentity";

describe("Firestore text identity", () => {
  it("normalizes case and whitespace for uniqueness", () => {
    expect(normalizeUniqueText("  Ice   CREAM ")).toBe("ice cream");
  });

  it("uses the same id for semantically identical user text", async () => {
    await expect(createOwnedTextDocumentId("word", "u1", " Apple ")).resolves.toBe(
      await createOwnedTextDocumentId("word", "u1", "apple"),
    );
  });

  it("keeps different users isolated", async () => {
    expect(await createOwnedTextDocumentId("word", "u1", "apple")).not.toBe(
      await createOwnedTextDocumentId("word", "u2", "apple"),
    );
  });

  it("hashes unusually long text into a Firestore-safe id", async () => {
    const id = await createOwnedTextDocumentId(
      "sentence",
      "u1",
      "very long sentence ".repeat(100),
    );

    expect(id).toMatch(/^v1h_[a-f0-9]{64}$/);
    expect(id.length).toBeLessThan(1_500);
  });
});
