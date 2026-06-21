import type {
  DialogueLine,
  TravelDialogue,
  TravelPhrase,
  TravelTopic,
  TravelVocab,
} from "../../types/travelEnglish";
import type { TravelProgress } from "../../services/travelProgressService";

export type TravelMissionStepKind = "word" | "phrase" | "dialogue";

const SITUATION_LABELS: Record<string, string> = {
  general: "一般",
  directions: "問路",
  inquiry: "詢問",
  observation: "觀察動物",
  facilities: "設施位置",
  photos: "拍照",
  shows: "看表演",
  schedule: "活動時間",
  hours: "開放時間",
  tickets: "買票",
  "check-in": "報到 / 入住",
  luggage: "行李託運",
  navigation: "找路 / 方向",
  security: "安檢",
  boarding: "登機",
  immigration: "入境查驗",
  customs: "海關申報",
  baggage: "領行李",
  money: "換錢",
  transport: "前往市區",
  "finding seat": "找座位",
  meal: "機上餐點",
  comfort: "機上需求",
  bathroom: "上廁所",
  time: "詢問時間",
  safety: "安全須知",
  "arrival card": "填入境卡",
  amenities: "設施服務",
  "room service": "客房服務",
  problems: "反映問題",
  checkout: "退房 / 結帳",
  ordering: "點餐",
  paying: "付款",
  drinks: "點飲料",
  "after eating": "用餐後",
  MRT: "搭地鐵",
  bus: "搭公車",
  taxi: "搭計程車",
  price: "詢問價格",
  size: "詢問尺寸",
  fitting: "試穿",
  browsing: "逛逛挑選",
  buying: "購買",
  payment: "付款",
  bargaining: "殺價",
  shopping: "購物",
  queue: "排隊",
  "theme park": "遊樂設施",
  lost: "迷路",
  health: "身體不適",
  "lost items": "遺失物品",
  emergency: "緊急狀況",
  feeding: "餵食動物",
  tram: "搭遊園車",
  trails: "走步道",
  environment: "環境",
  feelings: "心情感受",
  boat: "搭船",
  concern: "擔心疑慮",
  excitement: "興奮時刻",
  activities: "體驗活動",
};

function missionSituationLabel(situation?: string): string {
  if (!situation) return SITUATION_LABELS.general;
  return SITUATION_LABELS[situation] ?? SITUATION_LABELS.general;
}

export interface TravelMissionOption {
  id: string;
  label: string;
  supportingText?: string;
}

export interface TravelWordMissionStep {
  kind: "word";
  id: string;
  title: string;
  prompt: string;
  speakText: string;
  correctOptionId: string;
  options: TravelMissionOption[];
}

export interface TravelPhraseMissionStep {
  kind: "phrase";
  id: string;
  title: string;
  prompt: string;
  phrase: string;
  correctOptionId: string;
  options: TravelMissionOption[];
}

export interface TravelDialogueMissionLine {
  id: string;
  order: number;
  role: string;
  english: string;
  chinese: string;
}

export interface TravelDialogueMissionStep {
  kind: "dialogue";
  id: string;
  title: string;
  prompt: string;
  lines: TravelDialogueMissionLine[];
  correctOrder: string[];
}

export type TravelMissionStep =
  | TravelWordMissionStep
  | TravelPhraseMissionStep
  | TravelDialogueMissionStep;

export interface TravelMission {
  topicId: string;
  title: string;
  steps: [TravelWordMissionStep, TravelPhraseMissionStep, TravelDialogueMissionStep];
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function allVocabulary(topics: TravelTopic[]): TravelVocab[] {
  return topics.flatMap((topic) =>
    topic.groups.flatMap((group) => group.vocabulary),
  );
}

function topicVocabulary(topic: TravelTopic): TravelVocab[] {
  return topic.groups.flatMap((group) => group.vocabulary);
}

function topicPhrases(topic: TravelTopic): TravelPhrase[] {
  return topic.groups.flatMap((group) => group.phrases);
}

function allPhraseSituationOptions(topics: TravelTopic[]): TravelMissionOption[] {
  return uniqueBy(
    topics
      .flatMap((topic) => topic.groups.flatMap((group) => group.phrases))
      .map((phrase) => ({
        id: phrase.situation ?? phrase.id,
        label: missionSituationLabel(phrase.situation),
      })),
    (option) => option.label,
  );
}

function makeOptions(
  correct: TravelMissionOption,
  candidates: TravelMissionOption[],
): TravelMissionOption[] {
  const wrongOptions = uniqueBy(
    candidates.filter((option) => option.label !== correct.label),
    (option) => option.label,
  ).slice(0, 2);

  return uniqueBy([correct, ...wrongOptions], (option) => option.label).slice(0, 3);
}

function buildWordStep(topic: TravelTopic, topics: TravelTopic[]): TravelWordMissionStep {
  const word = topicVocabulary(topic)[0];
  if (!word) {
    throw new Error(`Travel topic "${topic.id}" has no vocabulary for a word mission`);
  }

  const correct = {
    id: word.word,
    label: word.chinese,
    supportingText: word.word,
  };
  const options = makeOptions(
    correct,
    allVocabulary(topics).map((vocab) => ({
      id: vocab.word,
      label: vocab.chinese,
      supportingText: vocab.word,
    })),
  );

  return {
    kind: "word",
    id: `${topic.id}-word`,
    title: "聽音選單字",
    prompt: "聽英文單字，選出正確的中文意思。",
    speakText: word.word,
    correctOptionId: correct.id,
    options,
  };
}

function buildPhraseStep(
  topic: TravelTopic,
  topics: TravelTopic[],
): TravelPhraseMissionStep {
  const phrase = topicPhrases(topic)[0];
  if (!phrase) {
    throw new Error(`Travel topic "${topic.id}" has no phrases for a phrase mission`);
  }

  const correct = {
    id: phrase.situation ?? phrase.id,
    label: missionSituationLabel(phrase.situation),
  };

  return {
    kind: "phrase",
    id: `${topic.id}-phrase`,
    title: "句子情境配對",
    prompt: "這句英文最適合在哪個旅遊情境使用？",
    phrase: phrase.english,
    correctOptionId: correct.id,
    options: makeOptions(correct, allPhraseSituationOptions(topics)),
  };
}

function chooseDialogue(topic: TravelTopic): TravelDialogue | null {
  return (
    topic.groups
      .flatMap((group) => group.dialogues ?? [])
      .find((dialogue) => dialogue.lines.length >= 3) ?? null
  );
}

function fallbackDialogueLines(topic: TravelTopic): DialogueLine[] {
  return topicPhrases(topic)
    .slice(0, 3)
    .map((phrase, index) => ({
      speaker: index % 2 === 0 ? "A" : "B",
      role: index % 2 === 0 ? "Traveler" : "Local",
      english: phrase.english,
      chinese: phrase.chinese,
    }));
}

function rotateLines(lines: TravelDialogueMissionLine[]): TravelDialogueMissionLine[] {
  if (lines.length < 2) return lines;
  return [...lines.slice(1), lines[0]];
}

function buildDialogueStep(topic: TravelTopic): TravelDialogueMissionStep {
  const dialogue = chooseDialogue(topic);
  const sourceLines = (dialogue?.lines ?? fallbackDialogueLines(topic)).slice(0, 4);
  if (sourceLines.length < 3) {
    throw new Error(`Travel topic "${topic.id}" needs at least three lines for a dialogue mission`);
  }

  const orderedLines = sourceLines.map((line, index) => ({
    id: `${topic.id}-dialogue-${index}`,
    order: index,
    role: line.role,
    english: line.english,
    chinese: line.chinese,
  }));

  return {
    kind: "dialogue",
    id: `${topic.id}-dialogue`,
    title: "對話排序",
    prompt: "把對話排成自然的旅遊英文順序。",
    lines: rotateLines(orderedLines),
    correctOrder: orderedLines.map((line) => line.id),
  };
}

export function buildTravelMission(
  topic: TravelTopic,
  allTopics: TravelTopic[],
): TravelMission {
  return {
    topicId: topic.id,
    title: `${topic.titleChinese} 任務`,
    steps: [
      buildWordStep(topic, allTopics),
      buildPhraseStep(topic, allTopics),
      buildDialogueStep(topic),
    ],
  };
}

export function getNextSuggestedTopicId(
  topics: TravelTopic[],
  progress: TravelProgress | null,
): string | null {
  const orderedTopics = [...topics].sort((a, b) => a.stage - b.stage);
  return (
    orderedTopics.find((topic) => !progress?.stamps[topic.id])?.id ?? null
  );
}

export type TravelMissionStatus = "not-started" | "in-progress" | "completed";

export function getTravelMissionStatus(
  topicId: string,
  progress: TravelProgress | null,
): TravelMissionStatus {
  if (progress?.stamps[topicId]) return "completed";
  if (progress?.inProgress[topicId]) return "in-progress";
  return "not-started";
}

export function getTravelProgressSummary(
  topics: TravelTopic[],
  progress: TravelProgress | null,
) {
  return {
    completed: topics.filter((topic) => Boolean(progress?.stamps[topic.id])).length,
    total: topics.length,
    nextTopicId: getNextSuggestedTopicId(topics, progress),
  };
}
