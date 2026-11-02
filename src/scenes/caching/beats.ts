/**
 * Beat times, looked up from the narration by text so the animation follows
 * the script after `npm run retime`. Every value is the start (or end) of the
 * cue that contains the fragment.
 */
import { CUES, SECTIONS } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
const at = (fragment: string) => cue(fragment).start;
const end = (fragment: string) => cue(fragment).end;
const section = (index: string) => SECTIONS.find((s) => s.index === index)!.start;

export const B = {
  // Hook
  sale: at('A sale starts'),
  same: at('And every single visit'),
  again: at('Again, and again'),
  fix: at('The fix is a cache'),

  // 1 · The problem
  s1: section('1'),
  lbAgo: at('Two episodes ago'),
  share: at('But behind them, they all share'),
  asks: at('Every time someone opens product 42'),
  sameAnswer: at('The answer is the same each time'),
  fullWork: at('But the database does the full work'),
  thousands: at("During a sale, that's thousands"),
  remember: at('What if we just remembered'),

  // 2 · What a cache does
  s2: section('2'),
  cacheIs: at("That's a cache: a small"),
  vendors: at('Redis and Memcached'),
  aside: at('The most common pattern'),
  checks: at('A server checks the cache first'),
  miss: at("The first time, product 42 isn't there"),
  fill: at('So the server asks the database, and then saves'),
  trips: at('A miss costs three trips'),
  hit: at('But the next visitor finds it'),
  micro: at('No database involved'),
  ratio: at('The more hits you get'),
  cdn: at("And you've seen this idea before"),

  // 3 · Stale data and TTL
  s3: section('3'),
  priceDrop: at("But there's a catch"),
  oldOne: at('The database has the new price'),
  wrong: at('So shoppers see the wrong price'),
  ttl: at('The simplest safety net'),
  expires: at("When it's gone, the next read"),
  redisExpiry: at('In Redis, expired keys'),
  untilTimer: at('But until the timer runs out'),
  deleteKey: at('So when the price changes, you can delete'),
  writeThrough: at('Or use write-through'),
  neverStale: at('Then the cache is never stale'),
  ttlEither: at('Most teams add a TTL either way'),

  // 4 · When the cache is full
  s4: section('4'),
  memory: at('A cache lives in memory'),
  full: at("So what happens when it's full"),
  noEvict: at('By default, Redis evicts nothing'),
  policy: at("That's why most teams pick an eviction policy"),
  lru: at('LRU means least recently used'),
  sample: at("Redis doesn't track that exactly"),

  // 5 · Traps
  s5: section('5'),
  traps: at('Caches have their own traps'),
  herd: at('First: the thundering herd'),
  hot: at('Product 42 is the hottest key'),
  stampede: at('In that moment, every request misses'),
  stampedeName: at("That's also called a cache stampede"),
  coalesce: at('The fix is request coalescing'),
  missing: at("Second: things that don't exist"),
  p404: at('Someone keeps asking for product 404'),
  straight: at('Every one of those requests goes straight'),
  negative: at("So cache the answer 'not found' too"),
  depend: at('Third: the cache becomes something'),
  restart: at('When a cache node restarts'),
  coldPlan: at('So plan for that cold start'),
  s5End: end('So plan for that cold start'),

  // Recap
  recap: section('✓'),
  recap1: at('A cache keeps answers in memory'),
  recap2: at('Every cached answer can go stale'),
  recap3: at('Pick an eviction policy'),
  next: at('Next up: replication'),
  ask: at('What do you cache in your app'),
};
