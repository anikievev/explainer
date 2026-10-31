/**
 * "How Message Queues Work" — narration script. Times are in seconds and drive
 * the animation beats, the voiceover placement and the exported .srt captions.
 * Timings come from the measured voiceover clips: natural length + 0.7 s, plus
 * `hold` where the animation needs time. Re-lock after editing text with
 * `npm run voiceover -- --episode message-queue && npm run retime -- --episode message-queue`.
 */
import type { Cue, Section } from '../../components/Script.ts';
import { findCue, findSection, toSrt as cuesToSrt } from '../../components/Script.ts';

export const DURATION = 373;

export const SECTIONS: Section[] = [
  { start: 0, end: 21.8, index: "", title: "Hook" },
  { start: 21.8, end: 63.7, index: "1", title: "The problem: doing it all now" },
  { start: 63.7, end: 136.2, index: "2", title: "What a message queue does" },
  { start: 136.2, end: 221.4, index: "3", title: "When a worker crashes" },
  { start: 221.4, end: 281.7, index: "4", title: "Queues vs. logs" },
  { start: 281.7, end: 338.4, index: "5", title: "Three traps" },
  { start: 338.4, end: 373, index: "✓", title: "Recap" },
];

export const CUES: Cue[] = [
  // Hook
  { start: 0.3, end: 5, text: "Last time, a load balancer kept the shop online during a sale." },
  { start: 5, end: 11.5, text: "Now you click Place order. The spinner spins, and spins.", hold: 1.0 },
  { start: 11.5, end: 16.2, text: "Then an error. But your card was charged anyway.", hold: 0.5 },
  { start: 16.2, end: 20.6, text: "The fix is called a message queue. Let's see how it works." },

  // The problem: doing it all now
  { start: 22.1, end: 26.7, text: "Behind that one button, the checkout server has four jobs." },
  { start: 26.7, end: 33.5, text: "Charge the card. Update the stock. Send the email. Build the invoice.", hold: 1.0 },
  { start: 33.5, end: 37.1, text: "It does them one after another, while you wait." },
  { start: 37.1, end: 42.6, text: "Every step adds its own delay, and the delays add up.", hold: 1.0 },
  { start: 42.6, end: 46.5, text: "If one service is slow, the whole checkout is slow." },
  { start: 46.5, end: 52.9, text: "If the email service is down, the order fails, even though the payment already went through.", hold: 0.5 },
  { start: 52.9, end: 58.1, text: "And during a sale, every one of those services gets hit at the same moment." },
  { start: 58.1, end: 62.5, text: "But does the email really have to go out before you see a confirmation?" },

  // What a message queue does
  { start: 64, end: 68.2, text: "It doesn't. And that's the idea behind a message queue." },
  { start: 68.2, end: 73.8, text: "The checkout server writes a short message: order 1042 was placed.", say: "The checkout server writes a short message: order ten forty-two was placed." },
  { start: 73.8, end: 79.9, text: "It drops that message into the queue, and answers right away: order received.", hold: 0.5 },
  { start: 79.9, end: 83.6, text: "The part that sends messages is called the producer." },
  { start: 83.6, end: 90.6, text: "On the other side, workers take messages from the queue and do the slow jobs. They're the consumers." },
  { start: 90.6, end: 94.8, text: "The queue holds every message until a worker is ready for it." },
  { start: 94.8, end: 99.6, text: "When a sale starts, orders arrive faster than the workers can finish them." },
  { start: 99.6, end: 107.3, text: "The queue just gets longer. Nothing falls over. The workers keep their own pace.", hold: 1.5 },
  { start: 107.3, end: 112.4, text: "When the rush is over, they catch up, and the line drains.", hold: 1.0 },
  { start: 112.4, end: 119.7, text: "Need it faster? Add more workers. Each message still goes to just one of them.", hold: 1.5 },
  { start: 119.7, end: 124, text: "And if the email service goes down, its messages simply wait." },
  { start: 124, end: 129.6, text: "When it comes back, it works through the backlog. Nothing is lost.", hold: 1.0 },
  { start: 129.6, end: 135, text: "Amazon SQS and RabbitMQ are two popular message queues.", say: "Amazon S Q S and Rabbit M Q are two popular message queues." },

  // When a worker crashes
  { start: 136.5, end: 140.1, text: "But what if a worker crashes halfway through a job?" },
  { start: 140.1, end: 145.1, text: "When a worker takes a message, the queue doesn't delete it. It hides it." },
  { start: 145.1, end: 153.9, text: "On Amazon SQS, it stays hidden for 30 seconds by default. That's the visibility timeout.", say: "On Amazon S Q S, it stays hidden for 30 seconds by default. That's the visibility timeout.", hold: 1.5 },
  { start: 153.9, end: 158, text: "When the job is done, the worker deletes the message for good." },
  { start: 158, end: 163.5, text: "If the worker crashes first, the timer runs out, and the message shows up again." },
  { start: 163.5, end: 168.2, text: "Another worker picks it up and tries again.", hold: 1.5 },
  { start: 168.2, end: 177.4, text: "RabbitMQ does the same: if a worker disconnects before it acknowledges a message, the message goes back in the queue.", say: "Rabbit M Q does the same: if a worker disconnects before it acknowledges a message, the message goes back in the queue." },
  { start: 177.4, end: 182.7, text: "So every message is delivered at least once. Sometimes more than once." },
  { start: 182.7, end: 188.1, text: "That means a job can run twice. And you don't want to charge a card twice." },
  { start: 188.1, end: 195.3, text: "So make jobs idempotent: running the same message again changes nothing.", say: "So make jobs idempotent: running the same message again changes nothing.", hold: 1.5 },
  { start: 195.3, end: 202.2, text: "For example, check whether order 1042 was already charged. If it was, skip it.", say: "For example, check whether order ten forty-two was already charged. If it was, skip it." },
  { start: 202.2, end: 208.3, text: "Some messages fail every single time, maybe because the data inside is broken." },
  { start: 208.3, end: 214.8, text: "After a set number of tries, the queue moves them to a dead-letter queue.", hold: 1.5 },
  { start: 214.8, end: 220.2, text: "There they wait for a person to look at them, instead of being retried forever." },

  // Queues vs. logs
  { start: 221.7, end: 228.1, text: "A queue hands each message to one worker. When the job is done, the message is gone." },
  { start: 228.1, end: 234.6, text: "But sometimes several teams need the same event: email, shipping, and analytics." },
  { start: 234.6, end: 238.4, text: "That's where a log comes in, like Apache Kafka." },
  { start: 238.4, end: 245.7, text: "Kafka keeps events after they've been read. Each group of readers tracks its own position.", hold: 1.0 },
  { start: 245.7, end: 253.7, text: "So the email team and the analytics team both see every order, each at its own speed.", hold: 1.5 },
  { start: 253.7, end: 260.1, text: "Events are kept for a set time, chosen per topic. By default, that's seven days." },
  { start: 260.1, end: 269.5, text: "Kafka keeps order within a partition. Events with the same key, like one customer's orders, land in the same partition.", hold: 1.0 },
  { start: 269.5, end: 274.8, text: "A standard SQS queue tries to keep order, but doesn't promise it.", say: "A standard S Q S queue tries to keep order, but doesn't promise it." },
  { start: 274.8, end: 280.5, text: "An SQS FIFO queue keeps strict order within each message group.", say: "An S Q S FIFO queue keeps strict order within each message group." },

  // Three traps
  { start: 282, end: 284.5, text: "Queues have their own traps." },
  { start: 284.5, end: 288.1, text: "First: a backlog that never drains." },
  { start: 288.1, end: 295, text: "If workers are slower than new messages, the queue only grows.", hold: 1.5 },
  { start: 295, end: 302.6, text: "So watch how long the queue is, and how old the oldest message is. When they climb, add workers." },
  { start: 302.6, end: 306.5, text: "Second: a dead-letter queue nobody watches." },
  { start: 306.5, end: 314.8, text: "Failed orders sit there in silence. On SQS, messages are deleted after four days by default.", say: "Failed orders sit there in silence. On S Q S, messages are deleted after four days by default." },
  { start: 314.8, end: 318.6, text: "So set an alarm on it, and look before they're gone." },
  { start: 318.6, end: 322.7, text: "Third: received isn't the same as done." },
  { start: 322.7, end: 326.7, text: "The user sees a confirmation before the work has happened." },
  { start: 326.7, end: 337.2, text: "So the app should show a status, like processing, then confirmed, and handle problems that show up later, like a declined card.", hold: 1.5 },

  // Recap
  { start: 338.7, end: 340.8, text: "Let's recap." },
  { start: 340.8, end: 346.9, text: "A queue lets the server answer now and do the slow work later, at the workers' pace." },
  { start: 346.9, end: 355, text: "Crashed jobs get retried, so make them safe to repeat. A log like Kafka keeps events for many readers." },
  { start: 355, end: 359.8, text: "And watch the backlog, the dead-letter queue, and what the user sees." },
  { start: 359.8, end: 365.8, text: "Next up: caching, for when every page asks the database the same question." },
  { start: 365.8, end: 369.4, text: "What does your app put in a queue? Tell me below." },
];

export const cueAt = (t: number) => findCue(CUES, t);
export const sectionAt = (t: number) => findSection(SECTIONS, t);
export const toSrt = () => cuesToSrt(CUES);
