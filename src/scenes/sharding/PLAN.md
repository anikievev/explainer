# Episode 6 plan: How Database Sharding Works

Format: concept explainer + failure walkthrough · target **6:00–6:45** · upload render 1440p · English narration, same voice (`Gfpl8Yo74Is0W6cPUWWT`).
Episode id `sharding` · slug `how-database-sharding-works`.

**Promise from episode 5:** the end card says "Sharding" and the narration says "Every replica holds all the data. What happens when the data doesn't fit on one server?" The first 20 seconds pay that off: replicas don't help, because every write still lands on one primary and every replica is a full copy.

**Bridge from episodes 2–5:**
- Episode 2: many app servers.
- Episode 3: orders go through a queue (order #1042).
- Episode 4: a cache takes the reads.
- Episode 5: replicas take more reads and survive a crash, but each one holds everything, and all writes go to one primary.
- Now the data itself outgrows one machine. Same shop, `shop.example`.

**Running example:** the shop's `orders` table. Order `#1042` belongs to customer `7`. The Data Packet mascot is **order #1042**: the router reads its shard key, sends it to its shard, and later it has to move when a shard is added.

---

## 0. Demand check (2026-11-08, Chrome; per CLAUDE.md)

Searches (14):
- database sharding
- sharding explained
- database sharding system design
- horizontal partitioning database
- sharding vs partitioning
- consistent hashing
- hot partition
- shard key
- resharding
- database scaling
- sharding vs replication
- postgres sharding
- vitess
- mongodb sharding

There were 175 unique results. 87 of them were from the last 12 months, across 71 channels; I compared each video with its channel's median views.

| Signal | Data |
|---|---|
| Demand is larger than replication | Hello Interview "Sharding in System Design Interviews" 200k (1 yr, ×2.4). Hello Interview "Consistent Hashing" 203k (1 yr, ×2.4). KodeKloud "Database Sharding Explained for Beginners" 46k in 3 weeks. Hayk Simonyan "How to Scale a Database to 10M Users" 58k in 3 weeks (×5.8). |
| Evergreen, owned by older videos | Aced "The Basics of Database Sharding and Partitioning" 141k (3 yr). Anton Putra "What is Database Sharding" 138k (3 yr). Be A Better Dev 177k (5 yr). |
| **Story outliers win** | Perfology "Scaling 7M+ Postgres Tables" (Zerodha CTO) **232k, ×66** (42.6k subs). programmerCave on the same Zerodha story ×8.5. Inspektor "Vitess" ×27. Real-company scaling stories beat definitions. |
| Small-channel signal on failure modes | Prateek Goel (1.8k subs) "Shard Keys, Hot Partitions and…" ×18 in 2 weeks. SimplifiedBy "Resharding: The Celebrity Problem" ×3.9. SREish "Hot Partitions" ×3.2. Arpit Bhayani "Consistent Hashing… From the Ground Up" 27k (×6.4). |
| Comparisons searched | "sharding vs partitioning", "partitioning vs sharding vs replication" (CodeView ×5.9), "horizontal vs vertical partitioning". |
| Comments (Hello Interview, 200k) | Top: jokes. Questions: "How do you learn those numbers… for determining whether you need sharding?"; a clarification on cardinality vs distribution got 29 likes; one viewer points out that **writes all hit one primary, replicas don't help**; another reader adds that consistent hashing's ring isn't clean arcs in practice (virtual nodes). Hayk: "How do we balance between replicas?" |

**Takeaways for the script:**
1. Open on the episode 5 tease: replicas copy everything, writes still go to one primary.
2. Make **the shard key** the centre: cardinality vs. distribution confused viewers, and a bad key creates a hot shard. That's the failure gap small channels are winning on.
3. Use real numbers from real companies (Notion's 480 shards, Figma), since story outliers win.
4. "Sharding vs. replication" is a comparison people search: make it a Short.
5. End on resharding: adding one server with `hash % N` moves most keys. That sets up **consistent hashing** as the next episode (203k demand, and a roadmap item).

---

## 1. Structure and visual beats

| Time | Section | What the viewer learns | Main visual |
|---|---|---|---|
| 0:00–0:20 | Hook | "Black Friday. Replicas took the reads, but every write still goes to one primary, and every replica holds the whole database. The disk is filling up. Adding replicas won't help." | The episode 5 cluster. The primary's write meter and disk meter climb to red. A new replica slides in: it's a full copy, so its own disk meter is just as full. Title card. |
| 0:20–1:10 | 1 · Split the data | **Sharding** splits one table across several databases (shards); each holds a piece, with no overlap. A **router** reads each row's **shard key** and sends it to the right shard. Contrast with replication: replicas = same data copied; shards = different data. | The big orders table slices into 4 colour-coded shards. Order #1042 (mascot) with `customer 7` reaches the router and lands on shard 3. Side-by-side: 3 replicas (identical stacks) vs. 4 shards (different stacks). |
| 1:10–2:30 | 2 · Picking the shard key | Three tries: **order date** (monotonic) sends every new order to the last shard: a hot spot (MongoDB docs). **Hash of the order ID** spreads writes evenly, but "all orders for customer 7" now asks every shard. **Customer ID** keeps one customer's orders together (Notion shards by workspace ID). Good key: many distinct values, evenly used, not always increasing. | A write-rate bar per shard. Date key: one bar maxes out (red), the rest idle. Hash: bars even (green), but a query fans out to all 4. Customer key: even bars and the customer-7 query hits one shard. A checklist of 3 properties ticks. |
| 2:30–3:30 | 3 · Queries that cross shards | A query without the shard key is broadcast to every shard and gathered: slower, and it doesn't scale linearly (MongoDB). Transactions that span shards lose the database's guarantees: Figma: "Postgres can no longer be used to enforce transactionality." Figma chose not to support atomic cross-shard transactions. | "Top products today" fans out to all shards; the slowest shard sets the response time (timer). A transfer between two customers on different shards: one side commits, the other fails, ✗. |
| 3:30–4:30 | 4 · The hot shard | Even with a good key, one huge customer (a big seller with a flash sale) can overload its shard. A high-cardinality key "does not, on its own, guarantee even distribution" (MongoDB). DynamoDB states a hard per-partition limit: 3,000 read units and 1,000 write units per second. Fixes: split the hot key (add a suffix), or give it its own shard. | Shard 2's bar goes red while the others idle; a "big seller" icon floods it. Error counter on shard 2 only. Then the key splits into `seller-9#1…#4`, spreading over shards. |
| 4:30–5:35 | 5 · Adding a shard | Rows move when you add a shard. With `hash % 4` → `hash % 5`, **80% of keys change shard** (computed and shown on screen with real counts). Fix 1: many small **logical shards** on fewer machines, and move whole logical shards: Notion runs 480 logical shards on 32 databases, and picked 480 because it divides evenly many ways. Fix 2: MongoDB's balancer moves ranges in the background. Tease: consistent hashing moves far fewer keys. | 1,000 dots (keys) on 4 shards; a 5th shard appears and 800 dots fly. Counter "moved: 800 / 1,000". Then the logical-shard view: 480 small boxes on 32 machines (shown smaller); adding machines moves whole boxes. |
| 5:35–6:15 | ✓ Recap + next | 3 checks as in episodes 1–5. Tease **consistent hashing**: "Adding one shard moved 80% of the data. What if it moved only a fifth?" | Recap checklist; next-video card with the mascot waving. |

Pacing: write at **~2.3 words/s** and let `npm run retime` lock timings, as in episodes 2–5.

## 2. Facts (verified 2026-11-08)

Narration and on-screen text may only use claims from this table.

| Claim usable in narration / on screen | Source |
|---|---|
| MongoDB `mongos` routes queries and writes to shards ("query router"); queries without the shard key are broadcast | [MongoDB: query router](https://www.mongodb.com/docs/manual/core/sharded-cluster-query-router/) |
| Vitess VTGate: "a lightweight proxy server that routes traffic to the correct VTTablet servers"; apps connect to it "as if it is a MySQL Server" | [Vitess: VTGate](https://vitess.io/docs/concepts/vtgate/) |
| DynamoDB hashes the partition key; "The output value from the hash function determines the partition" | [DynamoDB: partitions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html) |
| Write sharding: "add a random number to the partition key values to distribute the items among partitions"; then "query the items for all the suffixes and then merge the results" | [DynamoDB: write sharding](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-sharding.html) |
| "Sharding is a method for distributing data across multiple machines"; used for "very large data sets and high throughput operations" | [MongoDB: sharding](https://www.mongodb.com/docs/manual/sharding/) |
| "A document's shard key value determines its distribution across the shards" | same |
| Queries without the shard key are broadcast to all shards; "These scatter/gather queries can be long running operations." Multi-shard queries "are less efficient and do not scale linearly" | same; [MongoDB: choose a shard key](https://www.mongodb.com/docs/manual/core/sharding-choose-a-shard-key/) |
| Always-increasing key: "all new inserts are routed to the chunk with maxKey as the upper bound"; "The shard containing that chunk becomes the bottleneck for write operations" | [MongoDB: choose a shard key](https://www.mongodb.com/docs/manual/core/sharding-choose-a-shard-key/) |
| Good key properties: large cardinality, low frequency, not monotonically changing | [MongoDB: ranged sharding](https://www.mongodb.com/docs/manual/core/ranged-sharding/), choose a shard key |
| "A shard key with high cardinality does not, on its own, guarantee even distribution of data" | choose a shard key |
| Hashed sharding: "more even data distribution… at the cost of reducing Targeted Operations"; range queries more likely broadcast | [MongoDB: hashed sharding](https://www.mongodb.com/docs/manual/core/hashed-sharding/) |
| MongoDB splits data into chunks; a background balancer migrates ranges between shards | [MongoDB: balancer](https://www.mongodb.com/docs/manual/core/sharding-balancer-administration/) |
| MongoDB 5.0+: `reshardCollection` changes the shard key and redistributes data | choose a shard key |
| Notion: "480 logical shards evenly distributed across 32 physical databases"; partition key = workspace ID; 480 chosen because it has many factors (scale 32 → 40 → 48 hosts) | [Notion: sharding Postgres](https://www.notion.com/blog/sharding-postgres-at-notion) (Oct 2021) |
| Notion's self-set limits: 500 GB per table, 10 TB per physical database | same |
| Figma: vertical partitioning couldn't help, "the smallest unit of partitioning is a single table"; they were about to exceed RDS's maximum IOPS | [Figma: databases team](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) |
| Figma: "Transactions now span multiple shards, meaning Postgres can no longer be used to enforce transactionality"; "Certain SQL queries become inefficient or impossible to support"; they chose not to support atomic cross-shard transactions | same |
| Figma: sequential IDs would have caused "significant hotspots"; they hashed the sharding key | same |
| DynamoDB: each partition delivers at most 3,000 read units and 1,000 write units per second; design for uniform activity across partition keys | [DynamoDB: partition key design](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html) |
| `hash % 4` → `hash % 5` moves 80% of keys | Arithmetic: a key stays only if `k mod 4 = k mod 5`, which is 4 of every 20 values. `ShardSim` counts it on screen. |

**Wording rules from checking:**
- **Dropped:** Instagram's logical-shard numbers (the page didn't load). Don't use them.
- Figma facts only from verbatim quotes above. Not their dates, failover seconds or percentages (those came from a summary, not the page).
- DynamoDB numbers only as "per partition", with the units (read units, write units), never as "requests".
- "Router": generic. Name real ones only as examples (MongoDB `mongos`, Vitess, Citus) and only if verified in step 2.
- Consistent hashing: tease only, no claims about how much it moves beyond "far fewer keys" (verify in the next episode).
- No claims about when to shard ("at 1 TB"). Viewers asked, but no source gives a number. Say: when one machine can't keep up with the writes or the data, after caching and replicas.

## 3. Reuse vs. build

**Reuse as is:**
- CameraRig, Timeline, Hud, Label3D
- Overlays: meters, counters, recap panel, end card
- PacketPool, ArcPath
- NodeMesh: servers, `createDatabase`, `setDim`, `createLoadBalancer` (as the router)
- Mascot presenter with the new reactions (worried, scared, thinking, determined…)
- the `beats.ts` pattern; ThumbnailKit
- the whole pipeline: record (1440p), voiceover, retime, shorts (cold opens), thumbnail, metadata

**New components** (in `src/components/`):

| Component | Purpose |
|---|---|
| `ShardSim` | Deterministic: keys → shard by strategy (range on date, `hash % N`, customer ID, logical shards → hosts). Counts writes per shard per second, keys moved when N changes, and which shards a query touches. Drives every bar and counter, so numbers on screen are computed. |
| `ShardBars` | A row of per-shard load bars over each shard database (green → yellow → red). |
| `KeyField` | 1,000 small instanced dots (keys) that sit on shards and fly between them when shards are added. |

## 4. Shorts planned up front

Every Short opens on its problem or payoff (cold open), per CLAUDE.md's Shorts rules.

| Short | Source | Opens on |
|---|---|---|
| Add one server, move 80% of your data | Section 5 | 800 of 1,000 keys flying to new shards |
| Never shard by timestamp | Section 2 | One red shard taking every write while the others idle |
| Sharding vs. replication (comparison) | Hook + section 1 | Identical replicas vs. different shards, side by side |
| Why Notion picked 480 shards | Section 5 | "480 logical shards on 32 databases" |

## 5. Titles and thumbnails (draft, per niche rules)

- **Primary:** `How Database Sharding Works: Shard Keys, Hot Shards, and Resharding`
- **Test & compare:**
  - `Add One Server, Move 80% of Your Data` (surprise)
  - `Your Shard Key Is Wrong: Hot Shards Explained` (failure)
  - `Sharding Explained: System Design Basics, Animated`
- **Thumbnail variants** (scene: 4 shard databases with load bars, the mascot):
  - a: `ONE HOT SHARD` (risk; one red shard, badge "ALL WRITES")
  - b: `80% MOVED?` (surprise; keys flying to a 5th shard)
  - c: `SPLIT THE DATA` (payoff; 4 even green shards)

## 6. Open questions (decide before step 3)

1. ~~Next-episode tease~~ **decided: consistent hashing** ("Adding one shard moved 80 percent of the keys. What if it moved only a small slice?"). The end card reads "Consistent hashing".
2. ~~Running example~~ **decided:** customer ID is the final shard key; order #1042 belongs to customer 7.

## 7. Production steps

| # | Step | Output |
|---|---|---|
| 1 | ~~Register the episode in `episodes.ts`~~ done (`sharding`, slug `how-database-sharding-works`, `autoTimed: true`; `shorts.ts` empty until step 7) | `--episode sharding` works for the Node scripts |
| 2 | ~~Verify the remaining facts~~ done: mongos routes queries and writes to shards; Vitess VTGate "routes traffic to the correct VTTablet servers"; DynamoDB hashes the partition key to pick the partition; DynamoDB write sharding adds a suffix and reads must query all suffixes and merge. Citus verified but not used | This table final |
| 3 | ~~Write the full narration~~ done: 48 lines, 702 words; `say` overrides for MongoDB, mongos, MySQL, VTGate, DynamoDB | `script.ts`, `SCRIPT.md` |
| 4 | ~~Voiceover dry run, `npm run retime`~~ done: **5:40**, no overruns after retime | `how-database-sharding-works-voiceover.wav` |
| 5 | ~~Build components and scene~~ done: `ShardSim` (routing, write rates, rehash: 800 of 1,000 keys move), `KeyField` (instanced keys), `ShardBars`; `ShardingScene`, `ShardingStage`, `traffic.ts`, `beats.ts`, presenter with matched reactions. The Notion logical-shard view is a HUD panel (32 → 40 databases, whole shards move). Thumbnail entry in `main.ts` is a placeholder until step 7 | Stills reviewed |
| 6 | ~~Full render at 1440p, voiceover mux, captions~~ done: 5:40, 2560×1440, audio peak −1.3 dB | `how-database-sharding-works-1440p-voiced.mp4`, `.srt` |
| 7 | ~~Thumbnail (3 variants), Shorts with cold opens and covers, `YOUTUBE.md`, `CHANNEL.md` episode list~~ done: thumbnails ONE HOT SHARD / 80% MOVED? / SPLIT THE DATA; Shorts 39.5, 43.5, 42.3, 31.4 s, all with cold opens; `YOUTUBE.md` with 15 chapters; `CHANNEL.md` lists episode 6, next up consistent hashing | `Thumbnail.ts`, `shorts.ts`, `YOUTUBE.md` |
| 7b | ~~YouTube Studio review follow-up (2026-11-08)~~ done: promise line at the end of the hook (0:24); runtime **5:48**; re-rendered and re-cut. Short #1 is the **sound test**: accents from `src/assets/sfx/` (`beatSounds` + 5 cues), limiter at ≈ −1 dBFS; Shorts #2–4 stay silent for comparison | `YOUTUBE.md` chapters shifted +8 s |
| 8 | After upload: log results after 7 days, including each Short's "Stayed to watch" | `PLAN.md` → Results |
