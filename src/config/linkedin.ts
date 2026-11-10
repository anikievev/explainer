/**
 * LinkedIn series: every post starts with "System design, animated #N:", so
 * regulars recognise it in the feed. N is the posting order below, across
 * episodes; `npm run shorts -- --linkedin` fails for a Short with a `linkedin`
 * post that isn't listed here.
 */
export const LINKEDIN_SERIES = 'System design, animated';

/** Posting order as "<episode id>/<short slug>". Append new posts; never reorder posted ones. */
export const LINKEDIN_ORDER = [
  'caching/one-key-expired-cache-stampede',
  'replication/split-brain-two-primaries',
  'sharding/never-shard-by-timestamp',
  'caching/redis-doesnt-evict-by-default',
  'replication/sync-vs-async-replication',
  'sharding/add-one-server-move-80-percent',
  'load-balancer/why-sticky-sessions-hurt',
];

/** "System design, animated #3" for a Short, or an error if it isn't scheduled. */
export function linkedinLabel(episodeId: string, slug: string): string {
  const n = LINKEDIN_ORDER.indexOf(`${episodeId}/${slug}`);
  if (n < 0) throw new Error(`${episodeId}/${slug} has a linkedin post but isn't in LINKEDIN_ORDER (src/config/linkedin.ts)`);
  return `${LINKEDIN_SERIES} #${n + 1}`;
}
