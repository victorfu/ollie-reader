import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContextType";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth 必須搭配 AuthProvider 使用");
  }

  return context;
}
