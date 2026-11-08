# YouTube metadata — How Database Sharding Works

Channel: **Data Packet** · *Small packets. Big ideas.*
Files: `output/renders/how-database-sharding-works-1440p-voiced.mp4` (5:45, 2560×1440) · captions `output/renders/how-database-sharding-works.srt`
Shorts: `output/renders/shorts/sharding/` (4 clips + covers + `SHORTS.md`)

## Title

Primary (66 chars):

```
How Database Sharding Works: Shard Keys, Hot Shards, and Resharding
```

Alternatives for A/B testing (YouTube "Test & compare"). Per the niche rules: one "How X Works" title, plus failure and myth angles:

```
Add One Server, Move 80% of Your Data (Sharding Explained)
Your Shard Key Is Wrong: Hot Shards Explained
Sharding Explained: System Design Basics, Animated
```

## Description

```
Black Friday: replicas took the reads, but every write still goes to one primary, and every replica holds the whole database. Sharding splits the data across databases instead. This 6-minute animation follows the shop's orders through a router and four shards: picking a shard key, queries that cross shards, a hot shard, and what happens when you add a fifth.

What you'll see:
• Sharding vs. replication: different data on each shard, not copies
• The router and the shard key (MongoDB mongos, Vitess VTGate)
• Three shard keys: order date (one hot shard), a hash (queries ask every shard), customer ID
• What makes a good shard key
• Scatter-gather queries and transactions across shards
• The hot shard: one huge customer, and splitting the hot key
• Adding a shard: hash % N moves 800 of 1,000 keys, and how logical shards avoid it

⏱️ Chapters
0:00 Black Friday: one primary takes every write
0:32 Sharding: split one table across databases
0:55 The router and the shard key
1:12 Order 1042 finds its shard
1:23 Shard key try 1: order date
1:50 Try 2: hash the order ID
2:08 Try 3: customer ID, and a good shard key
2:31 Queries across shards: scatter-gather
2:50 Transactions across shards
3:08 The hot shard: one huge customer
3:44 Fix: split the hot key
4:03 Adding a shard: hash % N
4:18 800 of 1,000 keys move
4:32 Logical shards: Notion's 480
5:05 Recap and what's next

📌 The facts in this video
• MongoDB: the shard key value determines a document's distribution across shards; mongos routes queries and writes to shards
• MongoDB: with an always-increasing shard key, one shard becomes the bottleneck for writes
• MongoDB: queries without the shard key are broadcast to all shards (scatter/gather), can be long running, and do not scale linearly
• MongoDB: high cardinality alone doesn't guarantee an even distribution; a background balancer migrates ranges between shards
• Vitess VTGate routes traffic to the correct VTTablet servers
• Figma: once transactions span shards, "Postgres can no longer be used to enforce transactionality"; they chose not to support atomic cross-shard transactions
• DynamoDB: each partition delivers at most 3,000 read units and 1,000 write units per second; write sharding adds a suffix, and reads then query all suffixes and merge
• Notion: 480 logical shards on 32 physical databases, sharded by workspace ID; 480 divides evenly many ways
• hash % 4 → hash % 5 moves 80% of keys (a key stays only if k mod 4 = k mod 5: 4 of every 20 values)
• Write rates on screen are examples; customer and order numbers are illustrative

💬 What would you pick as the shard key for your app? Tell me in the comments.

▶️ Previous episode: How Database Replication Works [link]
▶️ Next episode: consistent hashing, for adding a shard without moving most of the data. Subscribe so you catch it.

Data Packet explains system design with animated 3D diagrams. Small packets. Big ideas.

#SystemDesign #Database #Sharding
```

(≈ 2,900 characters; limit is 5,000. The first three hashtags show above the title.)

Only the first ~150 characters show before "…more". Alternative openings to test:

- A: `Black Friday: replicas took the reads, but every write still goes to one primary, and every replica holds the whole database.` (current: concrete scene, pain first)
- B: `Sharding splits one table across several databases. Here's how shard keys work, why one shard gets hot, and what happens when you add one.` (keyword first)
- C: `Add one database, and 80% of your data has to move. Here's how database sharding really works.` (matches Short #1)

## Tags

Paste as comma-separated (≈ 430 characters; limit 500):

```
database sharding, how sharding works, sharding explained, system design, system design interview, shard key, horizontal partitioning, hot shard, hot partition, scatter gather, resharding, logical shards, consistent hashing, sharding vs replication, mongodb sharding, vitess, dynamodb partition key, postgres sharding, database scaling, data packet
```

## Upload settings

Same as episode 1 (`src/scenes/cdn/YOUTUBE.md`), except:

| Field | Value |
|---|---|
| File | the **1440p** render (YouTube encodes 1440p+ uploads with a better codec) |
| Caption language | English — upload `how-database-sharding-works.srt` |
| Playlist | "Cloud Architecture" (episode 6) |

## Chapters check

- First chapter at 0:00 ✓
- 15 chapters, ascending, each ≥ 10 s ✓ (shortest: 1:12 → 1:23, 11 s)

## End screen (5:27–5:45)

From 5:27 the scene dims behind a "NEXT VIDEO: Consistent hashing" card, the comment question appears below it, and the mascot waves on the right.
- **Element 1:** Video — "How Database Replication Works" (until the consistent hashing episode exists), bottom-left
- **Element 2:** Subscribe button, bottom, left of center
- Start both at 5:27. Keep the right third clear for the mascot.

## Cards

| Time | Card |
|---|---|
| 0:09 | Video: "How Database Replication Works" ("Replicas copy everything": for viewers who want the replicas episode) |
| 1:26 | Poll: "What do you shard by?" Customer / tenant ID · Hash of an ID · Date or time · We don't shard |

## Pinned comment

```
Quick quiz 🧠 You shard with hash(key) % 4 and add a fifth shard. What share of your keys has to move?
👇 (Answer at 4:18)
```

## Thumbnail

Three A/B variants for YouTube **Test & compare**: upload all three, and YouTube picks the winner by watch time. Re-render with `node src/scripts/record.ts --episode sharding --thumbnail` (scene: `Thumbnail.ts`, style rules: `src/components/ThumbnailKit.ts`). The review sheet, including phone size, is `output/renders/how-database-sharding-works-thumbnails-preview.png`.

| File | Hook | Badge | Type |
|---|---|---|---|
| `how-database-sharding-works-thumbnail-a.jpg` (also `-thumbnail.jpg`) | ONE HOT SHARD | ALL WRITES | risk |
| `how-database-sharding-works-thumbnail-b.jpg` | 80% MOVED? | 800 / 1,000 | surprise |
| `how-database-sharding-works-thumbnail-c.jpg` | SPLIT THE DATA | — | payoff |

Same scene in all three: shard databases in a row with stacks of keys, and the mascot on the left. In variant a, red writes pour into one shard. In b, yellow keys fly from four shards to a fifth. In c, four even, green shards. There's no title pill, and the bottom-right corner is kept clear for the duration badge.

## Social / community post

```
New video: How database sharding works 🗂️📦
Why replicas don't help with writes, how to pick a shard key (and why a date is a trap), what a hot shard looks like, and why adding one database can move 80% of your data. 6 animated minutes.
```

## After this goes live

- In `src/scenes/replication/YOUTUBE.md` and on the replication video: replace "Next episode: sharding" with the link, and point its end-screen video element at this video.
