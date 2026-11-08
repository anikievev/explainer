import * as THREE from 'three';
import { CSS } from '../config/theme.ts';
import type { Hud } from './Hud.ts';
import { loadColor } from './Overlays.ts';
import { clamp } from './Timeline.ts';

/**
 * A vertical load bar above each shard (green → yellow → red), with its write
 * rate underneath. `loads` are 0..1 of a shard's capacity; `rates` the writes
 * per second they stand for.
 */
export function drawShardBars(hud: Hud, anchors: THREE.Vector3[], loads: number[], rates: number[], alpha: number, opts: { height?: number; offsetY?: number; unit?: string } = {}) {
  if (alpha <= 0.001) return;
  const h = opts.height ?? 120;
  const w = 40;
  anchors.forEach((anchor, i) => {
    const p = hud.project(anchor);
    const load = clamp(loads[i] ?? 0);
    const x = p.x - w / 2;
    const bottom = p.y - (opts.offsetY ?? 20);
    hud.roundRect(x - 8, bottom - h - 8, w + 16, h + 16, 10, CSS.panel, CSS.panelBorder, alpha, 1.5);
    hud.roundRect(x, bottom - h, w, h, 6, 'rgba(148,163,184,0.18)', undefined, alpha);
    const fill = Math.max(8, h * load);
    hud.roundRect(x, bottom - fill, w, fill, 6, loadColor(load), undefined, alpha);
    const rate = Math.round(rates[i] ?? 0);
    hud.text(`${rate}${opts.unit ?? '/s'}`, p.x, bottom + 24, { size: 22, weight: 800, mono: true, color: load >= 0.85 ? CSS.failure : CSS.muted, align: 'center', alpha });
  });
}
