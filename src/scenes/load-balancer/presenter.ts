import { blendPose, poseCheer, poseIdle, posePoint, poseSurprised, poseWave, type MascotPose } from '../../components/Mascot.ts';
import type { MascotLayer } from '../../components/MascotLayer.ts';
import { fadeWindow, progress } from '../../components/Timeline.ts';
import { B } from './beats.ts';

type PoseFn = (t: number) => MascotPose;

/** Presenter reactions to on-screen events: [start, end, pose]. */
const REACTIONS: Array<[number, number, PoseFn]> = [
  [B.crash + 0.6, B.crash + 4, poseSurprised], // the single server goes down
  [B.job + 0.3, B.job + 2.6, poseCheer], // load balancer arrives
  [B.roundRobin + 0.5, B.roundRobin + 3, posePoint],
  [B.breaks + 0.6, B.breaks + 3.2, poseSurprised], // server 2 breaks
  [B.staysOpen, B.staysOpen + 3, poseCheer],
  [B.recovers + 4, B.recovers + 6, poseCheer],
  [B.failOpen + 2.5, B.failOpen + 6, poseSurprised],
  [B.autoscale + 5, B.autoscale + 7.5, poseCheer], // new server joins
  [B.paths + 0.3, B.paths + 3, posePoint],
  [B.pileUp + 3, B.pileUp + 6, poseSurprised], // carts lost
  [B.store + 1.4, B.store + 4, poseCheer],
  [B.runTwo + 3.6, B.runTwo + 6.4, poseCheer], // failover works
  [B.dbNotFaster, B.dbNotFaster + 3.5, poseSurprised],
  [B.recap1 + 0.5, B.recap1 + 1.8, poseCheer],
  [B.recap2 + 0.5, B.recap2 + 1.8, poseCheer],
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
  if (t < B.shop) {
    layer.update(t, { x: 960, y: 1010, heightPx: 290, appear: life(t, 0.3, B.shop - 0.6), pose: poseWave(t), yaw: -0.15 });
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
