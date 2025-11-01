import { FirebaseError } from "firebase/app";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  useCallback,
  useEffect,
  useMemo,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser?.email) {
        try {
          // 這個檢查可以被繞過，但 Firestore Rules 無法繞過
          const userDoc = await getDoc(
            doc(db, "allowedUsers", currentUser.email),
          );
          if (!userDoc.exists()) {
            await signOut(auth);
            setAuthError("此帳號無權限存取。請聯絡管理員。");
            setUser(null);
            setLoading(false);
            return;
          }
        } catch (error) {
          // 如果 Firestore Rules 拒絕存取，會進到這裡
          console.error("權限驗證失敗:", error);
          await signOut(auth);
          setAuthError("此帳號無權限存取。");
          setUser(null);
          setLoading(false);
          return;
        }
      }
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
