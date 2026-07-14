import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDocFromServer } from "firebase/firestore";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "../utils/firebaseUtil";
import { AuthContext } from "./AuthContextType";

function mapFirebaseError(error: unknown, action: "signIn" | "signOut") {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/popup-closed-by-user":
        return "登入視窗已關閉";
      case "auth/cancelled-popup-request":
        return "登入已取消";
      case "auth/popup-blocked":
        return "瀏覽器封鎖了彈出視窗";
      case "auth/account-exists-with-different-credential":
        return "此帳號已使用其他登入方式註冊";
      case "auth/too-many-requests":
        return "嘗試次數過多，請稍後再試";
      case "auth/network-request-failed":
        return "網路連線異常";
      default:
        break;
    }
  }

  if (action === "signOut") {
    return "登出失敗，請稍後再試";
  }

  return "發生未知錯誤，請稍後再試";
}

type AccessVerification =
  | { status: "allowed" }
  | { status: "denied"; message: string; error?: unknown }
  | { status: "unavailable"; error: unknown };

function isAccessDeniedError(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return false;
  return error.code === "permission-denied" || error.code === "unauthenticated";
}

async function verifyAllowedUser(currentUser: User): Promise<AccessVerification> {
  if (!currentUser.email) return { status: "allowed" };

  try {
    // 這個檢查可以被繞過，但 Firestore Rules 無法繞過
    const userDoc = await getDocFromServer(
      doc(db, "allowedUsers", currentUser.email),
    );
    return userDoc.exists()
      ? { status: "allowed" }
      : {
          status: "denied",
          message: "此帳號無權限存取。請聯絡管理員。",
        };
  } catch (error) {
    return isAccessDeniedError(error)
      ? { status: "denied", message: "此帳號無權限存取。", error }
      : { status: "unavailable", error };
  }
}

function unavailableAccessMessage(): string {
  return typeof navigator !== "undefined" && !navigator.onLine
    ? "目前離線，已使用這台裝置上次的登入狀態。"
    : "暫時無法驗證帳號權限，部分雲端功能可能無法使用。";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const needsAccessRecheckRef = useRef(false);
  const verificationSequenceRef = useRef(0);

  const denyAccess = useCallback(
    async (message: string, error?: unknown) => {
      if (error) console.error("權限驗證失敗:", error);
      needsAccessRecheckRef.current = false;
      currentUserRef.current = null;
      setAuthError(message);
      setUser(null);
      setLoading(false);
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("拒絕存取後登出失敗:", signOutError);
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const sequence = ++verificationSequenceRef.current;
      currentUserRef.current = currentUser;
      if (!currentUser) {
        needsAccessRecheckRef.current = false;
        setUser(null);
        setLoading(false);
        return;
      }

      const verification = await verifyAllowedUser(currentUser);
      if (verificationSequenceRef.current !== sequence) return;

      if (verification.status === "denied") {
        await denyAccess(verification.message, verification.error);
        return;
      }

      if (verification.status === "unavailable") {
        // 網路中斷時保留 Firebase Auth 已持久化的登入狀態；真正的資料
        // 權限仍由 Firestore Rules 驗證，讓離線功能可以讀取本機快取。
        console.warn("暫時無法驗證帳號權限:", verification.error);
        needsAccessRecheckRef.current = true;
        setAuthError(unavailableAccessMessage());
        setUser(currentUser);
        setLoading(false);
        return;
      }

      needsAccessRecheckRef.current = false;
      setAuthError(null);
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [denyAccess]);

  useEffect(() => {
    const handleOnline = () => {
      const currentUser = currentUserRef.current;
      if (!needsAccessRecheckRef.current || !currentUser) return;

      const sequence = ++verificationSequenceRef.current;
      void verifyAllowedUser(currentUser).then(async (verification) => {
        if (
          verificationSequenceRef.current !== sequence ||
          currentUserRef.current?.uid !== currentUser.uid
        ) {
          return;
        }

        if (verification.status === "denied") {
          await denyAccess(verification.message, verification.error);
          return;
        }

        if (verification.status === "unavailable") {
          console.warn("重新驗證帳號權限失敗:", verification.error);
          setAuthError(unavailableAccessMessage());
          return;
        }

        needsAccessRecheckRef.current = false;
        setAuthError(null);
        setUser(currentUser);
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [denyAccess]);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      const message = mapFirebaseError(error, "signIn");
      setAuthError(message);
      console.error("Firebase Google sign in error", error);
      throw new Error(message);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      const message = mapFirebaseError(error, "signOut");
      setAuthError(message);
      console.error("Firebase sign out error", error);
      throw new Error(message);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      signInWithGoogle,
      signOutUser,
      clearError,
    }),
    [user, loading, authError, signInWithGoogle, signOutUser, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
