import { createContext } from "react";
import type { User } from "firebase/auth";
import type { MessageKey } from "../i18n/translate";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  /** Dictionary key of the message to show; render it with t(). */
  authError: MessageKey | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  clearError: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
