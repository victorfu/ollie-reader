import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  runTransaction: vi.fn(),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn(),
  error: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  getDocs: mocks.getDocs,
  getDoc: mocks.getDoc,
  runTransaction: mocks.runTransaction,
  writeBatch: mocks.writeBatch,
  onSnapshot: mocks.onSnapshot,
}));
vi.mock("./logger", () => ({ logger: { error: mocks.error } }));

import { getDoc, getDocs, onSnapshot, runTransaction, writeBatch } from "./firestore";

function firebaseError(code: string, message: string) {
  return Object.assign(new Error(message), { name: "FirebaseError", code });
}

afterEach(() => vi.resetAllMocks());

describe("Firestore error logging", () => {
  it("logs a missing index with Firebase's link and still rejects", async () => {
    const error = firebaseError(
      "failed-precondition",
      "The query requires an index. You can create it here: https://console.firebase.google.com/x",
    );
    mocks.getDocs.mockRejectedValue(error);

    await expect(getDocs({} as never)).rejects.toBe(error);
    expect(mocks.error).toHaveBeenCalledWith(
      expect.stringMatching(/Missing index for getDocs query\..*https:\/\/console\.firebase\.google\.com\/x/),
      error,
    );
  });

  it("logs a rules denial with the document path", async () => {
    const error = firebaseError("permission-denied", "Missing or insufficient permissions.");
    mocks.getDoc.mockRejectedValue(error);

    await expect(getDoc({ path: "users/u1/podcasts/p1" } as never)).rejects.toBe(error);
    expect(mocks.error).toHaveBeenCalledWith(
      "[Firestore] Permission denied by security rules for getDoc users/u1/podcasts/p1.",
      error,
    );
  });

  it("leaves a transaction's own errors to the caller", async () => {
    mocks.runTransaction.mockRejectedValue(new Error("Not enough coins"));

    await expect(runTransaction({} as never, vi.fn())).rejects.toThrow("Not enough coins");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("logs a failed batch commit", async () => {
    const error = firebaseError("permission-denied", "Missing or insufficient permissions.");
    const commit = vi.fn().mockRejectedValue(error);
    mocks.writeBatch.mockReturnValue({ commit });

    await expect(writeBatch({} as never).commit()).rejects.toBe(error);
    expect(commit).toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("writeBatch.commit"), error);
  });

  it("logs listener errors and still passes them to the caller", () => {
    const onError = vi.fn();
    onSnapshot({ path: "gameProgress/u1" } as never, () => {}, onError);
    const [, , reportingOnError] = mocks.onSnapshot.mock.calls[0];
    const error = firebaseError("permission-denied", "Missing or insufficient permissions.");

    reportingOnError(error);

    expect(onError).toHaveBeenCalledWith(error);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("onSnapshot gameProgress/u1"), error);
  });
});
