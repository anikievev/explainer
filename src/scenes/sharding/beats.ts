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
  friday: at('Black Friday'),
  onePrimary: at('And every write lands on one database server'),
  disks: at('Replicas copy everything'),
  fix: at("Another replica won't help"),

  // 1 · Split the data
  s1: section('1'),
  splits: at('Sharding splits one table'),
  slice: at('Each shard holds a different slice'),
  compare: at('Compare that with replicas'),
  writesSplit: at('So the writes split up too'),
  router: at('But how does a row find its shard'),
  names: at('In MongoDB, that router is called mongos'),
  order: at('Order 1042 belongs to customer 7'),

  // 2 · Picking the shard key
  s2: section('2'),
  three: at("Everything depends on that key"),
  date: at('First try: the order date'),
  today: at("But every new order has today's date"),
  dateDocs: at("MongoDB's docs warn about this"),
  hash: at('Second try: hash the order ID'),
  balanced: at('Writes are balanced now'),
  customer: at('Third try: the customer ID'),
  notion: at('Notion shards its data the same way'),
  goodKey: at('A good shard key has many different values'),

  // 3 · Queries across shards
  s3: section('3'),
  dontFit: at("Even with a good key, some questions don't fit"),
  topProducts: at('Top products today'),
  scatter: at('MongoDB calls this scatter gather'),
  txHarder: at('Transactions get harder too'),
  figma: at('Figma wrote that once transactions span shards'),
  noTx: at('They chose not to support transactions across shards'),

  // 4 · The hot shard
  s4: section('4'),
  huge: at('Now the customer key looks great'),
  flash: at('A big seller runs a flash sale'),
  red: at('That shard turns red'),
  hotDocs: at("MongoDB's docs say it plainly"),
  limit: at('And every shard has a limit'),
  suffix: at('One fix: split the hot key'),
  suffixCost: at("The cost: reading that seller's orders"),

  // 5 · Adding a shard
  s5: section('5'),
  fifth: at("Sooner or later, four shards aren't enough"),
  modulo: at('A simple way to pick a shard is the hash'),
  fourToFive: at('Go from four shards to five'),
  thousand: at('Here are a thousand keys'),
  onTheMove: at("That's 80 percent of the data on the move"),
  logical: at('One way out: create many small shards'),
  notion480: at('Notion runs 480 logical shards'),
  divides: at('They picked 480 because'),
  balancer: at('MongoDB works in a similar way'),
  s5End: end('MongoDB works in a similar way'),

  // Recap
  recap: section('✓'),
  recap1: at('Sharding splits the data, so each shard'),
  recap2: at('The shard key decides everything'),
  recap3: at('Adding shards moves data'),
  next: at('Next up: consistent hashing'),
  ask: at('What would you pick as the shard key'),
};
