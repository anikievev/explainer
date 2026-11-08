# YouTube metadata — How Database Replication Works

Channel: **Data Packet** · *Small packets. Big ideas.*
Files: `output/renders/how-database-replication-works-1440p-voiced.mp4` (5:38, 2560×1440) · captions `output/renders/how-database-replication-works.srt`
Shorts: `output/renders/shorts/replication/` (4 clips + covers + `SHORTS.md`)

## Title

Primary (60 chars):

```
How Database Replication Works: Primaries, Replicas, and Lag
```

Alternatives for A/B testing (YouTube "Test & compare"). Per the niche rules: one "How X Works" title, plus failure and myth angles:

```
I Saved It. Why Is the Old Data Back? (Replication Lag)
Two Primaries, One Database: Split Brain Explained
Database Replication Explained: System Design Basics, Animated
```

## Description

```
Mid-sale, the database server goes down, and one machine takes the whole shop with it. Replication fixes that by keeping copies on other servers. This 6-minute animation follows order #1042 and a delivery-address change through a primary and its replicas: reads, lag, a crash, and a failover with two traps.

What you'll see:
• Primary and replicas (leader and followers): every change streamed and applied in order
• Read replicas: read-only copies that take reads off the primary
• Replication lag: why a user can save a change and then see the old data
• Read-your-writes, and one fix: read a user's own recent changes from the primary
• Async vs. sync replication: lost writes on a crash vs. a round trip per write
• Failover: promoting a replica to be the new primary
• Trap 1: lost writes. Trap 2: split brain, and STONITH

⏱️ Chapters
0:00 The database goes down mid-sale
0:21 One database, one point of failure
0:33 Replication: a primary and its replicas
0:54 Order 1042: one change, streamed to every replica
1:07 Read replicas are read-only
1:21 Spreading reads, and adding replicas
1:40 Asynchronous by default
2:08 Replication lag: the old address comes back
2:27 Read-your-writes, and one fix
2:42 Async + a crash = lost writes
3:03 Synchronous replication: a round trip per write
3:25 RDS Multi-AZ: a synchronous standby
3:45 Failover: promoting a replica
4:06 Trap 1: lost writes
4:17 Trap 2: split brain
4:40 STONITH: only ever one primary
4:53 Recap and what's next

📌 The facts in this video
• PostgreSQL and MySQL replicate asynchronously by default; MySQL also offers semi-synchronous replication
• PostgreSQL docs: replicas are usually under a second behind, if the replica is powerful enough to keep up
• PostgreSQL hot standby connections are "strictly read-only"
• With async replication, a crash can lose committed transactions, in proportion to the replication delay (PostgreSQL docs)
• Synchronous commit waits at least one round trip to the standby (synchronous_standby_names)
• AWS: route reads to an RDS read replica to reduce load on the primary; RDS Multi-AZ keeps a synchronous standby in another Availability Zone that can't serve reads
• PostgreSQL doesn't detect a failed primary itself; an external tool triggers the promotion (pg_ctl promote)
• PostgreSQL docs warn that two primaries lead to "confusion and ultimately data loss"
• The lag shown on screen is slowed down; order numbers and addresses are examples

💬 Have you ever seen your own change disappear after saving? Tell me in the comments.

▶️ Previous episode: How Caching Works [link]
▶️ Next episode: sharding, for when the data doesn't fit on one server. Subscribe so you catch it.

Data Packet explains system design with animated 3D diagrams. Small packets. Big ideas.

#SystemDesign #Database #Replication
```

(≈ 2,800 characters; limit is 5,000. The first three hashtags show above the title.)

Only the first ~150 characters show before "…more". Alternative openings to test:

- A: `Mid-sale, the database server goes down, and one machine takes the whole shop with it.` (current: concrete scene, pain first)
- B: `Replication keeps copies of your database on other servers. Here's how primaries and replicas work, and the traps in lag and failover.` (keyword first)
- C: `The page said "saved", then the old address came back. That's replication lag, and here's how database replication really works.` (matches Short #1)

## Tags

Paste as comma-separated (≈ 420 characters; limit 500):

```
database replication, how replication works, replication explained, system design, system design interview, primary replica, leader follower, read replica, replication lag, read your writes, asynchronous replication, synchronous replication, semi synchronous replication, failover, split brain, stonith, postgresql replication, mysql replication, rds multi-az, high availability, data packet
```

## Upload settings

Same as episode 1 (`src/scenes/cdn/YOUTUBE.md`), except:

| Field | Value |
|---|---|
| File | the **1440p** render (YouTube encodes 1440p+ uploads with a better codec) |
| Caption language | English — upload `how-database-replication-works.srt` |
| Playlist | "Cloud Architecture" (episode 5) |

## Chapters check

- First chapter at 0:00 ✓
- 17 chapters, ascending, each ≥ 10 s ✓ (shortest: 4:06 → 4:17, 11 s)

## End screen (5:19–5:38)

From 5:19 the scene dims behind a "NEXT VIDEO: Sharding" card, the comment question appears below it, and the mascot waves on the right.
- **Element 1:** Video — "How Caching Works" (until the sharding episode exists), bottom-left
- **Element 2:** Subscribe button, bottom, left of center
- Start both at 5:19. Keep the right third clear for the mascot.

## Cards

| Time | Card |
|---|---|
| 0:22 | Video: "How Caching Works" (the narration calls back to it) |
| 1:28 | Poll: "Do you use read replicas?" Yes, in production / Only a standby / No, one database / Not sure |
| 3:46 | Video: "How Load Balancers Work" (a server dies, traffic moves on) |

## Pinned comment

```
Quick quiz 🧠 A user saves a new address. The page says "saved". They reload, and the read goes to a replica.
What can they see? 👇 (Answer at 2:19)
```

## Thumbnail

Three A/B variants for YouTube **Test & compare**: upload all three, and YouTube picks the winner by watch time. Re-render with `node src/scripts/record.ts --episode replication --thumbnail` (scene: `Thumbnail.ts`, style rules: `src/components/ThumbnailKit.ts`). The review sheet, including phone size, is `output/renders/how-database-replication-works-thumbnails-preview.png`.

| File | Hook | Badge | Type |
|---|---|---|---|
| `how-database-replication-works-thumbnail-a.jpg` (also `-thumbnail.jpg`) | TWO PRIMARIES? | ★ PRIMARY ×2 | surprise |
| `how-database-replication-works-thumbnail-b.jpg` | SAVED. THEN GONE? | CRASH · SAVED ✓ | risk |
| `how-database-replication-works-thumbnail-c.jpg` | DB DIES. SHOP LIVES. | PROMOTED ✓ | payoff |

Same scene in all three: a primary database streaming to a replica, with the mascot on the left reacting. In variant a, both glow red and both take writes (split brain). In b, the primary has crashed with a saved change still on the wire. In c, the primary is down and the promoted replica takes the writes. There's no title pill, and the bottom-right corner is kept clear for the duration badge.

## Social / community post

```
New video: How database replication works 🗄️📦
Primaries and replicas, why a user can save a change and then see the old data, how a crash can lose "saved" writes, and what happens when two servers both think they're the primary. 6 animated minutes.
```

## After this goes live

- In `src/scenes/caching/YOUTUBE.md` and on the caching video: replace "Next episode: replication" with the link, and point its end-screen video element at this video.
