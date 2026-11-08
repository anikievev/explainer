/**
 * "How Database Replication Works" — narration script. Times are in seconds and drive
 * the animation beats, the voiceover placement and the exported .srt captions.
 * Timings come from the measured voiceover clips: natural length + 0.7 s, plus
 * `hold` where the animation needs time. Re-lock after editing text with
 * `npm run voiceover -- --episode replication && npm run retime -- --episode replication`.
 */
import type { Cue, Section } from '../../components/Script.ts';
import { findCue, findSection, toSrt as cuesToSrt } from '../../components/Script.ts';

export const DURATION = 338;

export const SECTIONS: Section[] = [
  { start: 0, end: 21.4, index: "", title: "Hook" },
  { start: 21.4, end: 67.8, index: "1", title: "Keep copies" },
  { start: 67.8, end: 100.3, index: "2", title: "Read replicas" },
  { start: 100.3, end: 162, index: "3", title: "Replication lag" },
  { start: 162, end: 225.4, index: "4", title: "Sync vs. async" },
  { start: 225.4, end: 293.3, index: "5", title: "Failover and two traps" },
  { start: 293.3, end: 338, index: "✓", title: "Recap" },
];

export const CUES: Cue[] = [
  // Hook
  { start: 0.3, end: 4.2, text: "Mid-sale, the database server goes down.", hold: 0.5 },
  { start: 4.2, end: 12.9, text: "The cache still answers some reads. But every order, every save, every cache miss now fails.", hold: 0.5 },
  { start: 12.9, end: 16.3, text: "One machine took the whole shop down.", hold: 0.5 },
  { start: 16.3, end: 20.2, text: "The fix is replication. Let's see how it works." },

  // Keep copies
  { start: 21.7, end: 26.2, text: "Last episode, a cache took most of the reads off the database." },
  { start: 26.2, end: 33.3, text: "But there was still only one database. If it dies, everything that needs it dies too.", hold: 0.5 },
  { start: 33.3, end: 37.6, text: "Replication keeps copies of the database on other servers." },
  { start: 37.6, end: 41.9, text: "One server is the primary. It takes all the writes." },
  { start: 41.9, end: 50, text: "The others are replicas. They get a stream of every change the primary makes, and apply it in the same order.", hold: 0.5 },
  { start: 50, end: 54.4, text: "You'll also hear leader and followers. Same idea." },
  { start: 54.4, end: 59.8, text: "Remember order 1042? The customer changes the delivery address." },
  { start: 59.8, end: 66.6, text: "That change is written on the primary, then travels down the stream to each replica.", hold: 1.0 },

  // Read replicas
  { start: 68.1, end: 73.6, text: "Replicas are read-only. They can answer reads, but never writes." },
  { start: 73.6, end: 81.9, text: "In PostgreSQL, those connections are strictly read-only. An insert or an update just fails.", say: "In Postgres Q L, those connections are strictly read-only. An insert or an update just fails.", hold: 0.5 },
  { start: 81.9, end: 87.3, text: "So the app sends writes to the primary, and spreads reads across the replicas." },
  { start: 87.3, end: 95.6, text: "Amazon's docs describe exactly this: route reads to a replica to take load off the primary.", hold: 0.5 },
  { start: 95.6, end: 99.1, text: "Need more reads? Add another replica.", hold: 0.5 },

  // Replication lag
  { start: 100.6, end: 103.4, text: "But copies take time to arrive." },
  { start: 103.4, end: 109.3, text: "By default, PostgreSQL and MySQL replicate asynchronously.", say: "By default, Postgres Q L and My S Q L replicate asynchronously." },
  { start: 109.3, end: 115.7, text: "The primary says saved right away, and sends the change to the replicas afterwards.", hold: 0.5 },
  { start: 115.7, end: 124.6, text: "So replicas run a little behind. PostgreSQL's docs say usually under a second, if the replica keeps up.", say: "So replicas run a little behind. Postgres Q L's docs say usually under a second, if the replica keeps up.", hold: 0.5 },
  { start: 124.6, end: 128.4, text: "Usually, nobody notices. But watch this." },
  { start: 128.4, end: 133.6, text: "The customer saves the new address. The page says saved." },
  { start: 133.6, end: 139.2, text: "Then the page reloads, and the read goes to a replica that hasn't got the change yet." },
  { start: 139.2, end: 142.5, text: "The old address is back.", hold: 1.0 },
  { start: 142.5, end: 147.8, text: "A moment later, the change lands, and the new address shows up.", hold: 0.5 },
  { start: 147.8, end: 154.8, text: "That's replication lag. It breaks something users expect: reading their own writes.", hold: 0.5 },
  { start: 154.8, end: 160.8, text: "One fix: for a user's own recent changes, read from the primary.", hold: 0.5 },

  // Sync vs. async
  { start: 162.3, end: 164.6, text: "Lag has a darker side." },
  { start: 164.6, end: 170.5, text: "With asynchronous replication, the primary confirms the save, and the copies follow." },
  { start: 170.5, end: 179.5, text: "If the primary crashes before a change reaches the replicas, that change is gone, even though the user saw saved.", hold: 1.0 },
  { start: 179.5, end: 183.1, text: "The more lag, the more you lose.", hold: 0.5 },
  { start: 183.1, end: 190, text: "With synchronous replication, each save waits until a replica confirms it has the change." },
  { start: 190, end: 199.2, text: "Then the replica already has every confirmed save. But every write is slower: it waits at least one round trip.", hold: 0.5 },
  { start: 199.2, end: 205.6, text: "PostgreSQL has a synchronous mode, and MySQL offers a semi-synchronous one.", say: "Postgres Q L has a synchronous mode, and My S Q L offers a semi-synchronous one." },
  { start: 205.6, end: 216.5, text: "Amazon RDS Multi-AZ keeps a synchronous standby in another availability zone. It can't serve reads. It's a spare, kept in sync.", say: "Amazon R D S Multi A Z keeps a synchronous standby in another availability zone. It can't serve reads. It's a spare, kept in sync.", hold: 0.5 },
  { start: 216.5, end: 224.2, text: "So: async is fast, but can lose recent writes. Sync is safer, but slower.", hold: 0.5 },

  // Failover and two traps
  { start: 225.7, end: 228.8, text: "Now, the primary dies.", hold: 0.5 },
  { start: 228.8, end: 233.6, text: "Something has to notice, and promote a replica to be the new primary." },
  { start: 233.6, end: 241.1, text: "PostgreSQL doesn't do that part itself. A separate tool watches the primary and triggers the switch.", say: "Postgres Q L doesn't do that part itself. A separate tool watches the primary and triggers the switch." },
  { start: 241.1, end: 246.2, text: "The app's writes now go to the new primary, and the shop is back.", hold: 0.5 },
  { start: 246.2, end: 248.7, text: "Failover has two traps." },
  { start: 248.7, end: 257, text: "First: lost writes. With async replication, anything that hadn't reached the replica is gone.", hold: 0.5 },
  { start: 257, end: 259.5, text: "Second: split brain." },
  { start: 259.5, end: 265, text: "The old primary comes back online, still thinking it's the primary." },
  { start: 265, end: 274, text: "Now two servers accept writes. Order 1042 gets one address on one, and a different address on the other.", hold: 1.0 },
  { start: 274, end: 280.2, text: "PostgreSQL's docs warn this leads to confusion and, ultimately, data loss.", say: "Postgres Q L's docs warn this leads to confusion and, ultimately, data loss." },
  { start: 280.2, end: 286.2, text: "The fix has a blunt name: STONITH. Shoot the other node in the head.", say: "The fix has a blunt name: Stonith. Shoot the other node in the head." },
  { start: 286.2, end: 292.1, text: "Make sure the old primary is shut out, so there's only ever one primary.", hold: 0.5 },

  // Recap
  { start: 293.6, end: 295.1, text: "Let's recap." },
  { start: 295.1, end: 302.8, text: "Replication keeps copies: one primary takes the writes, and replicas follow and serve reads." },
  { start: 302.8, end: 313.2, text: "Async replicas lag, so users may not see their own change, and a crash can lose recent writes. Sync waits a round trip instead." },
  { start: 313.2, end: 319.6, text: "Failover promotes a replica. Make sure the old primary can't come back as a second one." },
  { start: 319.6, end: 328.2, text: "Next up: sharding. Every replica holds all the data. What happens when the data doesn't fit on one server?" },
  { start: 328.2, end: 333.5, text: "Have you ever seen your own change disappear after saving? Tell me below." },
];

export const cueAt = (t: number) => findCue(CUES, t);
export const sectionAt = (t: number) => findSection(SECTIONS, t);
export const toSrt = () => cuesToSrt(CUES);
