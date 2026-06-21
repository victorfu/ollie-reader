export type KaplaySceneLoader = {
  loadProgress: () => number;
  onLoad: (action: () => void) => void;
  go: (scene: string) => void;
};

type TimeoutId = ReturnType<typeof setTimeout>;

export type KaplayInitScheduler = {
  setTimeout: (action: () => void, delay: number) => TimeoutId;
  clearTimeout: (id: TimeoutId) => void;
};

const browserInitScheduler: KaplayInitScheduler = {
  setTimeout: (action, delay) => window.setTimeout(action, delay),
  clearTimeout: (id) => window.clearTimeout(id),
};

export function scheduleKaplayInit(
  action: () => void,
  scheduler: KaplayInitScheduler = browserInitScheduler,
): () => void {
  const timeoutId = scheduler.setTimeout(action, 0);

  return () => {
    scheduler.clearTimeout(timeoutId);
  };
}

export function startKaplaySceneWhenReady(
  k: KaplaySceneLoader,
  scene = "runner",
): void {
  if (k.loadProgress() >= 1) {
    k.go(scene);
    return;
  }

  k.onLoad(() => {
    k.go(scene);
  });
}
