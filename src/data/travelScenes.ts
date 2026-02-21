import type { TravelScene, SceneSection } from "../types/travelEnglish";
import { beforeDepartureScene } from "./scenes/journey-before-departure";
import { taoyuanAirportScene } from "./scenes/journey-taoyuan-airport";
import { onThePlaneScene } from "./scenes/journey-on-the-plane";
import { changiArrivalScene } from "./scenes/journey-changi-arrival";
import { singaporeGeneralScenes } from "./scenes/singapore-general";
import { goingHomeScene } from "./scenes/journey-going-home";
import { singaporeMandaiScenes } from "./scenes/singapore-mandai";
import { singaporeMandaiHubScene } from "./scenes/singapore-mandai-hub";
import { singaporeMandaiDiningScene } from "./scenes/singapore-mandai-dining";
import { singaporeMandaiResortScene } from "./scenes/singapore-mandai-resort";

export const sceneSections: SceneSection[] = [
  {
    id: "journey",
    title: "The Journey",
    titleChinese: "旅程",
    emoji: "✈️",
    scenes: [
      beforeDepartureScene,
      taoyuanAirportScene,
      onThePlaneScene,
      changiArrivalScene,
      ...singaporeGeneralScenes,
      goingHomeScene,
    ],
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
