import { useContext } from "react";
import { PdfContext } from "../contexts/PdfContext";

export const usePdfState = () => {
  const context = useContext(PdfContext);
  if (!context) {
    throw new Error("usePdfState must be used within PdfProvider");
  }
  return context;
};
