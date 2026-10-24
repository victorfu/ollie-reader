import { useEffect, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CompanionRuntime } from "./logic/companionRuntime";
import type { PetEvent } from "./logic/petMachine";
import { createPointerTracker } from "./logic/pointerTracker";

/**
 * Wires canvas pointer events to the petting machine. Hit testing raycasts
 * only the invisible head mesh, which follows the animated head, so ears,
 * body and empty canvas never count as a pet.
 */
export function usePetInteraction(
  runtime: CompanionRuntime,
  headHitRef: RefObject<THREE.Mesh | null>,
): void {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const element = gl.domElement;
    const tracker = createPointerTracker();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const center = new THREE.Vector3();
    const edge = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const local = new THREE.Vector3();

    const send = (events: PetEvent[]) => events.forEach(runtime.dispatch);

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
      const hit = raycaster.intersectObject(head, false)[0];

      head.getWorldPosition(center);
      head.getWorldScale(edge);
      const radius = edge.y;
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
          onHead: Boolean(hit),
          now: performance.now(),
          headRadiusPx,
        },
        // Cursor offset from the head center in head radii (y up).
        lookX: (ndc.x - center.x) * (rect.width / 2) / headRadiusPx / 2,
        lookY: (ndc.y - center.y) * (rect.height / 2) / headRadiusPx / 2,
      };
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const result = probe(event);
      if (!result) return;
      const { capture, events } = tracker.down(result.sample);
      if (capture) {
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // The pointer may already be gone; up/cancel still end the touch.
        }
        element.style.cursor = "grabbing";
        event.preventDefault();
      }
      send(events);
    };

    const onMove = (event: PointerEvent) => {
      const result = probe(event);
      if (!result) return;
      send(tracker.move(result.sample));
      if (event.pointerType === "mouse") {
        runtime.look.x = THREE.MathUtils.clamp(result.lookX, -1, 1);
        runtime.look.y = THREE.MathUtils.clamp(result.lookY, -1, 1);
        runtime.look.active = true;
        if (!element.hasPointerCapture(event.pointerId)) {
          element.style.cursor = result.sample.onHead ? "grab" : "";
        }
      }
    };

    const onEnd = (event: PointerEvent) => {
      send(tracker.end(event.pointerId, performance.now()));
      if (event.pointerType === "mouse") element.style.cursor = "";
    };

    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") runtime.look.active = false;
    };

    const releaseAll = () => {
      send(tracker.reset(performance.now()));
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
  }, [camera, gl, headHitRef, runtime]);
}
