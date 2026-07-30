import { Candy, Crosshair, Swords } from "lucide-react";
import {
  ARCHETYPE_BASE,
  ARCHETYPE_BY_ELEMENT,
  ARCHETYPE_DESC_ZH,
  ARCHETYPE_LABEL_ZH,
  ELEMENT_COLOR,
  ELEMENT_LABEL_ZH,
} from "../data/elements";
import { DEFAULT_ROSTER_IDS } from "../data/characters";
import { TRAIT_BASE, TRAIT_DESC_ZH, TRAIT_LABEL_ZH } from "../data/traits";
import { getTowerStats, getTrait } from "../engine/combat";
import { RARITY_TIERS } from "../constants";
import { getPlaceCost } from "../engine/economy";
import type { Rarity, TowerCharacter } from "../types";

const RARITY_LABEL_ZH: Record<Rarity, string> = {
  common: "普通",
  uncommon: "少見",
  rare: "稀有",
  warden: "守護者",
  mythling: "傳說",
};

const RARITY_STYLE: Record<Rarity, string> = {
  common: "bg-slate-100 text-slate-600",
  uncommon: "bg-emerald-100 text-emerald-700",
  rare: "bg-sky-100 text-sky-700",
  warden: "bg-violet-100 text-violet-700",
  mythling: "bg-amber-100 text-amber-700",
};

/**
 * 射程五格的比例尺兩端。從 ARCHETYPE_BASE 推出來而不是寫死，平衡時改了
 * 基礎射程，這裡會跟著對。
 */
const RANGE_MIN = Math.min(
  ...Object.values(ARCHETYPE_BASE).map((base) => base.range),
);
const RANGE_MAX =
  Math.max(...Object.values(ARCHETYPE_BASE).map((base) => base.range)) *
  (1 + TRAIT_BASE.focus.rangeBonus);

/**
 * 射程：五個準星，亮幾個就站得多遠。
 *
 * 跟 PowerMeter 同一套視覺語言。「射程 195」這個數字沒有東西可以比——
 * 195 算遠還算近？五格跟隔壁那張卡一數就能比，數字留給想算的人。
 */
export function RangePips({ range }: { range: number }) {
  const PIPS = 5;
  const ratio = Math.min(
    1,
    Math.max(0, (range - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)),
  );
  // 站得最近的也至少亮一格，不然看起來像「打不到任何東西」。
  const filled = Math.max(1, Math.round(ratio * PIPS));

  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`射程 ${filled} / ${PIPS}`}
    >
      {Array.from({ length: PIPS }, (_, index) => (
        <Crosshair
          key={index}
          size={13}
          strokeWidth={2.25}
          aria-hidden="true"
          className={index < filled ? "text-sky-500" : "text-slate-300/70"}
        />
      ))}
    </span>
  );
}

const DEFAULT_ROSTER = new Set(DEFAULT_ROSTER_IDS);

/**
 * 攻擊力的兩端。跟射程條一樣從 ARCHETYPE_BASE 推出來，平衡時改了基礎傷害，
 * 這裡的刻度會跟著對。重砲最高、應援不攻擊所以不算進來。
 */
const DAMAGES = Object.values(ARCHETYPE_BASE)
  .map((base) => base.damage)
  .filter((damage) => damage > 0);
const DAMAGE_MIN = Math.min(...DAMAGES);
const DAMAGE_MAX = Math.max(...DAMAGES) * RARITY_TIERS.mythling.power;

/**
 * 攻擊力：五把劍，填滿幾把就是多強。
 *
 * 「攻擊 33.6」這個數字對小朋友沒有意義——沒有東西可以拿來比。五格的圖示
 * 一眼就看得出「這隻比剛剛那隻兇」，數字留在旁邊給想算的人。
 */
export function PowerMeter({ damage }: { damage: number }) {
  const PIPS = 5;
  const ratio = Math.min(
    1,
    Math.max(0, (damage - DAMAGE_MIN) / (DAMAGE_MAX - DAMAGE_MIN)),
  );
  // 有攻擊力就至少亮一把，不然低傷害的糖漿塔看起來像不會打人。
  const filled = damage <= 0 ? 0 : Math.max(1, Math.round(ratio * PIPS));

  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`攻擊力 ${filled} / ${PIPS}`}
    >
      {Array.from({ length: PIPS }, (_, index) => (
        <Swords
          key={index}
          size={13}
          strokeWidth={2.25}
          aria-hidden="true"
          className={index < filled ? "text-[#ff6f9f]" : "text-slate-300/70"}
        />
      ))}
    </span>
  );
}

type Props = {
  character: TowerCharacter;
  /** 還沒收集到的角色顯示成剪影 + 引導去扭蛋 */
  unlocked?: boolean;
};

/**
 * 一隻角色的完整說明：打法、特性、以及這兩者實際的數字。
 *
 * 刻意不帶卡片外框——圖鑑放在面板底部、選隊畫面放在彈出視窗裡，外框交給
 * 呼叫的人決定，才不會變成卡片裡又一張卡片。
 */
export function CharacterDetail({ character, unlocked = true }: Props) {
  const isDefault = DEFAULT_ROSTER.has(character.id);
  const element = character.elements[0];
  const archetype = ARCHETYPE_BY_ELEMENT[element];
  const trait = getTrait(character);
  const stats = getTowerStats(character, 1);

  return (
    <section>
      <div className="flex items-start gap-4">
        <img
          src={character.sprite}
          alt={unlocked ? character.name : "還沒收集到的角色"}
          className={`h-20 w-20 shrink-0 object-contain ${
            unlocked ? "" : "opacity-35 brightness-0"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
              {unlocked ? character.nameZh : "？？？"}
            </h3>
            {unlocked && (
              <span className="text-xs font-medium text-slate-400">
                {character.name}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RARITY_STYLE[character.rarity]}`}
            >
              {RARITY_LABEL_ZH[character.rarity]}
            </span>
            {unlocked && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {isDefault ? "預設班底" : "扭蛋抽到的"}
              </span>
            )}
          </div>

          {unlocked ? (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-800"
                  style={{ backgroundColor: ELEMENT_COLOR[element] }}
                >
                  {ELEMENT_LABEL_ZH[element]} · {ARCHETYPE_LABEL_ZH[archetype]}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-black/5"
                  style={{
                    backgroundColor: `${ELEMENT_COLOR[character.elements[1] ?? element]}55`,
                  }}
                >
                  {TRAIT_LABEL_ZH[trait]}
                </span>
              </div>

              {/* 招式和特性分兩行寫清楚：一行是「平常怎麼打」，一行是「多了什麼」。 */}
              <p className="mt-2 text-sm leading-snug text-slate-600">
                <span className="font-semibold text-slate-700">招式</span>
                {" · "}
                {ARCHETYPE_DESC_ZH[archetype]}
              </p>
              <p className="mt-1 text-sm leading-snug text-slate-600">
                <span className="font-semibold text-slate-700">特性</span>
                {" · "}
                {TRAIT_DESC_ZH[trait]}
              </p>

              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <Metric label="造價">
                  <span className="flex items-center gap-0.5">
                    <Candy size={12} strokeWidth={2} aria-hidden="true" />
                    {getPlaceCost(character)}
                  </span>
                </Metric>
                <Metric label="射程">
                  <span className="flex items-center gap-1.5">
                    <RangePips range={stats.range} />
                    {Math.round(stats.range)}
                  </span>
                </Metric>
                {stats.damage > 0 && (
                  <Metric label="攻擊">
                    <span className="flex items-center gap-1.5">
                      <PowerMeter damage={stats.damage} />
                      {stats.damage.toFixed(1)}
                    </span>
                  </Metric>
                )}
                {stats.cooldownMs > 0 && (
                  <Metric label="間隔">
                    {(stats.cooldownMs / 1000).toFixed(2)}s
                  </Metric>
                )}
                {stats.splashRadius > 0 && (
                  <Metric label="濺射">{Math.round(stats.splashRadius)}</Metric>
                )}
                {stats.slowFactor > 0 && (
                  <Metric label="減速">{percent(stats.slowFactor)}</Metric>
                )}
                {stats.stunChance > 0 && (
                  <Metric label="定身機率">{percent(stats.stunChance)}</Metric>
                )}
                {stats.armorPierce > 0 && (
                  <Metric label="破甲">{percent(stats.armorPierce)}</Metric>
                )}
                {stats.cheerBonus > 0 && (
                  <Metric label="夥伴加速">{percent(stats.cheerBonus)}</Metric>
                )}
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              去「人氣角色扭蛋機」抽抽看，抽到就能放上塔位。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Metric({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="opacity-70">{label}</dt>
      <dd className="font-semibold text-slate-600">{children}</dd>
    </div>
  );
}
