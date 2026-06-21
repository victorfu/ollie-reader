import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTravelMission,
  getNextSuggestedTopicId,
  getTravelMissionStatus,
  getTravelProgressSummary,
} from "../src/components/TravelEnglish/travelMissionUtils.ts";
import {
  completeTravelMission,
  createDefaultTravelProgress,
  markTravelMissionInProgress,
} from "../src/services/travelProgressService.ts";
import type { TravelTopic } from "../src/types/travelEnglish.ts";

const travelTopics: TravelTopic[] = [
  {
    id: "airport",
    section: "core",
    stage: 1,
    stageLabel: "出發與入境",
    title: "Airport & Immigration",
    titleChinese: "機場與入境",
    summary: "從報到到入境的旅遊英文。",
    learningGoals: ["辦理登機", "回答入境問題"],
    mission: "完成機場任務。",
    reviewPrompt: "練習問登機門。",
    colorClass: "bg-sky-50",
    groups: [
      {
        sceneId: "check-in",
        vocabulary: [
          { word: "boarding pass", chinese: "登機證", emoji: "" },
          { word: "luggage", chinese: "行李", emoji: "" },
          { word: "passport", chinese: "護照", emoji: "" },
        ],
        phrases: [
          {
            id: "airport-check-in",
            english: "I'd like to check in, please.",
            chinese: "我想辦理登機。",
            situation: "check-in",
          },
          {
            id: "airport-gate",
            english: "Where is Gate B5?",
            chinese: "B5 登機門在哪裡？",
            situation: "navigation",
          },
        ],
        dialogues: [
          {
            id: "airport-dialogue",
            title: "Check-in",
            titleChinese: "報到",
            description: "在櫃台報到。",
            lines: [
              {
                speaker: "A",
                role: "Traveler",
                english: "Hi, I'd like to check in.",
                chinese: "你好，我想辦理登機。",
              },
              {
                speaker: "B",
                role: "Staff",
                english: "May I see your passport?",
                chinese: "我可以看你的護照嗎？",
              },
              {
                speaker: "A",
                role: "Traveler",
                english: "Here you go.",
                chinese: "給你。",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "plane",
    section: "more",
    stage: 2,
    stageLabel: "飛行途中",
    title: "On the Plane",
    titleChinese: "飛機上",
    summary: "機上英文。",
    learningGoals: ["找座位"],
    mission: "完成機上任務。",
    reviewPrompt: "練習 May I have...",
    colorClass: "bg-blue-50",
    groups: [
      {
        sceneId: "plane",
        vocabulary: [
          { word: "blanket", chinese: "毯子", emoji: "" },
          { word: "seat belt", chinese: "安全帶", emoji: "" },
        ],
        phrases: [
          {
            id: "plane-blanket",
            english: "May I have a blanket?",
            chinese: "可以給我一條毯子嗎？",
            situation: "comfort",
          },
        ],
        dialogues: [],
      },
    ],
  },
];

const airportTopic = travelTopics[0];

test("builds a three-step mission from an existing travel topic", () => {
  const mission = buildTravelMission(airportTopic, travelTopics);

  assert.equal(mission.topicId, "airport");
  assert.deepEqual(
    mission.steps.map((step) => step.kind),
    ["word", "phrase", "dialogue"],
  );

  const wordStep = mission.steps[0];
  assert.equal(wordStep.kind, "word");
  assert.equal(wordStep.options.length, 3);
  assert.equal(new Set(wordStep.options.map((option) => option.id)).size, 3);
  assert.ok(
    wordStep.options.some((option) => option.id === wordStep.correctOptionId),
    "word step includes its correct option",
  );

  const phraseStep = mission.steps[1];
  assert.equal(phraseStep.kind, "phrase");
  assert.equal(phraseStep.options.length, 3);
  assert.ok(
    phraseStep.options.some((option) => option.id === phraseStep.correctOptionId),
    "phrase step includes its correct option",
  );

  const dialogueStep = mission.steps[2];
  assert.equal(dialogueStep.kind, "dialogue");
  assert.ok(dialogueStep.lines.length >= 3);
  assert.deepEqual(
    dialogueStep.correctOrder,
    dialogueStep.lines.toSorted((a, b) => a.order - b.order).map((line) => line.id),
  );
});

test("records in-progress and completed passport stamps without double-counting", () => {
  const initial = createDefaultTravelProgress("user-1", 1000);
  const started = markTravelMissionInProgress(initial, "airport", "phrase", 1500);

  assert.equal(started.inProgress.airport?.step, "phrase");
  assert.equal(started.totalCompleted, 0);

  const completed = completeTravelMission(started, "airport", 2000);
  assert.equal(completed.totalCompleted, 1);
  assert.equal(completed.stamps.airport?.stars, 3);
  assert.equal(completed.stamps.airport?.attempts, 1);
  assert.equal(completed.inProgress.airport, undefined);

  const completedAgain = completeTravelMission(completed, "airport", 3000);
  assert.equal(completedAgain.totalCompleted, 1);
  assert.equal(completedAgain.stamps.airport?.attempts, 2);
  assert.equal(completedAgain.stamps.airport?.completedAt, 3000);
});

test("suggests the first unfinished topic by travel stage", () => {
  const progress = completeTravelMission(
    createDefaultTravelProgress("user-1", 1000),
    "airport",
    2000,
  );

  assert.equal(getNextSuggestedTopicId(travelTopics, progress), "plane");

  const fullyStamped = travelTopics.reduce(
    (nextProgress, topic, index) =>
      completeTravelMission(nextProgress, topic.id, 3000 + index),
    progress,
  );

  assert.equal(getNextSuggestedTopicId(travelTopics, fullyStamped), null);
});

test("summarizes mission status for the travel route", () => {
  const started = markTravelMissionInProgress(
    createDefaultTravelProgress("user-1", 1000),
    "airport",
    "word",
    1500,
  );
  const completed = completeTravelMission(started, "plane", 2000);

  assert.equal(getTravelMissionStatus("airport", completed), "in-progress");
  assert.equal(getTravelMissionStatus("plane", completed), "completed");
  assert.equal(getTravelMissionStatus("unknown", completed), "not-started");
  assert.deepEqual(getTravelProgressSummary(travelTopics, completed), {
    completed: 1,
    total: 2,
    nextTopicId: "airport",
  });
});
