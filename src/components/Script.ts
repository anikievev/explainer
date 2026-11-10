import type { SfxCue } from '../config/sfx.ts';
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
  /** Extra silence (s) after the line, where the animation needs time. Used by retime. */
  hold?: number;
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
  /**
   * Cold open: a few seconds of the payoff (video time range) played before
   * `start`, so the first second already shows why to keep watching. Most
   * feed viewers decide to swipe in that first second.
   */
  open?: { start: number; end: number };
  /**
   * A line spoken only in the Short (synthesized with the episode voice),
   * played after the cold open and before the main clip, over footage from
   * video time `at`. Use it when the main clip leans on setup the Short cuts
   * out ("The old primary comes back" needs "the primary died first").
   */
  intro?: { say: string; at: number };
  /** Big on-screen title, shown for the whole Short. */
  hook: string;
  /** YouTube title (≤ 100 characters, #Shorts added automatically). */
  title: string;
  description: string;
  hashtags: string[];
  /** Comment prompt for the Instagram caption, specific to this clip. */
  question?: string;
  /**
   * LinkedIn post body. Only Shorts with one are cut for LinkedIn (`--linkedin`):
   * the failure and trade-off clips, never "what is X". Lead with the failure,
   * explain in short paragraphs, end with a question. Every claim must be in the
   * episode script. The link line and hashtags are added automatically.
   */
  linkedin?: string;
  /** Optional step pill under the title (list progress, HIT → MISS). */
  beats?: Beat[];
  /** Video time (s) of the cover frame, used as the Short's thumbnail. Default: 2 s into the first beat, else 4 s in. */
  cover?: number;
  /**
   * Sound accents (video times), mixed quietly under the narration. With
   * `beatSounds`, every step-pill change also gets a pop and every cut a whoosh.
   */
  sfx?: SfxCue[];
  beatSounds?: boolean;
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
