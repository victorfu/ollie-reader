import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueAudioUploadCleanup,
  listAudioUploadCleanupMarkers,
  listAudioUploadCleanups,
  removeAudioUploadCleanup,
} from "./audioUploadCleanupQueue";

describe("audio upload cleanup markers", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const userId of ["user-1", "user-2"]) {
      for (const path of listAudioUploadCleanups(userId)) {
        removeAudioUploadCleanup(userId, path);
      }
    }
  });

  it("persists markers per owner and never exposes another owner's work", () => {
    const alicePath = "audio-uploads/user-1/pending.mp3";
    expect(enqueueAudioUploadCleanup("user-1", alicePath)).toBe(true);

    expect(listAudioUploadCleanups("user-1")).toEqual([alicePath]);
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: alicePath, reason: "orphaned-upload" },
    ]);
    expect(listAudioUploadCleanups("user-2")).toEqual([]);

    removeAudioUploadCleanup("user-1", alicePath);
    expect(listAudioUploadCleanups("user-1")).toEqual([]);
  });

  it("rejects a path that is not owned by the marker's user", () => {
    expect(
      enqueueAudioUploadCleanup(
        "user-2",
        "audio-uploads/user-1/not-bobs.mp3",
      ),
    ).toBe(false);
    expect(listAudioUploadCleanups("user-2")).toEqual([]);
  });

  it("persists delete intent and never downgrades it to an upload rollback", () => {
    const path = "audio-uploads/user-1/delete-pending.mp3";
    expect(
      enqueueAudioUploadCleanup("user-1", path, {
        reason: "deleted-record",
        requireDurable: true,
      }),
    ).toBe(true);
    enqueueAudioUploadCleanup("user-1", path, {
      reason: "orphaned-upload",
    });

    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: path, reason: "deleted-record" },
    ]);

    removeAudioUploadCleanup("user-1", path, "orphaned-upload");
    expect(listAudioUploadCleanupMarkers("user-1")).toEqual([
      { audioPath: path, reason: "deleted-record" },
    ]);
  });

  it("reports failure when a caller requires persistence but storage is unavailable", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(
      enqueueAudioUploadCleanup(
        "user-1",
        "audio-uploads/user-1/durable.mp3",
        { requireDurable: true },
      ),
    ).toBe(false);
    setItem.mockRestore();
  });
});
