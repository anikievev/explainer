import { blendPose, poseCheer, poseIdle, posePoint, poseSurprised, poseWave, type MascotPose } from '../../components/Mascot.ts';
import type { MascotLayer } from '../../components/MascotLayer.ts';
import { fadeWindow, progress } from '../../components/Timeline.ts';
import { B } from './beats.ts';

type PoseFn = (t: number) => MascotPose;

/** Presenter reactions to on-screen events: [start, end, pose]. */
const REACTIONS: Array<[number, number, PoseFn]> = [
  [B.down + 2.4, B.down + 5, poseSurprised], // order failed, card charged
  [B.drops + 2.0, B.drops + 4.4, poseCheer], // instant "order received"
  [B.rush + 1, B.rush + 3.4, poseSurprised], // the sale spike
  [B.emailBack + 2.4, B.emailBack + 4.6, poseCheer], // nothing lost
  [B.crash + 0.8, B.crash + 3.6, poseSurprised], // worker crashes
  [B.retry + 2.2, B.retry + 4.4, poseCheer],
  [B.twice + 2.2, B.twice + 4.6, poseSurprised], // charged twice
  [B.example + 1.4, B.example + 3.6, poseCheer],
  [B.kafka + 0.4, B.kafka + 2.8, posePoint],
  [B.grows + 1.0, B.grows + 3.6, poseSurprised],
  [B.silence + 4.6, B.silence + 7, poseSurprised], // messages deleted
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
  if (t < B.click) {
    layer.update(t, { x: 960, y: 1010, heightPx: 290, appear: life(t, 0.3, B.click - 0.6), pose: poseWave(t), yaw: -0.15 });
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
