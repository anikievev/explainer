/**
 * "How Caching Works" — narration script. Times are in seconds and drive
 * the animation beats, the voiceover placement and the exported .srt captions.
 * Timings come from the measured voiceover clips: natural length + 0.7 s, plus
 * `hold` where the animation needs time. Re-lock after editing text with
 * `npm run voiceover -- --episode caching && npm run retime -- --episode caching`.
 */
import type { Cue, Section } from '../../components/Script.ts';
import { findCue, findSection, toSrt as cuesToSrt } from '../../components/Script.ts';

export const DURATION = 353;

export const SECTIONS: Section[] = [
  { start: 0, end: 20.7, index: "", title: "Hook" },
  { start: 20.7, end: 56.9, index: "1", title: "The problem: the same question" },
  { start: 56.9, end: 126.9, index: "2", title: "What a cache does" },
  { start: 126.9, end: 198, index: "3", title: "Stale data and TTL" },
  { start: 198, end: 236.4, index: "4", title: "When the cache is full" },
  { start: 236.4, end: 316.5, index: "5", title: "Three traps" },
  { start: 316.5, end: 353, index: "✓", title: "Recap" },
];

export const CUES: Cue[] = [
  // Hook
  { start: 0.3, end: 5.9, text: "A sale starts. Thousands of people open the same product page.", hold: 0.5 },
  { start: 5.9, end: 10.4, text: "And every single visit asks the database the same question." },
  { start: 10.4, end: 15.7, text: "Again, and again, until the database can't keep up.", hold: 1.0 },
  { start: 15.7, end: 19.5, text: "The fix is a cache. Let's see how it works." },

  // The problem: the same question
  { start: 21, end: 26.3, text: "Two episodes ago, a load balancer spread visitors across many servers." },
  { start: 26.3, end: 29.9, text: "But behind them, they all share one database." },
  { start: 29.9, end: 35.7, text: "Every time someone opens product 42, a server asks the database for it." },
  { start: 35.7, end: 42.4, text: "The answer is the same each time. The price hasn't changed. The photos haven't changed.", hold: 0.5 },
  { start: 42.4, end: 46.8, text: "But the database does the full work, every time.", hold: 0.5 },
  { start: 46.8, end: 53, text: "During a sale, that's thousands of identical questions, all at once.", hold: 1.0 },
  { start: 53, end: 55.7, text: "What if we just remembered the answer?" },

  // What a cache does
  { start: 57.2, end: 63.9, text: "That's a cache: a small, fast store that keeps answers in memory, right next to your servers." },
  { start: 63.9, end: 70.2, text: "Redis and Memcached are two popular ones. They store data as keys and values." },
  { start: 70.2, end: 75.3, text: "The most common pattern is called cache-aside, or lazy loading." },
  { start: 75.3, end: 78, text: "A server checks the cache first." },
  { start: 78, end: 83.7, text: "The first time, product 42 isn't there. That's a cache miss." },
  { start: 83.7, end: 91.2, text: "So the server asks the database, and then saves the answer in the cache, under the key product 42.", hold: 0.5 },
  { start: 91.2, end: 98, text: "A miss costs three trips: to the cache, to the database, and back to the cache.", hold: 0.5 },
  { start: 98, end: 102.7, text: "But the next visitor finds it right away. That's a cache hit." },
  { start: 102.7, end: 109.7, text: "No database involved. Amazon says its ElastiCache service answers in microseconds.", say: "No database involved. Amazon says its Elasti-Cache service answers in microseconds." },
  { start: 109.7, end: 118.8, text: "The more hits you get, the less work the database does. That share is your hit ratio, and it's the number to watch.", hold: 1.0 },
  { start: 118.8, end: 125.7, text: "And you've seen this idea before: a CDN is a cache too, just placed close to your users.", say: "And you've seen this idea before: a C D N is a cache too, just placed close to your users." },

  // Stale data and TTL
  { start: 127.2, end: 133.7, text: "But there's a catch. The price of product 42 drops from 49 to 39." },
  { start: 133.7, end: 139.2, text: "The database has the new price. The cache still has the old one.", hold: 0.5 },
  { start: 139.2, end: 143.6, text: "So shoppers see the wrong price. That's stale data." },
  { start: 143.6, end: 151.5, text: "The simplest safety net is a time to live, or TTL. Each key expires after a set time.", say: "The simplest safety net is a time to live, or T T L. Each key expires after a set time." },
  { start: 151.5, end: 157.1, text: "When it's gone, the next read is a miss, and the fresh price gets loaded.", hold: 0.5 },
  { start: 157.1, end: 164.4, text: "In Redis, expired keys are removed when someone reads them, and by a regular check of random keys." },
  { start: 164.4, end: 169, text: "But until the timer runs out, the old price can still show up." },
  { start: 169, end: 175.3, text: "So when the price changes, you can delete the key right away. The next read loads the new one." },
  { start: 175.3, end: 181.5, text: "Or use write-through: every time the database is written, the cache is updated too." },
  { start: 181.5, end: 187.9, text: "Then the cache is never stale. But it also fills up with data nobody reads.", hold: 0.5 },
  { start: 187.9, end: 196.8, text: "Most teams add a TTL either way. As Amazon's docs put it, that still doesn't guarantee a value isn't stale.", say: "Most teams add a T T L either way. As Amazon's docs put it, that still doesn't guarantee a value isn't stale.", hold: 0.5 },

  // When the cache is full
  { start: 198.3, end: 202.8, text: "A cache lives in memory, and memory runs out." },
  { start: 202.8, end: 206, text: "So what happens when it's full?" },
  { start: 206, end: 213.7, text: "By default, Redis evicts nothing. New writes just fail with an error. Reads still work.", hold: 0.5 },
  { start: 213.7, end: 219.4, text: "That's why most teams pick an eviction policy, like all keys LRU.", say: "That's why most teams pick an eviction policy, like all keys L R U." },
  { start: 219.4, end: 228.4, text: "LRU means least recently used: the key nobody has asked for in the longest time gets removed to make room.", say: "L R U means least recently used: the key nobody has asked for in the longest time gets removed to make room.", hold: 0.5 },
  { start: 228.4, end: 235.2, text: "Redis doesn't track that exactly. It samples a few keys and evicts the one idle the longest." },

  // Three traps
  { start: 236.7, end: 239.2, text: "Caches have their own traps." },
  { start: 239.2, end: 242.1, text: "First: the thundering herd." },
  { start: 242.1, end: 248.2, text: "Product 42 is the hottest key in the shop. Then its TTL runs out.", say: "Product 42 is the hottest key in the shop. Then its T T L runs out." },
  { start: 248.2, end: 255, text: "In that moment, every request misses, and they all hit the database at once.", hold: 1.5 },
  { start: 255, end: 258.7, text: "That's also called a cache stampede." },
  { start: 258.7, end: 268.6, text: "The fix is request coalescing: only one request goes to the database. The others wait for its answer.", hold: 1.0 },
  { start: 268.6, end: 271.8, text: "Second: things that don't exist." },
  { start: 271.8, end: 278.7, text: "Someone keeps asking for product 404. It's not in the database, so it's never in the cache.", say: "Someone keeps asking for product four oh four. It's not in the database, so it's never in the cache." },
  { start: 278.7, end: 283, text: "Every one of those requests goes straight to the database.", hold: 0.5 },
  { start: 283, end: 290.1, text: "So cache the answer 'not found' too, with its own short TTL. That's a negative cache.", say: "So cache the answer, not found, too, with its own short T T L. That's a negative cache." },
  { start: 290.1, end: 294.8, text: "Third: the cache becomes something you depend on." },
  { start: 294.8, end: 304.7, text: "When a cache node restarts, it starts empty. Every request misses, and the database takes the full load again.", hold: 1.0 },
  { start: 304.7, end: 315.3, text: "So plan for that cold start. And if the database goes down, you can keep serving slightly old data for a while, until a hard limit runs out.", hold: 1.0 },

  // Recap
  { start: 316.8, end: 318.3, text: "Let's recap." },
  { start: 318.3, end: 323.9, text: "A cache keeps answers in memory, so most reads never reach the database." },
  { start: 323.9, end: 330.6, text: "Every cached answer can go stale, so use a TTL, and update or delete on write.", say: "Every cached answer can go stale, so use a T T L, and update or delete on write." },
  { start: 330.6, end: 337.4, text: "Pick an eviction policy, and protect the database from stampedes, missing keys and cold starts." },
  { start: 337.4, end: 345.5, text: "Next up: replication. A cache helps with reads, but what happens when the database itself goes down?" },
  { start: 345.5, end: 349, text: "What do you cache in your app? Tell me below." },
];

export const cueAt = (t: number) => findCue(CUES, t);
export const sectionAt = (t: number) => findSection(SECTIONS, t);
export const toSrt = () => cuesToSrt(CUES);
