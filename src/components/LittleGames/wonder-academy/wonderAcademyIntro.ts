export const wonderAcademyIntroCopy = {
  academyName: "Sparkleaf 星葉學院",
  headmistressName: "雲耳院長 薇拉",
  titleSubtitle: "走進發光森林,遇見第一位會陪你長大的 Wonderling。",
  arrivalKicker: "序章 · 星光校門",
  arrivalTitle: "你的入學星簿正在發光",
  arrivalBody:
    "歡迎來到 Sparkleaf 星葉學院!這裡的森林會記得每個勇敢的新朋友,也會把你帶到命定夥伴身邊。",
  emptyNameLine: "寫下你的名字,讓入學星簿亮起來。",
  continueLabel: "這就是我 →",
} as const;

export const wonderAcademyIntroVisualAlt = {
  arrivalBackground: "Sparkleaf 星葉學院入口的魔法森林背景",
  headmistress: "雲耳院長薇拉的微笑肖像",
} as const;

export function getWonderAcademyArrivalState(playerName: string) {
  const trimmedName = playerName.trim();
  return {
    canContinue: trimmedName.length > 0,
    trimmedName,
    personalLine: trimmedName
      ? `${trimmedName},星葉學院的第一扇星光門已經為你打開。`
      : wonderAcademyIntroCopy.emptyNameLine,
    buttonLabel: wonderAcademyIntroCopy.continueLabel,
  };
}
