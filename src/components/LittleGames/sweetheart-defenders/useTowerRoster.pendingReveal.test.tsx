import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UID = "pending-roster-player";
const ATTEMPT_ID = "pending-roster-attempt";
const deletedField = { kind: "deleted-field" };
const serverTimestamp = { kind: "server-timestamp" };

const authState = vi.hoisted(() => ({
  user: null as { uid: string } | null,
}));
const firestoreMocks = vi.hoisted(() => ({
  deleteField: vi.fn(),
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
}));
const mockDb = vi.hoisted(() => ({ kind: "mock-firestore" }));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock("../../../utils/logger", () => ({
  logger: { warn: vi.fn() },
}));
vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("../../../utils/firebaseUtil", () => ({ db: mockDb }));

import {
  acknowledgeGachaPendingReveal,
  getGachaCacheKey,
  loadGachaCloud,
  readGachaCache,
} from "../gacha-machine/gachaStorage";
import { useTowerRoster, type TowerRoster } from "./useTowerRoster";

const baselineSave = {
  schemaVersion: 1 as const,
  resetVersion: 7,
  totalDraws: 3,
  ownedCounts: { kuromi: 1 },
  unknownOwnedCounts: { "future-character": 2 },
};

function pendingDocument(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    resetVersion: 7,
    totalDraws: 4,
    ownedCounts: { kuromi: 1, "hello-kitty": 1 },
    unknownOwnedCounts: { "future-character": 2 },
    pendingReveal: {
      schemaVersion: 1,
      attemptId: ATTEMPT_ID,
      resetVersion: 7,
      baselineSave,
      result: {
        kind: "character",
        characterId: "hello-kitty",
        isNew: true,
        ownedCount: 1,
        totalDraws: 4,
      },
      coinsAfter: 450,
      createdAt: 1_723_456_789_000,
    },
  };
}

function snapshot(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

let host: HTMLDivElement;
let root: Root;
let roster: TowerRoster;
let serverDocument: Record<string, unknown>;

function Harness() {
  const nextRoster = useTowerRoster();
  useLayoutEffect(() => {
    roster = nextRoster;
  }, [nextRoster]);
  return null;
}

async function renderRoster(): Promise<void> {
  await act(async () => {
    root.render(<Harness />);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.clearAllMocks();
  authState.user = { uid: UID };
  serverDocument = pendingDocument();
  localStorage.setItem(getGachaCacheKey(UID), JSON.stringify(serverDocument));
  firestoreMocks.doc.mockImplementation(
    (_db, _collection, uid: string) => ({ kind: "gacha-document", uid }),
  );
  firestoreMocks.deleteField.mockReturnValue(deletedField);
  firestoreMocks.serverTimestamp.mockReturnValue(serverTimestamp);
  firestoreMocks.getDocFromServer.mockImplementation(async () =>
    snapshot(serverDocument),
  );
  firestoreMocks.runTransaction.mockImplementation(
    async (_database, update) => update({
      get: vi.fn().mockImplementation(async () => snapshot(serverDocument)),
      update: vi.fn().mockImplementation(
        (_ref: unknown, patch: Record<string, unknown>) => {
          if (patch.pendingReveal === deletedField) {
            const nextDocument = { ...serverDocument };
            delete nextDocument.pendingReveal;
            nextDocument.updatedAt = patch.updatedAt;
            serverDocument = nextDocument;
          }
        },
      ),
    }),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("useTowerRoster pending gacha reveal", () => {
  it("hides a paid character until its capsule is acknowledged", async () => {
    await renderRoster();

    expect(readGachaCache(UID)).toEqual(baselineSave);
    await expect(loadGachaCloud(UID)).resolves.toEqual(baselineSave);
    expect(roster.availableIds).toContain("kuromi");
    expect(roster.availableIds).not.toContain("hello-kitty");
    expect(roster.availableIds).not.toContain("future-character");
    expect(roster.ownedCount).toBe(1);

    // Another tab may write the committed-but-unrevealed cache. Both the
    // immediate local read and its cloud follow-up must remain baseline-only.
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: getGachaCacheKey(UID),
        newValue: localStorage.getItem(getGachaCacheKey(UID)),
      }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(roster.availableIds).not.toContain("hello-kitty");

    await expect(
      acknowledgeGachaPendingReveal(UID, ATTEMPT_ID),
    ).resolves.toBe(true);
    expect(readGachaCache(UID)).toEqual({
      schemaVersion: 1,
      resetVersion: 7,
      totalDraws: 4,
      ownedCounts: { "hello-kitty": 1, kuromi: 1 },
      unknownOwnedCounts: { "future-character": 2 },
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(roster.availableIds).toContain("hello-kitty");
    expect(roster.availableIds).toContain("kuromi");
    expect(roster.availableIds).not.toContain("future-character");
    expect(roster.ownedCount).toBe(2);
  });

  it("applies a cross-tab acknowledgement ahead of an older focus refresh", async () => {
    await renderRoster();
    expect(roster.availableIds).not.toContain("hello-kitty");

    const stalePendingDocument = pendingDocument();
    let resolveStaleCloud:
      | ((value: ReturnType<typeof snapshot>) => void)
      | undefined;
    firestoreMocks.getDocFromServer.mockReturnValueOnce(
      new Promise<ReturnType<typeof snapshot>>((resolve) => {
        resolveStaleCloud = resolve;
      }),
    );
    act(() => window.dispatchEvent(new Event("focus")));

    const acknowledgedDocument = { ...serverDocument };
    delete acknowledgedDocument.pendingReveal;
    acknowledgedDocument.acknowledgedAttemptId = ATTEMPT_ID;
    serverDocument = acknowledgedDocument;
    const serializedAcknowledgement = JSON.stringify(acknowledgedDocument);
    localStorage.setItem(getGachaCacheKey(UID), serializedAcknowledgement);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getGachaCacheKey(UID),
          newValue: serializedAcknowledgement,
        }),
      );
    });

    expect(roster.availableIds).toContain("hello-kitty");
    expect(roster.ownedCount).toBe(2);

    await act(async () => {
      resolveStaleCloud?.(snapshot(stalePendingDocument));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(roster.availableIds).toContain("hello-kitty");
    expect(roster.availableIds).toContain("kuromi");
    expect(roster.ownedCount).toBe(2);
  });

  it("unlocks an acknowledged cross-tab character on its cache event", async () => {
    await renderRoster();
    await acknowledgeGachaPendingReveal(UID, ATTEMPT_ID);

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: getGachaCacheKey(UID),
        newValue: localStorage.getItem(getGachaCacheKey(UID)),
      }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(roster.availableIds).toContain("hello-kitty");
    expect(roster.ownedCount).toBe(2);
  });

  it("does not let account A's late cloud load contaminate account B", async () => {
    const uidB = "roster-player-b";
    let resolveA!: (value: ReturnType<typeof snapshot>) => void;
    const lateA = new Promise<ReturnType<typeof snapshot>>((resolve) => {
      resolveA = resolve;
    });
    const saveA = {
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 1,
      ownedCounts: { "badtz-maru": 1 },
      unknownOwnedCounts: {},
    };
    const saveB = {
      schemaVersion: 1,
      resetVersion: 1,
      totalDraws: 1,
      ownedCounts: { "hello-kitty": 1 },
      unknownOwnedCounts: {},
    };
    localStorage.setItem(getGachaCacheKey(UID), JSON.stringify(saveA));
    localStorage.setItem(getGachaCacheKey(uidB), JSON.stringify(saveB));
    firestoreMocks.getDocFromServer.mockImplementation(
      async (ref: { uid: string }) => (
        ref.uid === UID ? lateA : snapshot(saveB)
      ),
    );

    await renderRoster();
    expect(roster.availableIds).toContain("badtz-maru");

    authState.user = { uid: uidB };
    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(roster.availableIds).toContain("hello-kitty");
    expect(roster.availableIds).not.toContain("badtz-maru");

    await act(async () => {
      resolveA(snapshot(saveA));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(roster.availableIds).toContain("hello-kitty");
    expect(roster.availableIds).not.toContain("badtz-maru");
  });
});
