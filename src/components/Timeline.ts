/**
 * Pure time helpers. Every animated value in a scene is a function of the
 * global time `t` (seconds), so any frame can be rendered in isolation.
 */

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k: number) => k * k * k;
export const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

/** Linear 0→1 progress of `t` through [start, end]. */
export const progress = (t: number, start: number, end: number) => clamp((t - start) / (end - start));

/** Eased 0→1 progress of `t` through [start, end]. */
export const ramp = (t: number, start: number, end: number, ease = easeInOut) => ease(progress(t, start, end));

/**
 * Visibility envelope: fades in over [start, start+fade], holds, fades out
 * over [end-fade, end]. Returns 0..1.
 */
export const fadeWindow = (t: number, start: number, end: number, fade = 0.5) => {
  if (t <= start || t >= end) return 0;
  return Math.min(ramp(t, start, start + fade), 1 - ramp(t, end - fade, end));
};

/** True while t is inside [start, end). */
export const within = (t: number, start: number, end: number) => t >= start && t < end;

/** Smooth 0→1→0 pulse with the given period, phase-locked to t. */
export const pulse = (t: number, period = 1.5) => 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2);

/** Interpolate between numeric keyframes [time, value], eased per segment. */
export function keyframes(t: number, frames: Array<[number, number]>, ease = easeInOut): number {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      return lerp(v0, v1, ease(progress(t, t0, t1)));
    }
  }
  return frames[frames.length - 1][1];
}
