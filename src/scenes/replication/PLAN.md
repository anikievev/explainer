# Episode 5 plan: How Database Replication Works

Format: concept explainer + failure walkthrough · target **6:00–6:45** · upload render 1440p · English narration, same voice (`Gfpl8Yo74Is0W6cPUWWT`).
Episode id `replication` · slug `how-database-replication-works`.

**Promise from episode 4:** the end card says "Replication" and the narration says "A cache helps with reads, but what happens when the database itself goes down?" The first 20 seconds have to pay that off: the one database dies mid-sale.

**Bridge from episodes 2–4:**
- Episode 2: many servers, one database behind them all.
- Episode 3: order #1042 went through a queue.
- Episode 4: a cache took the reads off the database, but a miss or a write still needs it.
- Now the database itself is the single point of failure. Same shop, `shop.example`.

**Running example:** order `#1042` from episode 3. The customer changes the delivery address. The write goes to the primary; copies travel to the replicas. The Data Packet mascot is **the change itself**:
- it's written on the primary;
- it rides the replication stream;
- it arrives late (lag);
- it's lost when an async primary crashes;
- it ends up on two primaries (split brain).

---

## 0. Demand check (2026-11-04, Chrome; per CLAUDE.md)

Searches:
- database replication
- database replication explained
- replication system design
- leader follower replication
- master slave replication
- replication lag
- read replicas
- postgres replication
- database failover
- synchronous vs asynchronous replication
- multi leader replication
- split brain database

Scanned the latest uploads of the 27 channels with a result from the last 12 months.

| Signal | Data |
|---|---|
| Evergreen, but owned by older videos | Aced (formerly Exponent) "Database replication in 5 minutes" 118k (3 yr). Gaurav Sen "Distributed consensus and data replication" 212k (7 yr). ByteByteGo "7 must-know strategies to scale your database" 291k (2 yr). Hayk Simonyan "Database Replication & Sharding Explained" 87k (2 yr). |
| Demand is smaller than caching | Best recent videos: Java Techie "Replication and sharding made simple" 17.7k in 2 months (×1.5 their median). Caleb Curry "Replication and Sharding" 12.6k (12 mo). No recent replication video near 100k. |
| Small-channel outliers | Ivan Fedyanin (564 subs) "Understanding Leader Follower Replication, Part 1" 5.3k, **×17.8**. Step Up Dev (2k subs) "Database Replication in Simple Terms" 4.1k, ×5. A 14-sub channel's "Database Replication Explained Visually: Leader-Follower, Sync vs Async, Replication Lag" 322 in 3 weeks, ×14. |
| Pairing with sharding | 3 of the top titles bundle "replication and sharding". |
| **Gap: failure modes** | "replication lag", "database failover", "split brain database": top results are under 2.5k views, mostly under 1k. Exception: ByteMonk "Disaster Recovery: RTO, RPO, Failover" 38k (1 yr). No strong visual explainer of lag or split brain. |
| Comments (Aced, Hayk) | Few questions. Repeated: "how do you make these animations", "expand on choosing a strategy". One correction: "Master/Slave is not used any more, it's Primary/Secondary". |

**Takeaways for the script:**
1. Lead with the failure the tease promised: the database dies.
2. Use **primary / replica** (mention "leader / follower" once; avoid master/slave).
3. Give lag and failover the most time. That's the gap, and it's what nobody animates.
4. "Sync vs async" is the comparison viewers search for; make it a Short (comparisons held best in Shorts).
5. Tease **sharding** next: the natural pair, and our roadmap's next item.

---

## 1. Structure and visual beats

| Time | Section | What the viewer learns | Main visual |
|---|---|---|---|
| 0:00–0:20 | Hook | "Mid-sale, the database server dies. The cache still answers a few reads, but every order, every miss, every save fails. One machine took the whole shop down." | The episode 4 shop. The purple database flickers and goes dark (red ✗). Arcs into it turn red; the cache's misses bounce off. Error counter climbs. Title card. |
| 0:20–1:05 | 1 · The fix: keep copies | Replication keeps copies of the database on other servers. One **primary** takes the writes; **replicas** receive a stream of every change and apply it in order. Also called leader and followers. | The database splits into a primary and two replicas. A tape of changes (`LogTape`) runs from primary to each replica. The mascot (the address change on order #1042) is written on the primary, then rides the tape. |
| 1:05–1:55 | 2 · Read replicas | Replicas are read-only copies: they can answer reads, never writes. Send reads to replicas and the primary has room for writes. (PostgreSQL standbys: "strictly read-only". RDS: "a read-only copy".) | App servers' arcs: blue read arcs fan out to the replicas; yellow write arcs all go to the primary. A write aimed at a replica bounces with ✗ "read-only". Primary load meter drops. |
| 1:55–3:05 | 3 · Replication lag | By default, replication is **asynchronous** (PostgreSQL and MySQL): the primary says "saved" before replicas have the change. So replicas run a little behind, usually under a second if they keep up (PostgreSQL docs). Story: the customer saves a new address, the page reloads from a replica that hasn't got it yet, and the old address shows. That breaks **read-your-writes**. Fix: send reads that must see the user's own latest write to the primary. | Split screen: the customer's phone says "Saved ✓", then reloads and shows the old address (yellow). The mascot is still on the tape, halfway to the replica. A lag counter "replica behind: 0.8 s" ticks down; the mascot lands and the page turns right. |
| 3:05–4:05 | 4 · Sync vs. async | **Async:** fast commits, but if the primary crashes, committed transactions not yet replicated are lost; "proportional to the replication delay". **Sync:** each commit waits for the replica to confirm; nothing confirmed is lost, but every write is slower: at least one round trip (PostgreSQL docs). Options: PostgreSQL `synchronous_standby_names`, MySQL semisynchronous replication, RDS Multi-AZ keeps a synchronous standby that doesn't serve reads. | Two lanes side by side. Async: "Saved ✓" lights immediately; the primary explodes while the mascot is still on the tape, and the replica never gets it (ghost mascot). Sync: "Saved ✓" waits for the round trip (a small timer), then the primary dies and the replica has the change. |
| 4:05–5:25 | 5 · Failover, and two traps | **Failover:** when the primary dies, a replica is **promoted** (`pg_ctl promote`) and the app switches to it. PostgreSQL itself doesn't detect the failure; an external tool does. **Trap 1, lost writes:** async failover drops what hadn't arrived (callback to section 4). **Trap 2, split brain:** the old primary comes back still thinking it's the primary; now two servers take writes and data diverges. Fix: fence the old one (STONITH, "shoot the other node in the head"), so only one primary exists. | Primary goes dark; a health checker (small eye icon) notices; replica 1 gets a crown and turns green; arcs swing to it. Then the old primary blinks back with its own crown. Writes split between the two (two copies of order #1042 with different addresses, red). A fence/✗ shuts the old one out. |
| 5:25–6:05 | ✓ Recap + next | 3 checks as in episodes 1–4. Tease **sharding**: "Every replica holds all the data. What happens when the data doesn't fit on one server?" | Recap checklist over the overview shot; next-video card with the mascot waving. |

Pacing: write at **~2.3 words/s** and let `npm run retime` lock timings, as in episodes 2–4.

## 2. Facts (verified 2026-11-04)

Narration and on-screen text may only use claims from this table.

| Claim usable in narration / on screen | Source |
|---|---|
| PostgreSQL streaming replication "is asynchronous by default" | [PostgreSQL: log-shipping standby servers](https://www.postgresql.org/docs/current/warm-standby.html) |
| Async: "If the primary server crashes then some transactions that were committed may not have been replicated to the standby server, causing data loss." Loss "is proportional to the replication delay at the time of failover." | same |
| Streaming replication delay is "typically under one second assuming the standby is powerful enough to keep up with the load" | same |
| Sync: each commit waits for confirmation that it reached the standby's disk; "The minimum wait time is the round-trip time between primary and standby." Needs `synchronous_standby_names`. | same |
| Standby (hot standby) connections are "strictly read-only"; INSERT/UPDATE/DELETE fail | [PostgreSQL: hot standby](https://www.postgresql.org/docs/current/hot-standby.html) |
| "there will be a measurable delay between primary and standby"; the same query on both "might therefore return differing results"; the standby is "eventually consistent with the primary" | same |
| PostgreSQL "does not provide the system software required to identify a failure on the primary and notify the standby"; external tools do | [PostgreSQL: failover](https://www.postgresql.org/docs/current/warm-standby-failover.html) |
| Promote a standby with `pg_ctl promote` or `pg_promote()` | same |
| The old primary must be told it's no longer the primary: STONITH "is necessary to avoid situations where both systems think they are the primary, which will lead to confusion and ultimately data loss" | same |
| MySQL: "Replication is asynchronous by default"; semisynchronous replication is supported too | [MySQL 8.4: replication](https://dev.mysql.com/doc/refman/8.4/en/replication.html) |
| RDS read replica: "a read-only copy of a DB instance", updated with asynchronous replication; route queries to it to reduce load on the primary | [RDS read replicas](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html) |
| RDS Multi-AZ: a "synchronous standby replica in a different Availability Zone"; "You can't use a standby replica to serve read traffic." | [RDS Multi-AZ instance deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html) |
| Read-your-writes: if a process writes and later reads, the read must observe that write | [Jepsen: read your writes](https://jepsen.io/consistency/models/read-your-writes) |

**Wording rules from checking:**
- No failover time (e.g. "60–120 seconds"): not found on the RDS page. Don't use any number.
- Don't say RDS Multi-AZ failover is "automatic" unless verified in step 2.
- "Under a second" only with the condition: if the replica keeps up.
- "Primary / replica" in narration. "Standby" only when quoting PostgreSQL or RDS.
- The read-your-writes fix ("read your own recent writes from the primary") is presented as one option, not a product feature.
- Multi-leader replication and consensus (Raft/Paxos): out of scope; one line at most, no claims.
- **Dropped:** "a replica is not a backup: a bad DELETE replicates too". No source states it (step 2).

## 3. Reuse vs. build

**Reuse as is:**
- CameraRig, Timeline, Hud, Label3D
- Overlays: meters, counters, recap panel, end card
- PacketPool, ArcPath
- NodeMesh: servers, database, `createLoadBalancer`, `createCacheNode` (cameo in the hook)
- `LogTape` from episode 3: the replication stream
- Mascot presenter and `Mascot.setOpacity` (the lost change as a ghost)
- the `beats.ts` pattern
- ThumbnailKit
- the whole pipeline: record (1440p upload render), voiceover, retime, shorts (with cold opens), thumbnail, metadata

**New components** (in `src/components/`):

| Component | Purpose |
|---|---|
| `ReplicationSim` | Deterministic simulation like `CacheSim`: writes at times → primary commit time, arrival time per replica (lag), sync vs async ack, which writes are lost if the primary dies at t, reads served by a replica at t (old or new value). Drives the lag counter and the "Saved ✓" timing, so numbers on screen are correct. |
| Primary/replica styling in NodeMesh | `createDatabase()` variants: a crown badge for the primary, a "read-only" lock for replicas, a dark "down" state. |
| `HealthCheck` (small) | The eye icon that pings the primary and triggers promotion. |

## 4. Shorts planned up front

Write these sections so each stands alone. Every Short opens on its problem or payoff (cold open), per CLAUDE.md's Shorts rules.

| Short | Source | Opens on |
|---|---|---|
| I saved it. Why is the old address back? | Section 3 | The page showing the old address after "Saved ✓" |
| Sync vs. async replication (comparison) | Section 4 | The primary dying with the change still on the wire |
| Split brain: two primaries, one database | Section 5 trap 2 | Two crowns, two different addresses for order #1042 |
| Read replicas in 40 seconds | Section 2 | A write bouncing off a replica: "read-only" |

## 5. Titles and thumbnails (draft, per niche rules)

- **Primary:** `How Database Replication Works: Primaries, Replicas, and Lag`
- **Test & compare:**
  - `I Saved It. Why Is the Old Data Back?` (failure)
  - `Two Primaries, One Database: Split Brain Explained` (failure)
  - `Database Replication Explained: System Design Basics, Animated`
- **Thumbnail variants** (scene: a primary with a crown and two replicas, the change on the wire):
  - a: `TWO PRIMARIES?` (surprise; two crowns, red)
  - b: `SAVED. THEN GONE?` (risk; ghost mascot, badge "0.8 s behind")
  - c: `DB DIES. SHOP LIVES.` (payoff; replica promoted, green)

## 6. Open questions (decide before step 3)

1. ~~Next-episode tease~~ **decided: sharding** ("Every replica holds all the data. What happens when the data doesn't fit on one server?"). The end card reads "Sharding".
2. ~~Running example~~ **decided:** order #1042 and the delivery-address change.

## 7. Production steps

| # | Step | Output |
|---|---|---|
| 1 | ~~Register the episode in `episodes.ts`~~ done (`replication`, slug `how-database-replication-works`, `autoTimed: true`; `shorts.ts` empty until step 7) | `--episode replication` works for the Node scripts |
| 2 | ~~Verify the remaining facts~~ done: "a replica is not a backup" was **not** found stated in PostgreSQL, MySQL or Azure docs (closest: MySQL delayed replication "to protect against user mistakes on the source"), so it's **dropped** from the script | This table final |
| 3 | ~~Write the full narration~~ done: 55 lines, 666 words; `say` overrides for PostgreSQL, MySQL, RDS, Multi-AZ, STONITH | `script.ts`, `SCRIPT.md` |
| 4 | ~~Voiceover dry run, `npm run retime`~~ done: **5:38**, no overruns after retime | `how-database-replication-works-voiceover.wav` |
| 5 | ~~Build components and scene~~ done: `ReplicationSim`, `NodeMesh.setDim` (a database that's down); `ReplicationScene`, `ReplicationStage`, `traffic.ts`, `beats.ts`, presenter. The health check is a HUD icon, and primary/replica roles are labels (★ Primary), not new meshes. Thumbnail entry in `main.ts` is a placeholder until step 7 | Stills reviewed in 3 passes |
| 6 | ~~Full render at 1440p, voiceover mux, captions~~ done: 5:38, 2560×1440, audio peak −1.4 dB; recorder now runs Vite without HMR/watch (a mid-render reload killed the first run) | `how-database-replication-works-1440p-voiced.mp4`, `.srt` |
| 7 | ~~Thumbnail (3 variants), Shorts with cold opens and covers, `YOUTUBE.md`, `CHANNEL.md` episode list~~ done: thumbnails TWO PRIMARIES? / SAVED. THEN GONE? / DB DIES. SHOP LIVES.; Shorts 37.9, 45.8, 43.8, 41.5 s, all with cold opens (#4 opens on the write bouncing off a replica); `YOUTUBE.md` with 17 chapters; `CHANNEL.md` lists episode 5, next up sharding | `Thumbnail.ts`, `shorts.ts`, `YOUTUBE.md` |
| 8 | After upload: log results after 7 days, including each Short's "Stayed to watch" | `PLAN.md` → Results |
