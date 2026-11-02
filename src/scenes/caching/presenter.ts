import { blendPose, poseCheer, poseIdle, posePoint, poseSurprised, poseWave, type MascotPose } from '../../components/Mascot.ts';
import type { MascotLayer } from '../../components/MascotLayer.ts';
import { fadeWindow, progress } from '../../components/Timeline.ts';
import { B } from './beats.ts';

type PoseFn = (t: number) => MascotPose;

/** Presenter reactions to on-screen events: [start, end, pose]. */
const REACTIONS: Array<[number, number, PoseFn]> = [
  [B.thousands + 1, B.thousands + 3.4, poseSurprised], // database overloaded
  [B.hit + 1.0, B.hit + 3.4, poseCheer], // first hit
  [B.ratio + 1.5, B.ratio + 3.8, poseCheer], // database idles
  [B.cdn + 0.4, B.cdn + 2.6, posePoint],
  [B.wrong + 0.4, B.wrong + 2.8, poseSurprised], // wrong price
  [B.noEvict + 0.6, B.noEvict + 3.0, poseSurprised], // writes fail
  [B.stampede + 0.4, B.stampede + 3.0, poseSurprised], // stampede
  [B.coalesce + 3.0, B.coalesce + 5.2, poseCheer],
  [B.restart + 1.2, B.restart + 3.6, poseSurprised], // cold cache
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
