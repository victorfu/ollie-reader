import { ArrowLeft, Compass, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useReducer, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { getMoveById } from "../../../data/wonderAcademyMoves";
import { isSleepy } from "./logic/battleLogic";
import {
  playerAttack,
  playerCatch,
  playerFlee,
  playerSwitch,
  startBattle,
  type BattleSession,
} from "./logic/battleSession";
import { rollEncounter, type EncounterTable } from "./logic/encounter";
import { gainXp } from "./logic/progression";
import { getEffectivenessAgainst } from "./logic/typeChart";
import { dexCompletion, recordDex, type Wonderdex } from "./logic/wonderdex";
import {
  ELEMENT_META,
  speciesById,
  toCombatant,
  toWild,
  WA_CREATURES,
  WILD_SPECIES,
  STARTER_SPECIES,
  type OwnedCreature,
} from "./wonderAcademyCreatures";

type Screen = "select" | "hub" | "battle" | "result" | "dex";

type ResultInfo = {
  kind: BattleSession["outcome"];
  speciesId?: string;
  lines: string[];
};

type Persisted = {
  playerName: string;
  team: OwnedCreature[];
  dex: Wonderdex;
  stardust: number;
};

type GameState = Persisted & {
  ready: boolean;
  screen: Screen;
  battle: BattleSession | null;
  result: ResultInfo | null;
};

type Action =
  | { type: "load"; state: Persisted | null }
  | { type: "selectStarter"; speciesId: string }
  | { type: "explore" }
  | { type: "battleMove"; moveId: string }
  | { type: "battleCatch" }
  | { type: "battleSwitch"; ownedId: string }
  | { type: "battleFlee" }
  | { type: "closeResult" }
  | { type: "openDex" }
  | { type: "closeDex" };

const INITIAL: GameState = {
  ready: false,
  screen: "select",
  playerName: "",
  team: [],
  dex: {},
  stardust: 0,
  battle: null,
  result: null,
};

const random = (): number => Math.random();

const displayName = (owned: OwnedCreature): string =>
  owned.nickname || speciesById(owned.speciesId)?.name || owned.speciesId;

function resolveOutcome(state: GameState, session: BattleSession): GameState {
  const activeOwnedId = session.active.ownedId;
  const wildSpeciesId = session.wild.speciesId;
  const wildName = speciesById(wildSpeciesId)?.name ?? "野生寵物";
  const lines: string[] = [];
  let team = state.team;
  let dex = state.dex;
  let stardust = state.stardust;

  const awardXp = (amount: number) => {
    team = team.map((o) => {
      if (o.ownedId !== activeOwnedId) return o;
      const res = gainXp(o.level, o.xp, amount);
      if (res.levelsGained > 0) {
        lines.push(`${displayName(o)} 升到了 Lv.${res.level}!✨`);
      }
      return { ...o, level: res.level, xp: res.xp };
    });
  };

  if (session.outcome === "caught") {
    team = [
      ...team,
      {
        ownedId: `${wildSpeciesId}-${team.length}-${Math.floor(random() * 1e6)}`,
        speciesId: wildSpeciesId,
        nickname: "",
        level: session.wild.level,
        xp: 0,
        bond: 10,
        stage: 0,
      },
    ];
    dex = recordDex(dex, wildSpeciesId, "caught");
    stardust += 15;
    lines.push(`你和 ${wildName} 成為了朋友!🎉`);
    awardXp(session.wild.level * 4);
  } else if (session.outcome === "won") {
    dex = recordDex(dex, wildSpeciesId, "seen");
    stardust += 5;
    lines.push(`${wildName} 累倒了,溜走了…`);
    awardXp(session.wild.level * 4);
  } else if (session.outcome === "fled") {
    lines.push("你帶著夥伴安全撤退了。");
  } else {
    lines.push("你的夥伴都累倒了…回學院休息一下吧。");
  }

  return {
    ...state,
    team,
    dex,
    stardust,
    battle: null,
    result: { kind: session.outcome, speciesId: wildSpeciesId, lines },
    screen: "result",
  };
}

function afterBattle(state: GameState, next: BattleSession): GameState {
  return next.outcome === "ongoing"
    ? { ...state, battle: next }
    : resolveOutcome(state, next);
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "load": {
      if (!action.state) return { ...INITIAL, ready: true, screen: "select" };
      return {
        ...INITIAL,
        ...action.state,
        ready: true,
        screen: action.state.team.length > 0 ? "hub" : "select",
      };
    }
    case "selectStarter": {
      const species = speciesById(action.speciesId);
      if (!species) return state;
      return {
        ...state,
        team: [
          {
            ownedId: `${species.speciesId}-starter`,
            speciesId: species.speciesId,
            nickname: "",
            level: 5,
            xp: 0,
            bond: 20,
            stage: 0,
          },
        ],
        dex: recordDex(state.dex, species.speciesId, "caught"),
        screen: "hub",
      };
    }
    case "explore": {
      if (state.team.length === 0) return state;
      const table: EncounterTable = {
        encounterChance: 1,
        entries: WILD_SPECIES.map((s) => ({
          speciesId: s.speciesId,
          weight: s.rarity === "common" ? 3 : 1,
        })),
        minLevel: 2,
        maxLevel: 6,
      };
      const enc = rollEncounter(table, random);
      if (!enc) return state;
      const species = speciesById(enc.speciesId);
      if (!species) return state;
      const session = startBattle(state.team.map(toCombatant), toWild(species, enc.level));
      return {
        ...state,
        dex: recordDex(state.dex, enc.speciesId, "seen"),
        battle: session,
        result: null,
        screen: "battle",
      };
    }
    case "battleMove":
      return state.battle ? afterBattle(state, playerAttack(state.battle, action.moveId)) : state;
    case "battleCatch":
      return state.battle ? afterBattle(state, playerCatch(state.battle, 2, false, random)) : state;
    case "battleSwitch":
      return state.battle ? afterBattle(state, playerSwitch(state.battle, action.ownedId)) : state;
    case "battleFlee":
      return state.battle ? resolveOutcome(state, playerFlee(state.battle)) : state;
    case "closeResult":
      return { ...state, result: null, screen: "hub" };
    case "openDex":
      return { ...state, screen: "dex" };
    case "closeDex":
      return { ...state, screen: "hub" };
    default:
      return state;
  }
}

const storageKey = (uid: string) => `wonder-academy-game-v2-${uid}`;

function loadPersisted(uid: string): Persisted | null {
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.team)) return null;
    return {
      playerName: parsed.playerName ?? "",
      team: parsed.team,
      dex: parsed.dex ?? {},
      stardust: parsed.stardust ?? 0,
    };
  } catch {
    return null;
  }
}

// ---- small presentational pieces ----

function TypeBadge({ element }: { element: keyof typeof ELEMENT_META }) {
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

function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
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

function battleHeadline(session: BattleSession): string {
  const last = session.log[session.log.length - 1];
  const wildName = speciesById(session.wild.speciesId)?.name ?? "野生寵物";
  if (!last) return `野生的 ${wildName} 出現了!`;
  switch (last.kind) {
    case "playerMove":
      return last.effectiveness >= 2 ? "效果絕佳!⭐" : last.effectiveness <= 0.5 ? "效果不太好…" : `${session.active.name} 出招了!`;
    case "wildMove":
      return `${wildName} 反擊了!`;
    case "wildSleepy":
      return `${wildName} 想睡了 😴 — 趁現在遞點心!`;
    case "switch":
      return `換 ${session.active.name} 上場!`;
    case "playerFainted":
      return `${session.active.name} 累倒了!`;
    case "catchAttempt":
      return last.caught ? "收服成功!🎉" : "差一點…牠掙脫了!";
    default:
      return `野生的 ${wildName}`;
  }
}

const PANEL_BG =
  "radial-gradient(120% 90% at 12% 0%, #fff7ec 0%, rgba(255,247,236,0) 55%), radial-gradient(120% 110% at 100% 0%, #efe7ff 0%, rgba(239,231,255,0) 50%), linear-gradient(180deg, #fbf6ff 0%, #f3eefe 60%, #efeafc 100%)";

type Props = { onExit?: () => void };

export default function WonderAcademyGame({ onExit }: Props) {
  const { user } = useAuth();
  const uid = user?.uid ?? "guest";
  const [state, dispatch] = useReducer(reducer, INITIAL);

  useEffect(() => {
    dispatch({ type: "load", state: loadPersisted(uid) });
  }, [uid]);

  useEffect(() => {
    if (!state.ready) return;
    const data: Persisted = {
      playerName: state.playerName,
      team: state.team,
      dex: state.dex,
      stardust: state.stardust,
    };
    try {
      window.localStorage.setItem(storageKey(uid), JSON.stringify(data));
    } catch {
      // ignore quota / availability errors
    }
  }, [uid, state.ready, state.playerName, state.team, state.dex, state.stardust]);

  const completion = useMemo(
    () => dexCompletion(state.dex, WA_CREATURES.map((c) => c.speciesId)),
    [state.dex],
  );

  const frame = (children: ReactNode) => (
    <div style={{ minHeight: "100dvh", background: PANEL_BG, fontFamily: '-apple-system, "PingFang TC", "Noto Sans TC", sans-serif', color: "#33304a" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <button onClick={onExit} style={btnGhost}><ArrowLeft size={16} /> 離開</button>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em" }}>✦ Sparkleaf 星葉學院</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8a83a3" }}>✨ {state.stardust}</div>
      </header>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "4px 16px 40px" }}>{children}</div>
    </div>
  );

  if (!state.ready) return frame(<div style={{ textAlign: "center", padding: 60, color: "#8a83a3" }}>載入中…</div>);

  // ---------- STARTER SELECT ----------
  if (state.screen === "select") {
    return frame(
      <div>
        <div style={{ textAlign: "center", letterSpacing: ".2em", fontSize: 11, fontWeight: 700, color: "#8a83a3", textTransform: "uppercase", margin: "6px 0" }}>序章 — 命運的相遇</div>
        <h1 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, margin: "0 0 6px" }}>選擇你的第一個夥伴</h1>
        <p style={{ textAlign: "center", color: "#8a83a3", fontSize: 14, maxWidth: 460, margin: "0 auto 22px" }}>牠會陪你走完整段冒險。看看牠的個性與屬性,再決定誰一起出發。</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          {STARTER_SPECIES.map((s) => (
            <button key={s.speciesId} onClick={() => dispatch({ type: "selectStarter", speciesId: s.speciesId })} style={cardBtn}>
              <img src={s.portrait} alt={s.name} style={{ width: 96, height: 96, objectFit: "contain", margin: "0 auto 8px", display: "block", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.12))" }} />
              <div style={{ fontWeight: 800, fontSize: 18 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "#8a83a3", marginBottom: 8 }}>{s.category}</div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
                {s.elements.map((e) => <TypeBadge key={e} element={e} />)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, minHeight: 32 }}>「{s.personality}」</div>
            </button>
          ))}
        </div>
      </div>,
    );
  }

  // ---------- HUB ----------
  if (state.screen === "hub") {
    return frame(
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "8px 0 2px" }}>學院大廳</h1>
        <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 18px" }}>圖鑑進度 {completion.caught}/{completion.total} 已收服 · {completion.seen} 已遇見</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
          <button onClick={() => dispatch({ type: "explore" })} style={ctaBtn}><Compass size={18} /> 探索森林</button>
          <button onClick={() => dispatch({ type: "openDex" })} style={btnOutline}><Sparkles size={16} /> 圖鑑</button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".1em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 10 }}>你的隊伍</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {state.team.map((o) => {
            const sp = speciesById(o.speciesId);
            return (
              <div key={o.ownedId} style={cardStatic}>
                <img src={sp?.portrait} alt={sp?.name} style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 6px", display: "block" }} />
                <div style={{ fontWeight: 800, textAlign: "center" }}>{displayName(o)}</div>
                <div style={{ fontSize: 11, color: "#8a83a3", textAlign: "center", marginBottom: 6 }}>Lv.{o.level} · {sp?.category}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  {sp?.elements.map((e) => <TypeBadge key={e} element={e} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- DEX ----------
  if (state.screen === "dex") {
    return frame(
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Wonderdex</h1>
          <button onClick={() => dispatch({ type: "closeDex" })} style={btnGhost}><X size={16} /> 關閉</button>
        </div>
        <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 16px" }}>已收服 {completion.caught} / {completion.total}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
          {WA_CREATURES.map((s) => {
            const status = state.dex[s.speciesId] ?? "unseen";
            const seen = status !== "unseen";
            const caught = status === "caught" || status === "evolved";
            return (
              <div key={s.speciesId} style={{ ...cardStatic, opacity: seen ? 1 : 0.55, textAlign: "center" }}>
                <img src={s.portrait} alt={seen ? s.name : "???"} style={{ width: 64, height: 64, objectFit: "contain", margin: "0 auto 6px", display: "block", filter: caught ? "none" : "grayscale(1) brightness(.7)" }} />
                <div style={{ fontWeight: 800 }}>{seen ? s.name : "？？？"}</div>
                <div style={{ fontSize: 11, color: caught ? "#42b86a" : "#8a83a3", fontWeight: 700 }}>
                  {caught ? "已收服" : seen ? "已遇見" : "未發現"}
                </div>
              </div>
            );
          })}
        </div>
      </div>,
    );
  }

  // ---------- RESULT ----------
  if (state.screen === "result" && state.result) {
    const sp = state.result.speciesId ? speciesById(state.result.speciesId) : undefined;
    const caught = state.result.kind === "caught";
    return frame(
      <div style={{ textAlign: "center", paddingTop: 24 }}>
        {sp && (
          <img src={sp.portrait} alt={sp.name} style={{ width: 140, height: 140, objectFit: "contain", margin: "0 auto 10px", display: "block", filter: caught ? "drop-shadow(0 8px 12px rgba(244,169,58,.35))" : "grayscale(.4)" }} />
        )}
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 14px" }}>{caught ? "🎉 新夥伴!" : state.result.kind === "won" ? "戰鬥結束" : state.result.kind === "fled" ? "撤退" : "回去休息"}</h1>
        <div style={{ maxWidth: 380, margin: "0 auto 22px" }}>
          {state.result.lines.map((l, i) => (
            <p key={i} style={{ fontSize: 15, margin: "6px 0", color: "#33304a" }}>{l}</p>
          ))}
        </div>
        <button onClick={() => dispatch({ type: "closeResult" })} style={ctaBtn}>回到學院 →</button>
      </div>,
    );
  }

  // ---------- BATTLE ----------
  if (state.screen === "battle" && state.battle) {
    const s = state.battle;
    const wildSp = speciesById(s.wild.speciesId);
    const activeSp = speciesById(s.active.speciesId);
    const wildSleepy = isSleepy(s.wild);
    return frame(
      <div>
        <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(80,50,130,.12)" }}>
          <div style={{ position: "relative", padding: 16, background: "radial-gradient(60% 50% at 78% 18%, #fff6d8 0%, rgba(255,246,216,0) 60%), linear-gradient(180deg,#cdeffb 0%, #d7f0d0 52%, #bfe3a3 100%)" }}>
            {/* enemy */}
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 8 }}>
              <div style={infoCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800 }}>{wildSp?.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8a83a3" }}>Lv.{s.wild.level}</span>
                </div>
                <div style={{ display: "flex", gap: 4, margin: "3px 0 5px" }}>{s.wild.elements.map((e) => <TypeBadge key={e} element={e} />)}</div>
                <HpBar hp={s.wild.hp} maxHp={s.wild.maxHp} />
                {wildSleepy && <div style={{ marginTop: 5, fontSize: 11, fontWeight: 800, color: "#c98a12", background: "#fff4d6", display: "inline-block", padding: "2px 8px", borderRadius: 999 }}>😴 想睡了 — 好收服!</div>}
              </div>
            </div>
            <div style={{ textAlign: "right", marginBottom: 4 }}>
              <img src={wildSp?.portrait} alt={wildSp?.name} style={{ width: 92, height: 92, objectFit: "contain", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.16))" }} />
            </div>
            {/* player */}
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <img src={activeSp?.portrait} alt={activeSp?.name} style={{ width: 104, height: 104, objectFit: "contain", transform: "scaleX(-1)", filter: "drop-shadow(0 6px 6px rgba(0,0,0,.18))" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -28 }}>
              <div style={infoCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800 }}>{s.active.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#8a83a3" }}>Lv.{s.active.level}</span>
                </div>
                <HpBar hp={s.active.hp} maxHp={s.active.maxHp} />
              </div>
            </div>
          </div>

          <div style={{ background: "#2c2a3f", color: "#fdfcff", fontSize: 13.5, fontWeight: 600, padding: "11px 16px" }}>{battleHeadline(s)}</div>

          <div style={{ padding: 14, background: "#f6f2fc", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
            <div style={{ gridColumn: "1 / span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {s.active.moveIds.slice(0, 4).map((id) => {
                const mv = getMoveById(id);
                if (!mv) return null;
                const eff = getEffectivenessAgainst(mv.element, s.wild.elements);
                const m = ELEMENT_META[mv.element];
                return (
                  <button key={id} onClick={() => dispatch({ type: "battleMove", moveId: id })} style={moveBtn}>
                    {eff >= 2 && <span style={effBadge}>剋制 2×</span>}
                    {eff <= 0.5 && <span style={{ ...effBadge, background: "#9aa0b5" }}>沒效 ½</span>}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.fg }} />
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{mv.name}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#8a83a3", fontWeight: 700 }}>{mv.element} · 威力 {mv.power}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={() => dispatch({ type: "battleCatch" })} style={{ ...actBtn, background: "linear-gradient(180deg,#ffd66b,#f7b13a)", color: "#5b3d00", border: "none", boxShadow: "0 6px 16px rgba(247,177,58,.4)" }}>🍪 遞點心收服</button>
              {s.bench.length > 0 && (
                <button onClick={() => dispatch({ type: "battleSwitch", ownedId: s.bench[0].ownedId })} style={actBtnSub}>🔄 換 {s.bench[0].name}</button>
              )}
              <button onClick={() => dispatch({ type: "battleFlee" })} style={actBtnSub}>🏃 逃跑</button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  return frame(<div style={{ textAlign: "center", padding: 60, color: "#8a83a3" }}>…</div>);
}

// ---- shared styles ----
const btnGhost: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#6a6585", background: "transparent", border: "none", cursor: "pointer", padding: "6px 8px" };
const btnOutline: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: "#6a52ff", background: "rgba(255,255,255,.7)", border: "1px solid rgba(106,82,255,.3)", borderRadius: 13, padding: "12px 18px", cursor: "pointer" };
const ctaBtn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "#fff", background: "linear-gradient(180deg,#7c6cff,#6a52ff)", border: "none", padding: "13px 24px", borderRadius: 14, boxShadow: "0 8px 20px rgba(106,82,255,.34)", cursor: "pointer" };
const cardBtn: CSSProperties = { background: "rgba(255,255,255,.66)", backdropFilter: "blur(14px)", border: "1px solid rgba(60,40,90,.1)", borderRadius: 18, padding: "16px 14px", textAlign: "center", cursor: "pointer", boxShadow: "0 6px 18px rgba(80,50,130,.08)", transition: "transform .18s" };
const cardStatic: CSSProperties = { background: "rgba(255,255,255,.66)", border: "1px solid rgba(60,40,90,.1)", borderRadius: 16, padding: 12, boxShadow: "0 5px 14px rgba(80,50,130,.07)" };
const infoCard: CSSProperties = { background: "rgba(255,255,255,.85)", backdropFilter: "blur(6px)", border: "1px solid rgba(60,40,90,.1)", borderRadius: 12, padding: "8px 11px", width: 200, boxShadow: "0 5px 12px rgba(60,40,90,.1)" };
const moveBtn: CSSProperties = { position: "relative", background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 12, padding: "10px 11px", cursor: "pointer", textAlign: "left", boxShadow: "0 2px 6px rgba(60,40,90,.06)" };
const effBadge: CSSProperties = { position: "absolute", top: -8, right: -6, fontSize: 10, fontWeight: 800, color: "#fff", background: "#ef5b6e", padding: "2px 7px", borderRadius: 999, boxShadow: "0 3px 7px rgba(239,91,110,.4)" };
const actBtn: CSSProperties = { borderRadius: 12, padding: "10px 8px", fontSize: 12.5, fontWeight: 800, textAlign: "center", cursor: "pointer", border: "1px solid rgba(60,40,90,.12)", background: "#fff" };
const actBtnSub: CSSProperties = { ...actBtn, color: "#6a6585" };
