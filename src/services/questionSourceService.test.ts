import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  deleteQuestionsForSource: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_parent: unknown, name?: string, id?: string) =>
    name === undefined ? { id: "generated-source-id" } : { path: `${name}/${id}` },
  ),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  deleteDoc: mocks.deleteDoc,
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ kind: "where", field, op, value })),
  orderBy: vi.fn((field: string, direction: string) => ({ kind: "orderBy", field, direction })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date("2026-09-24T00:00:00Z") })),
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));
vi.mock("../utils/supabaseClient", () => ({
  STORAGE_BUCKET: "ollie-reader",
  supabase: {
    storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })) },
  },
}));
vi.mock("./bankQuestionService", () => ({
  deleteQuestionsForSource: mocks.deleteQuestionsForSource,
}));

import { makePage, makeSource } from "../testing/questionBankFixtures";
import {
  createQuestionSourcePath,
  createSource,
  deleteSource,
  getSource,
  listSources,
  newQuestionSourceId,
} from "./questionSourceService";

const stamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };
const sourceData = {
  userId: "user-1",
  title: "月考",
  subject: "math",
  pages: [{ storagePath: "p0.jpg", width: 10, height: 20, masks: [] }],
  createdAt: stamp,
  updatedAt: stamp,
};

function rendered(width: number) {
  return { blob: new Blob(["jpeg"]), width, height: 200 };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = { uid: "user-1" };
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.setDoc.mockResolvedValue(undefined);
  mocks.deleteDoc.mockResolvedValue(undefined);
  mocks.deleteQuestionsForSource.mockResolvedValue(undefined);
});

describe("paths and ids", () => {
  it("builds the owner-scoped storage path", () => {
    expect(createQuestionSourcePath("user-1", "s1", 3)).toBe("question-bank/user-1/s1/page-3.jpg");
  });

  it("uses a Firestore auto id for new sources", () => {
    expect(newQuestionSourceId()).toBe("generated-source-id");
  });
});

describe("createSource", () => {
  it("renders and uploads one page at a time, then writes the document", async () => {
    const log: string[] = [];
    mocks.upload.mockImplementation(async (path: string) => {
      log.push(`upload ${path}`);
      return { error: null };
    });
    mocks.setDoc.mockImplementation(async () => {
      log.push("setDoc");
    });

    const source = await createSource({
      sourceId: "s1",
      title: "月考",
      subject: "math",
      pageCount: 2,
      renderPage: async (index) => {
        log.push(`render ${index}`);
        return rendered(100 + index);
      },
      onProgress: (done, total) => log.push(`progress ${done}/${total}`),
    });

    expect(log).toEqual([
      "render 0",
      "upload question-bank/user-1/s1/page-0.jpg",
      "progress 1/2",
      "render 1",
      "upload question-bank/user-1/s1/page-1.jpg",
      "progress 2/2",
      "setDoc",
    ]);
    expect(mocks.upload).toHaveBeenCalledWith(
      "question-bank/user-1/s1/page-0.jpg",
      expect.any(Blob),
      { contentType: "image/jpeg", upsert: true },
    );
    const [ref, data] = mocks.setDoc.mock.calls[0];
    expect(ref).toEqual({ path: "questionSources/s1" });
    expect(data).toMatchObject({
      userId: "user-1",
      title: "月考",
      subject: "math",
      pages: [
        { storagePath: "question-bank/user-1/s1/page-0.jpg", width: 100, height: 200, masks: [] },
        { storagePath: "question-bank/user-1/s1/page-1.jpg", width: 101, height: 200, masks: [] },
      ],
    });
    expect(source.id).toBe("s1");
    expect(source.pages).toHaveLength(2);
  });

  it("cleans up uploaded pages and skips the document when an upload fails", async () => {
    mocks.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("network") });

    await expect(
      createSource({
        sourceId: "s1",
        title: "t",
        subject: "math",
        pageCount: 2,
        renderPage: async (index) => rendered(index),
      }),
    ).rejects.toThrow("network");

    expect(mocks.setDoc).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith(["question-bank/user-1/s1/page-0.jpg"]);
  });

  it("cleans up every page when the document write fails", async () => {
    mocks.setDoc.mockRejectedValue(new Error("denied"));
    await expect(
      createSource({
        sourceId: "s1",
        title: "t",
        subject: "math",
        pageCount: 2,
        renderPage: async (index) => rendered(index),
      }),
    ).rejects.toThrow("denied");
    expect(mocks.remove).toHaveBeenCalledWith([
      "question-bank/user-1/s1/page-0.jpg",
      "question-bank/user-1/s1/page-1.jpg",
    ]);
  });
});

describe("listSources", () => {
  it("lists the current user's sources newest first and skips broken ones", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        { id: "s1", data: () => sourceData },
        { id: "bad", data: () => ({ ...sourceData, subject: "music" }) },
      ],
    });
    const sources = await listSources();
    expect(sources.map((source) => source.id)).toEqual(["s1"]);
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([
      { kind: "where", field: "userId", op: "==", value: "user-1" },
      { kind: "orderBy", field: "createdAt", direction: "desc" },
    ]);
  });
});

describe("getSource", () => {
  it("returns the source when it belongs to the current user", async () => {
    mocks.getDoc.mockResolvedValue({ id: "s1", exists: () => true, data: () => sourceData });
    expect((await getSource("s1"))?.title).toBe("月考");
  });

  it("returns null for missing, foreign or forbidden sources", async () => {
    mocks.getDoc.mockResolvedValueOnce({ id: "s1", exists: () => false, data: () => undefined });
    expect(await getSource("s1")).toBeNull();

    mocks.getDoc.mockResolvedValueOnce({
      id: "s1",
      exists: () => true,
      data: () => ({ ...sourceData, userId: "someone-else" }),
    });
    expect(await getSource("s1")).toBeNull();

    mocks.getDoc.mockRejectedValueOnce({ code: "permission-denied" });
    expect(await getSource("s1")).toBeNull();
  });
});

describe("deleteSource", () => {
  it("deletes questions, then the source document, then the page images", async () => {
    const log: string[] = [];
    mocks.deleteQuestionsForSource.mockImplementation(async () => log.push("questions"));
    mocks.deleteDoc.mockImplementation(async () => log.push("source"));
    mocks.remove.mockImplementation(async () => {
      log.push("storage");
      return { error: null };
    });

    await deleteSource(
      makeSource({ id: "s1", pages: [makePage({ storagePath: "a.jpg" }), makePage({ storagePath: "b.jpg" })] }),
    );

    expect(log).toEqual(["questions", "source", "storage"]);
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: "questionSources/s1" });
    expect(mocks.remove).toHaveBeenCalledWith(["a.jpg", "b.jpg"]);
  });

  it("does not fail when the storage cleanup fails", async () => {
    mocks.remove.mockRejectedValue(new Error("storage down"));
    await expect(deleteSource(makeSource())).resolves.toBeUndefined();
  });

  it("keeps the source document when deleting questions fails (so it can be retried)", async () => {
    mocks.deleteQuestionsForSource.mockRejectedValue(new Error("offline"));
    await expect(deleteSource(makeSource())).rejects.toThrow("offline");
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });
});
