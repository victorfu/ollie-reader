import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  callback: null as ((user: User | null) => Promise<void>) | null,
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(() => ({ kind: "allowed-user-document" })),
  getDocFromServer: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class GoogleAuthProvider {},
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
}));
vi.mock("firebase/firestore", () => firestoreMocks);
vi.mock("../utils/firebaseUtil", () => ({
  auth: { kind: "auth" },
  db: { kind: "db" },
}));

import { useAuth } from "../hooks/useAuth";
import { AuthProvider } from "./auth";

let container: HTMLDivElement;
let root: Root;

function AuthProbe() {
  const { user, loading, authError } = useAuth();
  return (
    <div>
      <span data-state>{loading ? "loading" : user?.uid ?? "signed-out"}</span>
      <span data-error>{authError ?? ""}</span>
    </div>
  );
}

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  setOnline(true);
  authMocks.callback = null;
  authMocks.onAuthStateChanged.mockReset().mockImplementation((_auth, callback) => {
    authMocks.callback = callback;
    return vi.fn();
  });
  authMocks.signOut.mockReset().mockResolvedValue(undefined);
  firestoreMocks.getDocFromServer.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AuthProvider allowlist verification", () => {
  it("keeps the persisted user when allowlist verification is unavailable offline", async () => {
    setOnline(false);
    firestoreMocks.getDocFromServer.mockRejectedValue(
      new FirebaseError("unavailable", "offline"),
    );
    const user = {
      uid: "offline-player",
      email: "player@example.com",
    } as User;

    await act(async () => {
      await authMocks.callback?.(user);
    });

    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(container.querySelector("[data-state]")?.textContent).toBe(
      "offline-player",
    );
    expect(container.querySelector("[data-error]")?.textContent).toContain(
      "目前離線",
    );

    setOnline(true);
    firestoreMocks.getDocFromServer.mockResolvedValue({ exists: () => true });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(container.querySelector("[data-error]")?.textContent).toBe("");
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledTimes(2);
  });

  it("still signs out a user when Firestore explicitly denies access", async () => {
    firestoreMocks.getDocFromServer.mockRejectedValue(
      new FirebaseError("permission-denied", "denied"),
    );
    const user = {
      uid: "denied-player",
      email: "denied@example.com",
    } as User;

    await act(async () => {
      await authMocks.callback?.(user);
    });

    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-state]")?.textContent).toBe(
      "signed-out",
    );
    expect(container.querySelector("[data-error]")?.textContent).toContain(
      "無權限",
    );
  });
});
