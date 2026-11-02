import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { KeySlots } from '../../components/KeySlots.ts';
import { poseCheer, posePoint, poseSurprised } from '../../components/Mascot.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { createCacheNode, createDatabase, type NodeMesh } from '../../components/NodeMesh.ts';
import { drawHook, glow, numberBadge, pickVariant, vignette, type ThumbnailVariant, type VariantId } from '../../components/ThumbnailKit.ts';
import { COLORS, CSS } from '../../config/theme.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [2.0, 6.6, 12.8];
const CAMERA_TARGET: V3 = [3.2, 0.8, -1.4];
const POSE_T = 1.2;

const CACHE = new THREE.Vector3(3.4, 0, 1.4);
const SLOTS = new THREE.Vector3(4.9, 0, 1.6);
const DB = new THREE.Vector3(7.8, 0, -1.8);
/** Request lanes into the database (the stampede in variant a, quiet in b and c). */
const LANES = [new THREE.Vector3(0.6, 0.6, -2.6), new THREE.Vector3(1.2, 0.6, -0.6), new THREE.Vector3(2.0, 0.6, 1.0)];
const PACKETS_AT = [0.2, 0.42, 0.64, 0.86];

/** A/B variants for YouTube "Test & compare". Each hook matches a claim in the video. */
const VARIANTS: ThumbnailVariant[] = [
  {
    id: 'a',
    lines: [
      { text: 'ONE KEY', color: '#f1f5f9' },
      { text: 'EXPIRED.', color: CSS.failure },
    ],
    pose: poseSurprised,
  },
  {
    id: 'b',
    lines: [
      { text: 'WRONG', color: '#f1f5f9' },
      { text: 'PRICE?', color: CSS.warning },
    ],
    pose: posePoint,
  },
  {
    id: 'c',
    lines: [
      { text: 'SKIP THE', color: '#f1f5f9' },
      { text: 'DATABASE', color: CSS.healthy },
    ],
    pose: poseCheer,
  },
];

/**
 * Static YouTube thumbnail: a cache with its key slots in front of a big
 * database. Variant a: the hot key expired and red requests slam the
 * database. Variant b: the cached price is stale. Variant c: hits stay in
 * memory and the database idles.
 */
export class CacheThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly variant: ThumbnailVariant;
  private readonly nodes: NodeMesh[] = [];
  private readonly lanes: ArcPath[];
  private readonly slots = new KeySlots(4);
  private readonly packetGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  private readonly packetMat: THREE.MeshStandardMaterial;
  private readonly floorGeo = new THREE.CircleGeometry(60, 64);
  private readonly floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
  private readonly grid = new THREE.GridHelper(120, 120, COLORS.oceanGrid, COLORS.oceanGrid);
  private readonly db: NodeMesh;
  private readonly cache: NodeMesh;

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

    const stampede = this.variant.id === 'a';
    this.db = this.place(createDatabase(), DB, 3.4);
    this.db.setStatus(stampede ? COLORS.failure : COLORS.healthy, stampede ? 3 : 2.4);
    this.cache = this.place(createCacheNode(), CACHE, 2.4);

    this.slots.group.position.copy(SLOTS);
    this.slots.group.scale.setScalar(1.5);
    this.slots.update(1, (i) => {
      if (i === 0 && stampede) return { fill: 1, ghost: true, color: COLORS.failure };
      if (i === 0 && this.variant.id === 'b') return { fill: 1, color: COLORS.warning };
      return { fill: 1, color: COLORS.storage, glow: i === 0 ? 1 : 0.6 };
    });
    this.scene.add(this.slots.group);

    const laneColor = stampede ? COLORS.failure : COLORS.network;
    this.packetMat = new THREE.MeshStandardMaterial({ color: laneColor, emissive: laneColor, emissiveIntensity: 1.8 });
    const into = DB.clone().setY(1.4);
    this.lanes = LANES.map((from) => new ArcPath(from, into, { radius: 0.06, height: 1.2, color: laneColor }));
    for (const lane of this.lanes) {
      lane.show(stampede ? 0.9 : 0.35);
      this.scene.add(lane.mesh);
      if (!stampede) continue;
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
    this.presenter.update(POSE_T, { x: 1450, y: 1060, heightPx: 420, appear: 1, pose: this.variant.pose(POSE_T), yaw: -0.45 });
  }

  drawOverlay(hud: Hud) {
    const db = hud.project(this.db.group.position.clone().setY(1.2));
    const cache = hud.project(this.cache.group.position.clone().setY(0.6));
    const id = this.variant.id;
    glow(hud, db.x, db.y, 560, id === 'a' ? CSS.failure : CSS.storage, id === 'a' ? 0.5 : 0.35);
    glow(hud, cache.x, cache.y, 380, id === 'b' ? CSS.warning : id === 'c' ? CSS.healthy : CSS.storage, 0.35);
    vignette(hud);
    drawHook(hud, this.variant);
    const top = hud.project(this.db.top.getWorldPosition(new THREE.Vector3()));
    if (id === 'a') numberBadge(hud, top.x, top.y - 60, 'STAMPEDE', CSS.failure);
    this.slots.group.updateMatrixWorld(true);
    const slot0 = hud.project(this.slots.slotPosition(0).setY(1.0));
    if (id === 'b') numberBadge(hud, slot0.x + 40, slot0.y - 70, '€49 → €39', CSS.warning);
    if (id === 'c') numberBadge(hud, slot0.x + 40, slot0.y - 70, 'HIT ✓', CSS.healthy);
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    for (const lane of this.lanes) lane.dispose();
    this.slots.dispose();
    this.packetGeo.dispose();
    this.packetMat.dispose();
    this.floorGeo.dispose();
    this.floorMat.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.presenter.dispose();
  }
}
