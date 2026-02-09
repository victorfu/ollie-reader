interface SeasonSelectorProps {
  seasonCount: number;
  selectedSeason: number;
  onSelectSeason: (season: number) => void;
}

export function SeasonSelector({
  seasonCount,
  selectedSeason,
  onSelectSeason,
}: SeasonSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: seasonCount }, (_, i) => i + 1).map((season) => (
        <button
          key={season}
          type="button"
          className={`btn btn-sm transition-all duration-200 ${
            selectedSeason === season
              ? "btn-primary"
              : "btn-ghost bg-base-200/50 hover:bg-base-200"
          }`}
          onClick={() => onSelectSeason(season)}
        >
          Season {season}
        </button>
      ))}
    </div>
  );
}
