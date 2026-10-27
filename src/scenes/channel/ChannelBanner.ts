import * as THREE from 'three';
import type { Hud } from '../../components/Hud.ts';
import { ArcPath } from '../../components/ArcPath.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { poseWave } from '../../components/Mascot.ts';
import { createEdgeServer, createOriginServer, type NodeMesh } from '../../components/NodeMesh.ts';
import { WorldMap, geo } from '../../components/WorldMap.ts';
import { COLORS, CSS, FONTS } from '../../config/theme.ts';
import { EDGES, ORIGIN_VIRGINIA } from '../cdn/locations.ts';

type V3 = THREE.Vector3Tuple;

/**
 * YouTube channel banner, 2560×1440 (16:9). Everything that must be readable
 * sits in the 1546×423 safe area that every device shows; the map fills the
 * rest for desktop and TV. Coordinates below are 1920×1080 design pixels.
 */
const SAFE = { x: 380, y: 381, w: 1160, h: 317 };

const CAMERA_POSITION: V3 = [2.5, 24, 9.5];
const CAMERA_TARGET: V3 = [2.5, 0, -1.5];
const NODE_SCALE = 1.1;
const POSE_T = 0.42;
const TOPICS = ['Cloud', 'DevOps', 'Infrastructure', 'Automation', 'FinOps'];

const lifted = (lonLat: [number, number]) => geo(...lonLat, 0.06);

export class ChannelBanner {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly map = new WorldMap();
  private readonly nodes: NodeMesh[] = [];
  private readonly arcs: ArcPath[] = [];

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

    this.place(createOriginServer(), lifted(ORIGIN_VIRGINIA).setY(0.04));
    const originPos = lifted(ORIGIN_VIRGINIA);
    for (const edge of Object.values(EDGES)) {
      const node = this.place(createEdgeServer(), geo(...edge.lonLat));
      node.setStatus(COLORS.edge);
      const arc = new ArcPath(originPos, lifted(edge.lonLat), { radius: 0.05, color: COLORS.network });
      arc.show(0.5);
      this.arcs.push(arc);
      this.scene.add(arc.mesh);
    }
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
    const pose = { ...poseWave(POSE_T), expression: 'smile' as const };
    this.presenter.update(POSE_T, { x: SAFE.x + 150, y: SAFE.y + SAFE.h - 8, heightPx: 285, appear: 1, pose, yaw: 0.35 });
  }

  drawOverlay(hud: Hud) {
    const { ctx } = hud;

    // Soft dark band behind the safe area so text reads over the map.
    const band = ctx.createLinearGradient(0, SAFE.y - 90, 0, SAFE.y + SAFE.h + 90);
    band.addColorStop(0, 'rgba(5, 8, 15, 0)');
    band.addColorStop(0.25, 'rgba(5, 8, 15, 0.72)');
    band.addColorStop(0.75, 'rgba(5, 8, 15, 0.72)');
    band.addColorStop(1, 'rgba(5, 8, 15, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, SAFE.y - 90, hud.width, SAFE.h + 180);

    const left = SAFE.x + 330;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = `900 112px ${FONTS.sans}`;
    ctx.fillStyle = CSS.text;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
    ctx.shadowBlur = 28;
    ctx.fillText('Data Packet', left, SAFE.y + 92);
    ctx.restore();

    hud.text('Small packets. Big ideas.', left + 4, SAFE.y + 175, { size: 46, weight: 700, color: CSS.edge });
    hud.text('Cloud architecture, explained visually', left + 4, SAFE.y + 225, { size: 28, weight: 500, color: CSS.muted });

    let x = left;
    for (const topic of TOPICS) {
      const w = hud.measure(topic, { size: 24, weight: 700 }) + 36;
      hud.roundRect(x, SAFE.y + 258, w, 44, 22, CSS.panel, CSS.network, 1, 2);
      hud.text(topic, x + w / 2, SAFE.y + 281, { size: 24, weight: 700, align: 'center' });
      x += w + 14;
    }
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    this.map.dispose();
    this.presenter.dispose();
  }
}
