/**
 * The channel's sound-effect library: one short, quiet accent per kind of
 * on-screen event. Generated once by `npm run sfx` into src/assets/sfx/.
 * `gain` is the default mix level under the narration (linear).
 */
export const SFX = {
  /** Camera moves and cuts between Short segments. */
  whoosh: { prompt: 'Short soft airy whoosh transition, clean, modern tech explainer video', duration: 0.8, gain: 0.28 },
  /** A label, badge or step pill appears. */
  pop: { prompt: 'Soft subtle UI pop click, modern interface, clean and short', duration: 0.5, gain: 0.7 },
  /** Many keys or packets flying at once. */
  scatter: { prompt: 'Many tiny digital blips scattering quickly, data particles flying, light and playful', duration: 2.0, gain: 0.35 },
  /** A counter or warning badge lands ("80% MOVED"). */
  alert: { prompt: 'Short two-tone alert chime, attention grabbing but not alarming, interface sound', duration: 0.8, gain: 0.3 },
  /** Something fails or overloads (red state). */
  error: { prompt: 'Soft low digital error buzz, short, user interface', duration: 0.6, gain: 0.3 },
  /** A fix works (green state). */
  success: { prompt: 'Bright short success chime, user interface, positive', duration: 0.8, gain: 0.6 },
} as const;

export type SfxName = keyof typeof SFX;

/** One sound at a video time (seconds), optionally louder or quieter than its default. */
export interface SfxCue {
  at: number;
  sound: SfxName;
  gain?: number;
}
