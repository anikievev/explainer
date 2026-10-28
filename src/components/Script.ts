/**
 * Narration and packaging types shared by every episode. Pure data, no
 * three.js, so Node scripts (voiceover, shorts, record) can import it too.
 */

export interface Cue {
  start: number;
  end: number;
  text: string;
  /** Spoken form for the voiceover, when the caption text reads badly aloud. */
  say?: string;
}

export interface Section {
  start: number;
  end: number;
  index: string;
  title: string;
}

export interface Beat {
  /** Video time (s) the step appears; it stays until the next one. */
  at: number;
  text: string;
  /** CSS hex color, following the video's color language. */
  color: string;
}

export interface Short {
  slug: string;
  /** Video time range in seconds. */
  start: number;
  end: number;
  /** Big on-screen title, shown for the whole Short. */
  hook: string;
  /** YouTube title (≤ 100 characters, #Shorts added automatically). */
  title: string;
  description: string;
  hashtags: string[];
  /** Optional step pill under the title (list progress, HIT → MISS). */
  beats?: Beat[];
}

export function findCue(cues: Cue[], t: number): Cue | undefined {
  return cues.find((c) => t >= c.start && t < c.end);
}

export function findSection(sections: Section[], t: number): Section {
  return sections.find((s) => t >= s.start && t < s.end) ?? sections[sections.length - 1];
}

const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
};

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}
