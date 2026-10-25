import { useEffect, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CompanionRuntime } from "./logic/companionRuntime";
import {
  createPointerTracker,
  type TrackerEvent,
} from "./logic/pointerTracker";
import { releaseSpin, turnSpin } from "./logic/spin";
import type { BuiltRig } from "./cinnamorollRig";
import type { CompanionAction } from "../../../types/companion";

/** Turn for a drag across the whole canvas width, radians. */
const TURN_PER_WIDTH = Math.PI * 1.5;

/**
 * Wires canvas pointer events to turning and petting. Every drag turns the
 * character until petting mode is on; then a drag that starts on the head
 * pets it, and ear strokes use their own targets. Other drags still turn.
 * The nearest head/body/ear/hand hit determines the gesture; blank canvas
 * never triggers an action. Only a completed tap performs a body reaction.
 */
export function usePetInteraction(
  runtime: CompanionRuntime,
  headHitRef: RefObject<THREE.Mesh | null>,
  hits: BuiltRig["hits"],
): void {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const element = gl.domElement;
    const tracker = createPointerTracker();
    let gestureVersion = runtime.gestureVersion;
    let activePointer: number | null = null;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const center = new THREE.Vector3();
    const edge = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const local = new THREE.Vector3();

    const send = (events: TrackerEvent[]) => {
      for (const event of events) {
        if (event.type === "turn") {
          const perPx = TURN_PER_WIDTH / Math.max(element.getBoundingClientRect().width, 1);
          runtime.spin = turnSpin(runtime.spin, event.dx * perPx, event.dy * perPx, event.now);
        } else if (event.type === "turnEnd") {
          runtime.spin = releaseSpin(runtime.spin, event.now);
        } else if (event.type === "perform") {
          runtime.perform(event.action, event.now);
          // A reaction from this gesture must not invalidate its own ear stroke.
          gestureVersion = runtime.gestureVersion;
        } else {
          runtime.dispatch(event);
        }
      }
    };

    const toNdc = (event: PointerEvent, rect: DOMRect) =>
      ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );

    /** Where the pointer is relative to the head, in screen terms. */
    const probe = (event: PointerEvent) => {
      const head = headHitRef.current;
      const rect = element.getBoundingClientRect();
      if (!head || rect.width === 0) return null;
      toNdc(event, rect);
      raycaster.setFromCamera(ndc, camera);
      head.updateWorldMatrix(true, false);
      Object.values(hits).forEach((mesh) => mesh.updateWorldMatrix(true, false));
      const nearest = raycaster.intersectObjects([head, ...Object.values(hits)], false)[0];
      const hit = nearest?.object === head ? nearest : undefined;
      const part = (Object.entries(hits).find(([, mesh]) => mesh === nearest?.object)?.[0]) as CompanionAction | undefined;

      head.getWorldPosition(center);
      head.getWorldScale(edge);
      // The head is wide and short; average so strokes feel the same both ways.
      const radius = (edge.x + edge.y) / 2;
      cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
      edge.copy(center).addScaledVector(cameraUp, radius).project(camera);
      center.project(camera);
      const headRadiusPx = Math.max(
        1,
        (Math.abs(edge.y - center.y) * rect.height) / 2,
      );

      if (hit) {
        local.copy(hit.point);
        head.worldToLocal(local);
        runtime.contact.x = local.x;
        runtime.contact.y = local.y;
      }

      return {
        sample: {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          // Outside petting mode the head is just another place to grab.
          onHead: runtime.petting && Boolean(hit),
          now: performance.now(),
          headRadiusPx,
          part,
          petting: runtime.petting,
        },
        // Cursor offset from the head center in head radii (y up).
        lookX: (ndc.x - center.x) * (rect.width / 2) / headRadiusPx / 2,
        lookY: (ndc.y - center.y) * (rect.height / 2) / headRadiusPx / 2,
      };
    };

    const onDown = (event: PointerEvent) => {
      if (gestureVersion !== runtime.gestureVersion) {
        send(tracker.reset(performance.now()));
        activePointer = null;
        gestureVersion = runtime.gestureVersion;
      }
      if (activePointer !== null) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const result = probe(event);
      if (!result) return;
      const { capture, events } = tracker.down(result.sample);
      if (capture) {
        activePointer = event.pointerId;
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // The pointer may already be gone; up/cancel still end the touch.
        }
        element.style.cursor = result.sample.onHead ? "pointer" : "grabbing";
        event.preventDefault();
      }
      send(events);
    };

    const onMove = (event: PointerEvent) => {
      if (gestureVersion !== runtime.gestureVersion) {
        send(tracker.reset(performance.now()));
        activePointer = null;
        gestureVersion = runtime.gestureVersion;
      }
      if (activePointer !== null && event.pointerId !== activePointer) return;
      const result = probe(event);
      if (!result) return;
      send(tracker.move(result.sample));
      if (event.pointerType === "mouse") {
        runtime.look.x = THREE.MathUtils.clamp(result.lookX, -1, 1);
        runtime.look.y = THREE.MathUtils.clamp(result.lookY, -1, 1);
        runtime.look.active = true;
        if (!element.hasPointerCapture(event.pointerId)) {
          element.style.cursor = result.sample.onHead ? "pointer" : "grab";
        }
      }
    };

    const onEnd = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return;
      send(tracker.end(event.pointerId, performance.now(), event.type !== "pointerup" || gestureVersion !== runtime.gestureVersion));
      activePointer = null;
      if (event.pointerType === "mouse") element.style.cursor = "";
    };

    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") runtime.look.active = false;
    };

    const releaseAll = () => {
      send(tracker.reset(performance.now()));
      activePointer = null;
      runtime.look.active = false;
    };
    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };

    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
    element.addEventListener("lostpointercapture", onEnd);
    element.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onEnd);
      element.removeEventListener("pointercancel", onEnd);
      element.removeEventListener("lostpointercapture", onEnd);
      element.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAll();
      element.style.cursor = "";
    };
  }, [camera, gl, headHitRef, hits, runtime]);
}
