# How Database Sharding Works — script

49 lines · 718 words · estimated runtime **6:18** (pre-voiceover estimate at 2.3 words/s; `script.ts` gets the real times after `npm run retime`).
Facts: every number and vendor claim comes from the verified table in `PLAN.md` §2. Customer 7, order 1042, seller 9 and all key counts are *illustrative*; the 800-of-1,000 count is computed by `ShardSim`.

## Hook

| ~Time | Narration | Visual |
|---|---|---|
| 0:00 | Black Friday. Every order is a write. | Write arcs pile into the primary; write meter climbs |
| 0:04 | And every write lands on one database server: the primary. | All write arcs hit the primary; it turns yellow, then red |
| 0:09 | Replicas copy everything, so each one is just as full. The disks are filling up on all of them. | Disk meters on primary and replicas all climb to red together |
| 0:19 | Another replica won't help. The fix is sharding. | A new replica slides in, already full; ✗ |
| 0:23 | In six minutes: how to pick a shard key, why one shard can melt down, and why adding a database can move 80 percent of your data. | Title card: How Database Sharding Works; mascot waves |

## Split the data

| ~Time | Narration | Visual |
|---|---|---|
| 0:37 | Sharding splits one table across several databases, called shards. | The big orders table slices into 4 colour-coded databases |
| 0:41 | Each shard holds a different slice of the rows. | Each shard shows its own stack of rows, different colours |
| 0:46 | Compare that with replicas. Every replica holds the same data. Shards hold different data. | Side by side: 3 identical replica stacks vs. 4 different shard stacks |
| 0:54 | So the writes split up too. Each shard only takes the writes for its own rows. | Write arcs fan out to all 4 shards; per-shard write bars stay green |
| 1:02 | But how does a row find its shard? A router reads one field, the shard key, and picks the shard. | Router box in front of the shards; a field on the row highlights: shard key |
| 1:11 | In MongoDB, that router is called mongos. Vitess, for MySQL, has one called VTGate. | Two small tags on the router: mongos · VTGate |
| 1:18 | Order 1042 belongs to customer 7. With the customer ID as the shard key, it goes to shard 3. | Mascot (#1042 · customer 7) reaches the router, which sends it to shard 3 |

## Picking the shard key

| ~Time | Narration | Visual |
|---|---|---|
| 1:30 | Everything depends on that key. Let's try three. | Checklist card: 1 date · 2 hash · 3 customer |
| 1:34 | First try: the order date. Each shard holds a range of dates. | Shards relabel: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec |
| 1:40 | But every new order has today's date. So every new write lands on the last shard, while the others sit idle. | All write arcs go to the last shard; its bar maxes out red; others idle |
| 1:50 | MongoDB's docs warn about this: with an always increasing key, one shard becomes the bottleneck for writes. | Lower third with the docs quote |
| 1:59 | Second try: hash the order ID. A hash scrambles the value, so orders spread evenly across the shards. | Hash box scrambles IDs; write bars even out, all green |
| 2:08 | Writes are balanced now. But ask for all of customer 7's orders, and the router has to ask every shard. | A query from customer 7 fans out to all 4 shards |
| 2:18 | Third try: the customer ID. Each customer's orders stay together, and customers spread across the shards. | Bars stay even; customer 7's query goes to shard 3 only |
| 2:27 | Notion shards its data the same way, by workspace. | Tag: Notion · shard key = workspace ID |
| 2:32 | A good shard key has many different values, they're used about evenly, and it doesn't keep growing like a date. | Three checks tick: many values · used evenly · not always increasing |

## Queries across shards

| ~Time | Narration | Visual |
|---|---|---|
| 2:43 | Even with a good key, some questions don't fit. | Camera pulls back over all shards |
| 2:48 | Top products today needs everyone's orders. So the router asks every shard, and merges the answers. | Query fans out to all shards; answers flow back and merge at the router |
| 2:56 | MongoDB calls this scatter gather. It can be slow, and it doesn't scale the way single shard queries do. | Timers on each shard; the slowest one sets the total |
| 3:05 | Transactions get harder too. | Two customers on different shards |
| 3:08 | Figma wrote that once transactions span shards, Postgres can no longer enforce them. | A change touching shard 1 and shard 4: one side ✓, the other ✗ |
| 3:15 | They chose not to support transactions across shards at all, and worked around the failures instead. | Tag: Figma · no cross-shard transactions |

## The hot shard

| ~Time | Narration | Visual |
|---|---|---|
| 3:24 | Now the customer key looks great. Until one customer gets huge. | A big-seller icon appears next to shard 2 |
| 3:30 | A big seller runs a flash sale. Their orders all share one ID, so they all land on one shard. | Flood of write arcs into shard 2 |
| 3:40 | That shard turns red, while the others are fine. | Shard 2 bar red, error counter on shard 2 only; others green |
| 3:45 | MongoDB's docs say it plainly: many different values don't, on their own, guarantee an even spread. | Docs quote lower third |
| 3:54 | And every shard has a limit. DynamoDB gives each partition at most a thousand write units per second. | Tag: DynamoDB · 1,000 write units/s per partition |
| 4:03 | One fix: split the hot key. Add a suffix, one to four, so that seller's writes land on several shards. | seller 9 splits into 9#1 … 9#4; arcs spread to 4 shards; shard 2 back to green |
| 4:13 | The cost: reading that seller's orders now means asking every piece, and merging. | A read fans out to the 4 pieces |

## Adding a shard

| ~Time | Narration | Visual |
|---|---|---|
| 4:21 | Sooner or later, four shards aren't enough. Let's add a fifth. | A fifth shard slides in, empty |
| 4:27 | A simple way to pick a shard is the hash, modulo the number of shards. | Formula card: shard = hash(key) % 4 |
| 4:34 | Go from four shards to five, and the answer changes for most keys. | Formula changes to % 5 |
| 4:41 | Here are a thousand keys. Eight hundred of them now belong on a different shard, and have to move. | 1,000 dots on 4 shards; 800 fly to new shards; counter 'moved: 800 / 1,000' |
| 4:51 | That's 80 percent of the data on the move, while the shop is still running. | Write bars flicker during the move |
| 4:59 | One way out: create many small shards up front, and put several on each machine. | Each database fills with small boxes: logical shards |
| 5:06 | Notion runs 480 logical shards on 32 databases. To grow, whole shards move to new machines, and no key changes its shard. | 480 small boxes on 32 machines; add machines; whole boxes move, dots inside stay |
| 5:17 | They picked 480 because it divides evenly in so many ways. | 480 = 32 × 15 = 40 × 12 = 48 × 10 |
| 5:23 | MongoDB works in a similar way: a balancer moves chunks of data between shards in the background. | Tag: MongoDB balancer |

## Recap

| ~Time | Narration | Visual |
|---|---|---|
| 5:33 | Let's recap. | Recap panel |
| 5:35 | Sharding splits the data, so each shard holds a slice and takes its own writes. | Check 1 |
| 5:42 | The shard key decides everything. A growing key makes a hot shard, and queries without the key ask every shard. | Check 2 |
| 5:52 | Adding shards moves data. Many small logical shards keep that manageable. | Check 3 |
| 5:57 | Next up: consistent hashing. Adding one shard moved 80 percent of the keys. What if it moved only a small slice? | Next-video card: Consistent hashing |
| 6:07 | What would you pick as the shard key for your app? Tell me below. | Comment question; mascot waves |
