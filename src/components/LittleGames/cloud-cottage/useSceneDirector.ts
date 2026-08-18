import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { CottageSceneAction } from "./ui/CottageScene";

export type SceneRequest = {
  action: CottageSceneAction;
  emoji?: string;
  /**
   * Stays on screen indefinitely instead of decaying to idle. Used for sleep,
   * which has to hold all night. A persisted request still yields to anything
   * queued behind it, and is restored once the queue drains.
   */
  persist?: boolean;
};

/** How long each action holds the scene before the next one starts. */
export function durationFor(action: CottageSceneAction): number {
  if (action === "fly") return 2_250;
  if (action === "bath" || action === "celebrate") return 2_650;
  if (action === "heartBurst") return 2_200;
  if (action === "nap") return 6_000;
  if (action.startsWith("play")) return 1_900;
  return 1_450;
}

type DirectorState = {
  current: SceneRequest | null;
  queue: SceneRequest[];
  /** Restored when the queue drains, so sleep survives a celebration. */
  resume: SceneRequest | null;
  key: number;
};

type DirectorEvent =
  | { type: "play"; request: SceneRequest }
  | { type: "enqueue"; request: SceneRequest }
  | { type: "advance" }
  | { type: "reset" };

const INITIAL: DirectorState = {
  current: null,
  queue: [],
  resume: null,
  key: 0,
};

function reduce(state: DirectorState, event: DirectorEvent): DirectorState {
  switch (event.type) {
    case "play":
      // Direct input wins outright: anything queued behind the old action is
      // stale, so it is dropped rather than played after the new one.
      return {
        current: event.request,
        queue: [],
        resume: event.request.persist ? event.request : null,
        key: state.key + 1,
      };

    case "enqueue":
      if (state.current === null) {
        return { ...state, current: event.request, key: state.key + 1 };
      }
      return { ...state, queue: [...state.queue, event.request] };

    case "advance": {
      if (state.queue.length > 0) {
        const [next, ...rest] = state.queue;
        return { ...state, current: next, queue: rest, key: state.key + 1 };
      }
      return { ...state, current: state.resume, key: state.key + 1 };
    }

    case "reset":
      return { ...INITIAL, key: state.key + 1 };
  }
}

export type SceneDirector = {
  action: CottageSceneAction;
  actionKey: number;
  emoji: string | undefined;
  /** Interrupts whatever is on screen. For anything the player just did. */
  play: (request: SceneRequest) => void;
  /** Waits its turn. For reactions the game raises on the player's behalf. */
  enqueue: (request: SceneRequest) => void;
  reset: () => void;
};

/**
 * Owns which animation the scene is showing.
 *
 * Care actions can raise several reactions at once — finishing a wish and
 * gaining a bond level both want a celebration — and firing them as separate
 * state updates meant React batched them and only the last one ever rendered.
 * That is why playing with a toy showed no toy: the play animation and its prop
 * were overwritten in the same tick they were set. Reactions are queued here
 * instead, so each one gets its full turn on screen.
 */
export function useSceneDirector(): SceneDirector {
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const { current, queue, key } = state;

  useEffect(() => {
    if (current === null) return;
    // A persisted action only starts a timer when something is waiting; with an
    // empty queue it holds the scene for as long as the save says it should.
    if (current.persist && queue.length === 0) return;

    const timer = window.setTimeout(
      () => dispatch({ type: "advance" }),
      durationFor(current.action),
    );
    return () => window.clearTimeout(timer);
    // `key` restarts the timer when the same action is replayed back to back.
  }, [current, queue.length, key]);

  const play = useCallback(
    (request: SceneRequest) => dispatch({ type: "play", request }),
    [],
  );
  const enqueue = useCallback(
    (request: SceneRequest) => dispatch({ type: "enqueue", request }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return useMemo(
    () => ({
      action: current?.action ?? "idle",
      actionKey: key,
      emoji: current?.emoji,
      play,
      enqueue,
      reset,
    }),
    [current, key, play, enqueue, reset],
  );
}
