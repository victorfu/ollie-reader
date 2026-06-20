import { useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useSpeechState } from "../../hooks/useSpeechState";
import { travelTopics } from "../../data/travelTopics";
import { TopicGrid } from "./TopicGrid";
import { TopicDetail } from "./TopicDetail";
import { logger } from "../../utils/logger";

const pageVariants = {
  enter: { x: 30, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -30, opacity: 0 },
};

const transition = { duration: 0.25, ease: "easeOut" } as const;

export const TravelEnglishPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { speak } = useSpeechState();

  const topicId = searchParams.get("topic");
  const selectedTopic = useMemo(
    () => travelTopics.find((t) => t.id === topicId) ?? null,
    [topicId],
  );

  // 清掉無效的 ?topic= 參數
  useEffect(() => {
    if (topicId && !selectedTopic) {
      logger.warn(`Invalid travel topic ID: "${topicId}"`);
      setSearchParams({}, { replace: true });
    }
  }, [topicId, selectedTopic, setSearchParams]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <AnimatePresence mode="wait">
        {!selectedTopic ? (
          <motion.div
            key="topic-grid"
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            <TopicGrid onSelectTopic={(id) => setSearchParams({ topic: id })} />
          </motion.div>
        ) : (
          <motion.div
            key={`topic-${selectedTopic.id}`}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            <TopicDetail
              topic={selectedTopic}
              speak={speak}
              onBack={() => setSearchParams({})}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
