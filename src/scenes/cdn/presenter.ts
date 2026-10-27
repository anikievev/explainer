import { blendPose, poseCheer, poseIdle, posePoint, poseSurprised, poseWave, type MascotPose } from '../../components/Mascot.ts';
import type { MascotLayer } from '../../components/MascotLayer.ts';
import { fadeWindow, progress } from '../../components/Timeline.ts';

type PoseFn = (t: number) => MascotPose;

/** Presenter reactions to on-screen events: [start, end, pose]. */
const REACTIONS: Array<[number, number, PoseFn]> = [
  [217.6, 221.0, posePoint], // request leaves
  [220.2, 223.6, poseCheer], // HIT
  [241.2, 246.0, poseSurprised], // MISS
  [262.8, 265.8, poseCheer], // next user HITs
  [294.2, 300.6, poseSurprised], // copy expired
  [302.8, 306.6, poseCheer], // 304 Not Modified
  [318.2, 321.8, poseSurprised], // purge
  [339.4, 344.2, poseSurprised], // bypass
  [358.2, 361.8, poseSurprised], // cold cache miss
  [376.4, 382.2, posePoint], // takeaway
  [395.3, 396.6, poseCheer], // recap ticks
  [401.3, 402.6, poseCheer],
  [407.3, 408.6, poseCheer],
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
  if (t < 6) {
    layer.update(t, { x: 960, y: 1010, heightPx: 290, appear: life(t, 0.3, 4.55), pose: poseWave(t), yaw: -0.15 });
    return;
  }
  // Close-up sections: small presenter, bottom-left, reacting to HIT / MISS.
  if (t >= 210 && t < 384) {
    layer.update(t, { x: 150, y: 1045, heightPx: 220, appear: life(t, 211, 382.4), pose: reactingPose(t) });
    return;
  }
  // Recap: under the checklist.
  if (t >= 390 && t < 412.4) {
    layer.update(t, { x: 190, y: 1045, heightPx: 220, appear: life(t, 391, 411.6), pose: reactingPose(t), yaw: 0.25 });
    return;
  }
  // Outro: waves next to the "next video" card.
  if (t >= 412.4) {
    layer.update(t, { x: 1590, y: 600, heightPx: 300, appear: life(t, 412.6, 418.6), pose: poseWave(t), yaw: -0.45 });
    return;
  }
  layer.update(t, { x: 0, y: 0, heightPx: 0, appear: 0, pose: poseIdle(t) });
}
