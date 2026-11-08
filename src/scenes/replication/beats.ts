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
  down: at('Mid-sale, the database server goes down'),
  stillReads: at('The cache still answers some reads'),
  oneMachine: at('One machine took the whole shop down'),
  fix: at('The fix is replication'),

  // 1 · Keep copies
  s1: section('1'),
  lastEp: at('Last episode, a cache'),
  onlyOne: at('But there was still only one database'),
  copies: at('Replication keeps copies'),
  primary: at('One server is the primary'),
  replicas: at('The others are replicas'),
  leader: at("You'll also hear leader"),
  order: at('Remember order 1042'),
  travels: at('That change is written on the primary'),

  // 2 · Read replicas
  s2: section('2'),
  readOnly: at('Replicas are read-only'),
  pgReadOnly: at('In PostgreSQL, those connections'),
  spread: at('So the app sends writes to the primary'),
  aws: at("Amazon's docs describe exactly this"),
  addReplica: at('Need more reads'),

  // 3 · Replication lag
  s3: section('3'),
  takeTime: at('But copies take time'),
  async: at('By default, PostgreSQL and MySQL'),
  savedEarly: at('The primary says saved right away'),
  behind: at('So replicas run a little behind'),
  watch: at('Usually, nobody notices'),
  saves: at('The customer saves the new address'),
  reload: at('Then the page reloads'),
  oldBack: at('The old address is back'),
  lands: at('A moment later, the change lands'),
  ryw: at("That's replication lag"),
  ownReads: at("One fix: for a user's own recent changes"),

  // 4 · Sync vs. async
  s4: section('4'),
  darker: at('Lag has a darker side'),
  asyncMode: at('With asynchronous replication, the primary confirms'),
  crash: at('If the primary crashes before'),
  moreLag: at('The more lag, the more you lose'),
  syncMode: at('With synchronous replication, each save waits'),
  syncSafe: at('Then the replica already has every confirmed save'),
  vendors: at('PostgreSQL has a synchronous mode'),
  rds: at('Amazon RDS Multi-AZ'),
  summary: at('So: async is fast'),

  // 5 · Failover and two traps
  s5: section('5'),
  dies: at('Now, the primary dies'),
  notice: at('Something has to notice'),
  tool: at("PostgreSQL doesn't do that part itself"),
  back: at("The app's writes now go to the new primary"),
  twoTraps: at('Failover has two traps'),
  lostWrites: at('First: lost writes'),
  splitBrain: at('Second: split brain'),
  oldPrimary: at('The old primary comes back online'),
  twoWrites: at('Now two servers accept writes'),
  docsWarn: at("PostgreSQL's docs warn"),
  stonith: at('The fix has a blunt name'),
  shutOut: at('Make sure the old primary is shut out'),
  s5End: end('Make sure the old primary is shut out'),

  // Recap
  recap: section('✓'),
  recap1: at('Replication keeps copies: one primary'),
  recap2: at('Async replicas lag'),
  recap3: at('Failover promotes a replica'),
  next: at('Next up: sharding'),
  ask: at('Have you ever seen your own change'),
};
