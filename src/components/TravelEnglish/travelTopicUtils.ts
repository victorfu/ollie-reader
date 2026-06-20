import type { TravelTopic } from "../../types/travelEnglish";

export function getTopicStats(topic: TravelTopic) {
  return topic.groups.reduce(
    (stats, group) => ({
      words: stats.words + group.vocabulary.length,
      phrases: stats.phrases + group.phrases.length,
      dialogues: stats.dialogues + (group.dialogues?.length ?? 0),
      facts: stats.facts + (group.funFacts?.length ?? 0),
    }),
    { words: 0, phrases: 0, dialogues: 0, facts: 0 },
  );
}
