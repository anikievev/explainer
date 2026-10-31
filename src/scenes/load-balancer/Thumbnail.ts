import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { poseCheer, poseSurprised } from '../../components/Mascot.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { createLoadBalancer, createOriginServer, type NodeMesh } from '../../components/NodeMesh.ts';
import { RequestQueue } from '../../components/RequestQueue.ts';
import { drawHook, glow, numberBadge, pickVariant, vignette, type ThumbnailVariant, type VariantId } from '../../components/ThumbnailKit.ts';
import { COLORS, CSS } from '../../config/theme.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [1.6, 6.8, 11.5];
const CAMERA_TARGET: V3 = [3.0, 0.6, -3.4];
const POSE_T = 1.2;

const OVERLOADED = new THREE.Vector3(3.2, 0, 1.2);
const LB = new THREE.Vector3(6.4, 0, -3.6);
const HEALTHY = [new THREE.Vector3(9.0, 0, -6.4), new THREE.Vector3(9.6, 0, -4.2), new THREE.Vector3(10.2, 0, -2.0)];
const PACKETS_AT = [0.35, 0.7];

/** A/B variants for YouTube "Test & compare". Each hook matches a claim in the video. */
const VARIANTS: ThumbnailVariant[] = [
  {
    id: 'a',
    lines: [
      { text: 'ONE SERVER', color: '#f1f5f9' },
      { text: "ISN'T ENOUGH", color: CSS.failure },
    ],
    pose: poseSurprised,
  },
  {
    id: 'b',
    lines: [
      { text: 'SERVER DOWN.', color: CSS.failure },
      { text: 'SHOP UP.', color: CSS.healthy },
    ],
    pose: poseCheer,
  },
  {
    id: 'c',
    lines: [
      { text: 'SURVIVE', color: '#f1f5f9' },
      { text: 'THE SALE', color: CSS.warning },
    ],
    pose: poseCheer,
  },
];

/**
 * Static YouTube thumbnail: one red, overloaded server with a long queue as
 * the subject; behind it, a load balancer fanning out to three green servers.
 */
export class LbThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly variant: ThumbnailVariant;
  private readonly nodes: NodeMesh[] = [];
  private readonly lanes: ArcPath[];
  private readonly queue = new RequestQueue(12, new THREE.Vector3(-1, 0, 0.45), 0.36);
  private readonly packetGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  private readonly packetMat = new THREE.MeshStandardMaterial({ color: COLORS.network, emissive: COLORS.network, emissiveIntensity: 1.8 });
  private readonly floorGeo = new THREE.CircleGeometry(60, 64);
  private readonly floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
  private readonly grid = new THREE.GridHelper(120, 120, COLORS.oceanGrid, COLORS.oceanGrid);
  private readonly overloaded: NodeMesh;
  private readonly healthy: NodeMesh[];

  constructor(aspect: number, variant: VariantId = 'a') {
    this.variant = pickVariant(VARIANTS, variant);
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.camera.position.set(...CAMERA_POSITION);
    this.camera.lookAt(...CAMERA_TARGET);

    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 14, 34);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    const floor = new THREE.Mesh(this.floorGeo, this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(key, floor, this.grid);

    this.overloaded = this.place(createOriginServer(false), OVERLOADED, 2.9);
    this.overloaded.setStatus(COLORS.failure, 3);
    this.queue.group.position.set(OVERLOADED.x - 0.9, 0.3, OVERLOADED.z + 0.5);
    this.queue.setLength(12, COLORS.failure);
    this.scene.add(this.queue.group);

    this.place(createLoadBalancer(), LB, 2.2);
    this.healthy = HEALTHY.map((p) => this.place(createOriginServer(false), p, 1.9));
    for (const s of this.healthy) s.setStatus(COLORS.healthy, 2.6);

    const from = LB.clone().setY(0.5);
    this.lanes = HEALTHY.map((p) => new ArcPath(from, p.clone().setY(0.5), { radius: 0.06, height: 0.8, color: COLORS.network }));
    for (const lane of this.lanes) {
      lane.show(0.85);
      this.scene.add(lane.mesh);
      for (const k of PACKETS_AT) {
        const packet = new THREE.Mesh(this.packetGeo, this.packetMat);
        packet.position.copy(lane.curve.getPointAt(k));
        this.scene.add(packet);
      }
    }
  }

  private place(node: NodeMesh, position: THREE.Vector3, scale: number) {
    node.group.position.copy(position);
    node.setBaseScale(scale);
    node.setAppear(1);
    this.scene.add(node.group);
    this.nodes.push(node);
    return node;
  }

  update() {
    this.presenter.update(POSE_T, { x: 560, y: 1050, heightPx: 430, appear: 1, pose: this.variant.pose(POSE_T), yaw: 0.45 });
  }

  drawOverlay(hud: Hud) {
    const red = hud.project(this.overloaded.group.position.clone().setY(1.0));
    const green = hud.project(this.healthy[1].group.position.clone().setY(0.6));
    glow(hud, red.x, red.y, 560, CSS.failure, 0.5);
    glow(hud, green.x, green.y, 380, CSS.healthy, 0.3);
    vignette(hud);
    drawHook(hud, this.variant);
    const top = hud.project(this.overloaded.top.getWorldPosition(new THREE.Vector3()));
    numberBadge(hud, top.x, top.y - 70, this.variant.id === 'b' ? 'DOWN' : '100% CPU', CSS.failure);
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    for (const lane of this.lanes) lane.dispose();
    this.queue.dispose();
    this.packetGeo.dispose();
    this.packetMat.dispose();
    this.floorGeo.dispose();
    this.floorMat.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.presenter.dispose();
  }
}
