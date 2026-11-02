# YouTube metadata — How Caching Works

Channel: **Data Packet** · *Small packets. Big ideas.*
Files: `output/renders/how-caching-works-1080p-voiced.mp4` (5:53) · captions `output/renders/how-caching-works.srt`
Shorts: `output/renders/shorts/caching/` (4 clips + covers + `SHORTS.md`)

## Title

Primary (47 chars):

```
How Caching Works: Hits, Misses, and Stale Data
```

Alternatives for A/B testing (YouTube "Test & compare"). Per the niche rules: one "How X Works" title, plus failure and myth angles:

```
One Expired Key Took Down the Database (Cache Stampede)
Your Cache Is Lying to You: Stale Data, TTL and Eviction
Caching Explained: System Design Basics, Animated
```

## Description

```
A sale starts, thousands of people open the same product page, and every visit asks the database the same question until it can't keep up. A cache fixes that by remembering the answer. This 6-minute animation follows product #42 through a cache: the first miss, the hits, a stale price, a full cache, and three traps that take databases down.

What you'll see:
• Cache-aside (lazy loading): check the cache first; a miss costs three trips
• Hit ratio, and why a CDN is the same idea placed near users
• Stale data: why shoppers see the old price, and how TTLs, delete-on-write and write-through help
• What happens when a Redis cache is full: noeviction by default, allkeys-lru, approximated LRU
• Trap 1: the thundering herd (cache stampede), and request coalescing
• Trap 2: requests for keys that don't exist, and negative caching
• Trap 3: a cold cache after a restart, and serving stale data with soft and hard TTLs

⏱️ Chapters
0:00 A sale, one product page, one database
0:20 The same question, again and again
0:56 What a cache is: Redis and Memcached
1:15 Cache-aside: hit, miss, three trips
1:49 Hit ratio, and the CDN connection
2:06 Stale data: the wrong price
2:23 TTL: keys that expire
2:49 Delete on write vs. write-through
3:18 When the cache is full: noeviction
3:33 LRU, and how Redis approximates it
3:56 Trap 1: thundering herd (cache stampede)
4:28 Trap 2: keys that don't exist
4:50 Trap 3: a cold cache after a restart
5:16 Recap and what's next

📌 The facts in this video
• Lazy loading: each cache miss costs three trips (cache, database, cache), per the AWS ElastiCache docs
• Write-through: the cache is never stale, but most of the data is never read
• A TTL on every write helps, but AWS notes it "doesn't guarantee that a value isn't stale"
• Redis default maxmemory-policy: noeviction (writes return an error when memory is full; reads still work)
• Redis approximates LRU by sampling a few keys
• Redis removes expired keys when they're read, and with a periodic random check
• Request coalescing, negative caching and soft/hard TTLs: AWS Builders' Library, "Caching challenges and strategies"
• Prices (€49 → €39) and product numbers are examples

💬 What do you cache in your app? Tell me in the comments.

▶️ Previous episode: How Message Queues Work [link]
▶️ Next episode: replication, for when the database itself goes down. Subscribe so you catch it.

Data Packet explains system design with animated 3D diagrams. Small packets. Big ideas.

#SystemDesign #Caching #Redis
```

(≈ 2,500 characters; limit is 5,000. The first three hashtags show above the title.)

Only the first ~150 characters show before "…more". Alternative openings to test:

- A: `A sale starts, thousands of people open the same product page, and every visit asks the database the same question until it can't keep up.` (current: concrete scene, pain first)
- B: `A cache keeps answers in memory so most reads never reach the database. Here's how it works, and the three traps that take databases down.` (keyword first)
- C: `One key expired, and every request hit the database at once. That's a cache stampede, and here's how caches really work.` (matches Short #4)

## Tags

Paste as comma-separated (≈ 350 characters; limit 500):

```
caching, how caching works, cache explained, system design, system design interview, redis, memcached, cache aside, lazy loading, write through, cache invalidation, stale data, ttl, cache eviction, lru, maxmemory policy, noeviction, cache stampede, thundering herd, request coalescing, negative caching, cold cache, hit ratio, elasticache, data packet
```

## Upload settings

Same as episode 1 (`src/scenes/cdn/YOUTUBE.md`), except:

| Field | Value |
|---|---|
| Caption language | English — upload `how-caching-works.srt` |
| Playlist | "Cloud Architecture" (episode 4) |

## Chapters check

- First chapter at 0:00 ✓
- 14 chapters, ascending, each ≥ 10 s ✓ (shortest: 3:18 → 3:33, 15 s)

## End screen (5:37–5:53)

From 5:37 the scene dims behind a "NEXT VIDEO: Replication" card, the comment question appears below it, and the mascot waves on the right.
- **Element 1:** Video — "How Message Queues Work" (until the replication episode exists), bottom-left
- **Element 2:** Subscribe button, bottom, left of center
- Start both at 5:37. Keep the right third clear for the mascot.

## Cards

| Time | Card |
|---|---|
| 0:21 | Video: "How Load Balancers Work" (the narration calls back to it) |
| 1:04 | Poll: "What do you cache with?" Redis / Memcached / Valkey / Nothing yet |
| 1:49 | Video: "How a CDN Works" (the CDN callback) |

## Pinned comment

```
Quick quiz 🧠 Your Redis cache is full. Default settings. A new write comes in.
What happens? 👇 (Answer at 3:26)
```

## Thumbnail

Three A/B variants for YouTube **Test & compare**: upload all three, and YouTube picks the winner by watch time. Re-render with `node src/scripts/record.ts --episode caching --thumbnail` (scene: `Thumbnail.ts`, style rules: `src/components/ThumbnailKit.ts`). The review sheet, including phone size, is `output/renders/how-caching-works-thumbnails-preview.png`.

| File | Hook | Badge | Type |
|---|---|---|---|
| `how-caching-works-thumbnail-a.jpg` (also `-thumbnail.jpg`) | ONE KEY EXPIRED. | STAMPEDE | risk |
| `how-caching-works-thumbnail-b.jpg` | WRONG PRICE? | €49 → €39 | curiosity |
| `how-caching-works-thumbnail-c.jpg` | SKIP THE DATABASE | HIT ✓ | payoff |

Same scene in all three: a cache with its key slots in front of a big database, with the mascot reacting. In variant a, the expired key is a red ghost slot and red requests slam the database. In b, the cached price slot glows yellow (stale). In c, the database idles. There's no title pill, and the bottom-right corner is kept clear for the duration badge.

## Social / community post

```
New video: How caching works ⚡📦
Hits and misses, why your cache shows the wrong price, what Redis does when it's full (not what most people think), and how one expired key can stampede your database. 6 animated minutes.
```
