// Sound for Tidy, generated live with the Web Audio API (no audio files to download).
// Effects: a soft "poof" when a pile clears, a small puff when it shrinks, a chime on unlocks.
// Music: a slow, calm ambient loop of soft pad chords and the odd gentle pluck.

let ctx = null;
let master = null;
let fxBus = null;
let musicBus = null;
let reverb = null;
let effectsOn = true;

export function setEffects(on) { effectsOn = on; }
export const effectsEnabled = () => effectsOn;

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(master);

    fxBus = ctx.createGain();
    fxBus.gain.value = 0.7;
    fxBus.connect(master);
    fxBus.connect(reverb);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0;
    musicBus.connect(master);
    musicBus.connect(reverb);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// A simple reverb tail made from fading noise.
function impulse(seconds, decay) {
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(2, rate * seconds, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
  }
  return buf;
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/* ---------------- effects ---------------- */

// Soft airy whoosh with a low thump underneath.
function poofSound(volume, length, startFreq) {
  if (!effectsOn) return;
  ensure();
  const t = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(length);
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(startFreq, t);
  band.frequency.exponentialRampToValueAtTime(220, t + length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(volume, t + 0.03);
  env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  noise.connect(band).connect(env).connect(fxBus);
  noise.start(t);
  noise.stop(t + length);

  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(180, t);
  thump.frequency.exponentialRampToValueAtTime(60, t + 0.25);
  const tEnv = ctx.createGain();
  tEnv.gain.setValueAtTime(0.0001, t);
  tEnv.gain.exponentialRampToValueAtTime(volume * 0.6, t + 0.01);
  tEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  thump.connect(tEnv).connect(fxBus);
  thump.start(t);
  thump.stop(t + 0.32);
}

// Squishy sounds. A foam squishy makes a soft crackle as air escapes thousands of tiny foam cells,
// so the sound is built from many tiny, quiet "pops" of noise (no thump, no long hiss, no echo).
let squishBus = null;
let grainBuffer = null;

function squishOut() {
  ensure();
  if (!squishBus) {
    squishBus = ctx.createGain();
    squishBus.gain.value = 0.9;
    const soften = ctx.createBiquadFilter();             // roll off harsh highs
    soften.type = "lowpass";
    soften.frequency.value = 5200;
    squishBus.connect(soften).connect(master);           // dry: no reverb, so it never sounds like a wave
    grainBuffer = noiseBuffer(0.05);
  }
  return squishBus;
}

// One tiny pop of foam: a few milliseconds of band-passed noise.
function grain(at, freq, volume, length) {
  const src = ctx.createBufferSource();
  src.buffer = grainBuffer;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 2.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(volume, at + length * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(f).connect(g).connect(squishBus);
  src.start(at, Math.random() * 0.03);
  src.stop(at + length + 0.01);
}

// A cloud of pops spread over `duration`, denser and louder near the start.
function crackle(start, duration, count, loudest, lowHz, highHz) {
  for (let k = 0; k < count; k++) {
    const p = Math.pow(Math.random(), 1.8);              // bunch the pops toward the start
    const at = start + p * duration;
    const fade = 1 - p * 0.85;
    grain(at, lowHz + Math.random() * (highHz - lowHz), loudest * fade * (0.4 + Math.random() * 0.6),
          0.004 + Math.random() * 0.008);
  }
}

export function squishPress() {
  if (!effectsOn) return;
  squishOut();
  const t = ctx.currentTime + 0.005;
  crackle(t, 0.5, 110, 0.16, 900, 3400);
  // A faint, soft rubbery creak underneath, the "skin" of the squishy stretching.
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(330, t);
  o.frequency.linearRampToValueAtTime(260, t + 0.3);
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 23;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 9;
  wobble.connect(wobbleDepth).connect(o.frequency);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.03, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(lp).connect(g).connect(squishBus);
  o.start(t); wobble.start(t);
  o.stop(t + 0.34); wobble.stop(t + 0.34);
}

export function squishRelease() {
  if (!effectsOn) return;
  squishOut();
  const t = ctx.currentTime + 0.005;
  crackle(t, 1.2, 55, 0.07, 1200, 3800);                 // air seeping back in as it slowly rises
}

export function poof() { poofSound(0.5, 0.65, 2400); }   // a whole pile clears
export function puff() { poofSound(0.22, 0.35, 1600); }  // a pile shrinks a little

// Two soft bell notes for unlocks and level-ups.
export function chime() {
  if (!effectsOn) return;
  ensure();
  const t = ctx.currentTime;
  [[659.25, 0], [987.77, 0.13]].forEach(([freq, delay]) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(0.18, t + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.4);
    o.connect(g).connect(fxBus);
    o.start(t + delay);
    o.stop(t + delay + 1.5);
  });
}

/* ---------------- calm background music ---------------- */

const CHORDS = [
  [130.81, 164.81, 196.0, 246.94],   // Cmaj7
  [110.0, 130.81, 164.81, 196.0],    // Am7
  [87.31, 130.81, 174.61, 220.0],    // Fmaj7
  [98.0, 146.83, 196.0, 246.94],     // G (add6 feel)
];
const PLUCKS = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C major pentatonic
const CHORD_SECONDS = 8;

let playing = false;
let timer = null;
let nextChordAt = 0;
let chordIndex = 0;

function pad(freq, start, length) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(0.05, start + 2.5);
  g.gain.setValueAtTime(0.05, start + length - 1);
  g.gain.linearRampToValueAtTime(0.0001, start + length + 2);
  filter.connect(g).connect(musicBus);
  [0, 4].forEach((detune, k) => {
    const o = ctx.createOscillator();
    o.type = k ? "triangle" : "sine";
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(filter);
    o.start(start);
    o.stop(start + length + 2.1);
  });
}

function pluck(freq, start) {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.06, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 2.2);
  o.connect(g).connect(musicBus);
  o.start(start);
  o.stop(start + 2.3);
}

// Schedule a little ahead of time so the music never stutters.
function schedule() {
  while (nextChordAt < ctx.currentTime + 2) {
    CHORDS[chordIndex].forEach((f) => pad(f, nextChordAt, CHORD_SECONDS));
    for (let beat = 0; beat < CHORD_SECONDS; beat += 1.6) {
      if (Math.random() < 0.45) pluck(PLUCKS[Math.floor(Math.random() * PLUCKS.length)], nextChordAt + beat + Math.random() * 0.3);
    }
    nextChordAt += CHORD_SECONDS;
    chordIndex = (chordIndex + 1) % CHORDS.length;
  }
}

export function startMusic() {
  ensure();
  if (playing) return;
  playing = true;
  nextChordAt = ctx.currentTime + 0.1;
  schedule();
  timer = setInterval(schedule, 1000);
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
}

export function stopMusic() {
  if (!playing) return;
  playing = false;
  clearInterval(timer);
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
}

export const musicPlaying = () => playing;
