import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 44_100;
const twoPi = Math.PI * 2;
const outputDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/assets/games/wonder-academy/audio",
);

const sfxSpecs = {
  ui_select: {
    duration: 0.18,
    notes: [
      { start: 0, duration: 0.09, frequency: 660, gain: 0.38 },
      { start: 0.055, duration: 0.1, frequency: 990, gain: 0.28 },
    ],
  },
  ui_confirm: {
    duration: 0.28,
    notes: [
      { start: 0, duration: 0.12, frequency: 523.25, gain: 0.34 },
      { start: 0.07, duration: 0.16, frequency: 783.99, gain: 0.34 },
      { start: 0.14, duration: 0.12, frequency: 1046.5, gain: 0.2 },
    ],
  },
  ui_back: {
    duration: 0.22,
    notes: [
      { start: 0, duration: 0.13, frequency: 587.33, gain: 0.3 },
      { start: 0.08, duration: 0.12, frequency: 392, gain: 0.24 },
    ],
  },
  ui_locked: {
    duration: 0.28,
    notes: [
      { start: 0, duration: 0.1, frequency: 220, gain: 0.34, wave: "triangle" },
      { start: 0.09, duration: 0.12, frequency: 207.65, gain: 0.28, wave: "triangle" },
    ],
  },
  node_unlock: {
    duration: 0.65,
    notes: [
      { start: 0, duration: 0.18, frequency: 392, gain: 0.22 },
      { start: 0.13, duration: 0.2, frequency: 587.33, gain: 0.26 },
      { start: 0.28, duration: 0.26, frequency: 880, gain: 0.3 },
      { start: 0.38, duration: 0.2, frequency: 1174.66, gain: 0.16 },
    ],
  },
  save_success: {
    duration: 0.42,
    notes: [
      { start: 0, duration: 0.16, frequency: 659.25, gain: 0.28 },
      { start: 0.12, duration: 0.22, frequency: 987.77, gain: 0.3 },
    ],
  },
  save_pending: {
    duration: 0.52,
    notes: [
      { start: 0, duration: 0.12, frequency: 440, gain: 0.2 },
      { start: 0.16, duration: 0.12, frequency: 493.88, gain: 0.2 },
      { start: 0.32, duration: 0.12, frequency: 554.37, gain: 0.2 },
    ],
  },
  attune_ready: {
    duration: 0.72,
    notes: [
      { start: 0, duration: 0.26, frequency: 329.63, gain: 0.18 },
      { start: 0.18, duration: 0.28, frequency: 493.88, gain: 0.24 },
      { start: 0.36, duration: 0.3, frequency: 739.99, gain: 0.24 },
    ],
  },
  attune_success: {
    duration: 0.95,
    notes: [
      { start: 0, duration: 0.2, frequency: 523.25, gain: 0.25 },
      { start: 0.15, duration: 0.22, frequency: 659.25, gain: 0.25 },
      { start: 0.3, duration: 0.26, frequency: 783.99, gain: 0.26 },
      { start: 0.5, duration: 0.34, frequency: 1046.5, gain: 0.24 },
      { start: 0.62, duration: 0.24, frequency: 1318.51, gain: 0.12 },
    ],
  },
  attune_fail_soft: {
    duration: 0.48,
    notes: [
      { start: 0, duration: 0.2, frequency: 493.88, gain: 0.2, wave: "triangle" },
      { start: 0.18, duration: 0.22, frequency: 369.99, gain: 0.22, wave: "triangle" },
    ],
  },
  wonderdex_update: {
    duration: 0.55,
    notes: [
      { start: 0, duration: 0.1, frequency: 880, gain: 0.18 },
      { start: 0.09, duration: 0.12, frequency: 1174.66, gain: 0.2 },
      { start: 0.2, duration: 0.22, frequency: 1760, gain: 0.16 },
    ],
  },
  snack_use: {
    duration: 0.36,
    notes: [
      { start: 0, duration: 0.1, frequency: 349.23, gain: 0.24, wave: "triangle" },
      { start: 0.08, duration: 0.12, frequency: 523.25, gain: 0.2, wave: "triangle" },
      { start: 0.17, duration: 0.1, frequency: 698.46, gain: 0.16 },
    ],
  },
  bond_skill_ready: {
    duration: 0.68,
    notes: [
      { start: 0, duration: 0.18, frequency: 440, gain: 0.24 },
      { start: 0.14, duration: 0.18, frequency: 660, gain: 0.24 },
      { start: 0.28, duration: 0.24, frequency: 990, gain: 0.24 },
      { start: 0.42, duration: 0.18, frequency: 1320, gain: 0.12 },
    ],
  },
};

// Loops are written as gentle, looping tunes: a soft pad chord, a warm bass
// note per bar, and a music-box arpeggio melody. Pitches are MIDI note numbers
// (C4 = 60). Each bar is one chord; `melody` lists chord-tone indices played as
// eighth notes (index into the bar's pad chord, extended one octave up).
const loopSpecs = {
  // Calm, cheerful overworld theme — C major: C – G – Am – F.
  hub_loop: {
    bpm: 100,
    beatsPerBar: 4,
    bars: [
      { bass: 48, pad: [60, 64, 67], melody: [0, 2, 1, 4, 3, 2, 1, 2] },
      { bass: 43, pad: [59, 62, 67], melody: [1, 2, 4, 3, 2, 1, 2, 0] },
      { bass: 45, pad: [60, 64, 69], melody: [0, 1, 2, 4, 3, 1, 2, 1] },
      { bass: 41, pad: [57, 60, 65], melody: [2, 1, 0, 1, 2, 3, 4, 2] },
    ],
  },
  // Brighter, wandering travel theme — G major: G – D – Em – C.
  region_map_loop: {
    bpm: 112,
    beatsPerBar: 4,
    bars: [
      { bass: 43, pad: [62, 66, 67], melody: [0, 2, 4, 2, 1, 3, 2, 4] },
      { bass: 50, pad: [62, 66, 69], melody: [2, 4, 3, 2, 4, 2, 1, 2] },
      { bass: 40, pad: [59, 64, 67], melody: [0, 2, 1, 4, 2, 3, 2, 0] },
      { bass: 48, pad: [60, 64, 67], melody: [4, 2, 3, 2, 1, 2, 4, 2] },
    ],
  },
  // Playful, light puzzle/mood theme — F major: F – Dm – B♭ – C.
  mood_trial_loop: {
    bpm: 124,
    beatsPerBar: 4,
    bars: [
      { bass: 41, pad: [60, 65, 69], melody: [0, 2, 4, 2, 1, 2, 4, 2] },
      { bass: 38, pad: [62, 65, 69], melody: [2, 4, 2, 1, 4, 2, 3, 2] },
      { bass: 46, pad: [58, 62, 65], melody: [0, 1, 2, 4, 2, 3, 2, 4] },
      { bass: 48, pad: [60, 64, 67], melody: [4, 2, 1, 2, 0, 2, 4, 2] },
    ],
  },
  // Tense but melodic boss-trial theme — A minor: Am – F – C – E.
  warden_trial_loop: {
    bpm: 132,
    beatsPerBar: 4,
    bars: [
      { bass: 45, pad: [57, 60, 64], melody: [0, 2, 4, 2, 1, 2, 4, 3] },
      { bass: 41, pad: [57, 60, 65], melody: [2, 4, 2, 1, 4, 2, 3, 2] },
      { bass: 48, pad: [60, 64, 67], melody: [0, 2, 1, 4, 2, 3, 2, 4] },
      { bass: 40, pad: [56, 59, 64], melody: [4, 3, 2, 4, 2, 1, 2, 4] },
    ],
  },
};

function waveSample(kind, phase) {
  if (kind === "triangle") {
    return (2 / Math.PI) * Math.asin(Math.sin(phase));
  }

  return Math.sin(phase);
}

function envelope(time, duration) {
  const attack = Math.min(0.025, duration * 0.25);
  const release = Math.min(0.08, duration * 0.35);

  if (time < attack) {
    return time / attack;
  }

  if (time > duration - release) {
    return Math.max(0, (duration - time) / release);
  }

  return 1;
}

function renderSfx(spec) {
  const samples = new Float32Array(Math.ceil(spec.duration * sampleRate));

  for (const note of spec.notes) {
    const startSample = Math.floor(note.start * sampleRate);
    const noteSamples = Math.floor(note.duration * sampleRate);

    for (let i = 0; i < noteSamples && startSample + i < samples.length; i += 1) {
      const time = i / sampleRate;
      const vibrato = 1 + Math.sin(twoPi * 5 * time) * 0.003;
      const phase = twoPi * note.frequency * vibrato * time;
      samples[startSample + i] +=
        waveSample(note.wave ?? "sine", phase) * note.gain * envelope(time, note.duration);
    }
  }

  return samples;
}

const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Add a voice to the buffer, wrapping past the loop point so trailing decays
// fold back onto the start — this keeps every loop perfectly seamless.
function addVoice(samples, startSample, durationSamples, frequency, wave, gain, shape) {
  for (let i = 0; i < durationSamples; i += 1) {
    const t = i / sampleRate;
    const dur = durationSamples / sampleRate;
    let env;

    if (shape === "pad") {
      env = Math.sin(Math.PI * (t / dur)); // smooth swell in and out
    } else if (shape === "bass") {
      env = Math.min(1, t / 0.012) * Math.exp(-t * 2.4); // soft, rounded pluck
    } else {
      env = Math.min(1, t / 0.006) * Math.exp(-t * 7); // bright music-box pluck
    }

    const vibrato = 1 + Math.sin(twoPi * 5.5 * t) * 0.0025;
    const phase = twoPi * frequency * vibrato * t;
    const idx = (startSample + i) % samples.length;
    samples[idx] += waveSample(wave, phase) * gain * env;
  }
}

function renderLoop(spec) {
  const beatDuration = 60 / spec.bpm;
  const barDuration = beatDuration * spec.beatsPerBar;
  const totalDuration = barDuration * spec.bars.length;
  const samples = new Float32Array(Math.ceil(totalDuration * sampleRate));
  const eighth = beatDuration / 2;

  spec.bars.forEach((bar, barIndex) => {
    const barStart = Math.floor(barIndex * barDuration * sampleRate);
    const extendedChord = [...bar.pad, ...bar.pad.map((note) => note + 12)];

    // Sustained pad chord under the whole bar.
    for (const note of bar.pad) {
      addVoice(
        samples,
        barStart,
        Math.floor(barDuration * sampleRate),
        midiToFreq(note),
        "triangle",
        0.05,
        "pad",
      );
    }

    // Warm bass note on the downbeat, ringing into the next bar.
    addVoice(
      samples,
      barStart,
      Math.floor(barDuration * 1.1 * sampleRate),
      midiToFreq(bar.bass),
      "sine",
      0.13,
      "bass",
    );

    // Music-box arpeggio melody, one note per eighth.
    bar.melody.forEach((step, eighthIndex) => {
      const note = extendedChord[step % extendedChord.length];
      addVoice(
        samples,
        barStart + Math.floor(eighthIndex * eighth * sampleRate),
        Math.floor(eighth * 1.6 * sampleRate),
        midiToFreq(note),
        "triangle",
        0.085,
        "pluck",
      );
    });
  });

  return samples;
}

function floatToPcm16(samples) {
  const data = Buffer.alloc(samples.length * 2);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(sample * 32_767), i * 2);
  }

  return data;
}

function wavBuffer(samples) {
  const pcm = floatToPcm16(samples);
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

await mkdir(outputDir, { recursive: true });

const writtenFiles = [];

for (const [id, spec] of Object.entries(sfxSpecs)) {
  const filePath = path.join(outputDir, `${id}.wav`);
  await writeFile(filePath, wavBuffer(renderSfx(spec)));
  writtenFiles.push(filePath);
}

for (const [id, spec] of Object.entries(loopSpecs)) {
  const filePath = path.join(outputDir, `${id}.wav`);
  await writeFile(filePath, wavBuffer(renderLoop(spec)));
  writtenFiles.push(filePath);
}

for (const filePath of writtenFiles) {
  console.log(path.relative(process.cwd(), filePath));
}
