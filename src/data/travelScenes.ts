import type { TravelScene, SceneSection } from "../types/travelEnglish";
import { singaporeGeneralScenes } from "./scenes/singapore-general";
import { singaporeMandaiScenes } from "./scenes/singapore-mandai";
import { singaporeMandaiHubScene } from "./scenes/singapore-mandai-hub";
import { singaporeMandaiDiningScene } from "./scenes/singapore-mandai-dining";
import { singaporeMandaiResortScene } from "./scenes/singapore-mandai-resort";

export const sceneSections: SceneSection[] = [
  {
    id: "singapore-general",
    title: "Singapore General",
    titleChinese: "新加坡通用場景",
    emoji: "🌏",
    scenes: singaporeGeneralScenes,
  },
  {
    id: "mandai-wildlife",
    title: "Mandai Wildlife Reserve",
    titleChinese: "萬態野生動物保育區",
    emoji: "🦁",
    scenes: [
      singaporeMandaiHubScene,
      ...singaporeMandaiScenes,
      singaporeMandaiDiningScene,
      singaporeMandaiResortScene,
    ],
  },
];

export const travelScenes: TravelScene[] = sceneSections.flatMap(
  (s) => s.scenes,
);
