import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Headphones, Trash2 } from "lucide-react";
import { resolvePodcast } from "../../services/podcastService";
import {
  deleteSavedPodcast,
  listSavedPodcasts,
  savePodcast,
  savedPodcastFrom,
} from "../../services/podcastLibraryService";
import type { SavedPodcast } from "../../types/podcast";
import { podcastLoadError, type PodcastLoadError } from "../../utils/podcastLoadError";
import { logger } from "../../utils/logger";
import { ConfirmModal } from "../common/ConfirmModal";
import { T } from "../common/T";
import { useAuth } from "../../hooks/useAuth";
import { useLanguage } from "../../hooks/useLanguage";

/** The saved podcast list: paste a link to check and save it, open one to listen. */
export default function Podcasts() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<PodcastLoadError | null>(null);
  const [notice, setNotice] = useState<SavedPodcast | null>(null);
  const [items, setItems] = useState<SavedPodcast[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedPodcast | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    setListLoading(true); setListFailed(false);
    listSavedPodcasts(uid)
      .then((saved) => { if (active) setItems(saved); })
      .catch((cause) => {
        logger.error("Failed to load saved podcasts:", cause);
        if (active) setListFailed(true);
      })
      .finally(() => { if (active) setListLoading(false); });
    return () => { active = false; };
  }, [uid]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!uid || !trimmed) return;
    setError(null); setNotice(null);
    const known = items.find((item) => item.url === trimmed);
    if (known) { setNotice(known); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setSaving(true);
    try {
      const podcast = savedPodcastFrom(await resolvePodcast(trimmed, controller.signal), trimmed);
      if (controller.signal.aborted) return;
      const existing = items.find((item) => item.url === podcast.url);
      if (existing) { setNotice(existing); setUrl(""); return; }
      const saved = await savePodcast(uid, podcast);
      if (controller.signal.aborted) return;
      setItems((prev) => [saved, ...prev]);
      setUrl("");
    } catch (cause) {
      if (!controller.signal.aborted) setError(podcastLoadError(cause));
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!uid || !pendingDelete) return;
    setDeleting(true); setDeleteError(null);
    try {
      await deleteSavedPodcast(uid, pendingDelete.id);
      setItems((prev) => prev.filter((item) => item.id !== pendingDelete.id));
      if (notice?.id === pendingDelete.id) setNotice(null);
      setPendingDelete(null);
    } catch (cause) {
      logger.error("Failed to delete saved podcast:", cause);
      setDeleteError(t("listening.podcast.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header className="space-y-2"><h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight"><Headphones className="shrink-0" /><T k="listening.podcast.title" /></h1><p className="text-muted-foreground"><T k="listening.podcast.subtitle" /></p></header>
      <form onSubmit={(event) => void save(event)} className="space-y-2">
        <label htmlFor="podcast-url" className="text-sm font-medium"><T k="listening.podcast.urlLabel" /></label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="podcast-url" type="url" required maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://podcasts.apple.com/…?i=…" className="input input-bordered min-h-11 w-full min-w-0 flex-1" />
          <button type="submit" disabled={saving || !url.trim() || !uid} className="btn btn-primary min-h-11 shrink-0">{saving ? <T k="listening.podcast.checkingButton" /> : <T k="listening.podcast.save" />}</button>
        </div>
        <p className="text-xs text-muted-foreground"><T k="listening.podcast.urlHint" /></p>
      </form>
      {saving && <p role="status"><T k="listening.podcast.checking" /></p>}
      {error && <p role="alert" className="rounded-lg border border-border-hairline bg-background p-4 text-destructive">{"key" in error ? <T k={error.key} /> : error.text}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground"><T k="listening.podcast.alreadySaved" params={{ title: notice.title }} /></p>}

      <section aria-label={t("listening.podcast.savedLabel")} className="space-y-3">
        <h2 className="text-xl font-semibold"><T k="listening.podcast.savedLabel" /></h2>
        {listLoading && <p role="status" className="text-sm text-muted-foreground"><T k="listening.loading" /></p>}
        {listFailed && <p role="alert" className="text-sm text-destructive"><T k="listening.podcast.listFailed" /></p>}
        {!listLoading && !listFailed && items.length === 0 && <p className="rounded-[10px] border border-dashed border-border-hairline p-6 text-center text-sm text-muted-foreground"><T k="listening.podcast.empty" /></p>}
        {items.length > 0 && <ul className="divide-y divide-border-hairline overflow-hidden rounded-[10px] border border-border-hairline bg-background shadow-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 pr-2">
              <Link to={`/podcasts/${item.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-3 transition-colors hover:bg-black/5 dark:hover:bg-white/10">
                {item.artworkUrl
                  ? <img src={item.artworkUrl} alt="" referrerPolicy="no-referrer" className="size-12 shrink-0 rounded-md object-cover" onError={(event) => { event.currentTarget.hidden = true; }} />
                  : <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent"><Headphones size={20} /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {item.kind === "show" ? <T k="listening.podcast.kindShow" /> : <T k="listening.podcast.kindEpisode" />}
                    {item.kind === "episode" && item.podcastTitle && ` · ${item.podcastTitle}`}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
              </Link>
              <button type="button" aria-label={t("listening.podcast.deleteItem", { title: item.title })} onClick={() => { setDeleteError(null); setPendingDelete(item); }} className="btn btn-ghost btn-sm min-h-11 min-w-11 shrink-0 text-destructive"><Trash2 size={18} /></button>
            </li>
          ))}
        </ul>}
      </section>

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={<T k="listening.podcast.deleteTitle" />}
        message={<T k="listening.podcast.deleteMessage" params={{ title: pendingDelete?.title ?? "" }} />}
        confirmText={<T k="listening.delete" />}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
        isLoading={deleting}
        errorMessage={deleteError}
      />
    </div>
  );
}
