/**
 * Tiny Web Audio synth for UI feedback — no audio assets. The context is
 * created/resumed lazily on the first user gesture (browser autoplay policy),
 * and everything no-ops silently when muted or not yet unlocked.
 */

let ctx: AudioContext | null = null;

const STORAGE_KEY = "mitm-sound";

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "off";
  } catch {
    return false;
  }
}

export function persistMuted(muted: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
  } catch {
    // storage blocked; preference just won't persist
  }
}

/** Call on pointerdown/keydown; safe to call repeatedly. */
export function initAudio() {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function playTone(
  at: number,
  freq: number,
  dur: number,
  peak: number,
  type: OscillatorType = "triangle",
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/**
 * Crisp two-note "the spot settled" chime: a short high square transient for
 * the attack, then a warm triangle interval (E6 → B6). Quiet by design.
 */
export function playSpotChime() {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.01;
  playTone(t, 2637, 0.05, 0.045, "square"); // crisp tick (E7)
  playTone(t, 1318.5, 0.16, 0.1); // E6 body
  playTone(t + 0.09, 1975.5, 0.22, 0.1); // B6 sparkle
}
