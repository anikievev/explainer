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
import { CUES as LB_CUES, DURATION as LB_DURATION } from './load-balancer/script.ts';
import { SHORTS as LB_SHORTS } from './load-balancer/shorts.ts';
import { CUES as MQ_CUES, DURATION as MQ_DURATION } from './message-queue/script.ts';
import { SHORTS as MQ_SHORTS } from './message-queue/shorts.ts';
import { CUES as CACHE_CUES, DURATION as CACHE_DURATION } from './caching/script.ts';
import { SHORTS as CACHE_SHORTS } from './caching/shorts.ts';
import { CUES as REPL_CUES, DURATION as REPL_DURATION } from './replication/script.ts';
import { SHORTS as REPL_SHORTS } from './replication/shorts.ts';
import { CUES as SHARD_CUES, DURATION as SHARD_DURATION } from './sharding/script.ts';
import { SHORTS as SHARD_SHORTS } from './sharding/shorts.ts';

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
  /** Cue times are locked to the voiceover by `npm run retime`. */
  autoTimed?: boolean;
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
  'load-balancer': {
    id: 'load-balancer',
    slug: 'how-load-balancers-work',
    title: 'How Load Balancers Work',
    kicker: 'HOW LOAD BALANCERS WORK',
    duration: LB_DURATION,
    cues: LB_CUES,
    shorts: LB_SHORTS,
    autoTimed: true,
  },
  'message-queue': {
    id: 'message-queue',
    slug: 'how-message-queues-work',
    title: 'How Message Queues Work',
    kicker: 'HOW MESSAGE QUEUES WORK',
    duration: MQ_DURATION,
    cues: MQ_CUES,
    shorts: MQ_SHORTS,
    autoTimed: true,
  },
  caching: {
    id: 'caching',
    slug: 'how-caching-works',
    title: 'How Caching Works',
    kicker: 'HOW CACHING WORKS',
    duration: CACHE_DURATION,
    cues: CACHE_CUES,
    shorts: CACHE_SHORTS,
    autoTimed: true,
  },
  replication: {
    id: 'replication',
    slug: 'how-database-replication-works',
    title: 'How Database Replication Works',
    kicker: 'HOW REPLICATION WORKS',
    duration: REPL_DURATION,
    cues: REPL_CUES,
    shorts: REPL_SHORTS,
    autoTimed: true,
  },
  sharding: {
    id: 'sharding',
    slug: 'how-database-sharding-works',
    title: 'How Database Sharding Works',
    kicker: 'HOW SHARDING WORKS',
    duration: SHARD_DURATION,
    cues: SHARD_CUES,
    shorts: SHARD_SHORTS,
    autoTimed: true,
  },
};

/** Used when no --episode / ?episode= is given: the latest one. */
export const DEFAULT_EPISODE = 'cdn';

export function getEpisode(id: string = DEFAULT_EPISODE): Episode {
  const episode = EPISODES[id];
  if (!episode) throw new Error(`Unknown episode "${id}". Known: ${Object.keys(EPISODES).join(', ')}`);
  return episode;
}
