import { useState } from "react";
import { Upload, X } from "lucide-react";
import type { WonderAcademyAudioSettings } from "../../../types/wonderAcademy";
import { getMoveById } from "../../../data/wonderAcademyMoves";
import {
  CHARM_DEFS,
  MATERIAL_DEFS,
  canCraftCharm,
  type CharmInventory,
  type CharmId,
  type MaterialInventory,
  type MaterialId,
} from "./logic/charms";
import { equippedMovesFor } from "./logic/moveLoadout";
import { POSTGAME_TRIALS } from "./logic/postgameTrials";
import { SNACK_NAMES, SNACK_POOL } from "./logic/snacks";
import {
  ELEMENT_META,
  FIELD_SKILLS,
  fieldSkillForElements,
  learnablePool,
  makeCustomCreature,
  moveUnlockLevel,
  speciesById,
  type CreatureSpecies,
  type OwnedCreature,
} from "./wonderAcademyCreatures";
import { TypeBadge } from "./wonderAcademyPresentation";
import { btnGhost, cardStatic, ctaBtn, feedBtn, fieldInput, fieldLabel, moveBtn } from "./wonderAcademyStyles";

export function SkillsScreen({
  owned,
  onEquip,
  onUnequip,
  onClose,
}: {
  owned: OwnedCreature;
  onEquip: (moveId: string) => void;
  onUnequip: (moveId: string) => void;
  onClose: () => void;
}) {
  const sp = speciesById(owned.speciesId);
  if (!sp) return <div />;
  const equipped = equippedMovesFor(owned, sp);
  const pool = learnablePool(sp);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>技能</h1>
        <button onClick={onClose} style={btnGhost}><X size={16} /> 完成</button>
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <img src={sp.portrait} alt={sp.name} style={{ width: 72, height: 72, objectFit: "contain" }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{owned.nickname || sp.growthStages[owned.stage] || sp.name}</div>
          <div style={{ fontSize: 12, color: "#8a83a3" }}>Lv.{owned.level} · 裝備 {equipped.length}/4</div>
        </div>
      </div>

      <div style={fieldLabel}>已裝備(點一下卸下)</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8, marginBottom: 18 }}>
        {equipped.map((id) => {
          const mv = getMoveById(id);
          if (!mv) return null;
          const m = ELEMENT_META[mv.element];
          return (
            <button key={id} onClick={() => onUnequip(id)} disabled={equipped.length <= 1} style={{ ...moveBtn, opacity: equipped.length <= 1 ? 0.6 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.fg }} />
                <span style={{ fontWeight: 800, fontSize: 13 }}>{mv.name}</span>
              </div>
              <div style={{ fontSize: 10, color: "#8a83a3", fontWeight: 700 }}>{mv.element} · 威力 {mv.power}</div>
            </button>
          );
        })}
      </div>

      <div style={fieldLabel}>可學招式</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
        {pool.map((id, i) => {
          const mv = getMoveById(id);
          if (!mv) return null;
          const m = ELEMENT_META[mv.element];
          const isEquipped = equipped.includes(id);
          const unlockLv = moveUnlockLevel(i);
          const locked = owned.level < unlockLv;
          const canEquip = !isEquipped && !locked && equipped.length < 4;
          return (
            <button key={id} onClick={() => { if (canEquip) onEquip(id); }} disabled={!canEquip} style={{ ...moveBtn, opacity: locked ? 0.45 : isEquipped ? 0.5 : equipped.length >= 4 ? 0.6 : 1, cursor: canEquip ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.fg }} />
                <span style={{ fontWeight: 800, fontSize: 13 }}>{mv.name}</span>
              </div>
              <div style={{ fontSize: 10, color: "#8a83a3", fontWeight: 700 }}>
                {locked ? `🔒 Lv.${unlockLv} 解鎖` : isEquipped ? "✓ 已裝備" : `${mv.element} · 威力 ${mv.power}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StarterConfirm({
  species,
  onBack,
  onConfirm,
}: {
  species: CreatureSpecies;
  onBack: () => void;
  onConfirm: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  return (
    <div style={{ textAlign: "center", paddingTop: 18 }}>
      <style>{`@keyframes waRunIn{0%{opacity:0;transform:translateX(-110px) scale(.78)}62%{transform:translateX(9px) scale(1.06)}100%{opacity:1;transform:none}}@keyframes waHeartFloat{0%{opacity:0;transform:translateY(2px) scale(.6)}25%{opacity:1}100%{opacity:0;transform:translateY(-44px) scale(1.1)}}.wa-runin{animation:waRunIn .7s cubic-bezier(.2,.8,.2,1) both}.wa-heart{animation:waHeartFloat 2.2s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.wa-runin{animation:none}.wa-heart{display:none}}`}</style>
      <div style={{ letterSpacing: ".2em", fontSize: 11, fontWeight: 700, color: "#8a83a3", textTransform: "uppercase", marginBottom: 12 }}>序章 — 命定的夥伴</div>
      <div style={{ position: "relative", width: 160, margin: "0 auto 8px" }}>
        <img className="wa-runin" src={species.portrait} alt={species.name} style={{ width: 160, height: 160, objectFit: "contain", filter: "drop-shadow(0 10px 14px rgba(244,169,58,.3))" }} />
        <div className="wa-heart" style={{ position: "absolute", top: 6, right: 2, fontSize: 22 }}>💛</div>
        <div className="wa-heart" style={{ position: "absolute", top: 20, left: 2, fontSize: 16, animationDelay: ".7s" }}>💛</div>
        <div className="wa-heart" style={{ position: "absolute", bottom: 16, left: 10, fontSize: 18, animationDelay: "1.3s" }}>✨</div>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px" }}><span style={{ color: "#f0922a" }}>{species.name}</span> 選擇了你!</h1>
      <p style={{ color: "#8a83a3", fontSize: 14, maxWidth: 360, margin: "0 auto 14px" }}>牠開心地跑向你 —— 從現在起,你們會一起走完整段冒險。</p>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
        {species.elements.map((e) => <TypeBadge key={e} element={e} />)}
      </div>
      <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={`幫牠取個暱稱?(預設 ${species.name})`} style={{ ...fieldInput, maxWidth: 300, margin: "0 auto 18px", textAlign: "center" }} />
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onBack} style={btnGhost}>← 再想想</button>
        <button onClick={() => onConfirm(nickname)} style={ctaBtn}>和 {nickname.trim() || species.name} 一起出發 →</button>
      </div>
    </div>
  );
}

export function CreatureBuilder({
  onSave,
  onCancel,
}: {
  onSave: (creature: CreatureSpecies) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [portrait, setPortrait] = useState("");
  const [elements, setElements] = useState<(keyof typeof ELEMENT_META)[]>([]);
  const [favoriteSnack, setFavoriteSnack] = useState(SNACK_POOL[0]);

  const toggleElement = (e: keyof typeof ELEMENT_META) =>
    setElements((cur) =>
      cur.includes(e)
        ? cur.filter((x) => x !== e)
        : cur.length < 2
          ? [...cur, e]
          : cur,
    );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setPortrait(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const canSave =
    name.trim().length > 0 && portrait.length > 0 && elements.length > 0;
  const selectedFieldSkill = FIELD_SKILLS[fieldSkillForElements(elements)];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>建立寵物</h1>
        <button onClick={onCancel} style={btnGhost}><X size={16} /> 取消</button>
      </div>
      <p style={{ color: "#8a83a3", fontSize: 13, margin: "0 0 18px" }}>上傳一張圖、取名、選屬性 —— 就會多一隻能在森林裡遇到、收服的夥伴!</p>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, alignItems: "start" }}>
        <label style={{ ...cardStatic, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 140, cursor: "pointer", textAlign: "center", color: "#8a83a3" }}>
          {portrait ? (
            <img src={portrait} alt="預覽" style={{ width: 110, height: 110, objectFit: "contain" }} />
          ) : (
            <>
              <Upload size={22} />
              <span style={{ fontSize: 12, marginTop: 6 }}>上傳圖片</span>
            </>
          )}
          <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} style={{ display: "none" }} />
        </label>

        <div>
          <div style={fieldLabel}>名字</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:咪咪" style={fieldInput} />

          <div style={{ ...fieldLabel, marginTop: 14 }}>屬性(選 1–2 個)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(ELEMENT_META) as (keyof typeof ELEMENT_META)[]).map((e) => {
              const m = ELEMENT_META[e];
              const on = elements.includes(e);
              return (
                <button key={e} onClick={() => toggleElement(e)} style={{ fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 999, cursor: "pointer", border: on ? `2px solid ${m.fg}` : "1px solid rgba(60,40,90,.15)", background: on ? m.bg : "#fff", color: m.fg }}>
                  {m.emoji} {m.label}
                </button>
              );
            })}
          </div>
          {elements.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#6a6585", background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 12, padding: "8px 10px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#8a83a3", marginBottom: 3 }}>建立後探索能力</div>
              <div style={{ fontWeight: 800, color: "#33304a" }}>{selectedFieldSkill.emoji} {selectedFieldSkill.name}</div>
              <div>{selectedFieldSkill.desc}</div>
            </div>
          )}

          <div style={{ ...fieldLabel, marginTop: 14 }}>最愛點心</div>
          <select value={favoriteSnack} onChange={(e) => setFavoriteSnack(e.target.value)} style={fieldInput}>
            {SNACK_POOL.map((s) => (
              <option key={s} value={s}>{SNACK_NAMES[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <button
          disabled={!canSave}
          onClick={() => onSave(makeCustomCreature({ name, portrait, elements, favoriteSnack, seed: Math.floor(Date.now()) }))}
          style={{ ...ctaBtn, opacity: canSave ? 1 : 0.4, pointerEvents: canSave ? "auto" : "none" }}
        >
          ✨ 加入森林
        </button>
      </div>
    </div>
  );
}

function materialCostText(cost: MaterialInventory): string {
  return (Object.entries(cost) as [MaterialId, number][])
    .map(([id, qty]) => {
      const material = MATERIAL_DEFS[id];
      return `${material.emoji}${material.name}×${qty}`;
    })
    .join(" · ");
}

export function WorkshopScreen({
  stardust,
  materials,
  charms,
  activeCharms,
  audioSettings,
  onCraft,
  onToggle,
  onSetVolume,
  onClose,
}: {
  stardust: number;
  materials: MaterialInventory;
  charms: CharmInventory;
  activeCharms: string[];
  audioSettings: WonderAcademyAudioSettings;
  onCraft: (charmId: CharmId) => void;
  onToggle: (charmId: CharmId) => void;
  onSetVolume: (channel: "musicVolume" | "sfxVolume", value: number) => void;
  onClose: () => void;
}) {
  const charmEntries = Object.entries(CHARM_DEFS) as [CharmId, (typeof CHARM_DEFS)[CharmId]][];
  const materialEntries = Object.entries(MATERIAL_DEFS) as [MaterialId, (typeof MATERIAL_DEFS)[MaterialId]][];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🔨 護符工房</h1>
        <button onClick={onClose} style={btnGhost}><X size={16} /> 關閉</button>
      </div>
      <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 16px" }}>用探索材料製作護符,最多同時啟用 2 個。護符會影響遇敵、寶箱、閃光與 XP 節奏。</p>

      <div style={{ ...cardStatic, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 8 }}>材料袋 · ✨ {stardust}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {materialEntries.map(([id, material]) => (
            <span key={id} style={{ fontSize: 12, fontWeight: 800, background: "#fff", border: "1px solid rgba(60,40,90,.12)", borderRadius: 999, padding: "5px 10px" }}>
              {material.emoji} {material.name} ×{materials[id] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...cardStatic, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 10 }}>音量</div>
        <label style={{ display: "grid", gridTemplateColumns: "82px 1fr 42px", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
          <span>音樂</span>
          <input aria-label="音樂音量" type="range" min={0} max={1} step={0.05} value={audioSettings.musicVolume} onChange={(e) => onSetVolume("musicVolume", Number(e.target.value))} />
          <span style={{ color: "#8a83a3" }}>{Math.round(audioSettings.musicVolume * 100)}%</span>
        </label>
        <label style={{ display: "grid", gridTemplateColumns: "82px 1fr 42px", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 800 }}>
          <span>音效</span>
          <input aria-label="音效音量" type="range" min={0} max={1} step={0.05} value={audioSettings.sfxVolume} onChange={(e) => onSetVolume("sfxVolume", Number(e.target.value))} />
          <span style={{ color: "#8a83a3" }}>{Math.round(audioSettings.sfxVolume * 100)}%</span>
        </label>
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#8a83a3", textTransform: "uppercase", marginBottom: 10 }}>護符 · 啟用 {activeCharms.length}/2</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 12 }}>
        {charmEntries.map(([id, charm]) => {
          const owned = charms[id] ?? 0;
          const active = activeCharms.includes(id);
          const craftable = canCraftCharm(stardust, materials, id);
          const cannotToggle = owned <= 0 || (!active && activeCharms.length >= 2);
          return (
            <div key={id} style={cardStatic}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 900 }}>{charm.emoji} {charm.name}</div>
                <span style={{ fontSize: 11, fontWeight: 800, color: active ? "#42b86a" : "#8a83a3" }}>{active ? "啟用中" : `持有 ${owned}`}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "#6a6585", lineHeight: 1.45, minHeight: 36, margin: "0 0 8px" }}>{charm.desc}</p>
              <div style={{ fontSize: 11, color: "#8a83a3", fontWeight: 700, marginBottom: 10 }}>
                ✨{charm.stardustCost} · {materialCostText(charm.materialCost)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={!craftable}
                  onClick={() => onCraft(id)}
                  style={{ ...feedBtn, flex: 1, color: craftable ? "#5b3d00" : "#b9b3c7", background: craftable ? "linear-gradient(180deg,#ffd66b,#f7b13a)" : "#f0eef6", border: craftable ? "none" : "1px solid rgba(60,40,90,.12)", cursor: craftable ? "pointer" : "default" }}
                >
                  製作
                </button>
                <button
                  disabled={cannotToggle}
                  onClick={() => onToggle(id)}
                  style={{ ...feedBtn, flex: 1, color: active ? "#42b86a" : cannotToggle ? "#b9b3c7" : "#6a52ff", background: active ? "#eefbe9" : cannotToggle ? "#f0eef6" : "#efeaff", border: "1px solid rgba(60,40,90,.12)", cursor: cannotToggle ? "default" : "pointer" }}
                >
                  {active ? "停用" : "啟用"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrialsScreen({
  unlocked,
  trialWins,
  onStart,
  onClose,
}: {
  unlocked: boolean;
  trialWins: Record<string, number>;
  onStart: (trialId: string) => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🏆 Wonder Keeper 試煉</h1>
        <button onClick={onClose} style={btnGhost}><X size={16} /> 關閉</button>
      </div>
      <p style={{ color: "#8a83a3", fontSize: 14, margin: "0 0 16px" }}>
        {unlocked
          ? "所有區域都恢復平靜了。挑戰高等級守護者,收集 Bell Shards 與稀有材料。"
          : "打敗所有地區的守關者後,這裡會開放長期挑戰。"}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
        {POSTGAME_TRIALS.map((trial) => {
          const wins = trialWins[trial.id] ?? 0;
          return (
            <div key={trial.id} style={{ ...cardStatic, opacity: unlocked ? 1 : 0.58 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 900 }}>{trial.name}</div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#8a83a3" }}>Lv.{trial.level}</span>
              </div>
              <div style={{ fontSize: 12, color: "#6a6585", marginBottom: 8 }}>對手: {speciesById(trial.speciesId)?.name ?? trial.speciesId}</div>
              <div style={{ fontSize: 11, color: "#8a83a3", fontWeight: 700, marginBottom: 10 }}>
                勝利 {wins} 次 · ✨{trial.stardust}{wins === 0 ? ` + 首勝 ${trial.firstWinBonus}` : ""} · {materialCostText(trial.materials)}
              </div>
              <button
                disabled={!unlocked}
                onClick={() => onStart(trial.id)}
                style={{ ...feedBtn, color: unlocked ? "#5b3d00" : "#b9b3c7", background: unlocked ? "linear-gradient(180deg,#ffd66b,#f7b13a)" : "#f0eef6", border: unlocked ? "none" : "1px solid rgba(60,40,90,.12)", cursor: unlocked ? "pointer" : "default" }}
              >
                {unlocked ? "開始試煉" : "尚未開放"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
