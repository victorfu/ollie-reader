import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user-1" } as { uid: string } | null },
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_db: unknown, name: string, id: string) => ({ path: `${name}/${id}` })),
  addDoc: mocks.addDoc,
  updateDoc: mocks.updateDoc,
  deleteDoc: mocks.deleteDoc,
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ kind: "where", field, op, value })),
  orderBy: vi.fn((field: string, direction: string) => ({ kind: "orderBy", field, direction })),
  Timestamp: {
    now: vi.fn(() => ({ kind: "now", toDate: () => new Date("2026-09-24T00:00:00Z") })),
  },
}));
vi.mock("../utils/firebaseUtil", () => ({ db: {}, auth: mocks.auth }));

import {
  createSheet,
  deleteSheet,
  getSheet,
  listSheets,
  updateSheet,
} from "./examSheetService";

const stamp = { toDate: () => new Date("2026-09-01T00:00:00Z") };
const sheetData = { userId: "user-1", title: "複習", questionIds: ["q1"], createdAt: stamp, updatedAt: stamp };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.currentUser = { uid: "user-1" };
});

describe("examSheetService", () => {
  it("creates a sheet owned by the current user", async () => {
    mocks.addDoc.mockResolvedValue({ id: "sheet-1" });
    const sheet = await createSheet({ title: "複習", questionIds: ["q2", "q1"] });

    const [collectionRef, data] = mocks.addDoc.mock.calls[0];
    expect(collectionRef).toEqual({ name: "examSheets" });
    expect(data).toMatchObject({ userId: "user-1", title: "複習", questionIds: ["q2", "q1"] });
    expect(sheet).toMatchObject({ id: "sheet-1", questionIds: ["q2", "q1"] });
  });

  it("updates title and question order", async () => {
    await updateSheet("sheet-1", { title: "新標題", questionIds: ["q1"] });
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: "examSheets/sheet-1" },
      expect.objectContaining({ title: "新標題", questionIds: ["q1"], updatedAt: expect.objectContaining({ kind: "now" }) }),
    );
  });

  it("deletes a sheet", async () => {
    await deleteSheet("sheet-1");
    expect(mocks.deleteDoc).toHaveBeenCalledWith({ path: "examSheets/sheet-1" });
  });

  it("lists the current user's sheets newest first", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [{ id: "sheet-1", data: () => sheetData }] });
    expect((await listSheets()).map((sheet) => sheet.id)).toEqual(["sheet-1"]);
    const [query] = mocks.getDocs.mock.calls[0];
    expect(query.constraints).toEqual([
      { kind: "where", field: "userId", op: "==", value: "user-1" },
      { kind: "orderBy", field: "createdAt", direction: "desc" },
    ]);
  });

  it("returns null for missing, foreign or forbidden sheets", async () => {
    mocks.getDoc.mockResolvedValueOnce({ id: "s", exists: () => false, data: () => undefined });
    expect(await getSheet("s")).toBeNull();
    mocks.getDoc.mockResolvedValueOnce({ id: "s", exists: () => true, data: () => ({ ...sheetData, userId: "other" }) });
    expect(await getSheet("s")).toBeNull();
    mocks.getDoc.mockRejectedValueOnce({ code: "permission-denied" });
    expect(await getSheet("s")).toBeNull();
  });

  it("refuses to write without a signed-in user", async () => {
    mocks.auth.currentUser = null;
    await expect(createSheet({ title: "x", questionIds: [] })).rejects.toThrow("尚未登入");
  });
});
