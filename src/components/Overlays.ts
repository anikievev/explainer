import * as THREE from 'three';
import { CSS } from '../config/theme.ts';
import type { Hud } from './Hud.ts';
import { clamp, fadeWindow, ramp } from './Timeline.ts';

/** Green → yellow → red for a 0..1 load value (CLAUDE.md colour language). */
export function loadColor(load: number): string {
  if (load < 0.6) return CSS.healthy;
  if (load < 0.85) return CSS.warning;
  return CSS.failure;
}

/** Small load bar floating above a world point, with an optional caption. */
export function drawMeter(hud: Hud, world: THREE.Vector3, load: number, alpha: number, opts: { label?: string; offsetY?: number; width?: number } = {}) {
  if (alpha <= 0.001) return;
  const p = hud.project(world);
  const w = opts.width ?? 120;
  const y = p.y - (opts.offsetY ?? 40);
  const x = p.x - w / 2;
  const fill = clamp(load);
  hud.roundRect(x - 8, y - 8, w + 16, opts.label ? 50 : 30, 10, CSS.panel, CSS.panelBorder, alpha, 1.5);
  hud.roundRect(x, y, w, 14, 7, 'rgba(148,163,184,0.25)', undefined, alpha);
  hud.roundRect(x, y, Math.max(14, w * fill), 14, 7, loadColor(fill), undefined, alpha);
  if (opts.label) hud.text(opts.label, p.x, y + 30, { size: 16, weight: 600, color: CSS.muted, align: 'center', alpha });
}

/** Counter pill (e.g. "12 requests") above a world point. */
export function drawCounter(hud: Hud, world: THREE.Vector3, text: string, alpha: number, accent: string = CSS.network, offsetY = 40) {
  if (alpha <= 0.001) return;
  const p = hud.project(world);
  const size = 24;
  const w = hud.measure(text, { size, weight: 800, mono: true }) + 28;
  hud.roundRect(p.x - w / 2, p.y - offsetY - 20, w, 40, 20, CSS.panel, accent, alpha, 2);
  hud.text(text, p.x, p.y - offsetY + 1, { size, weight: 800, mono: true, align: 'center', alpha });
}

export interface RecapItem {
  at: number;
  title: string;
  sub: string;
}

/** Recap checklist panel (left side), items tick in at their `at` times. */
export function drawRecapPanel(hud: Hud, t: number, start: number, end: number, items: RecapItem[]) {
  const alpha = fadeWindow(t, start, end, 0.6);
  if (alpha <= 0) return;
  const x = 80;
  const height = 150 + items.length * 120;
  hud.roundRect(x - 20, 200, 760, height, 24, CSS.panel, CSS.panelBorder, alpha);
  hud.text('Recap', x + 16, 252, { size: 34, weight: 800, color: CSS.edge, alpha });
  items.forEach((item, i) => {
    const a = alpha * ramp(t, item.at, item.at + 0.6);
    const y = 340 + i * 120;
    const slide = (1 - a) * 20;
    hud.roundRect(x + 16 + slide, y - 22, 44, 44, 22, CSS.healthy, undefined, a);
    hud.text('✓', x + 38 + slide, y + 1, { size: 28, weight: 800, color: '#05080f', align: 'center', alpha: a });
    hud.text(item.title, x + 84 + slide, y - 6, { size: 34, weight: 700, alpha: a });
    hud.text(item.sub, x + 84 + slide, y + 34, { size: 24, weight: 500, color: CSS.muted, alpha: a });
  });
}

/** "Next video" card, then the comment question. */
export function drawEndCard(hud: Hud, t: number, opts: { at: number; questionAt: number; next: string; question: string }) {
  const a1 = ramp(t, opts.at, opts.at + 0.8);
  if (a1 > 0) {
    const y = 300 + (1 - a1) * 30;
    hud.roundRect(hud.width / 2 - 430, y, 860, 200, 26, CSS.panel, CSS.edge, a1, 3);
    hud.text('NEXT VIDEO', hud.width / 2, y + 52, { size: 24, weight: 800, color: CSS.edge, align: 'center', alpha: a1 });
    hud.text(opts.next, hud.width / 2, y + 118, { size: 54, weight: 800, align: 'center', alpha: a1 });
  }
  const a2 = ramp(t, opts.questionAt, opts.questionAt + 0.8);
  if (a2 > 0) {
    hud.text(opts.question, hud.width / 2, 640 + (1 - a2) * 20, { size: 40, weight: 600, align: 'center', alpha: a2 });
    hud.text('Tell me in the comments ↓', hud.width / 2, 700 + (1 - a2) * 20, { size: 28, weight: 500, color: CSS.muted, align: 'center', alpha: a2 });
  }
}
