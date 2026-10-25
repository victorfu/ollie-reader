import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import type { RigParts } from "./rig";
import type { CompanionRuntime } from "./logic/companionRuntime";
import { petExpression, type PetPhase } from "./logic/petMachine";
import { advanceSpin, applySpin } from "./logic/spin";

const EAR_STIFFNESS = 70;
const EAR_DAMPING = 7;
/** Frame steps longer than this (tab switch, jank) are clamped. */
const MAX_STEP_S = 1 / 30;

type Spring = { value: number; velocity: number };

type AnimationState = {
  eyesClosed: number;
  smile: number;
  headLift: number;
  delight: number;
  pitch: number;
  yaw: number;
  roll: number;
  lookX: number;
  lookY: number;
  ears: [Spring, Spring];
  blinkStart: number;
  nextBlinkAt: number;
  tiltUntil: number;
  nextTiltAt: number;
  tiltSide: number;
  touchSide: number;
  phase: PetPhase;
  /** Rest height of the neck pivot, read from the model on the first frame. */
  headBaseY: number | null;
};

function initialState(now: number): AnimationState {
  return {
    eyesClosed: 0,
    smile: 0.25,
    headLift: 0,
    delight: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    lookX: 0,
    lookY: 0,
    ears: [
      { value: 0, velocity: 0 },
      { value: 0, velocity: 0 },
    ],
    blinkStart: -Infinity,
    nextBlinkAt: now + 2_000,
    tiltUntil: 0,
    nextTiltAt: now + 6_000,
    tiltSide: 1,
    touchSide: 1,
    phase: "idle",
    headBaseY: null,
  };
}

function stepSpring(spring: Spring, target: number, dt: number): void {
  const accel =
    (target - spring.value) * EAR_STIFFNESS - spring.velocity * EAR_DAMPING;
  spring.velocity += accel * dt;
  spring.value += spring.velocity * dt;
}

const BLINK_MS = 160;

/**
 * Per-frame animation for the companion. Reads the shared runtime, ticks the
 * petting machine, and eases every part toward the expression it asks for.
 * Breathing and blinking never stop, so the pet stays alive in every state.
 */
export function useCompanionAnimation(
  rig: RefObject<RigParts>,
  runtime: CompanionRuntime,
  reducedMotion: boolean,
): void {
  const anim = useRef<AnimationState | null>(null);

  useFrame((state, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, MAX_STEP_S);
    const t = state.clock.elapsedTime;
    const a = (anim.current ??= initialState(now));
    const parts = rig.current;
    const motion = reducedMotion ? 0.35 : 1;

    runtime.dispatch({ type: "tick", now });
    runtime.spin = advanceSpin(runtime.spin, dt);
    if (parts.turntable) applySpin(parts.turntable, runtime.spin);
    const pet = runtime.pet;
    const face = petExpression(pet, now);

    // Phase transitions trigger one-off reactions; continuing a pet does not.
    if (pet.phase !== a.phase) {
      if (pet.phase === "headTouch") {
        a.touchSide = runtime.contact.x >= 0 ? 1 : -1;
        a.ears.forEach((ear) => {
          ear.velocity -= 3.2 * motion;
        });
      }
      a.phase = pet.phase;
    }

    a.eyesClosed = MathUtils.damp(a.eyesClosed, face.eyesClosed, 14, dt);
    a.smile = MathUtils.damp(a.smile, face.smile, 10, dt);
    a.headLift = MathUtils.damp(a.headLift, face.headLift, 12, dt);
    a.delight = MathUtils.damp(a.delight, face.delight, 4, dt);

    // Blink on a loose rhythm; closed eyes skip it.
    if (now >= a.nextBlinkAt) {
      a.blinkStart = now;
      a.nextBlinkAt = now + 2_500 + Math.random() * 3_500;
    }
    const blinkProgress = (now - a.blinkStart) / BLINK_MS;
    const blink =
      blinkProgress >= 0 && blinkProgress <= 1
        ? Math.sin(blinkProgress * Math.PI)
        : 0;

    // Idle head tilt every so often.
    if (pet.phase === "idle" && now >= a.nextTiltAt && !reducedMotion) {
      a.tiltSide = Math.random() < 0.5 ? -1 : 1;
      a.tiltUntil = now + 1_600;
      a.nextTiltAt = now + 7_000 + Math.random() * 6_000;
    }
    const idleTilt = pet.phase === "idle" && now < a.tiltUntil ? 0.09 : 0;

    // Desktop cursor follow, only when nothing is touching the head.
    const following = runtime.look.active && pet.phase === "idle";
    a.lookX = MathUtils.damp(a.lookX, following ? runtime.look.x : 0, 5, dt);
    a.lookY = MathUtils.damp(a.lookY, following ? runtime.look.y : 0, 5, dt);

    const breath = Math.sin((t * Math.PI * 2) / 3.4);
    let targetPitch = -0.16 * a.lookY - 0.2 * a.headLift;
    let targetYaw = 0.32 * a.lookX;
    let targetRoll =
      -a.tiltSide * idleTilt + 0.13 * a.headLift * a.touchSide;
    if (pet.phase === "petting") {
      // Lean into the hand: the top of the head moves toward the touch.
      targetRoll = -MathUtils.clamp(runtime.contact.x, -1, 1) * 0.16;
      targetPitch = -0.08 + 0.02 * Math.sin(t * 5) * motion;
      targetYaw = 0;
    }
    a.pitch = MathUtils.damp(a.pitch, targetPitch * motion, 7, dt);
    a.yaw = MathUtils.damp(a.yaw, targetYaw * motion, 7, dt);
    const previousRoll = a.roll;
    a.roll = MathUtils.damp(a.roll, targetRoll * motion, 6, dt);
    const rollVelocity = (a.roll - previousRoll) / Math.max(dt, 1e-4);

    if (parts.body) {
      const b = 0.014 * breath * motion;
      parts.body.scale.set(1 + b, 1 + b * 1.4, 1 + b);
    }
    if (parts.head) {
      parts.head.rotation.set(a.pitch, a.yaw, a.roll);
      a.headBaseY ??= parts.head.position.y;
      parts.head.position.y = a.headBaseY + 0.012 * breath * motion;
    }
    if (parts.tail) {
      parts.tail.rotation.y =
        Math.sin(t * (pet.phase === "petting" ? 7 : 1.6)) *
        (pet.phase === "petting" ? 0.22 : 0.08) *
        motion;
    }

    // Ears: springs that sway at idle, relax while petted and wiggle with
    // delight, and lag behind head roll so they feel soft.
    const relaxed = pet.phase === "petting" ? 0.16 : 0;
    a.ears.forEach((ear, index) => {
      const side = index === 0 ? -1 : 1;
      const sway = Math.sin(t * 1.3 + index * 1.7) * 0.05 * motion;
      const wiggle = Math.sin(t * 9 + index) * 0.07 * a.delight * motion;
      stepSpring(ear, relaxed + sway + wiggle - rollVelocity * 0.04 * side, dt);
      const node = parts.ears[index];
      if (node) node.rotation.z = side * -ear.value;
    });

    const open = (1 - blink) * (1 - a.eyesClosed);
    parts.eyesOpen.forEach((node) => {
      if (!node) return;
      node.scale.set(1, Math.max(open, 0.04), 1);
      node.position.x = 0.025 * a.lookX;
      node.position.y = 0.02 * a.lookY;
      node.visible = open > 0.05;
    });
    parts.eyesClosed.forEach((node) => {
      if (!node) return;
      node.scale.setScalar(a.eyesClosed);
      node.visible = a.eyesClosed > 0.05;
    });

    if (parts.mouth) {
      parts.mouth.scale.set(0.9 + 0.2 * a.smile, 0.8 + 0.4 * a.smile, 1);
    }
    if (parts.mouthOpen) {
      parts.mouthOpen.scale.y = MathUtils.clamp((a.smile - 0.6) * 2.5, 0, 1);
    }
    if (parts.cheekMaterial) {
      parts.cheekMaterial.opacity = 0.75 + 0.25 * a.delight;
    }
  });
}
