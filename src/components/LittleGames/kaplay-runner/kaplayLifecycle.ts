export type KaplaySceneLoader = {
  loadProgress: () => number;
  onLoad: (action: () => void) => void;
  go: (scene: string) => void;
};

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
