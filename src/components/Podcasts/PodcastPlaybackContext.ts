import { createContext } from "react";

/** Playback state and the existing player's range-checked seek handler. */
export const PodcastPlaybackContext = createContext<{ time: number; seekable: boolean; seek: (time: number) => void }>({ time: 0, seekable: false, seek: () => {} });
