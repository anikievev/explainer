import type { Hud } from '../../components/Hud.ts';
import { CSS } from '../../config/theme.ts';
import { clamp, easeOut, fadeWindow, progress, ramp } from '../../components/Timeline.ts';

/** Round trips needed before the first paint (section 1). Times in seconds. */
export const PAGE_TRIPS: Array<{ label: string; start: number; end: number }> = [
  { label: 'TCP connect', start: 53, end: 55.3 },
  { label: 'TLS handshake', start: 55.3, end: 57.6 },
  { label: 'HTML', start: 57.6, end: 59.9 },
  { label: 'CSS · JS · images', start: 60.5, end: 63.5 },
];

const PANEL_X = 1340;
const PANEL_W = 520;

function panel(hud: Hud, y: number, h: number, title: string, alpha: number, x = PANEL_X, w = PANEL_W) {
  const slide = (1 - alpha) * 30;
  hud.roundRect(x + slide, y, w, h, 22, CSS.panel, CSS.panelBorder, alpha);
  hud.text(title, x + 32 + slide, y + 44, { size: 28, weight: 700, alpha });
  return slide;
}

function bar(hud: Hud, x: number, y: number, w: number, fill: number, color: string, alpha: number) {
  hud.roundRect(x, y, w, 16, 8, 'rgba(148,163,184,0.18)', undefined, alpha);
  if (fill > 0.001) hud.roundRect(x, y, Math.max(16, w * fill), 16, 8, color, undefined, alpha);
}

/** Section 1: stacking round trips with a running total. */
export function drawRoundTripPanel(hud: Hud, t: number) {
  const alpha = fadeWindow(t, 49, 73, 0.6);
  if (alpha <= 0) return;
  // Bottom-right, below Berlin, clear of the centered lower-thirds.
  const px = 1410;
  const y0 = 540;
  const slide = panel(hud, y0, 460, 'Opening the page', alpha, px, 470);
  const x = px + 32 + slide;
  let total = 0;
  PAGE_TRIPS.forEach((trip, i) => {
    const y = y0 + 100 + i * 58;
    const fill = progress(t, trip.start, trip.end);
    total += fill * 100;
    const active = t >= trip.start;
    hud.text(`${i + 1}  ${trip.label}`, x, y, { size: 24, weight: 600, color: active ? CSS.text : CSS.muted, alpha });
    bar(hud, x + 232, y - 8, 76, fill, CSS.network, alpha);
    if (fill >= 1) hud.text('100 ms', x + 406, y, { size: 22, weight: 600, color: CSS.muted, align: 'right', alpha });
  });
  const done = t >= 66;
  hud.text('Total', x, y0 + 342, { size: 28, weight: 700, alpha });
  hud.text(`≈ ${Math.round(total)} ms`, x + 406, y0 + 342, {
    size: done ? 38 : 32,
    weight: 800,
    color: done ? CSS.warning : CSS.text,
    align: 'right',
    alpha,
  });
  hud.text('example: ~100 ms per round trip', x, y0 + 420, { size: 20, weight: 500, color: CSS.muted, alpha });
}

/** Section 2: origin vs edge latency for the Berlin user. */
export function drawLatencyComparePanel(hud: Hud, t: number) {
  const alpha = fadeWindow(t, 187, 209.6, 0.6);
  if (alpha <= 0) return;
  const y0 = 150;
  const slide = panel(hud, y0, 470, 'From Berlin', alpha);
  const x = PANEL_X + 32 + slide;
  const rows = [
    { name: 'Origin · Virginia', ms: 100, color: CSS.warning },
    { name: 'Edge · Frankfurt', ms: 10, color: CSS.healthy },
  ];
  const grow = ramp(t, 189, 191.5, easeOut);
  hud.text('one round trip', x, y0 + 92, { size: 22, weight: 600, color: CSS.muted, alpha });
  rows.forEach((r, i) => {
    const y = y0 + 136 + i * 62;
    hud.text(r.name, x, y, { size: 24, alpha });
    bar(hud, x + 220, y - 8, 120, grow * (r.ms / 100), r.color, alpha);
    hud.text(`~${r.ms} ms`, x + 456, y, { size: 22, weight: 700, color: r.color, align: 'right', alpha });
  });

  const a2 = alpha * ramp(t, 196.5, 197.5);
  const grow2 = ramp(t, 197, 200, easeOut);
  hud.text('4 round trips (cached page)', x, y0 + 290, { size: 22, weight: 600, color: CSS.muted, alpha: a2 });
  rows.forEach((r, i) => {
    const y = y0 + 334 + i * 62;
    hud.text(r.name, x, y, { size: 24, alpha: a2 });
    bar(hud, x + 220, y - 8, 120, grow2 * (r.ms / 100), r.color, a2);
    hud.text(`≈ ${r.ms * 4} ms`, x + 456, y, { size: 22, weight: 700, color: r.color, align: 'right', alpha: a2 });
  });
}

/** Section 4 close: the four cases where a CDN helps little. */
export function drawLimitsCards(hud: Hud, t: number) {
  const alpha = fadeWindow(t, 383, 389.6, 0.5);
  if (alpha <= 0) return;
  const cards = [
    { title: 'Uncacheable', sub: 'private / no-store' },
    { title: 'Rarely used', sub: 'cold cache' },
    { title: 'Already nearby', sub: 'small gain' },
    { title: 'Slow backend', sub: 'fix the code' },
  ];
  const w = 360;
  const gap = 32;
  const total = cards.length * w + (cards.length - 1) * gap;
  cards.forEach((c, i) => {
    const a = alpha * ramp(t, 383.3 + i * 0.5, 383.9 + i * 0.5);
    const x = hud.width / 2 - total / 2 + i * (w + gap);
    const y = 790 + (1 - a) * 30;
    hud.roundRect(x, y, w, 150, 20, CSS.panel, CSS.warning, a, 3);
    hud.text(c.title, x + w / 2, y + 60, { size: 34, weight: 800, align: 'center', alpha: a });
    hud.text(c.sub, x + w / 2, y + 106, { size: 24, weight: 500, color: CSS.muted, align: 'center', alpha: a });
  });
}

/** Recap bullets (left side). */
export function drawRecap(hud: Hud, t: number) {
  const alpha = fadeWindow(t, 394, 412.4, 0.6);
  if (alpha <= 0) return;
  const items = [
    { at: 395.3, title: 'Edges near users', sub: 'DNS or Anycast picks a nearby one' },
    { at: 401.3, title: 'HIT = served at the edge', sub: 'MISS = one trip to origin, then cached' },
    { at: 407.3, title: 'Fresh copies', sub: 'max-age · revalidation · purge' },
  ];
  const x = 80;
  hud.roundRect(x - 20, 200, 720, 470, 24, CSS.panel, CSS.panelBorder, alpha);
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

/** Final 8 seconds: next video + question. */
export function drawEndCard(hud: Hud, t: number) {
  const a1 = ramp(t, 412.2, 413);
  if (a1 > 0) {
    const y = 300 + (1 - a1) * 30;
    hud.roundRect(hud.width / 2 - 430, y, 860, 200, 26, CSS.panel, CSS.edge, a1, 3);
    hud.text('NEXT VIDEO', hud.width / 2, y + 52, { size: 24, weight: 800, color: CSS.edge, align: 'center', alpha: a1 });
    hud.text('How load balancers work', hud.width / 2, y + 118, { size: 54, weight: 800, align: 'center', alpha: a1 });
  }
  const a2 = ramp(t, 416, 416.8);
  if (a2 > 0) {
    hud.text("What's in your Cache-Control headers?", hud.width / 2, 640 + (1 - a2) * 20, {
      size: 40,
      weight: 600,
      color: CSS.text,
      align: 'center',
      alpha: a2,
    });
    hud.text('Tell me in the comments ↓', hud.width / 2, 700 + (1 - a2) * 20, {
      size: 28,
      weight: 500,
      color: CSS.muted,
      align: 'center',
      alpha: a2,
    });
  }
}

/** Small mono countdown for the cache TTL, time-lapsed. */
export function formatCountdown(remaining01: number) {
  const secs = Math.round(clamp(remaining01) * 3600);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
