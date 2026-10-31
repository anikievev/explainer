# How Message Queues Work — script

64 lines · 803 words · voiceover-locked runtime **6:13** (times below are the pre-voiceover estimates; `script.ts` has the real ones).
Facts: every number and vendor claim comes from the verified table in `PLAN.md` §2. Numbers marked *illustrative* are labelled "example" on screen.


## Hook

| ~Time | Narration | Visual |
|---|---|---|
| 0:00 | Last time, a load balancer kept the shop online during a sale. | Episode 2 shop stage: LB + 3 green servers, cheering crowd of packets |
| 0:05 | Now you click Place order. The spinner spins, and spins. | Close on a checkout button; spinner turning; chain of 4 services lights up one by one |
| 0:11 | Then an error. But your card was charged anyway. | Email node turns red; red ✗ travels back; a green 'charged' receipt still pops |
| 0:15 | The fix is called a message queue. Let's see how it works. | Title card: How Message Queues Work |

## The problem: doing it all now

| ~Time | Narration | Visual |
|---|---|---|
| 0:22 | Behind that one button, the checkout server has four jobs. | Checkout server + 4 service nodes in a row |
| 0:27 | Charge the card. Update the stock. Send the email. Build the invoice. | Each service labels in: Payment, Stock, Email, Invoice |
| 0:33 | It does them one after another, while you wait. | Mascot (order) hops through each service in turn; user waits |
| 0:37 | Every step adds its own delay, and the delays add up. | Latency counter adds per hop: 300 ms + 200 ms + 900 ms + 600 ms (illustrative, labelled 'example') |
| 0:43 | If one service is slow, the whole checkout is slow. | Email node yellow; counter keeps climbing |
| 0:47 | If the email service is down, the order fails, even though the payment already went through. | Email node red; ✗ back to user; payment node still shows ✓ |
| 0:55 | And during a sale, every one of those services gets hit at the same moment. | Burst of packets hits all four services; all gauges go red |
| 1:01 | But does the email really have to go out before you see a confirmation? | Freeze; question mark over the email node |

## What a message queue does

| ~Time | Narration | Visual |
|---|---|---|
| 1:09 | It doesn't. And that's the idea behind a message queue. | Purple queue tube slides in between checkout and workers |
| 1:13 | The checkout server writes a short message: order 1042 was placed. | Mascot becomes a message card 'order #1042 placed' |
| 1:18 | It drops that message into the queue, and answers right away: order received. | Card drops into the tube; green 'Order received' back to user instantly |
| 1:24 | The part that sends messages is called the producer. | Label: Producer |
| 1:28 | On the other side, workers take messages from the queue and do the slow jobs. They're the consumers. | Row of 2 workers pulls cards; labels: Consumers |
| 1:36 | The queue holds every message until a worker is ready for it. | Cards wait in line inside the tube |
| 1:41 | When a sale starts, orders arrive faster than the workers can finish them. | Burst of cards in; depth meter rises |
| 1:47 | The queue just gets longer. Nothing falls over. The workers keep their own pace. | Queue grows; workers steady green; depth meter yellow |
| 1:54 | When the rush is over, they catch up, and the line drains. | Depth meter falls back to green |
| 2:00 | Need it faster? Add more workers. Each message still goes to just one of them. | Worker 3 drops in; drain speeds up; each card goes to exactly one worker |
| 2:08 | And if the email service goes down, its messages simply wait. | Email worker greys out; email cards pile up |
| 2:13 | When it comes back, it works through the backlog. Nothing is lost. | Email worker returns green; backlog drains |
| 2:19 | Amazon SQS and RabbitMQ are two popular message queues. | Lower third: Amazon SQS · RabbitMQ |

## When a worker crashes

| ~Time | Narration | Visual |
|---|---|---|
| 2:25 | But what if a worker crashes halfway through a job? | Close on worker 1 holding card #1042 |
| 2:30 | When a worker takes a message, the queue doesn't delete it. It hides it. | Card in the tube goes semi-transparent |
| 2:36 | On Amazon SQS, it stays hidden for 30 seconds by default. That's the visibility timeout. | Ring timer around the ghost card: 30 s; lower third: Visibility timeout · Amazon SQS default 30 s |
| 2:43 | When the job is done, the worker deletes the message for good. | Happy path: worker ✓, ghost card disappears |
| 2:49 | If the worker crashes first, the timer runs out, and the message shows up again. | Worker 1 flashes red and goes dark; ring runs out; card solid again |
| 2:55 | Another worker picks it up and tries again. | Worker 2 takes #1042 and finishes it |
| 3:00 | RabbitMQ does the same: if a worker disconnects before it acknowledges a message, the message goes back in the queue. | Lower third: RabbitMQ · not acknowledged → requeued |
| 3:09 | So every message is delivered at least once. Sometimes more than once. | Badge: AT LEAST ONCE |
| 3:14 | That means a job can run twice. And you don't want to charge a card twice. | Two payment ✓ for #1042 → red 'charged twice' |
| 3:21 | So make jobs idempotent: running the same message again changes nothing. | Lower third: Idempotent = safe to repeat |
| 3:27 | For example, check whether order 1042 was already charged. If it was, skip it. | Worker checks a small 'done' list: #1042 ✓ → skip |
| 3:33 | Some messages fail every single time, maybe because the data inside is broken. | A cracked red card bounces back from every worker |
| 3:39 | After a set number of tries, the queue moves them to a dead-letter queue. | Counter 1/3, 2/3, 3/3 → card drops into a red DLQ bin; lower third: maxReceiveCount |
| 3:46 | There they wait for a person to look at them, instead of being retried forever. | Normal cards flow again past the bin |

## Queues vs. logs

| ~Time | Narration | Visual |
|---|---|---|
| 3:54 | A queue hands each message to one worker. When the job is done, the message is gone. | Left half: card → one worker → vanishes |
| 4:01 | But sometimes several teams need the same event: email, shipping, and analytics. | Three team nodes wanting #1042 |
| 4:07 | That's where a log comes in, like Apache Kafka. | Right half: a tape of numbered slots (offsets); lower third: Apache Kafka |
| 4:11 | Kafka keeps events after they've been read. Each group of readers tracks its own position. | Two read heads (email, analytics) on the tape; events stay |
| 4:18 | So the email team and the analytics team both see every order, each at its own speed. | Heads move at different speeds; nothing disappears |
| 4:27 | Events are kept for a set time, chosen per topic. By default, that's seven days. | Lower third: Kafka default retention: 7 days (per topic) |
| 4:33 | Kafka keeps order within a partition. Events with the same key, like one customer's orders, land in the same partition. | Tape splits into 3 partitions; same-colour customer events land in one |
| 4:43 | A standard SQS queue tries to keep order, but doesn't promise it. | Cards occasionally swap places; label: best-effort order |
| 4:48 | An SQS FIFO queue keeps strict order within each message group. | Cards in strict order per group; label: FIFO |

## Three traps

| ~Time | Narration | Visual |
|---|---|---|
| 4:54 | Queues have their own traps. | Wide shot; chip: Three traps |
| 4:57 | First: a backlog that never drains. | Depth meter |
| 5:00 | If workers are slower than new messages, the queue only grows. | Queue keeps growing; meter past red |
| 5:06 | So watch how long the queue is, and how old the oldest message is. When they climb, add workers. | Badges: depth 4,800 · oldest 2 h (illustrative); worker 4 drops in |
| 5:14 | Second: a dead-letter queue nobody watches. | DLQ bin quietly filling |
| 5:17 | Failed orders sit there in silence. On SQS, messages are deleted after four days by default. | Day counter 1…4; cards fade out; lower third: Amazon SQS default retention: 4 days (max 14) |
| 5:24 | So set an alarm on it, and look before they're gone. | Alarm bell on the bin |
| 5:29 | Third: received isn't the same as done. | Order page with 'Order received' |
| 5:32 | The user sees a confirmation before the work has happened. | Card still in queue while the page says received |
| 5:37 | So the app should show a status, like processing, then confirmed, and handle problems that show up later, like a declined card. | Status pill: Processing → Confirmed; alt: 'Payment declined' email |

## Recap

| ~Time | Narration | Visual |
|---|---|---|
| 5:49 | Let's recap. | Recap panel |
| 5:50 | A queue lets the server answer now and do the slow work later, at the workers' pace. | Check 1 |
| 5:58 | Crashed jobs get retried, so make them safe to repeat. A log like Kafka keeps events for many readers. | Check 2 |
| 6:05 | And watch the backlog, the dead-letter queue, and what the user sees. | Check 3 |
| 6:11 | Next up: caching, for when every page asks the database the same question. | End card: Next video · Caching |
| 6:16 | What does your app put in a queue? Tell me below. | Question under the end card; mascot waves |
