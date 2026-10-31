import * as THREE from 'three';
import { ArcPath } from '../../components/ArcPath.ts';
import type { Hud } from '../../components/Hud.ts';
import { Label3D } from '../../components/Label3D.ts';
import { createOriginServer, createUser, type NodeMesh } from '../../components/NodeMesh.ts';
import { PacketPool } from '../../components/PacketPool.ts';
import { fadeWindow, progress } from '../../components/Timeline.ts';
import { WorldMap, geo } from '../../components/WorldMap.ts';
import { COLORS, CSS } from '../../config/theme.ts';
import { ORIGIN_VIRGINIA, USERS } from '../cdn/locations.ts';
import { B } from './beats.ts';

const lifted = (lonLat: [number, number]) => geo(...lonLat, 0.06);

/** Opening callback to episode 1: Berlin → the origin box in Virginia. */
export class IntroMap {
  readonly group = new THREE.Group();
  private readonly map = new WorldMap();
  private readonly origin: NodeMesh = createOriginServer();
  private readonly user: NodeMesh = createUser();
  private readonly arc: ArcPath;
  private readonly pool = new PacketPool(6, 0.06);
  private readonly originLabel: Label3D;
  private readonly userLabel: Label3D;

  constructor() {
    this.origin.group.position.copy(lifted(ORIGIN_VIRGINIA).setY(0.04));
    this.origin.setBaseScale(0.9);
    this.user.group.position.copy(geo(...USERS.berlin.lonLat));
    this.user.setBaseScale(0.9);
    this.arc = new ArcPath(lifted(USERS.berlin.lonLat), lifted(ORIGIN_VIRGINIA), { radius: 0.035 });
    this.group.add(this.map.group, this.origin.group, this.user.group, this.arc.mesh, this.pool.group);
    this.originLabel = new Label3D(this.origin.top, 'Origin · Virginia', { accent: CSS.storage, size: 24 });
    this.userLabel = new Label3D(this.user.top, 'Berlin', { size: 22 });
  }

  update(t: number) {
    this.origin.setAppear(progress(t, 0.2, 0.7));
    this.user.setAppear(progress(t, 0.4, 0.9));
    this.arc.setReveal(progress(t, 0.8, 2.2));
    this.arc.setOpacity(0.55);
    // The origin glows as the camera pushes in: "what's inside?"
    this.origin.setStatus(new THREE.Color(COLORS.healthy).lerp(new THREE.Color(COLORS.warning), progress(t, B.spike - 4, B.spike - 2.5)));
    this.pool.begin();
    this.pool.stream(this.arc.curve, t, 1.2, B.shop + 2, 0.9, 1.6, { color: COLORS.network, reverse: true });
    this.pool.end();
  }

  drawOverlay(hud: Hud, t: number) {
    const a = fadeWindow(t, 0.8, B.shop + 2.2, 0.4);
    this.originLabel.draw(hud, a, { sub: t >= B.shop ? 'an online shop' : undefined });
    this.userLabel.draw(hud, a);
  }

  dispose() {
    this.map.dispose();
    this.origin.dispose();
    this.user.dispose();
    this.arc.dispose();
    this.pool.dispose();
  }
}
