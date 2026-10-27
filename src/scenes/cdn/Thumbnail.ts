import * as THREE from 'three';
import type { Hud } from '../../components/Hud.ts';
import { ArcPath } from '../../components/ArcPath.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { poseRun } from '../../components/Mascot.ts';
import { createEdgeServer, createOriginServer, createUser, type NodeMesh } from '../../components/NodeMesh.ts';
import { WorldMap, geo } from '../../components/WorldMap.ts';
import { COLORS, CSS, FONTS } from '../../config/theme.ts';
import { EDGES, ORIGIN_VIRGINIA, USERS } from './locations.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [-3.3, 12.2, 3.9];
const CAMERA_TARGET: V3 = [-3.3, 0, -4.7];
const NODE_SCALE = 1.0;
/** Pose time picked for a clean running stride. */
const POSE_T = 0.17;

const lifted = (lonLat: [number, number]) => geo(...lonLat, 0.06);

/**
 * Static YouTube thumbnail: Berlin's long trip to the Virginia origin (red)
 * vs. the short hop to the Frankfurt edge (green), with the mascot and title.
 */
export class CdnThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly map = new WorldMap();
  private readonly nodes: NodeMesh[] = [];
  private readonly longTrip: ArcPath;
  private readonly shortTrip: ArcPath;
  private readonly origin: NodeMesh;
  private readonly edge: NodeMesh;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.camera.position.set(...CAMERA_POSITION);
    this.camera.lookAt(...CAMERA_TARGET);

    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 30, 60);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    this.scene.add(key, this.map.group);

    this.origin = this.place(createOriginServer(), lifted(ORIGIN_VIRGINIA).setY(0.04));
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
    const pose = poseRun(POSE_T, 9);
    this.presenter.update(POSE_T, { x: 1665, y: 1060, heightPx: 470, appear: 1, pose, yaw: -0.5 });
  }

  drawOverlay(hud: Hud) {
    const { ctx } = hud;

    // Darken the top-left so the headline pops.
    const shade = ctx.createLinearGradient(0, 0, 1100, 0);
    shade.addColorStop(0, 'rgba(5, 8, 15, 0.85)');
    shade.addColorStop(1, 'rgba(5, 8, 15, 0)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 1100, 470);

    hud.roundRect(80, 70, 360, 72, 36, CSS.edge);
    hud.text('HOW A CDN WORKS', 260, 107, { size: 36, weight: 900, color: '#05080f', align: 'center' });
    headline(ctx, "WHY IT'S", 80, 240, '#f1f5f9');
    headline(ctx, 'FAST', 80, 390, CSS.healthy);

    hud.label(this.origin.group.position, 'Origin · Virginia', { accent: CSS.storage, size: 40, below: true, offsetY: 70 });
    hud.label(this.longTrip.curve.getPointAt(0.45), '6,700 km · ~100 ms', { accent: CSS.failure, size: 50, offsetY: 40 });
    hud.label(this.shortTrip.curve.getPointAt(0.5), '400 km · ~10 ms', { accent: CSS.healthy, size: 50, offsetY: 150 });
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    this.longTrip.dispose();
    this.shortTrip.dispose();
    this.map.dispose();
    this.presenter.dispose();
  }
}

function headline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.save();
  ctx.font = `900 150px ${FONTS.sans}`;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#05080f';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillText(text, x, y);
  ctx.restore();
}
