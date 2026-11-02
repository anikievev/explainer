/**
 * Vertical Shorts cut from the full "How Message Queues Work" render. Times
 * are looked up from cue text (like beats.ts), so they follow `npm run retime`;
 * each Short starts and ends on a cue boundary and stays under 60 s.
 */
import type { Short } from '../../components/Script.ts';
import { CUES } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
/** Start a little before the cue, end a little after it, so no word is clipped. */
const from = (fragment: string) => cue(fragment).start - 0.3;
const to = (fragment: string) => cue(fragment).end + 0.8;
const at = (fragment: string) => cue(fragment).start;

const GREEN = '#34d399';
const YELLOW = '#fbbf24';
const RED = '#f87171';
const BLUE = '#38bdf8';

export const SHORTS: Short[] = [
  {
    slug: 'why-order-received-shows-up-instantly',
    start: from('But does the email really have to go out'),
    end: to('When the rush is over'),
    hook: 'Your order was confirmed before anything happened.',
    // Order 1042 dropping into the queue while checkout answers "order received".
    cover: at('It drops that message into the queue') + 3,
    beats: [
      { at: at('The checkout server writes a short message'), text: 'Order 1042 → queue', color: BLUE },
      { at: at('It drops that message into the queue'), text: 'Answer now: received', color: GREEN },
      { at: at('On the other side, workers'), text: 'Workers do the slow jobs', color: BLUE },
      { at: at('When a sale starts'), text: 'Rush: the queue grows', color: YELLOW },
      { at: at('When the rush is over'), text: 'Rush over: line drains', color: GREEN },
    ],
    title: 'Why "Order received" shows up instantly: message queues',
    description:
      'The checkout server drops a short message into a queue and answers right away. Workers take messages from the queue and do the slow jobs (charge, email, invoice) at their own pace. During a sale the queue just gets longer, and it drains when the rush is over.',
    hashtags: ['#systemdesign', '#messagequeue', '#backend'],
  },
  {
    slug: 'what-happens-when-a-worker-crashes',
    start: from('When a worker takes a message'),
    end: to('So make jobs idempotent'),
    hook: 'A worker crashed mid-job. Now what?',
    // The hidden message reappearing after the crash.
    cover: at('If the worker crashes first') + 3,
    beats: [
      { at: at('When a worker takes a message'), text: 'Taken = hidden, not deleted', color: BLUE },
      { at: at('On Amazon SQS, it stays hidden'), text: 'SQS: hidden for 30 s', color: YELLOW },
      { at: at('If the worker crashes first'), text: 'Crash → it comes back', color: RED },
      { at: at('So every message is delivered at least once'), text: 'At least once', color: YELLOW },
      { at: at('So make jobs idempotent'), text: 'Fix: idempotent jobs', color: GREEN },
    ],
    title: 'What happens when a worker crashes mid-job (SQS visibility timeout)',
    description:
      'A queue hides a message while a worker handles it. On Amazon SQS the visibility timeout is 30 seconds by default. If the worker crashes, the message shows up again and another worker retries it, so jobs can run twice. Make them idempotent.',
    hashtags: ['#systemdesign', '#aws', '#messagequeue'],
  },
  {
    slug: 'three-message-queue-traps',
    start: from('Queues have their own traps'),
    end: to('So the app should show a status'),
    hook: '3 message queue traps',
    // Backlog meters climbing: queue length and oldest message age.
    cover: at('So watch how long the queue is') + 3,
    beats: [
      { at: at('First: a backlog that never drains'), text: '1/3 · Backlog never drains', color: RED },
      { at: at('Second: a dead-letter queue nobody watches'), text: '2/3 · Unwatched DLQ', color: RED },
      { at: at("Third: received isn't the same as done"), text: '3/3 · Received ≠ done', color: YELLOW },
    ],
    title: '3 message queue traps (and how to avoid them)',
    description:
      'Watch the queue length and the age of the oldest message, and add workers when they climb. Set an alarm on the dead-letter queue: on SQS, messages are deleted after 4 days by default. And show users a status, because received is not the same as done.',
    hashtags: ['#systemdesign', '#messagequeue', '#aws'],
  },
  {
    slug: 'message-queue-vs-kafka',
    start: from('A queue hands each message to one worker'),
    end: to('Kafka keeps order within a partition'),
    hook: 'Queue vs. Kafka',
    // Kafka log tape with two reader groups at different positions.
    cover: at('So the email team and the analytics team') + 3,
    beats: [
      { at: at('A queue hands each message to one worker'), text: 'Queue: one reader, then gone', color: BLUE },
      { at: at("Kafka keeps events after they've been read"), text: 'Log: events stay', color: GREEN },
      { at: at('Events are kept for a set time'), text: 'Kept 7 days by default', color: GREEN },
      { at: at('Kafka keeps order within a partition'), text: 'Order per partition', color: BLUE },
    ],
    title: "Message queue vs. Kafka: what's the difference?",
    description:
      'A queue hands each message to one worker, and the message is gone when the job is done. Kafka keeps events after they are read, and each group of readers tracks its own position. Retention is set per topic; the broker default is 7 days. Order is kept within a partition.',
    hashtags: ['#kafka', '#systemdesign', '#messagequeue'],
  },
];
