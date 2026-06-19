import { useContext } from "react";
import { ThemeContext } from "../contexts/ThemeContextType";

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme 必須搭配 ThemeProvider 使用");
  }

  return context;
}
