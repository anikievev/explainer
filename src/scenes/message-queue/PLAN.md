# Episode 3 plan: How Message Queues Work

Format: concept explainer · target **6:15–7:00** · 1080p (4K optional) · English narration, same voice (`Gfpl8Yo74Is0W6cPUWWT`).
Episode id `message-queue` · slug `how-message-queues-work`.

**Promise from episode 2:** the end card says "Message queues" and the narration says "Next up: message queues, for when traffic arrives faster than any server can answer." The first minute has to pay that off.

**Bridge from episode 2:** the load balancer spread requests across servers, but every request still did all its work while the user waited. The same shop, `shop.example`, now gets a checkout spike. Behind "Place order" sit four slow jobs: charge the card, update stock, send the email, build the invoice.

**Running example:** order `#1042` from the Berlin user. The Data Packet mascot is the **message** this time ("order #1042 placed"): it waits in line, gets picked up, gets dropped by a crashing worker, and comes back.

---

## 1. Structure and visual beats

| Time | Section | What the viewer learns | Main visual |
|---|---|---|---|
| 0:00–0:20 | Hook | "You click Place order. The spinner spins. Then: error. But your card was charged." | Checkout button, spinner, a chain of 4 services lighting up one by one; the email service turns red, the whole request fails. Title card. |
| 0:20–1:20 | 1 · The problem: doing everything now | The checkout server calls payment, stock, email and invoice **in a row**, while the user waits. Wait times add up. One slow or broken service fails the whole order. A spike hits every service at once. | One web server with 4 service nodes in a chain. A latency counter adds up per hop. Email node goes red, a red ✗ travels back to the user. |
| 1:20–2:40 | 2 · What a queue does | Producer → queue → consumer. The checkout drops a small message ("order #1042 placed") in the queue and answers right away: "Order received." Workers take messages at their own pace. A spike just makes the line longer (load leveling). More workers = drain faster (competing consumers). Email down? Messages wait; nothing is lost. Examples: Amazon SQS, RabbitMQ. | A purple queue tube (storage colour) between the shop and a row of worker nodes. Packets pile in fast, drain at a steady rate. Queue-depth meter rises then falls. Worker 3 drops in; drain speeds up. Email worker greys out, messages pile up, it recovers and drains them. |
| 2:40–4:00 | 3 · What if a worker crashes? | A received message is **hidden, not deleted** (SQS: visibility timeout, default 30 s). The worker deletes it only when done. Worker crashes → the timeout runs out → message reappears → another worker retries. RabbitMQ: unacknowledged messages are requeued. So delivery is **at least once**: duplicates happen → make work **idempotent** ("already charged #1042? skip"). A message that fails every time is a **poison message** → after N receives (`maxReceiveCount`) it moves to a **dead-letter queue**. | Mascot (message) goes semi-transparent with a 30 s ring timer while a worker holds it. Worker explodes red; ring runs out; mascot fades back into the line; worker 2 takes it. Duplicate charge "✗ charged twice" vs. idempotency check "✓ already done". A broken message bounces 3× then drops into a red DLQ bin. |
| 4:00–5:10 | 4 · Queue vs. log (Kafka) | A queue: each message goes to **one** worker and is gone when done. A log (Apache Kafka): events are **kept after reading**, so many teams can each read all of them, each at its own position. Retention is per topic (broker default 7 days). Order is kept **within a partition**; each partition goes to one consumer in a group. SQS standard: best-effort order, possible duplicates. SQS FIFO: strict order per message group, no duplicates sent within a 5-minute window. | Split: left, the queue hands each card to one worker and the card vanishes. Right, a tape (log) with numbered offsets; two consumer groups ("email", "analytics") with their own read heads moving along it; nothing disappears. |
| 5:10–6:20 | 5 · Three traps | (1) **A backlog that never drains:** if workers are slower than producers, the queue only grows. Watch queue depth and the age of the oldest message, then add workers. (2) **A dead-letter queue nobody watches:** failed orders sit there silently until they expire (SQS retention default 4 days, max 14). Alarm on it. (3) **"Received" is not "done":** the user sees a confirmation before the work runs, so the UI must show status (processing → shipped) and some failures arrive later (e.g. card declined email). | Queue depth meter climbing past red with "oldest: 2 h". DLQ bin filling quietly, a calendar ticking 1…4 days, messages fade out. Order page with a status pill "Processing" → "Confirmed". |
| 6:20–7:00 | ✓ Recap + next | 3 checks as in episodes 1–2. Tease: "The shop is fast now, until every page asks the same database the same question. Next: caching." | Recap checklist over the overview shot, then the next-video card with the mascot waving. |

Pacing: episode 2's voice read ~2.6 words/s after silence trimming; write the narration at **~2.3 words/s** and let `npm run retime` lock timings to the real clips (as in episode 2).

## 2. Facts (verified 2026-10-30)

Narration and on-screen text may only use claims from this table.

| Claim usable in narration / on screen | Source |
|---|---|
| SQS standard queues: **at-least-once** delivery; more than one copy may arrive, and messages may occasionally arrive **out of order** (best-effort ordering) | [AWS SQS standard queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html) |
| SQS stores each message redundantly in multiple Availability Zones before acknowledging the send | same |
| AWS's own use case: "decoupling live user requests from intensive background work" | same |
| A received message **stays in the queue but is invisible** to other consumers for the **visibility timeout**; default **30 s**, min 0, max **12 h** | [AWS SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html), [message quotas](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html) |
| Not deleted before the timeout (crash, error, network) → the message **becomes visible again** and can be received by the same or another consumer | [AWS SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) |
| Retention: default **4 days**, min 60 s, max **14 days**. Max message size **1 MiB**. Max delay 15 min | [AWS SQS message quotas](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html) |
| Dead-letter queue: `maxReceiveCount` = how many times a message can be received before it moves to the DLQ; DLQ must be in the same account and Region | [AWS SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) |
| Standard queues: in a DLQ, a message's expiry is based on its **original** enqueue time, so set the DLQ's retention longer than the source queue's | same |
| FIFO: strict order **within a message group**; no duplicates introduced if a send is retried within the **5-minute** deduplication interval | [AWS SQS FIFO exactly-once](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html), [visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) |
| FIFO throughput without high-throughput mode: 300 API calls/s per action, 3,000 messages/s with batches of 10 | [AWS SQS message quotas](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html) |
| Long polling waits up to **20 s** for a message instead of returning empty; short polling is the default | [AWS SQS short and long polling](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-short-and-long-polling.html) |
| RabbitMQ: unacknowledged deliveries are **automatically requeued** when the channel or connection closes; redeliveries carry `redeliver = true`; consumers "must be prepared to handle redeliveries… with idempotence in mind" | [RabbitMQ consumer acknowledgements](https://www.rabbitmq.com/docs/confirms) |
| RabbitMQ: automatic acknowledgement "should be considered unsafe": messages in flight are lost if the connection closes | same |
| Kafka: "events are not deleted after consumption"; retention is set per topic | [Apache Kafka intro](https://kafka.apache.org/intro) |
| Kafka: events with the same key go to the same partition; consumers read a partition in exactly the order it was written | same |
| Kafka broker default retention: `log.retention.hours` = **168** (7 days) | [Kafka config](https://apache.googlesource.com/kafka-site/+/refs/heads/cve2/20/generated/kafka_config.html), [Conduktor](https://kafka-options-explorer.conduktor.io/config/log-retention-hours/) |
| Kafka consumer groups: each partition is assigned to **exactly one consumer in the group**; a new consumer joining takes partitions over from existing ones | [KafkaConsumer javadoc](https://kafka.apache.org/39/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html) |

**Wording rules from checking:**
- Say "at least once", never "exactly once", for SQS standard and RabbitMQ. For FIFO say "no duplicates **sent** within 5 minutes", not "exactly-once processing" (a consumer can still crash mid-work).
- The 30 s / 4 days / 14 days numbers are **SQS defaults**; label them "Amazon SQS default" on screen.
- Kafka's 7 days is the broker default; topics often override it. On screen: "Kafka default: 7 days (per topic)".
- Old size limit 256 KB is outdated; SQS is now 1 MiB. Don't mention size unless needed.

**Not used (step 2 decision):** SNS → SQS fan-out and RabbitMQ dead-letter exchanges were left out of the script instead of verified; the Kafka section already covers "many readers", and the DLQ beat uses the SQS `maxReceiveCount` model only.

Avoid throughput bragging ("millions per second"). Use relative visuals (queue depth, counters).

## 3. Reuse vs. build

**Reuse as is:** CameraRig, Timeline, Hud, Label3D, Overlays (meters, counters, recap panel, end card), PacketPool, ArcPath, NodeMesh servers and database, `createLoadBalancer` (cameo in the hook), RequestQueue (queue body), Mascot presenter, `beats.ts` pattern (beats anchored to cue text), the whole pipeline (`record`, `voiceover`, `retime`, `shorts`, thumbnail, metadata).

**New components** (in `src/components/`, reusable for Kubernetes/microservices later):

| Component | Purpose |
|---|---|
| `QueueSim` | Deterministic simulation like `Distributor`: messages with enqueue time → worker, start, finish, crash, redelivery, DLQ move. Drives every counter and meter, so the numbers on screen are correct and reproducible. |
| `createQueueBroker()` in NodeMesh | Purple tube/conveyor node with an open slot in and out; the waiting messages sit inside it (RequestQueue). |
| `createWorker()` in NodeMesh | Small server variant with a "busy" light, for consumers. |
| `createDeadLetterBin()` | Red bin node for the DLQ. |
| `MessageCard` | Small card packet with a text label ("order #1042"), can go semi-transparent (invisible/in-flight) with a ring timer. |
| `LogTape` | Kafka view: a strip of numbered slots (offsets) with one or more read heads per consumer group. |

## 4. Shorts planned up front

Write these sections so each stands alone (hook line at the start, payoff at the end):

| Short | Source | Hook |
|---|---|---|
| Why "Order received" shows up instantly | Section 2 | "Your order was confirmed before anything happened." |
| What happens when a worker crashes mid-job | Section 3 | Message vanishes, comes back 30 s later |
| Dead-letter queues in 45 seconds | Section 3 end | "Some messages fail forever." |
| Queue vs. Kafka | Section 4 | One card, one worker vs. one tape, many readers |

## 5. Production steps

| # | Step | Output |
|---|---|---|
| 1 | ~~Register episode~~ done in `episodes.ts` (`main.ts` scene entry comes with the scene in step 5) | `--episode message-queue` works for the Node scripts |
| 2 | ~~Verify the remaining facts~~ done: unverified items dropped | This table final |
| 3 | ~~Write the full narration~~ done: 64 lines, 803 words, est. 6:26 | `script.ts` (`autoTimed: true`), `SCRIPT.md` |
| 4 | ~~Voiceover dry run, `npm run retime`~~ done: 6:13, no overruns | `how-message-queues-work-voiceover.wav` |
| 5 | ~~Build components and scene~~ done: `QueueSim`, `LogTape`, `createQueueBroker/Worker/DeadLetterBin`, `Mascot.setOpacity`; `MqScene`, `MqStage`, `traffic.ts`, `beats.ts`, presenter | Stills reviewed in 2 passes |
| 6 | ~~Full render, voiceover mux, captions~~ done: 4.7 min render | `how-message-queues-work-1080p-voiced.mp4`, `.srt` |
| 7 | Thumbnail, Shorts, YouTube metadata, update `CHANNEL.md` episode list | `Thumbnail.ts`, `shorts.ts`, `YOUTUBE.md` |

## 6. Packaging (draft)

- **Title:** `How Message Queues Work: Why Your Order Is Confirmed Instantly`
  - Alternative: `What Happens When a Worker Crashes? Message Queues Explained`
  - Alternative: `Message Queues Explained Visually: SQS, RabbitMQ & Kafka`
- **Thumbnail:** left, a frozen checkout spinner with a red ✗ ("WAIT…"); right, a purple queue feeding three green workers, mascot in line. Text: `DON'T MAKE USERS WAIT`.
- **Hashtags:** `#MessageQueue #SystemDesign #CloudArchitecture`

## Decisions

- **Length:** same as episode 2, around 7:00, a little shorter is fine. Cut rather than pad.
- **Vendor names:** on screen where they make a point concrete (Amazon SQS, RabbitMQ, Apache Kafka). Narration stays mostly vendor-neutral; SQS defaults labelled as such.
- **Next-episode tease:** **Caching** (confirmed 2026-10-30). Pays off episode 2's "caching and read replicas… a story for another video". End card: `Caching`.
