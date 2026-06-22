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

const loopSpecs = {
  hub_loop: {
    duration: 8,
    layers: [
      { frequency: 196, gain: 0.1, wave: "sine" },
      { frequency: 293.66, gain: 0.08, wave: "sine" },
      { frequency: 392, gain: 0.06, wave: "triangle" },
    ],
    pulse: 0.14,
  },
  region_map_loop: {
    duration: 8,
    layers: [
      { frequency: 174.61, gain: 0.08, wave: "triangle" },
      { frequency: 261.63, gain: 0.08, wave: "sine" },
      { frequency: 349.23, gain: 0.07, wave: "sine" },
      { frequency: 523.25, gain: 0.04, wave: "triangle" },
    ],
    pulse: 0.18,
  },
  mood_trial_loop: {
    duration: 6,
    layers: [
      { frequency: 220, gain: 0.09, wave: "sine" },
      { frequency: 329.63, gain: 0.08, wave: "triangle" },
      { frequency: 440, gain: 0.05, wave: "sine" },
    ],
    pulse: 0.22,
  },
  warden_trial_loop: {
    duration: 6,
    layers: [
      { frequency: 146.83, gain: 0.11, wave: "triangle" },
      { frequency: 220, gain: 0.08, wave: "sine" },
      { frequency: 277.18, gain: 0.06, wave: "triangle" },
      { frequency: 440, gain: 0.04, wave: "sine" },
    ],
    pulse: 0.24,
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

function renderLoop(spec) {
  const samples = new Float32Array(Math.ceil(spec.duration * sampleRate));

  for (let i = 0; i < samples.length; i += 1) {
    const time = i / sampleRate;
    const loopPosition = time / spec.duration;
    const loopFade = Math.sin(Math.PI * loopPosition);
    const pulse = 1 + Math.sin(twoPi * spec.pulse * time) * 0.18;
    let value = 0;

    for (const layer of spec.layers) {
      const drift = 1 + Math.sin(twoPi * 0.07 * time + layer.frequency * 0.01) * 0.002;
      value +=
        waveSample(layer.wave, twoPi * layer.frequency * drift * time) *
        layer.gain *
        pulse *
        (0.72 + loopFade * 0.28);
    }

    samples[i] = value;
  }

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
