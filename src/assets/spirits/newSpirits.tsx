import type { ComponentType } from "react";
import type { Spirit } from "../../types/game";
import { BaseSpirit } from "./BaseSpirit";

interface SpiritDesign extends Spirit {
  bodyFrom: string;
  bodyTo: string;
  belly: string;
  cheek: string;
  motif: string;
  ears?: "bunny" | "cat" | "none";
  sparkle?: boolean;
}

type SpiritComp = ComponentType<{
  size?: number;
  className?: string;
  animate?: boolean;
}>;

// 第二章 / 進化 的新精靈設計（視覺 + 遊戲資料）
const DESIGNS: SpiritDesign[] = [
  // ---- 進化形（由第一章 base 精靈練成，evolvesFromId 指回 base）----
  {
    id: "blaze-drake",
    name: "火龍寶寶",
    element: "fire",
    rarity: "rare",
    description: "火焰史萊姆長大後變成的小火龍，噴出的是溫暖的火花。",
    evolvesFromId: "fire-slime",
    bodyFrom: "#FFC9A0",
    bodyTo: "#FF6B4A",
    belly: "#FFE6D6",
    cheek: "#FF9E7A",
    motif: "🔥",
  },
  {
    id: "forest-deer",
    name: "森林小鹿",
    element: "grass",
    rarity: "rare",
    description: "葉子兔長大後的森林小鹿，鹿角會開出小花。",
    evolvesFromId: "leaf-bunny",
    bodyFrom: "#B7E4A0",
    bodyTo: "#5AA84F",
    belly: "#E4F7D9",
    cheek: "#8FD07A",
    motif: "🌿",
  },
  {
    id: "tide-fox",
    name: "潮汐狐",
    element: "water",
    rarity: "rare",
    description: "水滴狐狸進化的潮汐狐，尾巴能捲起小浪花。",
    evolvesFromId: "water-fox",
    bodyFrom: "#A0D8F0",
    bodyTo: "#3AA0E0",
    belly: "#DDF0FB",
    cheek: "#7AC0E8",
    motif: "💧",
    ears: "cat",
  },

  // ---- 第二章「雲頂星夢國」關卡獎勵精靈 ----
  {
    id: "candy-lamb",
    name: "棉花糖羊",
    element: "normal",
    rarity: "common",
    description: "棉花糖做的小羊，抱起來軟綿綿的。",
    bodyFrom: "#FFE3EF",
    bodyTo: "#FFB6D5",
    belly: "#FFF5FA",
    cheek: "#FF8FBF",
    motif: "🍬",
    ears: "bunny",
  },
  {
    id: "star-kitten",
    name: "星光小貓",
    element: "electric",
    rarity: "uncommon",
    description: "住在糖果街的小貓，鬍鬚會閃爍星光。",
    bodyFrom: "#FFF3B0",
    bodyTo: "#FFD43B",
    belly: "#FFFBEA",
    cheek: "#FFB86B",
    motif: "⭐",
    ears: "cat",
  },
  {
    id: "pudding-pup",
    name: "布丁狗",
    element: "normal",
    rarity: "common",
    description: "布丁做的小狗，跑起來會 Q 彈搖晃。",
    bodyFrom: "#FFE8C7",
    bodyTo: "#F6C177",
    belly: "#FFF6E9",
    cheek: "#F19A6B",
    motif: "🍮",
  },
  {
    id: "marsh-guardian",
    name: "棉花糰子",
    element: "grass",
    rarity: "rare",
    description: "守護棉花糖雲海的糰子精靈，最愛保護大家。",
    bodyFrom: "#C3F5D9",
    bodyTo: "#63D9A0",
    belly: "#EAFBF2",
    cheek: "#7FE0B0",
    motif: "🍡",
  },
  {
    id: "cocoa-bear",
    name: "可可熊",
    element: "normal",
    rarity: "uncommon",
    description: "巧克力瀑布旁的小熊，身上有濃濃可可香。",
    bodyFrom: "#D8B08C",
    bodyTo: "#A9744F",
    belly: "#F0DEC9",
    cheek: "#C98A6B",
    motif: "🍫",
  },
  {
    id: "dream-pony",
    name: "旋轉木馬",
    element: "normal",
    rarity: "rare",
    description: "旋轉木馬變成的小馬，載著甜甜的夢。",
    bodyFrom: "#E6DBFF",
    bodyTo: "#B79CF0",
    belly: "#F6F1FF",
    cheek: "#C9A9F0",
    motif: "🎠",
  },
  {
    id: "caramel-owl",
    name: "焦糖貓頭鷹",
    element: "fire",
    rarity: "rare",
    description: "會變焦糖魔術的貓頭鷹，眼睛亮晶晶。",
    bodyFrom: "#FFD79A",
    bodyTo: "#E8933B",
    belly: "#FFF0D6",
    cheek: "#E8A65B",
    motif: "🍯",
  },
  {
    id: "moon-bun",
    name: "月光兔",
    element: "normal",
    rarity: "rare",
    description: "月光棉花田裡的兔子，耳朵沾著月光。",
    bodyFrom: "#D6DEFF",
    bodyTo: "#8EA1F0",
    belly: "#EEF2FF",
    cheek: "#A9B6F0",
    motif: "🌙",
    ears: "bunny",
  },
  {
    id: "comet-fawn",
    name: "彗星鹿",
    element: "electric",
    rarity: "rare",
    description: "拖著彗星尾巴的小鹿，跑得比流星還快。",
    bodyFrom: "#CDEBFF",
    bodyTo: "#74C0FC",
    belly: "#EAF6FF",
    cheek: "#8FD0FF",
    motif: "💫",
  },
  {
    id: "dream-queen",
    name: "星夢女王",
    element: "normal",
    rarity: "legendary",
    description: "雲頂星夢國的女王，微笑能點亮整片星空。",
    bodyFrom: "#FFD9F0",
    bodyTo: "#E68FD8",
    belly: "#FFF0FA",
    cheek: "#F0A9E0",
    motif: "👑",
    sparkle: true,
  },

];

// 只挑遊戲資料欄位輸出 Spirit（去掉視覺欄位）
export const NEW_SPIRITS: Spirit[] = DESIGNS.map((d) => ({
  id: d.id,
  name: d.name,
  element: d.element,
  rarity: d.rarity,
  description: d.description,
  ...(d.evolvesToId ? { evolvesToId: d.evolvesToId } : {}),
  ...(d.evolvesFromId ? { evolvesFromId: d.evolvesFromId } : {}),
  ...(d.evolveCondition ? { evolveCondition: d.evolveCondition } : {}),
}));

function makeSpiritComponent(d: SpiritDesign): SpiritComp {
  const Comp: SpiritComp = (props) => (
    <BaseSpirit
      gid={d.id}
      bodyFrom={d.bodyFrom}
      bodyTo={d.bodyTo}
      belly={d.belly}
      cheek={d.cheek}
      motif={d.motif}
      ears={d.ears}
      sparkle={d.sparkle}
      {...props}
    />
  );
  Comp.displayName = `Spirit_${d.id}`;
  return Comp;
}

export const NEW_SPIRIT_COMPONENTS: Record<string, SpiritComp> =
  Object.fromEntries(DESIGNS.map((d) => [d.id, makeSpiritComponent(d)]));
