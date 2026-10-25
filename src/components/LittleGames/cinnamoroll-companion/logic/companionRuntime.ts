import {
  createPetState,
  reducePet,
  type PetEvent,
  type PetState,
} from "./petMachine";
import { createSpin, resetSpin, type Spin } from "./spin";
import type { CompanionAction } from "../../../../types/companion";
import { ACTION_MS, type PerformanceState } from "./actions";

/**
 * Mutable state shared by the DOM overlay, pointer handlers and the render
 * loop. Kept outside React so pointer moves and frames never re-render.
 */
export type CompanionRuntime = {
  pet: PetState;
  /** Desktop cursor relative to the head, roughly -1..1; inactive when away. */
  look: { x: number; y: number; active: boolean };
  /** Last touch point on the head in head-local units (x right, y up). */
  contact: { x: number; y: number };
  /** Turntable rotation from dragging. */
  spin: Spin;
  /** Petting mode: a drag that starts on the head pets instead of turning. */
  petting: boolean;
  performance: PerformanceState;
  /** Invalidates a captured gesture when an overlay changes interaction mode. */
  gestureVersion: number;
  perform(action: CompanionAction, now: number): void;
  dispatch(event: PetEvent): void;
  setPetting(on: boolean): void;
  /** Eases the model back to upright and facing front. */
  resetView(): void;
};

export function createCompanionRuntime(
  now: number,
  onFirstTouch?: () => void,
): CompanionRuntime {
  let touched = false;
  const runtime: CompanionRuntime = {
    pet: createPetState(now),
    look: { x: 0, y: 0, active: false },
    contact: { x: 0, y: 1 },
    spin: createSpin(),
    petting: false,
    performance: null,
    gestureVersion: 0,
    perform(action, now) {
      runtime.gestureVersion += 1;
      runtime.pet = { ...createPetState(now), hearts: runtime.pet.hearts };
      runtime.performance = { action, since: now };
    },
    setPetting(on) {
      runtime.gestureVersion += 1;
      runtime.performance = null;
      // Repeated keyboard pats reselect this mode; keep their accumulated credit.
      if (!on || runtime.petting !== on) {
        runtime.pet = { ...createPetState(runtime.pet.since), hearts: runtime.pet.hearts };
      }
      runtime.petting = on;
    },
    resetView() {
      runtime.spin = resetSpin(runtime.spin);
    },
    dispatch(event) {
      if (event.type === "pat") runtime.gestureVersion += 1;
      if (event.type === "tick" && runtime.performance && event.now - runtime.performance.since >= ACTION_MS) {
        runtime.performance = null;
      }
      if (event.type === "pat" || event.type === "touchStart") runtime.performance = null;
      runtime.pet = reducePet(runtime.pet, event);
      if (!touched && runtime.pet.phase !== "idle") {
        touched = true;
        onFirstTouch?.();
      }
    },
  };
  return runtime;
}
