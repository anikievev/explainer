/**
 * Vertical Shorts cut from the full "How Database Replication Works" render.
 * Times are looked up from cue text (like beats.ts), so they follow
 * `npm run retime`; each Short starts and ends on a cue boundary and stays
 * under 60 s.
 *
 * Every Short opens on its problem or payoff (`open`, or a start right on the
 * surprise line), never on setup: in the first uploads 86–91% of feed viewers
 * swiped away within the first seconds.
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
/** One or more whole cues, for a cold open. */
const clip = (first: string, last = first) => ({ start: from(first), end: cue(last).end + 0.2 });

const GREEN = '#34d399';
const YELLOW = '#fbbf24';
const RED = '#f87171';
const BLUE = '#38bdf8';
const PURPLE = '#a78bfa';

export const SHORTS: Short[] = [
  {
    slug: 'saved-but-the-old-address-is-back',
    question: 'Ever seen your own change disappear after saving?',
    // Open on the payoff: the old address after "Saved ✓".
    open: clip('The old address is back'),
    start: from('The customer saves the new address'),
    end: to("One fix: for a user's own recent changes"),
    hook: 'It said saved. Then the old address came back.',
    // The order card showing the old address while the change is still on the wire.
    cover: at('The old address is back') + 0.3,
    beats: [
      { at: at('The customer saves the new address'), text: 'Saved on the primary', color: GREEN },
      { at: at('Then the page reloads'), text: 'Read hits a lagging replica', color: YELLOW },
      { at: at('A moment later, the change lands'), text: 'Change lands', color: PURPLE },
      { at: at("That's replication lag"), text: 'Replication lag', color: YELLOW },
      { at: at("One fix: for a user's own recent changes"), text: 'Fix: read your own writes from the primary', color: GREEN },
    ],
    title: 'It said "saved". Why is the old data back? (replication lag)',
    description:
      'The save lands on the primary database, but the reload reads from a replica that has not received the change yet, so the old address comes back. That is replication lag, and it breaks read-your-writes. One fix: read a user\'s own recent changes from the primary.',
    hashtags: ['#systemdesign', '#database', '#postgresql'],
  },
  {
    slug: 'sync-vs-async-replication',
    question: 'Sync or async: which would you pick for payments?',
    linkedin: `The database said "saved". Then the primary crashed, and the save was gone.

With asynchronous replication, the primary confirms a write before the replicas have it. If it crashes in that window, changes the user already saw as saved are lost. The more replication lag, the more you lose.

Synchronous replication waits until a replica confirms each write. Nothing confirmed is lost, but every write waits at least one extra round trip. PostgreSQL has a synchronous mode, and MySQL offers a semi-synchronous one.

Sync or async: which would you pick for payments?`,
    // Start right on the crash: a confirmed save that never reached a replica.
    // No cold open: the async setup line sits only one line before the crash, so a
    // cold open replayed the crash line 6 s later. The pill names async instead.
    start: from('If the primary crashes before'),
    end: to('Then the replica already has every confirmed save'),
    hook: 'Async vs sync replication: which one loses data?',
    // The async crash: CRASH badge and the "saved, then lost" counter.
    cover: at('If the primary crashes before') + 4,
    beats: [
      { at: at('If the primary crashes before'), text: 'Async: crash = confirmed saves lost', color: RED },
      { at: at('The more lag, the more you lose'), text: 'More lag, more loss', color: RED },
      { at: at('With synchronous replication'), text: 'Sync: wait for a replica', color: GREEN },
      { at: at('Then the replica already has every confirmed save'), text: 'Safe, but +1 round trip', color: BLUE },
    ],
    title: 'Async vs. sync replication: which one loses your data?',
    description:
      'With asynchronous replication (the PostgreSQL and MySQL default), the primary confirms a save before the replicas have it, so a crash can lose writes the user already saw as saved. Synchronous replication waits for a replica to confirm, so nothing confirmed is lost, but every write waits at least one round trip.',
    hashtags: ['#systemdesign', '#database', '#postgresql'],
  },
  {
    slug: 'split-brain-two-primaries',
    question: 'Have you ever ended up with two primaries?',
    linkedin: `Failover worked. Then the old primary came back, and the database had two primaries.

The primary crashes, and a separate tool promotes a replica; PostgreSQL doesn't do that step itself. When the old primary comes back online, it still thinks it's the primary. Now two servers accept writes, and order 1042 gets one address on one and a different address on the other.

PostgreSQL's docs warn this leads to confusion and, ultimately, data loss. The fix has a blunt name: STONITH, "shoot the other node in the head". Fence the old primary out, so there is only ever one.

Have you ever had to clean up after two primaries?`,
    // No cold open: "Now two servers accept writes" comes 6 s into the main clip,
    // so replaying it sounded like a glitch. The Short opens on the crash instead:
    // the main clip starts at "The old primary comes back", which needs the
    // failover the Short cuts out; this line restores it over the failover footage.
    intro: { say: 'Your primary database crashes, and a replica is promoted to take its place.', at: at('Now, the primary dies') },
    start: from('The old primary comes back online'),
    end: to('Make sure the old primary is shut out'),
    hook: 'Two primaries. One order. Two addresses.',
    // TWO PRIMARIES badge with both addresses under the nodes.
    cover: at('Now two servers accept writes') + 3,
    beats: [
      { at: at('The old primary comes back online'), text: 'Old primary comes back', color: YELLOW },
      { at: at('Now two servers accept writes'), text: 'Split brain', color: RED },
      { at: at("PostgreSQL's docs warn"), text: '"Ultimately, data loss"', color: RED },
      { at: at('The fix has a blunt name'), text: 'STONITH', color: YELLOW },
      { at: at('Make sure the old primary is shut out'), text: 'Only ever one primary', color: GREEN },
    ],
    title: 'Split brain: when your database has two primaries',
    description:
      'After failover, the old primary comes back online still thinking it is the primary. Now two servers accept writes, and order 1042 gets a different address on each. PostgreSQL\'s docs warn this leads to confusion and ultimately data loss. The fix: fence the old primary out (STONITH), so there is only ever one primary.',
    hashtags: ['#systemdesign', '#database', '#distributedsystems'],
  },
  {
    slug: 'read-replicas-are-read-only',
    question: 'Do your reads go to replicas, or does the primary take everything?',
    // Open on the bounce: an update sent to a replica fails ("✗ read-only").
    // Starts on "Replicas are read-only" so "those connections" has something to point at.
    open: clip('Replicas are read-only', 'In PostgreSQL, those connections are strictly read-only'),
    start: from('So the app sends writes to the primary'),
    end: to('Need more reads? Add another replica'),
    hook: 'Send a write to a replica. It bounces.',
    // The write bouncing off a replica: "✗ read-only".
    cover: at('In PostgreSQL, those connections are strictly read-only') + 3.5,
    beats: [
      { at: at('Replicas are read-only'), text: 'Replicas: reads only', color: RED },
      { at: at('So the app sends writes to the primary'), text: 'Writes → primary, reads → replicas', color: BLUE },
      { at: at("Amazon's docs describe exactly this"), text: 'Take load off the primary', color: GREEN },
      { at: at('Need more reads?'), text: 'Add a replica', color: PURPLE },
    ],
    title: 'Read replicas: why writes bounce off them',
    description:
      'A read replica is a read-only copy of the database: in PostgreSQL, an insert or update on it just fails. So the app sends writes to the primary and spreads reads across the replicas, which takes load off the primary. Need more reads? Add another replica.',
    hashtags: ['#systemdesign', '#database', '#aws'],
  },
];
