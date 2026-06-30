import type { CSSProperties } from "react";
import type { WonderAcademySaveStatus } from "./wonderAcademyPersistence";

export function saveStatusChip(status: WonderAcademySaveStatus): CSSProperties {
  const palette: Record<WonderAcademySaveStatus, { bg: string; border: string; color: string }> = {
    idle: { bg: "rgba(255,255,255,.58)", border: "rgba(60,40,90,.12)", color: "#8a83a3" },
    loading: { bg: "#eef5ff", border: "#b9d4ff", color: "#4270bc" },
    saving: { bg: "#eef5ff", border: "#b9d4ff", color: "#4270bc" },
    saved: { bg: "#eef9ee", border: "#b8ddb8", color: "#3b7b45" },
    pending: { bg: "#fff7e0", border: "#f0c869", color: "#9a6a10" },
    failed: { bg: "#ffecef", border: "#efb1bb", color: "#b64255" },
  };
  const c = palette[status];
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 24,
    borderRadius: 999,
    padding: "2px 8px",
    border: `1px solid ${c.border}`,
    background: c.bg,
    color: c.color,
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}
