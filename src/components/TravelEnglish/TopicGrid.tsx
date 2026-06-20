import { motion } from "framer-motion";
import { travelTopics } from "../../data/travelTopics";

interface TopicGridProps {
  onSelectTopic: (id: string) => void;
}

const sections = [
  { id: "core", title: "核心情境", subtitle: "Everyday essentials" },
  { id: "more", title: "更多情境", subtitle: "More situations" },
] as const;

/** 首頁：分情境的大卡片，點一下進入該情境的單字與句子 */
export function TopicGrid({ onSelectTopic }: TopicGridProps) {
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="toolbar sticky top-14 z-20 -mx-4 px-4 py-3 sm:rounded-b-2xl">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          🌏 新加坡旅遊英文
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          選一個情境，和家人一起學必備單字和句子
        </p>
      </div>

      {sections.map((section) => {
        const topics = travelTopics.filter((t) => t.section === section.id);
        if (topics.length === 0) return null;

        return (
          <div key={section.id} className="space-y-3">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              {section.title}{" "}
              <span className="normal-case font-normal">· {section.subtitle}</span>
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {topics.map((topic, i) => (
                <motion.button
                  key={topic.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectTopic(topic.id)}
                  className={`flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-hairline p-5 text-center shadow-elevated transition-shadow hover:shadow-floating ${topic.colorClass}`}
                >
                  <span className="text-4xl sm:text-5xl">{topic.emoji}</span>
                  <div>
                    <p className="text-base font-bold leading-tight sm:text-lg">
                      {topic.titleChinese}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{topic.title}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
