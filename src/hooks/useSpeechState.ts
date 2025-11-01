import { useContext } from "react";
import {
  SpeechContext,
  type SpeechContextType,
} from "../contexts/SpeechContextType";

export const useSpeechState = (): SpeechContextType => {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useSpeechState must be used within SpeechProvider");
  }
  return context;
};
