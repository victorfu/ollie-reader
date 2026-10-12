import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { PodcastEpisode } from "../types/podcast";
import type { TranscriptResult } from "../types/podcastTranscript";
import { requestPodcastTranscript } from "../services/podcastTranscriptionService";

type State = TranscriptResult | { status: "checking-cache" };
export function usePodcastTranscript(user: User | null, episode: PodcastEpisode) {
  const identity = JSON.stringify([user?.uid, episode.podcastId, episode.guid]);
  const [snapshot, setSnapshot] = useState<{ identity: string; state: State }>({ identity, state: { status: "checking-cache" } });
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useCallback(async (action: "check" | "generate", controller: AbortController) => {
    if (!user) { setSnapshot({ identity, state: { status: "failed", error: "請先登入以產生及儲存字幕。" } }); return; }
    busy.current = true;
    const update = (state: State) => { if (!controller.signal.aborted) setSnapshot({ identity, state }); };
    update({ status: action === "check" ? "checking-cache" : "generating" });
    try {
      let result = await requestPodcastTranscript(user, episode, action, controller.signal);
      update(result);
      // Poll only a known active lease; polling never starts another paid request.
      while (result.status === "generating" && !controller.signal.aborted) {
        await new Promise<void>((resolve) => {
          const finish = () => { if (timer.current) clearTimeout(timer.current); controller.signal.removeEventListener("abort", finish); resolve(); };
          timer.current = setTimeout(finish, 3000);
          controller.signal.addEventListener("abort", finish, { once: true });
          if (controller.signal.aborted) finish();
        });
        if (controller.signal.aborted) return;
        result = await requestPodcastTranscript(user, episode, "check", controller.signal);
        update(result);
      }
    } catch (error) {
      update({ status: "failed", error: error instanceof Error && error.name === "TimeoutError" ? "等候字幕逾時；請先重新檢查，避免重複產生。" : error instanceof TypeError ? "無法連線字幕服務，請確認網路後重新檢查。" : error instanceof Error ? error.message : "字幕產生失敗，請重試。" });
    } finally {
      if (request.current === controller) busy.current = false;
    }
  }, [user, episode, identity]);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void run("check", controller);
    return () => { request.current?.abort(); busy.current = false; };
  }, [run]);
  const start = (action: "check" | "generate") => {
    if (snapshot.identity === identity && ["checking-cache", "generating"].includes(snapshot.state.status)) return;
    // Ref guards repeated clicks before React commits the loading state.
    if (busy.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSnapshot({ identity, state: { status: action === "check" ? "checking-cache" : "generating" } });
    void run(action, controller);
  };
  return { state: snapshot.identity === identity ? snapshot.state : { status: "checking-cache" as const }, generate: () => start("generate"), check: () => start("check") };
}
