import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { poseCheer, posePoint, poseSurprised } from '../../components/Mascot.ts';
import { MascotLayer } from '../../components/MascotLayer.ts';
import { createQueueBroker, createWorker, type NodeMesh } from '../../components/NodeMesh.ts';
import { RequestQueue } from '../../components/RequestQueue.ts';
import { drawHook, glow, numberBadge, pickVariant, vignette, type ThumbnailVariant, type VariantId } from '../../components/ThumbnailKit.ts';
import { COLORS, CSS } from '../../config/theme.ts';

type V3 = THREE.Vector3Tuple;

const CAMERA_POSITION: V3 = [3.6, 6.4, 12.5];
const CAMERA_TARGET: V3 = [4.8, 0.6, -1.2];
const POSE_T = 1.2;

const QUEUE = new THREE.Vector3(3.0, 0, 0.6);
const QUEUE_SCALE = 1.2;
const WORKERS = [new THREE.Vector3(7.6, 0, -1.8), new THREE.Vector3(7.9, 0, 0.6), new THREE.Vector3(8.2, 0, 3.0)];
/** Waiting messages inside the tube. */
const WAITING = 11;
/** Frozen checkout spinner, design px. */
const SPINNER = { x: 300, y: 820, r: 78 };

/** A/B variants for YouTube "Test & compare". Each hook matches a claim in the video. */
const VARIANTS: ThumbnailVariant[] = [
  {
    id: 'a',
    lines: [
      { text: "DON'T MAKE", color: '#f1f5f9' },
      { text: 'USERS WAIT', color: CSS.failure },
    ],
    pose: posePoint,
  },
  {
    id: 'b',
    lines: [
      { text: 'CHARGED', color: '#f1f5f9' },
      { text: 'TWICE?', color: CSS.failure },
    ],
    pose: poseSurprised,
  },
  {
    id: 'c',
    lines: [
      { text: 'CONFIRMED', color: CSS.healthy },
      { text: "BEFORE IT'S DONE", color: '#f1f5f9' },
    ],
    pose: poseCheer,
  },
];

/**
 * Static YouTube thumbnail: a purple queue full of waiting orders feeding three
 * green workers (right), and a frozen red checkout spinner (left).
 */
export class MqThumbnail {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly duration = 1;
  readonly presenter = new MascotLayer();
  private readonly variant: ThumbnailVariant;
  private readonly nodes: NodeMesh[] = [];
  private readonly lanes: ArcPath[];
  private readonly queue: NodeMesh;
  private readonly waiting = new RequestQueue(WAITING, new THREE.Vector3(-1, 0, 0), 0.26);
  private readonly floorGeo = new THREE.CircleGeometry(60, 64);
  private readonly floorMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.95 });
  private readonly grid = new THREE.GridHelper(120, 120, COLORS.oceanGrid, COLORS.oceanGrid);

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

    this.queue = this.place(createQueueBroker(), QUEUE, QUEUE_SCALE);
    const out = QUEUE.clone().add(new THREE.Vector3(1.7 * QUEUE_SCALE, 0.46 * QUEUE_SCALE, 0));
    this.waiting.group.position.copy(out).add(new THREE.Vector3(-0.3, 0, 0));
    this.waiting.group.scale.setScalar(QUEUE_SCALE);
    this.waiting.setLength(WAITING, COLORS.warning);
    this.scene.add(this.waiting.group);

    const workers = WORKERS.map((p) => this.place(createWorker(), p, 2.1));
    for (const w of workers) w.setStatus(COLORS.healthy, 2.6);
    this.lanes = WORKERS.map((p) => new ArcPath(out, p.clone().setY(0.6), { radius: 0.06, height: 0.7, color: COLORS.network }));
    for (const lane of this.lanes) {
      lane.show(0.85);
      this.scene.add(lane.mesh);
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
    this.presenter.update(POSE_T, { x: 1040, y: 1060, heightPx: 400, appear: 1, pose: this.variant.pose(POSE_T), yaw: -0.3 });
  }

  drawOverlay(hud: Hud) {
    const tube = hud.project(this.queue.group.position.clone().setY(0.6));
    glow(hud, tube.x, tube.y, 520, CSS.storage, 0.45);
    glow(hud, SPINNER.x, SPINNER.y, 300, CSS.failure, 0.45);
    vignette(hud);
    drawHook(hud, this.variant);
    this.drawSpinner(hud);
    const top = hud.project(this.queue.top.getWorldPosition(new THREE.Vector3()));
    if (this.variant.id === 'b') numberBadge(hud, top.x, top.y - 60, '#1042 ×2', CSS.failure);
    if (this.variant.id === 'c') numberBadge(hud, top.x, top.y - 60, 'PROCESSING…', CSS.network, 56);
  }

  /** A frozen loading spinner (no text): the checkout that never answers. */
  private drawSpinner(hud: Hud) {
    const { ctx } = hud;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.25)';
    ctx.beginPath();
    ctx.arc(SPINNER.x, SPINNER.y, SPINNER.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = CSS.failure;
    ctx.shadowColor = CSS.failure;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(SPINNER.x, SPINNER.y, SPINNER.r, -Math.PI / 2, Math.PI * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  dispose() {
    for (const n of this.nodes) n.dispose();
    for (const lane of this.lanes) lane.dispose();
    this.waiting.dispose();
    this.floorGeo.dispose();
    this.floorMat.dispose();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.presenter.dispose();
  }
}
