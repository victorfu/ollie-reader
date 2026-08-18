import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFloatingPanel } from "../../hooks/useFloatingPanel";
import {
  WordPanelContent,
  type WordPanelSharedProps,
} from "./WordPanelContent";

/** Floating shell: draggable, resizable window that overlays the reader. */
export const WordPanel = memo((props: WordPanelSharedProps) => {
  const {
    panelStyle,
    dragHandleProps,
    resizeHandleProps,
    isDragging,
    isResizing,
  } = useFloatingPanel({
    defaultPosition: {
      x: window.innerWidth - 360 - 24,
      y: window.innerHeight - 480 - 24,
    },
    defaultSize: { width: 360, height: 480 },
    minSize: { width: 260, height: 240 },
    maxSize: { width: 560, height: 760 },
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{ ...panelStyle, overflow: "hidden" }}
        className="bg-base-100/90 backdrop-blur-xl rounded-2xl border border-border-hairline shadow-floating flex flex-col"
      >
        <WordPanelContent
          {...props}
          mode="floating"
          dragHandleProps={{
            ...dragHandleProps,
            style: {
              ...dragHandleProps.style,
              cursor: isDragging ? "grabbing" : "grab",
            },
          }}
          disableItemLayoutAnimation={isDragging || isResizing}
        />

        {/* Resize handle */}
        <div
          {...resizeHandleProps}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        >
          <svg
            className="w-3 h-3 text-base-content/20 absolute bottom-0.5 right-0.5"
            viewBox="0 0 6 6"
          >
            <circle cx="4.5" cy="1.5" r="0.75" fill="currentColor" />
            <circle cx="1.5" cy="4.5" r="0.75" fill="currentColor" />
            <circle cx="4.5" cy="4.5" r="0.75" fill="currentColor" />
          </svg>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

WordPanel.displayName = "WordPanel";
