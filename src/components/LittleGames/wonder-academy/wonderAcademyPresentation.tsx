import { ELEMENT_META } from "./wonderAcademyCreatures";

export function TypeBadge({ element }: { element: keyof typeof ELEMENT_META }) {
  const m = ELEMENT_META[element];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        color: m.fg,
        background: m.bg,
      }}
    >
      {m.emoji} {m.label}
    </span>
  );
}

export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.round((hp / maxHp) * 100));
  const color =
    pct > 50 ? "linear-gradient(90deg,#6fd07f,#42b86a)" : pct > 20 ? "linear-gradient(90deg,#ffcf5b,#f4a93a)" : "linear-gradient(90deg,#ff8a5b,#ef5b6e)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#e7e3ef", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width .35s" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#8a83a3", minWidth: 28, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}
