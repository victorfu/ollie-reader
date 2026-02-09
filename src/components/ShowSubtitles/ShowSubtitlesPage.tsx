import { useShowSubtitles } from "../../hooks/useShowSubtitles";
import { SeasonSelector } from "./SeasonSelector";
import { EpisodeList } from "./EpisodeList";
import { TranscriptViewer } from "./TranscriptViewer";

export function ShowSubtitlesPage() {
  const {
    seasons,
    selectedSeason,
    currentSeasonEpisodes,
    selectedEpisode,
    transcript,
    loading,
    error,
    selectSeason,
    selectEpisode,
    clearTranscript,
  } = useShowSubtitles();

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Header */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                📺 Gabby's Dollhouse
              </h1>
              <p className="text-base-content/60 mt-1">
                觀看影集字幕，學習日常英文對話
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="badge badge-lg badge-outline gap-1">
                {seasons.length} 季
              </div>
              <div className="badge badge-lg badge-outline gap-1">
                {seasons.reduce((sum, s) => sum + s.episodes.length, 0)} 集
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Season Selector */}
      {seasons.length > 0 && (
        <div className="card bg-base-100 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="text-lg font-bold mb-3">選擇季數</h2>
            <SeasonSelector
              seasonCount={seasons.length}
              selectedSeason={selectedSeason}
              onSelectSeason={selectSeason}
            />
          </div>
        </div>
      )}

      {/* Episode list or Transcript viewer */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {selectedEpisode ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1 self-start mb-2 -ml-2"
                onClick={clearTranscript}
                aria-label="返回集數列表"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                返回集數列表
              </button>
              <TranscriptViewer
                episode={selectedEpisode}
                transcript={transcript}
                loading={loading}
                error={error}
              />
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-3">
                Season {selectedSeason} 集數
              </h2>
              <EpisodeList
                episodes={currentSeasonEpisodes}
                selectedEpisode={selectedEpisode}
                onSelectEpisode={selectEpisode}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShowSubtitlesPage;
