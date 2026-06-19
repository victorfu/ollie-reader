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
        <p className="text-muted-foreground">此季沒有集數資料</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 auto-grid">
      {episodes.map((episode) => {
        const isSelected = selectedEpisode?.number === episode.number;
        return (
          <button
            key={episode.number}
            type="button"
            className={`text-left p-4 rounded-lg border transition-all duration-200 active:scale-[0.98] ${
              isSelected
                ? "border-transparent ring-2 ring-accent bg-accent-tint shadow-soft"
                : "border-border-hairline bg-card hover:bg-accent-tint hover:border-accent/20"
            }`}
            onClick={() => onSelectEpisode(episode)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  isSelected
                    ? "bg-primary text-primary-content"
                    : "bg-base-200 text-muted-foreground"
                }`}
              >
                {episode.number}
              </div>
              <span
                className={`text-sm font-medium leading-snug line-clamp-2 ${
                  isSelected ? "text-accent" : "text-base-content"
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
