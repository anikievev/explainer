import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { poseCheer, posePoint, poseSurprised } from '../../components/Mascot.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { createDatabase, type NodeMesh } from '../../components/NodeMesh.ts';
import { drawHook, glow, numberBadge, pickVariant, vignette, type ThumbnailVariant, type VariantId } from '../../components/ThumbnailKit.ts';
import { COLORS, CSS } from '../../config/theme.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [2.6, 7.6, 13.2];
const CAMERA_TARGET: V3 = [3.2, 2.4, -0.8];
const POSE_T = 1.2;

const PRIMARY = new THREE.Vector3(4.2, 0, 2.2);
const REPLICA = new THREE.Vector3(8.0, 0, -0.2);
/** App traffic into the databases, from off-screen left. */
const LANES = [new THREE.Vector3(0.2, 0.6, 0.4), new THREE.Vector3(0.4, 0.6, 2.6), new THREE.Vector3(1.0, 0.6, 4.6)];
/** The change on its way from the primary to the replica (fraction of the stream). */
const CHANGE_AT = 0.55;

/** A/B variants for YouTube "Test & compare". Each hook matches a claim in the video. */
const VARIANTS: ThumbnailVariant[] = [
  {
    id: 'a',
    // Split brain: "Now two servers accept writes."
    lines: [
      { text: 'TWO', color: '#f1f5f9' },
      { text: 'PRIMARIES?', color: CSS.failure },
    ],
    pose: poseSurprised,
  },
  {
    id: 'b',
    // Async + crash: "that change is gone, even though the user saw saved."
    lines: [
      { text: 'SAVED.', color: CSS.healthy },
      { text: 'THEN GONE?', color: CSS.failure },
    ],
    pose: posePoint,
  },
  {
    id: 'c',
    // Failover: "The app's writes now go to the new primary, and the shop is back."
    lines: [
      { text: 'DB DIES.', color: CSS.failure },
      { text: 'SHOP LIVES.', color: CSS.healthy },
    ],
    pose: poseCheer,
  },
];

/**
 * Static YouTube thumbnail: a primary database streaming changes to a replica.
 * Variant a: both think they are the primary and both take writes (split
 * brain). Variant b: the primary crashed with a saved change still on the
 * wire. Variant c: the primary is down and the promoted replica takes the
 * writes.
 */
export class ReplicationThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly variant: ThumbnailVariant;
  private readonly nodes: NodeMesh[] = [];
  private readonly arcs: ArcPath[] = [];
  private readonly packetGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
  private readonly packetMats: THREE.Material[] = [];
  private readonly floorGeo = new THREE.CircleGeometry(60, 64);
  private readonly floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
  private readonly grid = new THREE.GridHelper(120, 120, COLORS.oceanGrid, COLORS.oceanGrid);
  private readonly primary: NodeMesh;
  private readonly replica: NodeMesh;
  private readonly change: THREE.Vector3;

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

    const id = this.variant.id;
    this.primary = this.place(createDatabase(), PRIMARY, 2.8);
    this.replica = this.place(createDatabase(), REPLICA, 2.8);
    if (id === 'a') {
      this.primary.setStatus(COLORS.failure, 3);
      this.replica.setStatus(COLORS.failure, 3);
    } else if (id === 'b') {
      this.primary.setStatus(COLORS.failure, 3);
      this.primary.setDim(0.8);
      this.replica.setStatus(COLORS.storage, 2.2);
    } else {
      this.primary.setStatus(COLORS.failure, 2);
      this.primary.setDim(0.8);
      this.replica.setStatus(COLORS.healthy, 3);
    }

    // Replication stream primary → replica: live in b (the change on the wire), cut in a and c.
    const stream = new ArcPath(PRIMARY.clone().setY(1.2), REPLICA.clone().setY(1.2), { radius: 0.07, height: 1.0, color: id === 'b' ? COLORS.failure : COLORS.storage });
    stream.show(id === 'b' ? 0.9 : 0.25);
    this.addArc(stream);
    this.change = stream.curve.getPointAt(CHANGE_AT);
    if (id === 'b') this.addPacket(this.change, COLORS.failure, 0.35);

    // App traffic: into both in a (split brain), into the promoted replica in c, into the primary in b.
    const targets = id === 'a' ? [PRIMARY, REPLICA, PRIMARY] : id === 'c' ? [REPLICA, REPLICA, REPLICA] : [PRIMARY, PRIMARY, PRIMARY];
    const laneColor = id === 'a' ? COLORS.failure : id === 'c' ? COLORS.healthy : COLORS.network;
    LANES.forEach((from, i) => {
      const lane = new ArcPath(from, targets[i].clone().setY(1.4), { radius: 0.06, height: 1.2, color: laneColor });
      lane.show(id === 'b' ? 0.35 : 0.85);
      this.addArc(lane);
      if (id !== 'b') for (const k of [0.35, 0.7]) this.addPacket(lane.curve.getPointAt(k), laneColor, 1);
    });
  }

  private place(node: NodeMesh, position: THREE.Vector3, scale: number) {
    node.group.position.copy(position);
    node.setBaseScale(scale);
    node.setAppear(1);
    this.scene.add(node.group);
    this.nodes.push(node);
    return node;
  }

  private addArc(arc: ArcPath) {
    this.scene.add(arc.mesh);
    this.arcs.push(arc);
  }

  private addPacket(at: THREE.Vector3, color: number, opacity: number) {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.8, transparent: opacity < 1, opacity });
    this.packetMats.push(mat);
    const packet = new THREE.Mesh(this.packetGeo, mat);
    packet.position.copy(at);
    this.scene.add(packet);
  }

  update() {
    this.presenter.update(POSE_T, { x: 400, y: 1080, heightPx: 420, appear: 1, pose: this.variant.pose(POSE_T), yaw: 0.45 });
  }

  drawOverlay(hud: Hud) {
    const id = this.variant.id;
    const primary = hud.project(PRIMARY.clone().setY(1.2));
    const replica = hud.project(REPLICA.clone().setY(1.2));
    glow(hud, primary.x, primary.y, 520, id === 'c' ? CSS.failure : id === 'a' ? CSS.failure : CSS.storage, id === 'b' ? 0.3 : 0.4);
    glow(hud, replica.x, replica.y, 480, id === 'c' ? CSS.healthy : id === 'a' ? CSS.failure : CSS.storage, 0.35);
    vignette(hud);
    drawHook(hud, this.variant);

    const top = (n: NodeMesh) => hud.project(n.top.getWorldPosition(new THREE.Vector3()));
    if (id === 'a') {
      const p = top(this.primary);
      const r = top(this.replica);
      numberBadge(hud, p.x, p.y - 70, '★ PRIMARY', CSS.failure);
      numberBadge(hud, r.x, r.y - 70, '★ PRIMARY', CSS.failure);
    }
    if (id === 'b') {
      const p = top(this.primary);
      numberBadge(hud, p.x, p.y - 70, 'CRASH', CSS.failure);
      const c = hud.project(this.change);
      numberBadge(hud, c.x + 60, c.y - 90, 'SAVED ✓', CSS.healthy);
    }
    if (id === 'c') {
      const r = top(this.replica);
      numberBadge(hud, r.x, r.y - 70, 'PROMOTED ✓', CSS.healthy);
    }
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    for (const a of this.arcs) a.dispose();
    this.packetGeo.dispose();
    for (const m of this.packetMats) m.dispose();
    this.floorGeo.dispose();
    this.floorMat.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.presenter.dispose();
  }
}
