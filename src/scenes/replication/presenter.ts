import {
  blendPose,
  poseCheer,
  poseDetermined,
  poseIdle,
  poseNod,
  posePoint,
  poseSad,
  poseScared,
  poseShrug,
  poseSurprised,
  poseThinking,
  poseWave,
  poseWorried,
  type MascotPose,
} from '../../components/Mascot.ts';
import type { MascotLayer } from '../../components/MascotLayer.ts';
import { fadeWindow, progress } from '../../components/Timeline.ts';
import { B } from './beats.ts';

type PoseFn = (t: number) => MascotPose;

/**
 * Presenter reactions to the narration and on-screen events: [start, end, pose].
 * Matched to the moment: worry when something is about to break, fear at a
 * crash, sadness at lost data, thinking at a trade-off, determination at a fix.
 */
const REACTIONS: Array<[number, number, PoseFn]> = [
  // 1 · Keep copies
  [B.onlyOne + 2.4, B.onlyOne + 6.6, poseWorried], // "If it dies, everything that needs it dies too."
  [B.copies + 0.6, B.copies + 3.4, poseNod],
  [B.travels + 6.0, B.travels + 8.2, poseCheer], // change reached the replica
  // 2 · Read replicas
  [B.pgReadOnly + 2.6, B.pgReadOnly + 4.6, poseSurprised], // write bounced
  [B.aws + 1.5, B.aws + 3.6, poseCheer], // primary load drops
  [B.addReplica + 0.4, B.addReplica + 3.0, poseNod],
  // 3 · Replication lag
  [B.takeTime + 0.2, B.takeTime + 2.8, poseThinking],
  [B.behind + 0.6, B.behind + 3.6, poseShrug], // "a little behind"
  [B.watch + 1.4, B.watch + 3.6, posePoint], // "But watch this."
  [B.oldBack + 0.2, B.oldBack + 2.2, poseSurprised], // old address
  [B.oldBack + 2.2, B.lands + 0.4, poseWorried], // waiting for the change
  [B.lands + 0.6, B.lands + 2.8, poseCheer],
  [B.ryw + 2.6, B.ryw + 6.4, poseWorried], // "It breaks something users expect"
  [B.ownReads + 0.4, B.ownReads + 3.4, poseDetermined], // the fix
  // 4 · Sync vs. async
  [B.darker + 0.2, B.darker + 2.4, poseWorried],
  [B.crash + 2.8, B.crash + 6.0, poseScared], // the crash: saved writes lost
  [B.moreLag + 0.2, B.moreLag + 3.4, poseSad],
  [B.syncSafe + 1.6, B.syncSafe + 3.8, poseCheer], // nothing lost
  [B.syncSafe + 4.6, B.syncSafe + 8.4, poseShrug], // "But every write is slower"
  [B.summary + 0.4, B.summary + 6.4, poseThinking], // the trade-off
  // 5 · Failover and two traps
  [B.dies + 0.4, B.dies + 2.8, poseScared],
  [B.notice + 0.5, B.notice + 4.2, poseThinking], // something has to notice
  [B.back + 0.6, B.back + 2.8, poseCheer], // shop is back
  [B.twoTraps + 0.3, B.twoTraps + 2.4, poseWorried],
  [B.lostWrites + 1.4, B.lostWrites + 6.8, poseSad],
  [B.oldPrimary + 1.2, B.oldPrimary + 4.6, poseSurprised], // the old primary is back
  [B.twoWrites + 1.0, B.twoWrites + 4.4, poseScared], // split brain
  [B.docsWarn + 0.5, B.docsWarn + 4.6, poseWorried],
  [B.stonith + 0.5, B.stonith + 4.8, poseDetermined], // STONITH
  [B.shutOut + 0.6, B.shutOut + 2.8, posePoint],
  // Recap
  [B.recap1 + 0.5, B.recap1 + 1.8, poseNod],
  [B.recap2 + 0.5, B.recap2 + 1.8, poseNod],
  [B.recap3 + 0.5, B.recap3 + 1.8, poseCheer],
];

const life = (t: number, inAt: number, outAt: number, dur = 0.45) =>
  Math.min(progress(t, inAt, inAt + dur), 1 - progress(t, outAt, outAt + dur));

function reactingPose(t: number): MascotPose {
  let pose = poseIdle(t);
  for (const [start, end, fn] of REACTIONS) {
    const w = fadeWindow(t, start, end, 0.35);
    if (w > 0) pose = blendPose(pose, fn(t), w);
  }
  return pose;
}

/** Where the channel mascot stands on screen, and what it is doing. */
export function updatePresenter(layer: MascotLayer, t: number) {
  // Intro: waves under the title card.
  if (t >= B.fix && t < B.s1 + 0.6) {
    layer.update(t, { x: 960, y: 1010, heightPx: 290, appear: life(t, B.fix + 0.3, B.s1), pose: poseWave(t), yaw: -0.15 });
    return;
  }
  // Main sections: small presenter, bottom-left, reacting to events.
  if (t >= B.s1 && t < B.recap) {
    layer.update(t, { x: 150, y: 1045, heightPx: 220, appear: life(t, B.s1 + 0.6, B.recap - 0.6), pose: reactingPose(t) });
    return;
  }
  // Recap: under the checklist.
  if (t >= B.recap && t < B.next) {
    layer.update(t, { x: 190, y: 1045, heightPx: 220, appear: life(t, B.recap + 0.6, B.next - 0.6), pose: reactingPose(t), yaw: 0.25 });
    return;
  }
  // Outro: waves next to the "next video" card.
  if (t >= B.next) {
    layer.update(t, { x: 1590, y: 600, heightPx: 300, appear: life(t, B.next + 0.2, B.ask + 20), pose: poseWave(t), yaw: -0.45 });
    return;
  }
  layer.update(t, { x: 0, y: 0, heightPx: 0, appear: 0, pose: poseIdle(t) });
}
