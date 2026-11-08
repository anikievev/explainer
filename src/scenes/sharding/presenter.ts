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
 * Matched to the moment: worry when something is about to break, fear at an
 * overload, sadness at waste, thinking at a trade-off, determination at a fix.
 */
const REACTIONS: Array<[number, number, PoseFn]> = [
  // 1 · Split the data
  [B.slice + 0.6, B.slice + 3.2, poseNod],
  [B.writesSplit + 2.4, B.writesSplit + 5.0, poseCheer], // writes spread out
  [B.router + 0.4, B.router + 3.6, poseThinking], // how does a row find its shard?
  // 2 · Picking the shard key
  [B.today + 3.0, B.today + 7.6, poseWorried], // every write on the last shard
  [B.dateDocs + 0.6, B.dateDocs + 4.0, poseSad],
  [B.hash + 3.4, B.hash + 6.0, poseCheer], // balanced
  [B.balanced + 3.0, B.balanced + 7.0, poseWorried], // asks every shard
  [B.customer + 4.6, B.customer + 7.0, poseCheer], // one shard answers
  [B.notion + 0.4, B.notion + 3.0, poseNod],
  [B.goodKey + 0.6, B.goodKey + 5.4, poseDetermined],
  // 3 · Queries across shards
  [B.dontFit + 0.2, B.dontFit + 3.2, poseThinking],
  [B.scatter + 1.0, B.scatter + 4.6, poseShrug], // slow, doesn't scale
  [B.figma + 1.4, B.figma + 5.0, poseWorried], // one side fails
  [B.noTx + 0.6, B.noTx + 4.4, poseShrug],
  // 4 · The hot shard
  [B.huge + 2.6, B.huge + 5.0, poseSurprised],
  [B.flash + 1.4, B.flash + 4.6, poseWorried],
  [B.red + 0.4, B.red + 4.8, poseScared], // shard on fire
  [B.hotDocs + 0.6, B.hotDocs + 4.6, poseThinking],
  [B.limit + 0.6, B.limit + 4.0, poseWorried],
  [B.suffix + 1.0, B.suffix + 5.0, poseDetermined], // the fix
  [B.suffixCost + 0.6, B.suffixCost + 4.2, poseShrug],
  // 5 · Adding a shard
  [B.fifth + 1.0, B.fifth + 3.4, poseNod],
  [B.fourToFive + 0.6, B.fourToFive + 3.6, poseWorried],
  [B.thousand + 1.4, B.thousand + 6.6, poseScared], // 800 keys flying
  [B.onTheMove + 0.4, B.onTheMove + 4.0, poseSad],
  [B.logical + 0.4, B.logical + 4.0, poseThinking],
  [B.notion480 + 5.4, B.notion480 + 9.0, posePoint], // whole shards move
  [B.divides + 0.6, B.divides + 3.4, poseCheer],
  [B.balancer + 0.8, B.balancer + 3.6, poseNod],
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
