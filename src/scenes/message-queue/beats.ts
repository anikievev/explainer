/**
 * Beat times, looked up from the narration by text so the animation follows
 * the script after `npm run retime`. Every value is the start (or end) of the
 * cue that contains the fragment.
 */
import { CUES, SECTIONS } from './script.ts';

function cue(fragment: string) {
  const found = CUES.find((c) => c.text.includes(fragment));
  if (!found) throw new Error(`No cue contains "${fragment}"`);
  return found;
}
const at = (fragment: string) => cue(fragment).start;
const end = (fragment: string) => cue(fragment).end;
const section = (index: string) => SECTIONS.find((s) => s.index === index)!.start;

export const B = {
  // Hook
  lastTime: at('Last time, a load balancer'),
  click: at('Now you click Place order'),
  error: at('Then an error'),
  fix: at('The fix is called a message queue'),

  // 1 · The problem
  s1: section('1'),
  fourJobs: at('Behind that one button'),
  jobs: at('Charge the card'),
  inARow: at('It does them one after another'),
  delays: at('Every step adds its own delay'),
  slow: at('If one service is slow'),
  down: at('If the email service is down'),
  spike: at('And during a sale, every one'),
  question: at('But does the email really'),

  // 2 · What a queue does
  s2: section('2'),
  idea: at("It doesn't. And that's the idea"),
  message: at('The checkout server writes a short message'),
  drops: at('It drops that message into the queue'),
  producer: at('The part that sends messages'),
  consumers: at('On the other side, workers'),
  holds: at('The queue holds every message'),
  rush: at('When a sale starts, orders arrive faster'),
  longer: at('The queue just gets longer'),
  drains: at('When the rush is over'),
  moreWorkers: at('Need it faster? Add more workers'),
  emailDown: at('And if the email service goes down'),
  emailBack: at('When it comes back'),
  vendors: at('Amazon SQS and RabbitMQ'),

  // 3 · When a worker crashes
  s3: section('3'),
  crashQ: at('But what if a worker crashes'),
  hides: at("the queue doesn't delete it"),
  timeout: at('stays hidden for 30 seconds'),
  deletes: at('When the job is done, the worker deletes'),
  crash: at('If the worker crashes first'),
  retry: at('Another worker picks it up'),
  rabbit: at('RabbitMQ does the same'),
  atLeastOnce: at('So every message is delivered at least once'),
  twice: at('That means a job can run twice'),
  idempotent: at('So make jobs idempotent'),
  example: at('For example, check whether order'),
  poison: at('Some messages fail every single time'),
  dlq: at('After a set number of tries'),
  person: at('There they wait for a person'),

  // 4 · Queues vs. logs
  s4: section('4'),
  oneWorker: at('A queue hands each message to one worker'),
  teams: at('But sometimes several teams'),
  kafka: at("That's where a log comes in"),
  keeps: at('Kafka keeps events after'),
  bothSee: at('So the email team and the analytics team'),
  retention: at('Events are kept for a set time'),
  partitions: at('Kafka keeps order within a partition'),
  standard: at('A standard SQS queue tries'),
  fifo: at('An SQS FIFO queue keeps strict order'),

  // 5 · Traps
  s5: section('5'),
  traps: at('Queues have their own traps'),
  backlog: at('First: a backlog'),
  grows: at('If workers are slower than new messages'),
  watch: at('So watch how long the queue is'),
  dlqTrap: at('Second: a dead-letter queue nobody watches'),
  silence: at('Failed orders sit there in silence'),
  alarm: at('So set an alarm on it'),
  notDone: at("Third: received isn't the same as done"),
  confirmation: at('The user sees a confirmation'),
  status: at('So the app should show a status'),
  s5End: end('So the app should show a status'),

  // Recap
  recap: section('✓'),
  recap1: at('A queue lets the server answer now'),
  recap2: at('Crashed jobs get retried'),
  recap3: at('And watch the backlog'),
  next: at('Next up: caching'),
  ask: at('What does your app put in a queue'),
};
