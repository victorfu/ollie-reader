import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";

export type GameControl = "left" | "right" | "jump";

/** Mounted only while playing: all input sources are released on pause/exit. */
export function GameControls({ onChange, jump = false }: {
  onChange: (control: GameControl, pressed: boolean) => void;
  jump?: boolean;
}) {
  const sources = useRef(new Map<string, GameControl>());
  const setSource = useCallback((source: string, control: GameControl, pressed: boolean) => {
    const wasPressed = [...sources.current.values()].includes(control);
    if (pressed) sources.current.set(source, control);
    else sources.current.delete(source);
    const isPressed = [...sources.current.values()].includes(control);
    if (wasPressed !== isPressed) onChange(control, isPressed);
  }, [onChange]);

  useEffect(() => {
    const releaseAll = () => {
      const held = new Set(sources.current.values());
      sources.current.clear();
      held.forEach(control => onChange(control, false));
    };
    const keyControl = (key: string): GameControl | undefined => {
      if (["arrowleft", "a"].includes(key)) return "left";
      if (["arrowright", "d"].includes(key)) return "right";
      if (jump && ["arrowup", "w", " "].includes(key)) return "jump";
    };
    const keyEvent = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const control = keyControl(key);
      if (!control) return;
      event.preventDefault();
      setSource(`key:${key}`, control, event.type === "keydown");
    };
    const releasePointer = (event: PointerEvent) => {
      const source = `pointer:${event.pointerId}`;
      const control = sources.current.get(source);
      if (control) setSource(source, control, false);
    };
    const onVisibility = () => { if (document.hidden) releaseAll(); };
    window.addEventListener("keydown", keyEvent);
    window.addEventListener("keyup", keyEvent);
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", keyEvent);
      window.removeEventListener("keyup", keyEvent);
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
    };
  }, [jump, onChange, setSource]);

  const controlButton = (control: GameControl, label: string, Icon: typeof ArrowLeft) => (
    <button
      type="button"
      aria-label={label}
      className="flex size-14 touch-none select-none items-center justify-center rounded-xl border border-border-hairline bg-background/90 text-foreground shadow-lg backdrop-blur-md active:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent"
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setSource(`pointer:${event.pointerId}`, control, true);
      }}
      onPointerUp={event => setSource(`pointer:${event.pointerId}`, control, false)}
      onPointerCancel={event => setSource(`pointer:${event.pointerId}`, control, false)}
      onLostPointerCapture={event => setSource(`pointer:${event.pointerId}`, control, false)}
    >
      <Icon size={24} aria-hidden="true" />
    </button>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-between px-6" aria-label="遊戲控制">
      <div className="pointer-events-auto flex gap-3">
        {controlButton("left", "向左", ArrowLeft)}
        {controlButton("right", "向右", ArrowRight)}
      </div>
      {jump && <div className="pointer-events-auto">{controlButton("jump", "跳躍", ArrowUp)}</div>}
    </div>
  );
}
