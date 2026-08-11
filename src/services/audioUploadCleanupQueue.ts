const CLEANUP_MARKER_PREFIX = "ollie-audio-cleanup:v1:";
export const PENDING_AUDIO_METADATA_GRACE_MS = 60_000;
const memoryMarkers = new Map<
  string,
  Map<
    string,
    Map<AudioUploadCleanupReason, AudioUploadCleanupMarker>
  >
>();

export type AudioUploadCleanupReason = "orphaned-upload" | "deleted-record";

export interface AudioUploadCleanupMarker {
  audioPath: string;
  reason: AudioUploadCleanupReason;
  /** Avoid racing cleanup against an upload metadata request still in flight. */
  notBefore?: number;
}

interface EnqueueOptions {
  reason?: AudioUploadCleanupReason;
  requireDurable?: boolean;
  notBefore?: number;
}

function ownerPrefix(userId: string): string {
  return `${CLEANUP_MARKER_PREFIX}${encodeURIComponent(userId)}:`;
}

function legacyMarkerKey(userId: string, audioPath: string): string {
  return `${ownerPrefix(userId)}${encodeURIComponent(audioPath)}`;
}

function markerKey(
  userId: string,
  audioPath: string,
  reason: AudioUploadCleanupReason,
): string {
  return `${legacyMarkerKey(userId, audioPath)}:${reason}`;
}

export function isOwnedAudioUploadPath(
  userId: string,
  audioPath: string,
): boolean {
  return audioPath.startsWith(`audio-uploads/${userId}/`);
}

export function enqueueAudioUploadCleanup(
  userId: string,
  audioPath: string,
  options: EnqueueOptions = {},
): boolean {
  if (!isOwnedAudioUploadPath(userId, audioPath)) return false;

  const reason = options.reason ?? "orphaned-upload";
  if (
    options.notBefore !== undefined &&
    (!Number.isFinite(options.notBefore) || options.notBefore < 0)
  ) {
    return false;
  }
  const marker: AudioUploadCleanupMarker = {
    audioPath,
    reason,
    ...(options.notBefore === undefined
      ? {}
      : { notBefore: options.notBefore }),
  };
  const markers = memoryMarkers.get(userId) ?? new Map();
  const reasons = markers.get(audioPath) ?? new Map();
  reasons.set(reason, marker);
  markers.set(audioPath, reasons);
  memoryMarkers.set(userId, markers);

  try {
    globalThis.localStorage.setItem(
      markerKey(userId, audioPath, reason),
      JSON.stringify(marker),
    );
    return true;
  } catch {
    // The in-memory marker still enables retries during this page session.
    return !options.requireDurable;
  }
}

export function removeAudioUploadCleanup(
  userId: string,
  audioPath: string,
  expectedReason?: AudioUploadCleanupReason,
): void {
  const markers = memoryMarkers.get(userId);
  if (expectedReason) {
    const reasons = markers?.get(audioPath);
    reasons?.delete(expectedReason);
    if (reasons?.size === 0) markers?.delete(audioPath);
  } else {
    markers?.delete(audioPath);
  }
  if (markers?.size === 0) memoryMarkers.delete(userId);

  try {
    if (expectedReason) {
      globalThis.localStorage.removeItem(
        markerKey(userId, audioPath, expectedReason),
      );
      const legacyKey = legacyMarkerKey(userId, audioPath);
      const legacyValue = globalThis.localStorage.getItem(legacyKey);
      if (legacyValue) {
        const legacyMarker = parseMarkerValue(legacyValue);
        if (legacyMarker?.reason === expectedReason) {
          globalThis.localStorage.removeItem(legacyKey);
        }
      }
    } else {
      globalThis.localStorage.removeItem(
        markerKey(userId, audioPath, "orphaned-upload"),
      );
      globalThis.localStorage.removeItem(
        markerKey(userId, audioPath, "deleted-record"),
      );
      globalThis.localStorage.removeItem(legacyMarkerKey(userId, audioPath));
    }
  } catch {
    // A removed in-memory marker is still enough for this page session.
  }
}

function parseMarkerValue(value: string): AudioUploadCleanupMarker | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    // Values written before the reason schema contained only the raw path.
    return { audioPath: value, reason: "orphaned-upload" };
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.audioPath !== "string" ||
    (candidate.reason !== "orphaned-upload" &&
      candidate.reason !== "deleted-record")
  ) {
    return null;
  }
  if (
    candidate.notBefore !== undefined &&
    (typeof candidate.notBefore !== "number" ||
      !Number.isFinite(candidate.notBefore) ||
      candidate.notBefore < 0)
  ) {
    return null;
  }

  return {
    audioPath: candidate.audioPath,
    reason: candidate.reason,
    ...(typeof candidate.notBefore === "number"
      ? { notBefore: candidate.notBefore }
      : {}),
  };
}

export function listAudioUploadCleanupMarkers(
  userId: string,
): AudioUploadCleanupMarker[] {
  const markers = new Map<
    string,
    Map<AudioUploadCleanupReason, AudioUploadCleanupMarker>
  >();
  for (const [audioPath, reasons] of memoryMarkers.get(userId) ?? []) {
    markers.set(audioPath, new Map(reasons));
  }
  const prefix = ownerPrefix(userId);

  try {
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const value = globalThis.localStorage.getItem(key);
      if (!value) continue;
      const marker = parseMarkerValue(value);
      if (!marker || !isOwnedAudioUploadPath(userId, marker.audioPath)) {
        continue;
      }
      const reasons = markers.get(marker.audioPath) ?? new Map();
      reasons.set(marker.reason, marker);
      markers.set(marker.audioPath, reasons);
    }
  } catch {
    // Return the in-memory subset when durable storage is unavailable.
  }

  return [...markers].flatMap(([, reasons]) => {
    const marker =
      reasons.get("deleted-record") ?? reasons.get("orphaned-upload");
    return marker ? [marker] : [];
  });
}

export function listAudioUploadCleanups(userId: string): string[] {
  return listAudioUploadCleanupMarkers(userId).map(
    (marker) => marker.audioPath,
  );
}
