import { motion } from "framer-motion";
import type { VocabularyWord } from "../../types/vocabulary";
import { SpeakerIcon, TrashIcon, ClockIcon } from "../icons";

interface VocabularyCardProps {
  word: VocabularyWord;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const VocabularyCard = ({ word, onClick, onPlay, onDelete }: VocabularyCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="card bg-base-100 shadow-sm hover:shadow-xl transition-shadow duration-slow cursor-pointer border border-base-200 overflow-hidden group h-full"
      onClick={onClick}
    >
      {/* Decorative gradient bar at top */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/30 to-secondary/30 group-hover:from-primary group-hover:to-secondary transition-all duration-500" />
      
      <div className="card-body p-3 sm:p-4 flex flex-col h-full">
        <div className="flex justify-between items-start mb-1">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              {word.emoji && (
                <span className="text-xl" role="img" aria-label={word.word}>
                  {word.emoji}
                </span>
              )}
              <h3 className="text-lg font-bold truncate tracking-tight text-base-content group-hover:text-primary transition-colors">
                {word.word}
              </h3>
              <button
                type="button"
                onClick={onPlay}
                className="btn btn-ghost btn-xs btn-circle text-primary/70 hover:text-primary hover:bg-primary/10 ml-1"
                title="播放發音"
              >
                <SpeakerIcon />
              </button>
            </div>
            {word.phonetic && (
              <p className="text-xs text-base-content/60 font-serif italic mt-0.5">
                {word.phonetic}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            aria-label="刪除"
            title="刪除單字"
          >
            <TrashIcon className="h-4 w-4 text-error/70 hover:text-error" />
          </button>
        </div>

        {word.definitions.length > 0 && (
          <div className="bg-base-200/40 rounded-md p-2 mb-2 backdrop-blur-sm border border-base-200/50 flex-grow">
            <p className="text-xs line-clamp-2 text-base-content/80 leading-relaxed">
              <span className="inline-block px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-base-content/5 text-base-content/60 mr-1.5 align-middle">
                {word.definitions[0].partOfSpeech}
              </span>
              <span className="align-middle">
                {word.definitions[0].definitionChinese || word.definitions[0].definition}
              </span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mt-auto pt-1 items-center">
          {word.difficulty && (
            <span
              className={`badge badge-xs border-0 font-medium ${
                word.difficulty === "easy"
                  ? "bg-success/10 text-success"
                  : word.difficulty === "medium"
                  ? "bg-warning/10 text-warning"
                  : "bg-error/10 text-error"
              }`}
            >
              {word.difficulty === "easy"
                ? "簡單"
                : word.difficulty === "medium"
                ? "中等"
                : "困難"}
            </span>
          )}
          
          {word.tags.slice(0, 2).map((tag, index) => (
            <span
              key={`${index}-${tag}`}
              className="badge badge-xs badge-ghost bg-base-200/60 text-base-content/70"
            >
              #{tag}
            </span>
          ))}
          
          {word.tags.length > 2 && (
            <span className="badge badge-xs badge-ghost bg-base-200/60 text-base-content/70">
              +{word.tags.length - 2}
            </span>
          )}

          {word.reviewCount > 0 && (
             <div className="ml-auto flex items-center gap-1 text-xs text-base-content/40" title={`已複習 ${word.reviewCount} 次`}>
               <ClockIcon />
               {word.reviewCount}
             </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
