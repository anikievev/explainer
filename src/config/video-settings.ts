export interface VideoSettings {
  width: number;
  height: number;
  fps: number;
}

export const RESOLUTIONS = {
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
} as const;

export type ResolutionName = keyof typeof RESOLUTIONS;

/** Reference height that all 2D overlay sizes are authored against. */
export const DESIGN_HEIGHT = 1080;

export const DEFAULT_FPS = 30;

export function getVideoSettings(resolution: ResolutionName = '1080p', fps = DEFAULT_FPS): VideoSettings {
  return { ...RESOLUTIONS[resolution], fps };
}
