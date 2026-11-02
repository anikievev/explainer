# How Caching Works — script

58 lines · 755 words · voiceover-locked runtime **5:53** (times below are the pre-voiceover estimates; `script.ts` has the real ones).
Facts: every number and vendor claim comes from the verified table in `PLAN.md` §2. Prices (49 → 39), product 42 and product 404 are *illustrative* and labelled "example" on screen.

## Hook

| ~Time | Narration | Visual |
|---|---|---|
| 0:00 | A sale starts. Thousands of people open the same product page. | Product page #42 on many phones; packets stream from app servers into one purple database |
| 0:06 | And every single visit asks the database the same question. | All arcs converge on the database; query counter starts spinning |
| 0:11 | Again, and again, until the database can't keep up. | DB load meter climbs to red; database flickers |
| 0:16 | The fix is a cache. Let's see how it works. | Title card: How Caching Works |

## The problem: the same question

| ~Time | Narration | Visual |
|---|---|---|
| 0:23 | Two episodes ago, a load balancer spread visitors across many servers. | Episode 2 stage: LB fanning out to 3 green servers |
| 0:28 | But behind them, they all share one database. | Camera pulls back: one purple database behind all servers |
| 0:33 | Every time someone opens product 42, a server asks the database for it. | One request: server → DB → server, label 'SELECT product 42' |
| 0:39 | The answer is the same each time. The price hasn't changed. The photos haven't changed. | Same answer card (#42 · €49) returns again and again |
| 0:47 | But the database does the full work, every time. | DB work indicator pulses per request |
| 0:52 | During a sale, that's thousands of identical questions, all at once. | Burst of packets; query counter spins; DB meter red |
| 0:58 | What if we just remembered the answer? | Freeze; mascot appears holding the answer card |

## What a cache does

| ~Time | Narration | Visual |
|---|---|---|
| 1:04 | That's a cache: a small, fast store that keeps answers in memory, right next to your servers. | Cache node drops in between servers and database |
| 1:12 | Redis and Memcached are two popular ones. They store data as keys and values. | Key slots appear on top of the cache node |
| 1:18 | The most common pattern is called cache-aside, or lazy loading. | Lower third: Cache-aside (lazy loading) |
| 1:23 | A server checks the cache first. | Request arc server → cache |
| 1:27 | The first time, product 42 isn't there. That's a cache miss. | Empty slot; red ✗ MISS |
| 1:32 | So the server asks the database, and then saves the answer in the cache, under the key product 42. | Arc to DB and back; mascot (cached copy) drops into slot product:42 |
| 1:42 | A miss costs three trips: to the cache, to the database, and back to the cache. | Trip counter 1 · 2 · 3 on the three arcs |
| 1:50 | But the next visitor finds it right away. That's a cache hit. | Short green bounce off the cache; ✓ HIT |
| 1:56 | No database involved. Amazon says its ElastiCache service answers in microseconds. | Many green hits; DB idles; tag 'AWS: microsecond latency' |
| 2:01 | The more hits you get, the less work the database does. That share is your hit ratio, and it's the number to watch. | Hit-ratio meter climbs; DB load meter falls |
| 2:13 | And you've seen this idea before: a CDN is a cache too, just placed close to your users. | Inset: episode 1 edge server near Berlin |

## Stale data and TTL

| ~Time | Narration | Visual |
|---|---|---|
| 2:23 | But there's a catch. The price of product 42 drops from 49 to 39. | DB row price 49 → 39 (example) |
| 2:30 | The database has the new price. The cache still has the old one. | Cache slot still shows 49, turns yellow |
| 2:37 | So shoppers see the wrong price. That's stale data. | Phone shows €49; yellow STALE tag |
| 2:41 | The simplest safety net is a time to live, or TTL. Each key expires after a set time. | TTL ring timer appears around the mascot |
| 2:50 | When it's gone, the next read is a miss, and the fresh price gets loaded. | Ring runs out; slot fades; miss → DB → 39 loaded |
| 2:58 | In Redis, expired keys are removed when someone reads them, and by a regular check of random keys. | Two small icons: read-time check, periodic random sampling |
| 3:06 | But until the timer runs out, the old price can still show up. | Rewind: ring still running, 49 still served |
| 3:12 | So when the price changes, you can delete the key right away. The next read loads the new one. | Write to DB triggers ✗ delete on product:42 |
| 3:21 | Or use write-through: every time the database is written, the cache is updated too. | Write arrow splits: DB and cache both updated to 39 |
| 3:28 | Then the cache is never stale. But it also fills up with data nobody reads. | Slots fill with grey, never-read keys |
| 3:36 | Most teams add a TTL either way. As Amazon's docs put it, that still doesn't guarantee a value isn't stale. | TTL ring on every slot; small caveat label |

## When the cache is full

| ~Time | Narration | Visual |
|---|---|---|
| 3:47 | A cache lives in memory, and memory runs out. | Memory bar on the cache node fills to 100% |
| 3:52 | So what happens when it's full? | New key product:77 arrives |
| 3:55 | By default, Redis evicts nothing. New writes just fail with an error. Reads still work. | New key bounces off: red ✗ OOM; hits still green; tag 'Redis default: noeviction' |
| 4:03 | That's why most teams pick an eviction policy, like all keys LRU. | Policy label allkeys-lru |
| 4:09 | LRU means least recently used: the key nobody has asked for in the longest time gets removed to make room. | Coldest slot (dim, oldest timestamp) slides out; product:77 moves in |
| 4:19 | Redis doesn't track that exactly. It samples a few keys and evicts the one idle the longest. | A few random slots highlight; the oldest of them is evicted |

## Three traps

| ~Time | Narration | Visual |
|---|---|---|
| 4:28 | Caches have their own traps. | Overview shot |
| 4:31 | First: the thundering herd. | Lower third: Trap 1 · Thundering herd |
| 4:34 | Product 42 is the hottest key in the shop. Then its TTL runs out. | Ring on product:42 hits zero |
| 4:40 | In that moment, every request misses, and they all hit the database at once. | Wall of red packets slams the DB; load meter spikes |
| 4:49 | That's also called a cache stampede. | Label: cache stampede |
| 4:52 | The fix is request coalescing: only one request goes to the database. The others wait for its answer. | Rewind; one blue packet goes, the rest wait in a short line; all turn green |
| 5:02 | Second: things that don't exist. | Lower third: Trap 2 · Missing keys |
| 5:04 | Someone keeps asking for product 404. It's not in the database, so it's never in the cache. | Ghost key product:404 with a dashed outline |
| 5:13 | Every one of those requests goes straight to the database. | Misses pile into the DB |
| 5:18 | So cache the answer 'not found' too, with its own short TTL. That's a negative cache. | '∅ not found' entry with a short ring; misses stop |
| 5:26 | Third: the cache becomes something you depend on. | Lower third: Trap 3 · Cold cache |
| 5:30 | When a cache node restarts, it starts empty. Every request misses, and the database takes the full load again. | Cache blinks off and on, empty; DB meter jumps |
| 5:40 | So plan for that cold start. And if the database goes down, you can keep serving slightly old data for a while, until a hard limit runs out. | Soft and hard TTL markers on a timeline; stale-but-green answers while DB is red |

## Recap

| ~Time | Narration | Visual |
|---|---|---|
| 5:55 | Let's recap. | Recap panel |
| 5:57 | A cache keeps answers in memory, so most reads never reach the database. | ✓ 1 |
| 6:03 | Every cached answer can go stale, so use a TTL, and update or delete on write. | ✓ 2 |
| 6:11 | Pick an eviction policy, and protect the database from stampedes, missing keys and cold starts. | ✓ 3 |
| 6:18 | Next up: replication. A cache helps with reads, but what happens when the database itself goes down? | End card: NEXT VIDEO · Replication |
| 6:26 | What do you cache in your app? Tell me below. | Comment question; mascot waves |
