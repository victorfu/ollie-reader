import { memo } from "react";
import type { WordPosition } from "../../types/pdf";

interface WordOverlayProps {
  words: WordPosition[];
  onWordClick: (word: string, rect: DOMRect) => void;
}

export const WordOverlay = memo(({ words, onWordClick }: WordOverlayProps) => {
  if (words.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {words.map((w, i) => (
        <button
          key={`${w.word}-${i}-${w.x}-${w.y}`}
          type="button"
          className="absolute pointer-events-auto cursor-pointer bg-transparent hover:bg-warning/30 rounded transition-colors duration-150"
          style={{
            left: `${w.x}px`,
            top: `${w.y}px`,
            width: `${w.width}px`,
            height: `${w.height}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onWordClick(w.word, rect);
          }}
          title={w.word}
        />
      ))}
    </div>
  );
});

WordOverlay.displayName = "WordOverlay";
