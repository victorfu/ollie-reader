interface SeasonSelectorProps {
  seasonNumbers: number[];
  selectedSeason: number;
  onSelectSeason: (season: number) => void;
}

export function SeasonSelector({
  seasonNumbers,
  selectedSeason,
  onSelectSeason,
}: SeasonSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {seasonNumbers.map((season) => (
        <button
          key={season}
          type="button"
          className={`btn btn-sm transition-all duration-200 active:scale-[0.98] ${
            selectedSeason === season
              ? "btn-primary"
              : "btn-ghost bg-base-200/50 hover:bg-accent-tint hover:text-accent"
          }`}
          onClick={() => onSelectSeason(season)}
        >
          Season {season}
        </button>
      ))}
    </div>
  );
}
