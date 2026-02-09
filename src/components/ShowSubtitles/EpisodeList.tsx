import type { Episode } from "../../types/showSubtitles";

interface EpisodeListProps {
  episodes: Episode[];
  selectedEpisode: Episode | null;
  onSelectEpisode: (episode: Episode) => void | Promise<void>;
}

export function EpisodeList({
  episodes,
  selectedEpisode,
  onSelectEpisode,
}: EpisodeListProps) {
  if (episodes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-base-content/60">此季沒有集數資料</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {episodes.map((episode) => {
        const isSelected = selectedEpisode?.number === episode.number;
        return (
          <button
            key={episode.number}
            type="button"
            className={`text-left p-4 rounded-lg border transition-all duration-200 active:scale-[0.98] ${
              isSelected
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-black/5 dark:border-white/10 bg-base-100/70 hover:bg-base-200/50 hover:border-black/10 dark:hover:border-white/15"
            }`}
            onClick={() => onSelectEpisode(episode)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  isSelected
                    ? "bg-primary text-primary-content"
                    : "bg-base-200 text-base-content/70"
                }`}
              >
                {episode.number}
              </div>
              <span
                className={`text-sm font-medium leading-snug line-clamp-2 ${
                  isSelected ? "text-primary" : "text-base-content"
                }`}
              >
                {episode.title}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
