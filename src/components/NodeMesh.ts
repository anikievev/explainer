import * as THREE from 'three';
import { COLORS } from '../config/theme.ts';
import { easeOutBack, clamp } from './Timeline.ts';

/**
 * A reusable system node (server, edge, user...). Appearance is controlled by
 * `appear` (0 = hidden, 1 = full size) and a status color for the indicator.
 */
export class NodeMesh {
  readonly group = new THREE.Group();
  /** Point the HUD label hangs from (top of the node). */
  readonly top = new THREE.Object3D();
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly statusMaterials: THREE.MeshStandardMaterial[] = [];
  private baseScale = 1;
  private appearAmount = 1;

  constructor(readonly name: string) {
    this.group.name = name;
    this.group.add(this.top);
  }

  protected track<T extends { dispose(): void }>(resource: T): T {
    this.disposables.push(resource);
    return resource;
  }

  addStatusMaterial(material: THREE.MeshStandardMaterial) {
    this.statusMaterials.push(material);
  }

  addMesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3Tuple = [0, 0, 0]) {
    const mesh = new THREE.Mesh(this.track(geometry), this.track(material));
    mesh.position.fromArray(position);
    this.group.add(mesh);
    return mesh;
  }

  setStatus(color: THREE.ColorRepresentation, intensity = 2.2) {
    for (const m of this.statusMaterials) {
      m.color.set(color);
      m.emissive.set(color);
      m.emissiveIntensity = intensity;
    }
  }

  setBaseScale(scale: number) {
    this.baseScale = scale;
    this.applyScale();
  }

  setAppear(k: number) {
    this.appearAmount = k;
    this.applyScale();
  }

  private applyScale() {
    const k = clamp(this.appearAmount);
    const s = k <= 0 ? 0.0001 : easeOutBack(k) * this.baseScale;
    this.group.scale.setScalar(s);
    this.group.visible = k > 0;
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

const standard = (color: number, emissive = 0x000000, emissiveIntensity = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.55, metalness: 0.2, ...extra });

/** Origin server: three rack units with status lights, plus a database cylinder. */
export function createOriginServer(withDatabase = true): NodeMesh {
  const node = new NodeMesh('origin');
  const unitGeo = new THREE.BoxGeometry(0.62, 0.2, 0.46);
  const bodyMat = standard(0x52627a, 0x1e293b, 0.5);
  const ledMat = standard(COLORS.healthy, COLORS.healthy, 2.2);
  const stripMat = standard(COLORS.network, COLORS.network, 1.4);
  node.addStatusMaterial(ledMat);
  const ledGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
  const stripGeo = new THREE.BoxGeometry(0.34, 0.025, 0.02);
  for (let i = 0; i < 3; i++) {
    const y = 0.12 + i * 0.235;
    node.addMesh(unitGeo, bodyMat, [0, y, 0]);
    node.addMesh(ledGeo, ledMat, [0.22, y, 0.235]);
    node.addMesh(stripGeo, stripMat, [-0.08, y, 0.235]);
  }
  if (withDatabase) {
    const dbMat = standard(COLORS.storage, COLORS.storage, 0.6);
    const dbGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 28);
    for (let i = 0; i < 3; i++) node.addMesh(dbGeo, dbMat, [0.58, 0.07 + i * 0.13, 0.05]);
  }
  node.top.position.set(0, 0.78, 0);
  return node;
}

/** Edge server: hexagonal tower with a glowing cyan ring. */
export function createEdgeServer(): NodeMesh {
  const node = new NodeMesh('edge');
  const bodyMat = standard(0x2a6f8f, 0x0f4c66, 0.7);
  const ringMat = standard(COLORS.edge, COLORS.edge, 2.4);
  const ledMat = standard(COLORS.healthy, COLORS.healthy, 2.2);
  node.addStatusMaterial(ledMat);
  node.addMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 6), bodyMat, [0, 0.25, 0]);
  node.addMesh(new THREE.TorusGeometry(0.26, 0.025, 8, 6), ringMat, [0, 0.42, 0]).rotation.x = Math.PI / 2;
  node.addMesh(new THREE.TorusGeometry(0.3, 0.02, 8, 6), ringMat, [0, 0.03, 0]).rotation.x = Math.PI / 2;
  node.addMesh(new THREE.SphereGeometry(0.06, 16, 12), ledMat, [0, 0.56, 0]);
  node.top.position.set(0, 0.62, 0);
  return node;
}

/** User: simple person figure. */
export function createUser(color: number = COLORS.user): NodeMesh {
  const node = new NodeMesh('user');
  const mat = standard(color, color, 0.35);
  const ledMat = standard(COLORS.network, COLORS.network, 1.5);
  node.addStatusMaterial(ledMat);
  node.addMesh(new THREE.SphereGeometry(0.1, 20, 16), mat, [0, 0.42, 0]);
  node.addMesh(new THREE.CapsuleGeometry(0.11, 0.16, 6, 16), mat, [0, 0.18, 0]);
  node.addMesh(new THREE.TorusGeometry(0.18, 0.015, 8, 32), ledMat, [0, 0.01, 0]).rotation.x = Math.PI / 2;
  node.top.position.set(0, 0.56, 0);
  return node;
}

/** DNS server: compact box with a blue band. */
export function createDnsServer(): NodeMesh {
  const node = new NodeMesh('dns');
  node.addMesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), standard(0x475569, 0x1e293b, 0.5), [0, 0.21, 0]);
  const band = standard(COLORS.network, COLORS.network, 1.8);
  node.addStatusMaterial(band);
  node.addMesh(new THREE.BoxGeometry(0.44, 0.06, 0.44), band, [0, 0.3, 0]);
  node.top.position.set(0, 0.46, 0);
  return node;
}

/** A cached file, drawn as a small glowing cube. */
export function createFileCube(color: number = COLORS.network): NodeMesh {
  const node = new NodeMesh('file');
  const mat = standard(color, color, 0.9, { roughness: 0.3 });
  node.addStatusMaterial(mat);
  node.addMesh(new THREE.BoxGeometry(0.22, 0.28, 0.06), mat, [0, 0.14, 0]);
  node.top.position.set(0, 0.3, 0);
  return node;
}

/** Load balancer: wide flat unit with a fan-out light strip (one LED per lane). */
export function createLoadBalancer(): NodeMesh {
  const node = new NodeMesh('load-balancer');
  const bodyMat = standard(0x3b4a6b, 0x1e293b, 0.5);
  const stripMat = standard(COLORS.network, COLORS.network, 2.0);
  const ledMat = standard(COLORS.healthy, COLORS.healthy, 2.2);
  node.addStatusMaterial(ledMat);
  node.addMesh(new THREE.BoxGeometry(0.95, 0.24, 0.62), bodyMat, [0, 0.14, 0]);
  node.addMesh(new THREE.BoxGeometry(0.75, 0.05, 0.5), bodyMat, [0, 0.29, 0]);
  const laneGeo = new THREE.BoxGeometry(0.03, 0.025, 0.22);
  for (let i = -1; i <= 1; i++) {
    node.addMesh(laneGeo, stripMat, [0.12 + i * 0.12, 0.33, 0]).rotation.y = i * 0.45;
  }
  node.addMesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), ledMat, [-0.36, 0.14, 0.315]);
  node.addMesh(new THREE.BoxGeometry(0.22, 0.025, 0.02), stripMat, [0.08, 0.14, 0.315]);
  node.top.position.set(0, 0.42, 0);
  return node;
}

/** Database: stacked purple cylinders (storage colour). */
export function createDatabase(color: number = COLORS.storage): NodeMesh {
  const node = new NodeMesh('database');
  const mat = standard(color, color, 0.6);
  const geo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 32);
  for (let i = 0; i < 3; i++) node.addMesh(geo, mat, [0, 0.1 + i * 0.2, 0]);
  const ringMat = standard(COLORS.healthy, COLORS.healthy, 2.0);
  node.addStatusMaterial(ringMat);
  node.addMesh(new THREE.TorusGeometry(0.3, 0.015, 8, 40), ringMat, [0, 0.62, 0]).rotation.x = Math.PI / 2;
  node.top.position.set(0, 0.72, 0);
  return node;
}

/** Message queue: a translucent purple tube (storage colour) lying along x, open at both ends. */
export function createQueueBroker(length = 3.4): NodeMesh {
  const node = new NodeMesh('queue');
  const glass = standard(COLORS.storage, COLORS.storage, 0.35, { transparent: true, opacity: 0.22, depthWrite: false });
  const rimMat = standard(COLORS.storage, COLORS.storage, 1.8);
  node.addStatusMaterial(rimMat);
  node.addMesh(new THREE.CylinderGeometry(0.42, 0.42, length, 40, 1, true), glass, [0, 0.46, 0]).rotation.z = Math.PI / 2;
  for (const x of [-length / 2, length / 2]) {
    node.addMesh(new THREE.TorusGeometry(0.42, 0.03, 10, 40), rimMat, [x, 0.46, 0]).rotation.y = Math.PI / 2;
  }
  const feetGeo = new THREE.BoxGeometry(0.08, 0.06, 0.5);
  const feetMat = standard(0x334155);
  for (const x of [-length / 2 + 0.3, length / 2 - 0.3]) node.addMesh(feetGeo, feetMat, [x, 0.03, 0]);
  node.top.position.set(0, 0.95, 0);
  return node;
}

/** Worker (consumer): a compact two-unit server with a large status light. */
export function createWorker(): NodeMesh {
  const node = new NodeMesh('worker');
  const bodyMat = standard(0x3b4a6b, 0x1e293b, 0.5);
  const ledMat = standard(COLORS.healthy, COLORS.healthy, 2.2);
  node.addStatusMaterial(ledMat);
  const unitGeo = new THREE.BoxGeometry(0.5, 0.2, 0.42);
  for (let i = 0; i < 2; i++) node.addMesh(unitGeo, bodyMat, [0, 0.11 + i * 0.22, 0]);
  node.addMesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), ledMat, [-0.04, 0.11, 0.215]);
  node.addMesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), ledMat, [-0.04, 0.33, 0.215]);
  node.addMesh(new THREE.TorusGeometry(0.1, 0.03, 8, 6), ledMat, [0, 0.5, 0]).rotation.x = Math.PI / 2;
  node.top.position.set(0, 0.58, 0);
  return node;
}

/** Dead-letter queue: an open red-rimmed bin. */
export function createDeadLetterBin(): NodeMesh {
  const node = new NodeMesh('dead-letter-queue');
  const wallMat = standard(0x3f1d24, 0x2a0f14, 0.4);
  const rimMat = standard(COLORS.failure, COLORS.failure, 1.6);
  node.addStatusMaterial(rimMat);
  const w = 0.9;
  const h = 0.42;
  const wall = new THREE.BoxGeometry(w, h, 0.04);
  const side = new THREE.BoxGeometry(0.04, h, w);
  node.addMesh(new THREE.BoxGeometry(w, 0.04, w), wallMat, [0, 0.02, 0]);
  node.addMesh(wall, wallMat, [0, h / 2, -w / 2]);
  node.addMesh(wall, wallMat, [0, h / 2, w / 2]);
  node.addMesh(side, wallMat, [-w / 2, h / 2, 0]);
  node.addMesh(side, wallMat, [w / 2, h / 2, 0]);
  const rimX = new THREE.BoxGeometry(w + 0.06, 0.04, 0.06);
  const rimZ = new THREE.BoxGeometry(0.06, 0.04, w + 0.06);
  node.addMesh(rimX, rimMat, [0, h, -w / 2]);
  node.addMesh(rimX, rimMat, [0, h, w / 2]);
  node.addMesh(rimZ, rimMat, [-w / 2, h, 0]);
  node.addMesh(rimZ, rimMat, [w / 2, h, 0]);
  node.top.position.set(0, h + 0.1, 0);
  return node;
}

/** Cache: a squat in-memory box (light purple) with a glowing lightning strip and memory-chip ridges. */
export function createCacheNode(): NodeMesh {
  const node = new NodeMesh('cache');
  const bodyMat = standard(0x4c3f7a, 0x2e2452, 0.6);
  const chipMat = standard(0x1e293b, 0x000000, 0, { metalness: 0.5 });
  const boltMat = standard(COLORS.storage, COLORS.storage, 2.2);
  node.addStatusMaterial(boltMat);
  node.addMesh(new THREE.BoxGeometry(0.9, 0.34, 0.6), bodyMat, [0, 0.17, 0]);
  const ridge = new THREE.BoxGeometry(0.1, 0.06, 0.5);
  for (let i = 0; i < 6; i++) node.addMesh(ridge, chipMat, [-0.34 + i * 0.136, 0.37, 0]);
  // Lightning mark on the front: two slanted bars.
  const bar = new THREE.BoxGeometry(0.05, 0.2, 0.02);
  node.addMesh(bar, boltMat, [-0.02, 0.2, 0.305]).rotation.z = -0.5;
  node.addMesh(bar, boltMat, [0.05, 0.14, 0.305]).rotation.z = -0.5;
  node.addMesh(new THREE.BoxGeometry(0.5, 0.025, 0.02), boltMat, [0, 0.04, 0.305]);
  node.top.position.set(0, 0.5, 0);
  return node;
}
