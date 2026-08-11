import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../utils/supabaseClient", () => ({
  STORAGE_BUCKET: "practice-audio",
  supabase: {
    storage: {
      from: storageMocks.from,
    },
  },
}));

import {
  deletePracticeAudio,
  uploadPracticeAudio,
} from "./audioStorageService";

beforeEach(() => {
  vi.clearAllMocks();
  storageMocks.from.mockReturnValue({
    upload: storageMocks.upload,
    remove: storageMocks.remove,
    createSignedUrl: storageMocks.createSignedUrl,
  });
  storageMocks.upload.mockResolvedValue({ error: null });
  storageMocks.remove.mockResolvedValue({ error: null });
});

describe("practice audio storage metadata", () => {
  it("keeps the browser recorder's MP4 content type and extension", async () => {
    const blob = new Blob(["audio"], { type: "audio/mp4;codecs=mp4a.40.2" });

    await expect(
      uploadPracticeAudio("user-1", "record-1", blob),
    ).resolves.toBe("speech-practice/user-1/record-1.mp4");

    expect(storageMocks.upload).toHaveBeenCalledWith(
      "speech-practice/user-1/record-1.mp4",
      blob,
      { contentType: "audio/mp4", upsert: true },
    );
  });

  it("deletes the exact persisted path", async () => {
    await deletePracticeAudio(
      "user-1",
      "record-1",
      "speech-practice/user-1/record-1.ogg",
    );

    expect(storageMocks.remove).toHaveBeenCalledWith([
      "speech-practice/user-1/record-1.ogg",
    ]);
  });
});
