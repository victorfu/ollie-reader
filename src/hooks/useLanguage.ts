import { useContext } from "react";
import { LanguageContext } from "../contexts/LanguageContextType";

export function useLanguage() {
  return useContext(LanguageContext);
}
