import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  const updateDoc = vi.fn();

  return {
    documents,
    updateDoc,
    reset() {
      documents.clear();
      updateDoc.mockReset();
      updateDoc.mockResolvedValue(undefined);
    },
  };
});

vi.mock("../utils/firebaseUtil", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  deleteField: () => ({ kind: "delete" }),
  doc: vi.fn((_db, collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`,
  })),
  FieldPath: class FieldPath {
    readonly segments: string[];

    constructor(...segments: string[]) {
      this.segments = segments;
    }
  },
  getDoc: vi.fn(),
  increment: (amount: number) => ({ kind: "increment", amount }),
  serverTimestamp: () => ({ toMillis: () => 1_000 }),
  setDoc: vi.fn(),
  updateDoc: firestore.updateDoc,
}));

import {
  saveTravelMissionCompletion,
  saveTravelMissionStep,
} from "./travelProgressService";

describe("transactional travel progress updates", () => {
  beforeEach(() => firestore.reset());

  it("writes a mission step to one topic leaf instead of replacing the map", async () => {
    await saveTravelMissionStep("user-1", "airport", "word", 10);

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      { path: "travelProgress/user-1" },
      expect.objectContaining({ segments: ["inProgress", "airport"] }),
      { step: "word", updatedAt: 10 },
      "updatedAt",
      expect.anything(),
    );
    expect(firestore.updateDoc.mock.calls[0]).not.toContainEqual(
      expect.objectContaining({ inProgress: expect.anything() }),
    );
  });

  it("uses an atomic increment and topic-scoped delete for completion", async () => {
    await saveTravelMissionCompletion("user-1", "airport", 20, 3);

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      { path: "travelProgress/user-1" },
      expect.objectContaining({ segments: ["stamps", "airport", "completedAt"] }),
      20,
      expect.objectContaining({ segments: ["stamps", "airport", "stars"] }),
      3,
      expect.objectContaining({ segments: ["stamps", "airport", "attempts"] }),
      { kind: "increment", amount: 1 },
      expect.objectContaining({ segments: ["inProgress", "airport"] }),
      { kind: "delete" },
      "updatedAt",
      expect.anything(),
    );
  });
});
