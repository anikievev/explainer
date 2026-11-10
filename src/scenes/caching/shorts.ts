/**
 * Vertical Shorts cut from the full "How Caching Works" render. Times are
 * looked up from cue text (like beats.ts), so they follow `npm run retime`;
 * each Short starts and ends on a cue boundary and stays under 60 s.
 *
 * Every Short opens on its problem or payoff (`open`), never on setup: in the
 * first uploads 86–91% of feed viewers swiped away within the first seconds.
 */
import type { Short } from '../../components/Script.ts';
import { CUES } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
/** Start a little before the cue, end a little after it, so no word is clipped. */
const from = (fragment: string) => cue(fragment).start - 0.3;
const to = (fragment: string) => cue(fragment).end + 0.8;
const at = (fragment: string) => cue(fragment).start;
/** One or more whole cues, for a cold open. */
const clip = (first: string, last = first) => ({ start: from(first), end: cue(last).end + 0.2 });

const GREEN = '#34d399';
const YELLOW = '#fbbf24';
const RED = '#f87171';
const BLUE = '#38bdf8';
const PURPLE = '#a78bfa';

export const SHORTS: Short[] = [
  {
    slug: 'cache-hit-vs-miss',
    question: 'What do you cache in your app?',
    // Open on the problem: the database drowning in identical questions.
    open: clip('During a sale', 'What if we just remembered'),
    start: from('A server checks the cache first'),
    end: to('The more hits you get'),
    hook: 'The first visitor pays. Everyone after is instant.',
    // The three trips of a miss, labelled on the arcs.
    cover: at('A miss costs three trips') + 3,
    beats: [
      { at: at('A server checks the cache first'), text: 'Check the cache first', color: BLUE },
      { at: at("The first time, product 42 isn't there"), text: 'Miss', color: RED },
      { at: at('So the server asks the database, and then saves'), text: 'Load, then store', color: PURPLE },
      { at: at('But the next visitor finds it'), text: 'Hit', color: GREEN },
      { at: at('The more hits you get'), text: 'Watch the hit ratio', color: GREEN },
    ],
    title: 'Cache hit vs. cache miss in 45 seconds',
    description:
      'Cache-aside: a server checks the cache first. On a miss it asks the database and stores the answer, so a miss costs three trips. Everyone after that gets a hit straight from memory. The share of hits is your hit ratio.',
    hashtags: ['#systemdesign', '#caching', '#redis'],
  },
  {
    slug: 'your-cache-shows-the-wrong-price',
    question: 'How do you keep cached data fresh: a TTL, or delete on write?',
    // Open on the payoff: the shopper sees the old price.
    open: clip('So shoppers see the wrong price'),
    start: from("But there's a catch"),
    end: to('So when the price changes, you can delete'),
    hook: 'Your cache is showing the wrong price.',
    // The shopper's card at €49 while the database says €39.
    cover: at('So shoppers see the wrong price') + 1.5,
    beats: [
      { at: at("But there's a catch"), text: 'Price drops in the database', color: BLUE },
      { at: at('The database has the new price'), text: 'Cache keeps the old one', color: YELLOW },
      { at: at('The simplest safety net'), text: 'TTL: keys expire', color: YELLOW },
      { at: at('So when the price changes, you can delete'), text: 'Or delete on write', color: GREEN },
    ],
    title: 'Why your cache shows the wrong price (stale data and TTL)',
    description:
      'The price changes in the database, but the cache still has the old one: stale data. A TTL makes each key expire after a set time. Deleting the key when the price changes makes the next read load the new one.',
    hashtags: ['#systemdesign', '#caching', '#backend'],
  },
  {
    slug: 'redis-doesnt-evict-by-default',
    question: 'Which maxmemory-policy does your Redis run with?',
    // Start on the surprise itself; the full memory meter and OOM badge give the context.
    start: from('By default, Redis evicts nothing'),
    end: to("Redis doesn't track that exactly"),
    hook: 'Redis is full. Now writes fail.',
    // The rejected write: "✗ OOM · write rejected" over a full cache.
    cover: at('By default, Redis evicts nothing') + 2.5,
    beats: [
        { at: at('By default, Redis evicts nothing'), text: 'Default: noeviction', color: RED },
      { at: at("That's why most teams pick an eviction policy"), text: 'Pick allkeys-lru', color: PURPLE },
      { at: at("Redis doesn't track that exactly"), text: 'LRU is approximated', color: PURPLE },
    ],
    title: "Redis doesn't evict by default: what happens when the cache is full",
    description:
      "Redis's default maxmemory-policy is noeviction: when memory is full, writes return an error and reads still work. Most teams pick a policy like allkeys-lru. Redis approximates LRU by sampling a few keys and evicting the one idle longest.",
    hashtags: ['#redis', '#systemdesign', '#caching'],
  },
  {
    slug: 'one-key-expired-cache-stampede',
    question: 'Ever had one expired key flood your database?',
    // Open on the stampede, then show how it happened.
    open: clip('In that moment, every request misses'),
    start: from('Product 42 is the hottest key'),
    end: to('The fix is request coalescing'),
    hook: 'One key expired. Every request hit the database.',
    // The stampede: red requests slamming the database.
    cover: at('In that moment, every request misses') + 1.6,
    beats: [
      { at: at('Product 42 is the hottest key'), text: 'Hot key, TTL runs out', color: YELLOW },
      { at: at('In that moment, every request misses'), text: 'Every request misses', color: RED },
      { at: at("That's also called a cache stampede"), text: 'Cache stampede', color: RED },
      { at: at('The fix is request coalescing'), text: 'Fix: request coalescing', color: GREEN },
    ],
    title: 'Cache stampede: one expired key vs. your database',
    description:
      'A hot key expires and every request misses at the same moment, so they all hit the database at once: a thundering herd, or cache stampede. The fix is request coalescing: only one request goes to the database, and the others wait for its answer.',
    hashtags: ['#systemdesign', '#caching', '#backend'],
  },
];
