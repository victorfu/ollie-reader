import { useShowSubtitles } from "../../hooks/useShowSubtitles";
import { useTextSelection } from "../../hooks/useTextSelection";
import { useSpeechState } from "../../hooks/useSpeechState";
import {
  useVocabulary,
  formatDefinitionsForDisplay,
} from "../../hooks/useVocabulary";
import { useLookupQueue } from "../../hooks/useLookupQueue";
import { useAuth } from "../../hooks/useAuth";
import { useToastQueue } from "../../hooks/useToastQueue";
import { createTranslateFn } from "../../utils/translateFactory";
import { SeasonSelector } from "./SeasonSelector";
import { EpisodeList } from "./EpisodeList";
import { TranscriptViewer } from "./TranscriptViewer";
import { SelectionToolbar } from "../PdfReader/SelectionToolbar";
import { LookupPanel } from "../PdfReader/LookupPanel";
import { ToastContainer } from "../common/ToastContainer";
import { T } from "../common/T";
import { useLanguage } from "../../hooks/useLanguage";

export function ShowSubtitlesPage() {
  const { t } = useLanguage();
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

  const {
    selectedText,
    handleTextSelection,
    clearSelection,
    toolbarPosition,
  } = useTextSelection();

  const { user } = useAuth();
  const { speak } = useSpeechState();
  const { lookupOrAddWord } = useVocabulary();
  const { toasts, addToast, removeToast } = useToastQueue(3);
  const {
    lookups,
    requestSignal,
    startLookup,
    startTranslation,
    dismissLookup,
    dismissAll,
  } = useLookupQueue(lookupOrAddWord, formatDefinitionsForDisplay);

  const speakSelection = () => {
    if (selectedText) speak(selectedText);
  };

  const handleLookupWord = () => {
    const trimmedText = selectedText.trim();
    if (!trimmedText) return;

    const word = trimmedText.split(/\s+/)[0];
    const result = startLookup(word, { sourceContext: trimmedText });

    if (result === "duplicate") {
      addToast(t("listening.show.lookupInProgress", { word }), "info");
    } else if (result === "max_reached") {
      addToast(t("listening.show.lookupLimit"), "error");
    }

    clearSelection();
  };

  // Lookup a word typed directly into the panel's search row
  const handleLookupTypedWord = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;

    const result = startLookup(trimmed);

    if (result === "duplicate") {
      addToast(t("listening.show.lookupInProgress", { word: trimmed }), "info");
    } else if (result === "max_reached") {
      addToast(t("listening.show.lookupLimit"), "error");
    }
  };

  const handleTranslate = () => {
    const trimmedText = selectedText.trim();
    if (!trimmedText) return;

    const result = startTranslation(trimmedText, createTranslateFn(user));

    if (result === "duplicate") {
      addToast(t("listening.show.translating"), "info");
    } else if (result === "max_reached") {
      addToast(t("listening.show.lookupLimit"), "error");
    }

    clearSelection();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="surface-card p-4 sm:p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
              Gabby's Dollhouse
            </h1>
            <p className="text-muted-foreground mt-1">
              <T k="listening.show.subtitle" />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="badge badge-lg badge-outline gap-1">
              <T k="listening.show.seasonCount" params={{ count: seasons.length }} />
            </div>
            <div className="badge badge-lg badge-outline gap-1">
              <T
                k="listening.show.episodeCount"
                params={{
                  count: seasons.reduce((sum, s) => sum + s.episodes.length, 0),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Season Selector */}
      {seasons.length > 0 && (
        <div className="surface-card p-4 sm:p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-3">
            <T k="listening.show.chooseSeason" />
          </h2>
          <SeasonSelector
            seasonNumbers={seasons.map((s) => s.number)}
            selectedSeason={selectedSeason}
            onSelectSeason={selectSeason}
          />
        </div>
      )}

      {/* Episode list or Transcript viewer */}
      <div
        className="surface-card p-4 sm:p-5 md:p-6"
        onMouseUp={() => handleTextSelection()}
      >
          {selectedEpisode ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-1 self-start mb-3 -ml-2 active:scale-[0.98]"
                onClick={clearTranscript}
                aria-label={t("listening.show.backToEpisodes")}
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
                <T k="listening.show.backToEpisodes" />
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
              <h2 className="text-lg font-semibold mb-3">
                <T
                  k="listening.show.seasonEpisodes"
                  params={{ season: selectedSeason }}
                />
              </h2>
              <EpisodeList
                episodes={currentSeasonEpisodes}
                selectedEpisode={selectedEpisode}
                onSelectEpisode={selectEpisode}
              />
            </>
          )}
      </div>

      {/* Selection toolbar */}
      {selectedText && (
        <SelectionToolbar
          selectedText={selectedText}
          onSpeak={speakSelection}
          onTranslate={handleTranslate}
          onClear={clearSelection}
          onAddToVocabulary={handleLookupWord}
          position={toolbarPosition}
        />
      )}

      {/* Lookup Queue Panel */}
      <LookupPanel
        lookups={lookups}
        showSignal={requestSignal}
        onDismiss={dismissLookup}
        onDismissAll={dismissAll}
        onSpeak={speak}
        onLookupWord={handleLookupTypedWord}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default ShowSubtitlesPage;
