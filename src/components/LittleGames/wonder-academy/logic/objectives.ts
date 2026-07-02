export type WonderAcademyObjectiveState = {
  teamCount: number;
  clearedNodes: readonly string[];
  wardensDefeated: readonly string[];
  regionIds: readonly string[];
  dexCaught: number;
  dexTotal: number;
  charmCount: number;
  trialWins: Record<string, number>;
};

export type WonderAcademyObjectiveCard = {
  id: string;
  label: string;
  description: string;
  actionLabel: string;
};

function regionLabel(regionId: string): string {
  const labels: Record<string, string> = {
    sparkleaf: "星葉森林",
    tideglass: "玻璃海岸",
    clocktower: "鐘塔宿舍",
    sugarcloud: "糖雲市集",
  };
  return labels[regionId] ?? regionId;
}

export function nextWonderAcademyObjective(
  state: WonderAcademyObjectiveState,
): WonderAcademyObjectiveCard {
  if (state.teamCount <= 0) {
    return {
      id: "choose-starter",
      label: "選擇第一個夥伴",
      description: "完成入學儀式,讓第一隻 Wonderling 加入隊伍。",
      actionLabel: "開始冒險",
    };
  }

  if (state.clearedNodes.length === 0) {
    return {
      id: "explore-first-node",
      label: "完成第一個探索地點",
      description: "從星葉森林入口出發,走草叢、開寶箱、帶材料回學院。",
      actionLabel: "出發探索",
    };
  }

  const nextRegion = state.regionIds.find((regionId) => !state.wardensDefeated.includes(regionId));
  if (nextRegion) {
    const previousIndex = state.regionIds.indexOf(nextRegion) - 1;
    const previousRegionCleared = previousIndex < 0
      || state.wardensDefeated.includes(state.regionIds[previousIndex]);
    if (previousRegionCleared && nextRegion !== state.regionIds[0]) {
      return {
        id: `explore-region-${nextRegion}`,
        label: `前往${regionLabel(nextRegion)}`,
        description: "新的地區已解鎖。先完成幾個探索地點,再挑戰守關之地。",
        actionLabel: "前往下一區",
      };
    }
    return {
      id: `defeat-warden-${nextRegion}`,
      label: `挑戰${regionLabel(nextRegion)}守關者`,
      description: "完成主路探索後,打敗守關者就能打開下一段旅程。",
      actionLabel: "挑戰守關之地",
    };
  }

  if (state.charmCount <= 0) {
    return {
      id: "craft-first-charm",
      label: "製作第一個護符",
      description: "用探索帶回來的材料做護符,調整遇敵、寶箱、XP 或閃光節奏。",
      actionLabel: "打開工房",
    };
  }

  if (state.dexCaught < state.dexTotal) {
    return {
      id: "fill-wonderdex",
      label: "補完 Wonderdex",
      description: "還有沒收服的夥伴。換隊伍與護符,回到各區尋找稀有 Wonderlings。",
      actionLabel: "查看圖鑑",
    };
  }

  return {
    id: "postgame-trial",
    label: "挑戰 Wonder Keeper 試煉",
    description: "所有地區都恢復平靜了。進入試煉,挑戰更高等級的守護者。",
    actionLabel: "進入試煉",
  };
}
