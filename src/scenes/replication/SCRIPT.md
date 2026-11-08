# How Database Replication Works — script

55 lines · 666 words · voiceover-locked runtime **5:38** (times below are the pre-voiceover estimates; `script.ts` has the real ones).
Facts: every number and vendor claim comes from the verified table in `PLAN.md` §2. Order 1042, the address change and the lag value (0.8 s) are *illustrative* and labelled "example" on screen.

## Hook

| ~Time | Narration | Visual |
|---|---|---|
| 0:00 | Mid-sale, the database server goes down. | Episode 4 shop; the purple database flickers and goes dark, red ✗ |
| 0:04 | The cache still answers some reads. But every order, every save, every cache miss now fails. | Arcs into the database turn red; misses bounce off the cache; error counter climbs |
| 0:12 | One machine took the whole shop down. | Camera pulls back: everything waits on one dark box |
| 0:16 | The fix is replication. Let's see how it works. | Title card: How Database Replication Works |

## Keep copies

| ~Time | Narration | Visual |
|---|---|---|
| 0:22 | Last episode, a cache took most of the reads off the database. | Cache node cameo with green hits |
| 0:28 | But there was still only one database. If it dies, everything that needs it dies too. | Spotlight on the single database |
| 0:36 | Replication keeps copies of the database on other servers. | The database splits into three |
| 0:41 | One server is the primary. It takes all the writes. | Crown badge on the primary; yellow write arcs go to it |
| 0:46 | The others are replicas. They get a stream of every change the primary makes, and apply it in the same order. | Change tapes (LogTape) run from the primary to each replica |
| 0:56 | You'll also hear leader and followers. Same idea. | Lower third: primary = leader · replica = follower |
| 1:00 | Remember order 1042? The customer changes the delivery address. | Mascot appears as the change: '#1042 · new address' |
| 1:05 | That change is written on the primary, then travels down the stream to each replica. | Mascot lands on the primary, then rides the tape to both replicas |

## Read replicas

| ~Time | Narration | Visual |
|---|---|---|
| 1:15 | Replicas are read-only. They can answer reads, but never writes. | Lock icon on each replica |
| 1:20 | In PostgreSQL, those connections are strictly read-only. An insert or an update just fails. | A write arc aimed at a replica bounces: ✗ read-only |
| 1:27 | So the app sends writes to the primary, and spreads reads across the replicas. | Blue read arcs fan out to the replicas; yellow writes all go to the primary |
| 1:34 | Amazon's docs describe exactly this: route reads to a replica to take load off the primary. | Primary load meter drops; tag 'AWS RDS: read replicas' |
| 1:42 | Need more reads? Add another replica. | A third replica slides in and gets its own tape |

## Replication lag

| ~Time | Narration | Visual |
|---|---|---|
| 1:47 | But copies take time to arrive. | Close-up on the tape: changes in transit |
| 1:51 | By default, PostgreSQL and MySQL replicate asynchronously. | Tag: async (default) |
| 1:54 | The primary says saved right away, and sends the change to the replicas afterwards. | Primary flashes ✓ while the change is still on the tape |
| 2:02 | So replicas run a little behind. PostgreSQL's docs say usually under a second, if the replica keeps up. | Lag counter 'replica behind: 0.8 s' (example) |
| 2:11 | Usually, nobody notices. But watch this. | Camera moves to the customer's phone |
| 2:14 | The customer saves the new address. The page says saved. | Phone: 'Saved ✓'; mascot leaves the primary |
| 2:19 | Then the page reloads, and the read goes to a replica that hasn't got the change yet. | Read arc to the replica; mascot still halfway down the tape |
| 2:27 | The old address is back. | Phone shows the old address in yellow |
| 2:31 | A moment later, the change lands, and the new address shows up. | Mascot lands; phone turns green |
| 2:37 | That's replication lag. It breaks something users expect: reading their own writes. | Lower third: read-your-writes |
| 2:44 | One fix: for a user's own recent changes, read from the primary. | That user's read arc swings to the primary |

## Sync vs. async

| ~Time | Narration | Visual |
|---|---|---|
| 2:52 | Lag has a darker side. | Lights dim |
| 2:54 | With asynchronous replication, the primary confirms the save, and the copies follow. | Async lane: ✓ immediately, change on the tape |
| 3:00 | If the primary crashes before a change reaches the replicas, that change is gone, even though the user saw saved. | Primary goes dark with the mascot on the tape; mascot fades to a ghost |
| 3:11 | The more lag, the more you lose. | Tape with several changes in transit, all fading |
| 3:15 | With synchronous replication, each save waits until a replica confirms it has the change. | Sync lane: round-trip arc, small timer, then ✓ |
| 3:22 | Then the replica already has every confirmed save. But every write is slower: it waits at least one round trip. | Primary dies; replica still holds the mascot (green); write timer label '+1 round trip' |
| 3:32 | PostgreSQL has a synchronous mode, and MySQL offers a semi-synchronous one. | Two small tags |
| 3:37 | Amazon RDS Multi-AZ keeps a synchronous standby in another availability zone. It can't serve reads. It's a spare, kept in sync. | Standby box in a second zone, greyed lock: no reads |
| 3:47 | So: async is fast, but can lose recent writes. Sync is safer, but slower. | Two lanes side by side with ✓/✗ summary |

## Failover and two traps

| ~Time | Narration | Visual |
|---|---|---|
| 3:56 | Now, the primary dies. | Primary goes dark |
| 3:59 | Something has to notice, and promote a replica to be the new primary. | Health-check eye pings; crown moves to replica 1 |
| 4:06 | PostgreSQL doesn't do that part itself. A separate tool watches the primary and triggers the switch. | Eye icon labelled 'failover tool' |
| 4:13 | The app's writes now go to the new primary, and the shop is back. | Write arcs swing to the new primary; error counter stops |
| 4:21 | Failover has two traps. | Lower third: two traps |
| 4:23 | First: lost writes. With async replication, anything that hadn't reached the replica is gone. | Ghost mascot callback |
| 4:30 | Second: split brain. | Title tag: split brain |
| 4:32 | The old primary comes back online, still thinking it's the primary. | Old primary lights up with its own crown: two crowns |
| 4:38 | Now two servers accept writes. Order 1042 gets one address on one, and a different address on the other. | Writes split; two #1042 cards with different addresses, red |
| 4:48 | PostgreSQL's docs warn this leads to confusion and, ultimately, data loss. | Quote tag from the docs |
| 4:53 | The fix has a blunt name: STONITH. Shoot the other node in the head. | Lower third: STONITH |
| 5:00 | Make sure the old primary is shut out, so there's only ever one primary. | Fence drops around the old primary; one crown remains |

## Recap

| ~Time | Narration | Visual |
|---|---|---|
| 5:09 | Let's recap. | Recap panel |
| 5:10 | Replication keeps copies: one primary takes the writes, and replicas follow and serve reads. | Check 1 |
| 5:17 | Async replicas lag, so users may not see their own change, and a crash can lose recent writes. Sync waits a round trip instead. | Check 2 |
| 5:28 | Failover promotes a replica. Make sure the old primary can't come back as a second one. | Check 3 |
| 5:36 | Next up: sharding. Every replica holds all the data. What happens when the data doesn't fit on one server? | Next-video card: Sharding |
| 5:45 | Have you ever seen your own change disappear after saving? Tell me below. | Comment question; mascot waves |
