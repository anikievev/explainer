import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { KeyField, stackSlot } from '../../components/KeyField.ts';
import { poseCheer, poseScared, poseSurprised } from '../../components/Mascot.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { createDatabase, type NodeMesh } from '../../components/NodeMesh.ts';
import { drawHook, glow, numberBadge, pickVariant, vignette, type ThumbnailVariant, type VariantId } from '../../components/ThumbnailKit.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { SHARD_COLORS } from './ShardingStage.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [3.0, 8.2, 14.2];
const CAMERA_TARGET: V3 = [4.4, 2.2, -0.6];
const POSE_T = 1.2;

/** Four shards in a row receding to the right, and the fifth (variant b). */
const SHARDS = [new THREE.Vector3(3.4, 0, 3.0), new THREE.Vector3(5.8, 0, 1.6), new THREE.Vector3(8.2, 0, 0.2), new THREE.Vector3(10.6, 0, -1.2), new THREE.Vector3(13.0, 0, -2.6)];
/** Variant a: the hot shard. */
const HOT = 1;
const BLOCKS_PER_SHARD = 4;

/** A/B variants for YouTube "Test & compare". Each hook matches a claim in the video. */
const VARIANTS: ThumbnailVariant[] = [
  {
    id: 'a',
    // "every new write lands on the last shard" / the big seller's flash sale.
    lines: [
      { text: 'ONE HOT', color: '#f1f5f9' },
      { text: 'SHARD', color: CSS.failure },
    ],
    pose: poseScared,
  },
  {
    id: 'b',
    // "Eight hundred of them now belong on a different shard".
    lines: [
      { text: '80%', color: CSS.warning },
      { text: 'MOVED?', color: '#f1f5f9' },
    ],
    pose: poseSurprised,
  },
  {
    id: 'c',
    // "Sharding splits the data, so each shard holds a slice and takes its own writes."
    lines: [
      { text: 'SPLIT THE', color: '#f1f5f9' },
      { text: 'DATA', color: CSS.healthy },
    ],
    pose: poseCheer,
  },
];

/**
 * Static YouTube thumbnail: shard databases with stacks of keys. Variant a:
 * one shard glows red and takes every write. Variant b: keys fly to a fifth
 * shard. Variant c: four even, healthy shards.
 */
export class ShardingThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly variant: ThumbnailVariant;
  private readonly nodes: NodeMesh[] = [];
  private readonly arcs: ArcPath[] = [];
  /** Big key blocks on the shards (and in flight in b); small packets on the write lanes in a. */
  private readonly keys = new KeyField(BLOCKS_PER_SHARD * 5 + 8, 0.75, true);
  private readonly packets = new KeyField(8, 0.3);
  private readonly floorGeo = new THREE.CircleGeometry(60, 64);
  private readonly floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
  private readonly grid = new THREE.GridHelper(120, 120, COLORS.oceanGrid, COLORS.oceanGrid);
  private readonly shards: NodeMesh[];

  constructor(aspect: number, variant: VariantId = 'a') {
    this.variant = pickVariant(VARIANTS, variant);
    this.camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 200);
    this.camera.position.set(...CAMERA_POSITION);
    this.camera.lookAt(...CAMERA_TARGET);

    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.fog, 16, 38);
    this.scene.add(new THREE.HemisphereLight(0x9cc3ff, 0x05080f, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(6, 12, 8);
    const floor = new THREE.Mesh(this.floorGeo, this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(key, floor, this.grid, this.keys.mesh, this.packets.mesh);

    const id = this.variant.id;
    const count = id === 'b' ? 5 : 4;
    this.shards = SHARDS.slice(0, count).map((p, i) => {
      const node = createDatabase(SHARD_COLORS[i]);
      node.group.position.copy(p);
      node.setBaseScale(2.4);
      node.setAppear(1);
      const hot = id === 'a' && i === HOT;
      node.setStatus(hot ? COLORS.failure : id === 'c' ? COLORS.healthy : SHARD_COLORS[i], hot ? 3.2 : 2.2);
      this.scene.add(node.group);
      this.nodes.push(node);
      return node;
    });

    // Key stacks on each shard; in b, keys in flight to the fifth shard.
    let k = 0;
    let n = 0;
    const stack = { perRing: 1, radius: 0, baseY: 2.6, layer: 0.5 };
    for (let s = 0; s < 4; s++) {
      const count = id === 'b' ? 2 : id === 'a' && s === HOT ? BLOCKS_PER_SHARD + 1 : BLOCKS_PER_SHARD;
      for (let j = 0; j < count; j++) this.keys.place(k++, stackSlot(SHARDS[s], j, stack), id === 'a' && s === HOT ? COLORS.failure : SHARD_COLORS[s]);
    }
    if (id === 'b') {
      for (let j = 0; j < 2; j++) this.keys.place(k++, stackSlot(SHARDS[4], j, stack), SHARD_COLORS[4]);
      for (let s = 0; s < 4; s++) {
        const arc = new ArcPath(SHARDS[s].clone().setY(3.4), SHARDS[4].clone().setY(3.4), { radius: 0.04, height: 2.0 + s * 0.4, color: COLORS.warning });
        arc.show(0.45);
        this.scene.add(arc.mesh);
        this.arcs.push(arc);
        this.keys.place(k++, arc.curve.getPointAt(0.5), COLORS.warning);
      }
    }
    // Variant a: writes pouring into the hot shard.
    if (id === 'a') {
      for (let i = 0; i < 4; i++) {
        const from = new THREE.Vector3(0.6 + i * 0.6, 0.6, 5.4 - i * 0.5);
        const arc = new ArcPath(from, SHARDS[HOT].clone().setY(1.4), { radius: 0.06, height: 1.4, color: COLORS.failure });
        arc.show(0.85);
        this.scene.add(arc.mesh);
        this.arcs.push(arc);
        for (const t of [0.3, 0.65]) this.packets.place(n++, arc.curve.getPointAt(t), COLORS.failure);
      }
    }
    for (; k < this.keys.count; k++) this.keys.place(k, new THREE.Vector3(), 0x000000, 0);
    for (; n < this.packets.count; n++) this.packets.place(n, new THREE.Vector3(), 0x000000, 0);
    this.keys.setOpacity(1);
    this.packets.setOpacity(1);
    this.keys.commit();
    this.packets.commit();
  }

  update() {
    this.presenter.update(POSE_T, { x: 400, y: 1080, heightPx: 420, appear: 1, pose: this.variant.pose(POSE_T), yaw: 0.45 });
  }

  drawOverlay(hud: Hud) {
    const id = this.variant.id;
    const center = hud.project(SHARDS[id === 'b' ? 2 : 1].clone().setY(1.6));
    const hot = hud.project(SHARDS[HOT].clone().setY(1.4));
    if (id === 'a') glow(hud, hot.x, hot.y, 520, CSS.failure, 0.5);
    else glow(hud, center.x + 140, center.y, 640, id === 'c' ? CSS.healthy : CSS.warning, 0.3);
    vignette(hud);
    drawHook(hud, this.variant);
    const top = (i: number) => hud.project(SHARDS[i].clone().setY(id === 'a' ? 5.4 : 4.6));
    if (id === 'a') numberBadge(hud, top(HOT).x, top(HOT).y - 40, 'ALL WRITES', CSS.failure);
    if (id === 'b') numberBadge(hud, top(4).x - 60, top(4).y - 40, '800 / 1,000', CSS.warning);
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    this.keys.dispose();
    this.packets.dispose();
    this.floorGeo.dispose();
    this.floorMat.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.presenter.dispose();
  }
}
