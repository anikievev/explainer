import * as THREE from 'three';
import type { Hud } from '../../components/Hud.ts';
import { ArcPath } from '../../components/ArcPath.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { poseCheer, posePoint, poseSurprised } from '../../components/Mascot.ts';
import { createEdgeServer, createOriginServer, createUser, type NodeMesh } from '../../components/NodeMesh.ts';
import { drawHook, glow, numberBadge, pickVariant, vignette, type ThumbnailVariant, type VariantId } from '../../components/ThumbnailKit.ts';
import { WorldMap, geo } from '../../components/WorldMap.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { EDGES, ORIGIN_VIRGINIA, USERS } from './locations.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [-3.3, 12.2, 3.9];
const CAMERA_TARGET: V3 = [-3.3, 0, -4.7];
const NODE_SCALE = 1.0;
/** Pose time picked for a clear gesture. */
const POSE_T = 1.2;

/** A/B variants for YouTube "Test & compare". Each hook matches a claim in the video. */
const VARIANTS: ThumbnailVariant[] = [
  {
    id: 'a',
    lines: [
      { text: "WHY IT'S", color: '#f1f5f9' },
      { text: 'FAST', color: CSS.healthy },
    ],
    pose: poseCheer,
  },
  {
    id: 'b',
    lines: [
      { text: '~100 MS', color: CSS.failure },
      { text: '→ ~10 MS', color: CSS.healthy },
    ],
    pose: posePoint,
  },
  {
    id: 'c',
    lines: [
      { text: 'FAR AWAY.', color: '#f1f5f9' },
      { text: 'STILL FAST.', color: CSS.healthy },
    ],
    pose: poseSurprised,
  },
];

const lifted = (lonLat: [number, number]) => geo(...lonLat, 0.06);

/**
 * Static YouTube thumbnail: Berlin's long trip to the Virginia origin (red)
 * vs. the short hop to the Frankfurt edge (green), with the mascot and hook.
 */
export class CdnThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly variant: ThumbnailVariant;
  private readonly map = new WorldMap();
  private readonly nodes: NodeMesh[] = [];
  private readonly longTrip: ArcPath;
  private readonly shortTrip: ArcPath;
  private readonly edge: NodeMesh;

  constructor(aspect: number, variant: VariantId = 'a') {
    this.variant = pickVariant(VARIANTS, variant);
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.camera.position.set(...CAMERA_POSITION);
    this.camera.lookAt(...CAMERA_TARGET);

    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 30, 60);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    this.scene.add(key, this.map.group);

    this.place(createOriginServer(), lifted(ORIGIN_VIRGINIA).setY(0.04));
    this.edge = this.place(createEdgeServer(), geo(...EDGES.frankfurt.lonLat));
    this.edge.setStatus(COLORS.healthy);
    this.place(createUser(), geo(...USERS.berlin.lonLat));

    const berlin = lifted(USERS.berlin.lonLat);
    this.longTrip = new ArcPath(berlin, lifted(ORIGIN_VIRGINIA), { radius: 0.09, color: COLORS.failure });
    this.longTrip.show(0.55);
    this.shortTrip = new ArcPath(berlin, lifted(EDGES.frankfurt.lonLat), { radius: 0.12, height: 1.1, color: COLORS.healthy });
    this.shortTrip.show(1);
    this.scene.add(this.longTrip.mesh, this.shortTrip.mesh);
  }

  private place(node: NodeMesh, position: THREE.Vector3) {
    node.group.position.copy(position);
    node.setBaseScale(NODE_SCALE);
    node.setAppear(1);
    this.scene.add(node.group);
    this.nodes.push(node);
    return node;
  }

  update() {
    this.presenter.update(POSE_T, { x: 1380, y: 1000, heightPx: 430, appear: 1, pose: this.variant.pose(POSE_T), yaw: -0.45 });
  }

  drawOverlay(hud: Hud) {
    const far = hud.project(this.longTrip.curve.getPointAt(0.45));
    const near = hud.project(this.edge.group.position);
    glow(hud, far.x, far.y, 520, CSS.failure, 0.4);
    glow(hud, near.x, near.y, 360, CSS.healthy, 0.4);
    vignette(hud);
    drawHook(hud, this.variant);
    // The hook in variant b already shows the numbers.
    if (this.variant.id !== 'b') {
      numberBadge(hud, far.x, far.y + 110, '~100 ms', CSS.failure);
      numberBadge(hud, near.x + 40, near.y - 190, '~10 ms', CSS.healthy);
    }
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    this.longTrip.dispose();
    this.shortTrip.dispose();
    this.map.dispose();
    this.presenter.dispose();
  }
}
