/**
 * Every episode the pipeline can render, voice and cut into Shorts.
 * Pure data (no three.js) so the Node scripts can import it; the matching
 * scene classes are registered in main.ts under the same id.
 *
 *   node src/scripts/record.ts --episode cdn
 */
import type { Cue, Short } from '../components/Script.ts';
import { CUES as CDN_CUES, DURATION as CDN_DURATION } from './cdn/script.ts';
import { SHORTS as CDN_SHORTS } from './cdn/shorts.ts';

export interface Episode {
  id: string;
  /** Base name for every output file, e.g. how-a-cdn-works-1080p.mp4. */
  slug: string;
  title: string;
  /** Small label above the title in Shorts. */
  kicker: string;
  duration: number;
  cues: Cue[];
  shorts: Short[];
}

export const EPISODES: Record<string, Episode> = {
  cdn: {
    id: 'cdn',
    slug: 'how-a-cdn-works',
    title: 'How a CDN Works',
    kicker: 'HOW A CDN WORKS',
    duration: CDN_DURATION,
    cues: CDN_CUES,
    shorts: CDN_SHORTS,
  },
};

/** Used when no --episode / ?episode= is given: the latest one. */
export const DEFAULT_EPISODE = 'cdn';

export function getEpisode(id: string = DEFAULT_EPISODE): Episode {
  const episode = EPISODES[id];
  if (!episode) throw new Error(`Unknown episode "${id}". Known: ${Object.keys(EPISODES).join(', ')}`);
  return episode;
}
