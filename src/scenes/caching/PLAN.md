# Episode 4 plan: How Caching Works

Format: concept explainer + failure walkthrough · target **6:15–7:00** · 1080p (4K optional) · English narration, same voice (`Gfpl8Yo74Is0W6cPUWWT`).
Episode id `caching` · slug `how-caching-works`.

**Promise from episode 3:** the end card says "Caching" and the narration says "Next up: caching, for when every page asks the database the same question." The first minute has to pay that off.

**Bridge from episodes 2–3:**
- Episode 2's trap 3 was "the shared database": more servers, one database behind them all.
- Episode 3 moved slow work off the request.
- Now the reads are the problem. Same shop, `shop.example`: a sale starts and thousands of people open the **same product page**. Every request asks the database the same question.

**Running example:** product `#42` (the sale item), key `product:42`. The Data Packet mascot is the **cached copy** of product 42:
- it gets stored;
- it serves hit after hit;
- it goes stale when the price changes;
- it expires;
- it gets evicted.

---

## 0. Demand check (2026-11-02, Chrome; per CLAUDE.md)

Searches:
- caching explained
- caching system design
- redis cache explained
- cache invalidation
- cache stampede thundering herd
- cache aside write through
- how caching works
- redis explained
- why is redis so fast
- caching strategies

Scanned the latest 30 uploads of 93 channels found in those results.

| Signal | Data |
|---|---|
| Search demand is real and evergreen | Top results: ByteByteGo "Caching systems every developer should know" 676k (3 yr). Hello Interview "Caching in system design interviews" **270k in 11 months** (×2.5 their median). Simply Explained 169k. Fireship "Redis in 100 seconds" 1.0M. |
| Fresh winner, small channel, **bundle angle** | System Design School (27k): "Caching was HARD until I learned these 17 concepts", **31k in 2 weeks** (×2.2). |
| Overview bundles outperform | Hayk Simonyan (153k): "System Design Explained: APIs, Databases, Caching…" 708k (×71). |
| Myth angle around Redis | ByteByteGo "What Redis really is, why it's so fast" 144k (8 mo). "Why is single-threaded Redis so fast" 365k. |
| Story angle | Hello Interview: "Why Shopify moved inventory reservation off Redis" 52k (2 mo). |
| **Gap: failure modes** | "cache stampede / thundering herd" results are tiny channels with **0–1k views**. No strong visual explainer exists. Our failure-story format fills that gap. |
| Comments on the Hello Interview caching video (top) | the cache-invalidation joke; "5 min TTL is fine… until directors bubble up to your VP" (staleness); a request for "thundering herd" coverage; "why Redis over Memcached"; cache pollution and capacity; "there's also cache in the DB, OS, DNS, CPU" (cache layers). |

**Takeaways for the script:**
1. Lead with a failure: the sale melts the database.
2. Make staleness concrete: the wrong price.
3. Give the stampede a full section with a visual. This is the gap.
4. Answer "Redis vs Memcached" in one line.
5. Mention that caches exist at many layers, with one callback to the CDN episode.

---

## 1. Structure and visual beats

| Time | Section | What the viewer learns | Main visual |
|---|---|---|---|
| 0:00–0:20 | Hook | "A sale starts. Ten thousand people open the same product page. The database answers the same question again… and again… until it can't." | Product page `#42` on many phones. Packets stream from the app servers into one purple database, and its load meter climbs to red. Title card. |
| 0:20–1:00 | 1 · The problem: the same question, again and again | Behind the load balancer, every server asks the one shared database (episode 2's trap 3) for product 42 on every request. The answer barely changes, but the database does the full work each time. | The LB fan-out from episode 2. All servers' arcs converge on the database. A query counter spins: "SELECT … product 42" ×N. |
| 1:00–2:20 | 2 · What a cache does (cache-aside) | A cache is a fast in-memory key-value store next to the servers. Examples: Redis, Memcached. **Cache-aside / lazy loading:** check the cache first. On a **hit**, answer straight from memory. On a **miss**, ask the database, then save the answer in the cache, so a miss costs **three trips**. After the first miss, product 42 is a hit for everyone. AWS states ElastiCache answers in **microseconds** (labelled as an AWS claim). Hit ratio is the number to watch. One line: a CDN, from episode 1, is the same idea placed near users. | A new cache node between the servers and the database. The first request takes the long path (cache ✗ → DB → write back), and the mascot (the cached copy of product 42) drops into a slot `product:42`. The next requests bounce off the cache in green. Hit-ratio meter climbs; the DB load meter falls. |
| 2:20–3:30 | 3 · Stale data, TTL, and invalidation | The price changes in the database, but the cache still serves the old one. That's **stale data**. **TTL:** every key gets an expiry, and expired keys are removed when read, plus a periodic random sample (Redis). Two ways to keep it fresh: **delete the key on write**, so the next read misses and reloads, or **write-through**: update the cache whenever the database is written. Data is never stale, but most of it is never read (wasted memory), and a new cache node starts with gaps. AWS: combine with a TTL, which "doesn't guarantee that a value isn't stale." | DB row `price 49 → 39`. The cache still shows 49 in yellow, and a user sees the wrong price. A TTL ring timer on the mascot runs out, the key fades, the next read misses and reloads 39. Split: "delete on write" vs. "write-through" arrows. |
| 3:30–4:20 | 4 · When the cache is full: eviction | Memory is limited (`maxmemory`). Redis's **default policy is noeviction**: when full, writes return an error; reads still work. Usually you pick **allkeys-lru**, which evicts the least recently used keys. Redis approximates LRU by **sampling** a few keys, not by tracking all of them exactly. | Cache slots fill up. With noeviction, a new key bounces off with a red ✗ "OOM". With allkeys-lru, the coldest slot (dim, old timestamp) is removed and the new key takes its place. |
| 4:20–5:50 | 5 · Three traps | (1) **Thundering herd / cache stampede:** a hot key expires, and every request misses at the same moment, so the whole crowd hits the database at once. Fix: **request coalescing**, where only one request goes to the database and the others wait for its answer. (2) **Requests for things that don't exist:** product 999999 is never in the cache, so every request goes to the database. Fix: a **negative cache**, which caches "not found" with its own TTL. (3) **The cache becomes a dependency:** a restarted or new cache node starts empty, so everything misses and the database gets the full load again. Fix: plan for the cold start, and when the database is down, serve stale data until a hard TTL runs out (soft vs. hard TTL). | (1) The TTL ring on `product:42` hits zero, and a wall of red packets slams the DB (load meter spikes). Rewind; with coalescing, one blue packet goes and the rest wait in a small queue, then all turn green. (2) A ghost key `product:999999` with a dashed outline; misses pile into the DB, then an "∅ not found" entry with a short timer stops them. (3) The cache node blinks off and on, empty. The DB meter jumps. |
| 5:50–6:30 | ✓ Recap + next | 3 checks as in episodes 1–3. Tease the next episode (see Open questions). | Recap checklist over the overview shot, then the next-video card with the mascot waving. |

Pacing: write at **~2.3 words/s** and let `npm run retime` lock timings, as in episodes 2–3.

## 2. Facts (verified 2026-11-02)

Narration and on-screen text may only use claims from this table.

| Claim usable in narration / on screen | Source |
|---|---|
| Lazy loading "loads data into the cache only when necessary" | [AWS ElastiCache caching strategies](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html) |
| Lazy loading: "Each cache miss results in three trips": request to the cache, query to the database, write to the cache | same |
| Lazy loading: data "can become stale" because it's written only on a miss | same |
| Write-through: "adds data or updates data in the cache whenever data is written to the database"; "Data in the cache is never stale" | same |
| Write-through downsides: a new node (failure or scale-out) has missing data; "Most data is never read, which is a waste of resources" | same |
| Adding a TTL to each write combines both, but "doesn't guarantee that a value isn't stale" | same |
| ElastiCache: "microsecond latency" (AWS product claim; on screen: "AWS: microsecond latency") | [AWS ElastiCache](https://aws.amazon.com/elasticache/), [features](https://aws.amazon.com/elasticache/features/) |
| Redis default `maxmemory-policy` is **noeviction** | [redis.conf](https://raw.githubusercontent.com/redis/redis/unstable/redis.conf) |
| noeviction: keys aren't evicted, and the server returns an error on commands that would add data; reads still work | [Redis key eviction](https://redis.io/docs/latest/develop/reference/eviction/) |
| Policies include allkeys-lru, allkeys-lfu, allkeys-random, volatile-lru, volatile-lfu, volatile-random, volatile-ttl (volatile-* = only keys with an expiry) | same |
| Redis LRU is an **approximation**: it samples a few keys at random and evicts the one idle longest | same |
| Expired keys are removed **passively** when a client accesses them, and **actively** by periodically testing a few random keys that have an expiry | [Redis EXPIRE](https://redis.io/docs/latest/commands/expire/) |
| Thundering herd: many clients request the same uncached resource at about the same time | [AWS Builders' Library: Caching challenges and strategies](https://builder.aws.com/content/3K9TeXp6strMiJ4vhakpRD7BQWO/caching-challenges-and-strategies) |
| Request coalescing: only one pending request goes out for an uncached resource | same |
| Negative caching: cache "not found" results with a distinct TTL | same |
| Soft TTL / hard TTL: refresh at the soft TTL; if the downstream service is unavailable, keep using cached data until the hard TTL | same |

**Wording rules from checking:**
- Don't say "Redis evicts least recently used keys" as a default. The default is **noeviction**; LRU is something you choose (`allkeys-lru`).
- Say "Redis approximates LRU" if the algorithm is named on screen. Never say "exact LRU".
- ElastiCache's parameter-group default (`volatile-lru`) was only confirmed for an old Redis OSS 4.0.10 table. **Don't use it.**
- Latency: only the AWS wording "microsecond latency", attributed to AWS. No "100× faster" style numbers.
- "Three trips" belongs to lazy loading's miss only.
- TTL jitter was **not found** in the checked sources. Don't present it as a sourced fix. Coalescing is the sourced fix.
- Redis vs Memcached: name both as in-memory caches. Don't claim feature differences unless verified in step 2.

## 3. Reuse vs. build

**Reuse as is:**
- CameraRig, Timeline, Hud, Label3D
- Overlays: meters, counters, recap panel, end card
- PacketPool, ArcPath
- NodeMesh: servers, database, `createLoadBalancer`, `createQueueBroker` (cameo)
- RequestQueue: the waiting crowd in the coalescing beat
- Mascot presenter and `Mascot.setOpacity` (stale/expired copy)
- the `beats.ts` pattern
- ThumbnailKit
- the whole pipeline: record, voiceover, retime, shorts, thumbnail, metadata

**New components** (in `src/components/`):

| Component | Purpose |
|---|---|
| `CacheSim` | Deterministic simulation like `QueueSim`: requests by key and time → hit/miss, TTL expiry, eviction (noeviction vs. LRU), coalescing on/off, negative entries. Drives the hit-ratio and DB-load meters, so the numbers on screen are correct and reproducible. |
| `createCacheNode()` in NodeMesh | Fast memory node, lighter purple with a lightning mark, and a grid of key slots on top. |
| `KeySlots` | Row or grid of labelled slots (`product:42`, `∅ product:999999`) with an optional TTL ring per slot and a "last used" dimming for LRU. It may extend `LogTape`. |

## 4. Shorts planned up front

Write these sections so each stands alone (hook line at the start, payoff at the end):

| Short | Source | Hook |
|---|---|---|
| Cache hit vs. miss in 50 seconds | Section 2 | "The first visitor pays. Everyone after is instant." |
| Your cache is showing the wrong price | Section 3 | Stale data, TTL, delete-on-write |
| Redis doesn't evict by default | Section 4 | Myth angle: full cache → errors, not LRU |
| One key expired. The database went down. | Section 5 trap 1 | Stampede + request coalescing (the gap from the demand check) |

## 5. Titles and thumbnails (draft, per niche rules)

- **Primary:** `How Caching Works: Hits, Misses, and Stale Data`
- **Test & compare:**
  - `One Expired Key Took Down the Database` (failure)
  - `Your Cache Is Lying to You` (myth: stale data)
  - `Caching Explained: System Design Basics, Animated`
- **Thumbnail variants** (scene: the database overheating behind a cache with a red-ringed `product:42`):
  - a: `1 KEY EXPIRED` / `DB DOWN` (risk)
  - b: `WRONG PRICE?` (curiosity, with a "49 → 39" badge)
  - c: `CACHE HIT` / `DB COOL` (payoff)

## 6. Open questions (decide before step 3)

1. ~~Next-episode tease~~ **decided: replication** ("A cache helps with reads, but what happens when the database itself goes down?"). The end card reads "Replication".
2. **Length:** the stampede gets the most time (the gap). If the script runs over 7:00, shorten the eviction section first.

## 7. Production steps

| # | Step | Output |
|---|---|---|
| 1 | ~~Register the episode in `episodes.ts`~~ done (`caching`, slug `how-caching-works`, `autoTimed: true`) | `--episode caching` works for the Node scripts |
| 2 | ~~Verify remaining facts~~ done: the script names Redis and Memcached only as in-memory key-value stores, and the CDN callback reuses episode 1 facts; nothing new to verify | This table final |
| 3 | ~~Write the full narration~~ done: 58 lines, 755 words, `say` overrides for TTL, LRU, CDN, ElastiCache, product 404 | `script.ts`, `SCRIPT.md` |
| 4 | ~~Voiceover dry run, `npm run retime`~~ done: **5:53**, no overruns after retime | `how-caching-works-voiceover.wav` |
| 5 | ~~Build components and scene~~ done: `CacheSim`, `createCacheNode`, `KeySlots`; `CacheScene`, `CacheStage`, `traffic.ts`, `beats.ts`, presenter. Thumbnail entry in `main.ts` is a placeholder until step 7 | Stills reviewed in 2 passes |
| 6 | ~~Full render, voiceover mux, captions~~ done: 4.8 min render, 10,590 frames, 5:53 | `how-caching-works-1080p-voiced.mp4`, `.srt` |
| 7 | ~~Thumbnail (3 variants), Shorts with covers, `YOUTUBE.md`, `CHANNEL.md` episode list~~ done | `Thumbnail.ts`, `shorts.ts`, `YOUTUBE.md` |
| 8 | After upload: log results after 7 days | `PLAN.md` → Results |
