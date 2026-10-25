/** Convert mono browser PCM to the 16 kHz expected by Whistle. */
export function resamplePodcastPcm(samples: Float32Array, sourceRate: number): Float32Array {
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) throw new Error("Invalid PCM sample rate");
  if (sourceRate === 16_000) return samples;
  const output = new Float32Array(Math.round(samples.length * 16_000 / sourceRate));
  for (let i = 0; i < output.length; i++) {
    const position = i * sourceRate / 16_000;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, samples.length - 1);
    const blend = position - lower;
    output[i] = samples[lower] * (1 - blend) + samples[upper] * blend;
  }
  return output;
}

/** Word positions are relative to the stream; map them back to media time. */
export function toPodcastWords(
  words: ReadonlyArray<{ word: string; start: number; end: number }>,
  offset: number,
  playbackRate: number,
) {
  return words.filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end >= word.start)
    .map((word) => ({
      word: word.word,
      start: offset + word.start * playbackRate,
      end: offset + word.end * playbackRate,
    }));
}

export type PodcastCaptionWord = ReturnType<typeof toPodcastWords>[number];
