import { useCallback, useEffect, useState } from "react";

const SIDEBAR_MORE_ITEMS_KEY = "ollie-sidebar-more-items";
const SIDEBAR_MORE_OPEN_KEY = "ollie-sidebar-more-open";

/** 第一次使用時預設收進「更多」的入口 */
export const DEFAULT_SIDEBAR_MORE_ITEMS = ["/english-speech", "/show", "/exams"];

function readMoreItems(): string[] {
  try {
    const raw = localStorage.getItem(SIDEBAR_MORE_ITEMS_KEY);
    if (raw === null) return DEFAULT_SIDEBAR_MORE_ITEMS;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // localStorage not available or corrupted value
  }
  return DEFAULT_SIDEBAR_MORE_ITEMS;
}

function readMoreOpen(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_MORE_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Which sidebar entries live in the collapsible「更多」group, and whether that
 * group is expanded. Both are per-device preferences kept in localStorage.
 */
export function useSidebarMore() {
  const [moreItems, setMoreItems] = useState<string[]>(readMoreItems);
  const [moreOpen, setMoreOpen] = useState<boolean>(readMoreOpen);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_MORE_ITEMS_KEY, JSON.stringify(moreItems));
    } catch {
      // localStorage not available
    }
  }, [moreItems]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_MORE_OPEN_KEY, moreOpen ? "1" : "0");
    } catch {
      // localStorage not available
    }
  }, [moreOpen]);

  const isInMore = useCallback((to: string) => moreItems.includes(to), [moreItems]);

  const moveToMore = useCallback((to: string) => {
    setMoreItems((items) => (items.includes(to) ? items : [...items, to]));
  }, []);

  const moveOutOfMore = useCallback((to: string) => {
    setMoreItems((items) => items.filter((item) => item !== to));
  }, []);

  return { moreOpen, setMoreOpen, isInMore, moveToMore, moveOutOfMore };
}
