import type { Hud } from './Hud.ts';
import type { MascotPose } from './Mascot.ts';
import { FONTS } from '../config/theme.ts';

/**
 * Shared thumbnail style (see the rules below), so every episode's thumbnail
 * reads as one series:
 *   - a 2–4 word hook, top-left, at most two lines; the subject on the right
 *   - no title pill (the video title already says it)
 *   - at most two short number badges, large enough for a phone
 *   - a coloured glow behind the subject instead of a flat background
 *   - nothing in the bottom-right corner, where YouTube draws the duration
 */

export type VariantId = 'a' | 'b' | 'c';
export const VARIANTS: VariantId[] = ['a', 'b', 'c'];

export interface ThumbnailVariant {
  id: VariantId;
  /** Hook lines, drawn big and top-left (max 4 words in total). */
  lines: Array<{ text: string; color: string }>;
  pose: (t: number) => MascotPose;
}

const MAX_WORDS = 4;
/** YouTube's duration badge (design pixels, 1920×1080). */
const BADGE_ZONE = { x: 1600, y: 940 };
const HOOK_X = 80;
const HOOK_MAX_WIDTH = 1000;

export function parseVariant(value: string | null): VariantId {
  return value === 'b' || value === 'c' ? value : 'a';
}

export function pickVariant(variants: ThumbnailVariant[], id: VariantId): ThumbnailVariant {
  const variant = variants.find((v) => v.id === id) ?? variants[0];
  const words = variant.lines.flatMap((l) => l.text.split(/\s+/)).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length > MAX_WORDS) throw new Error(`Thumbnail hook "${variant.lines.map((l) => l.text).join(' ')}" has ${words.length} words (max ${MAX_WORDS}).`);
  return variant;
}

/** Fail loudly if something would sit under YouTube's duration badge. */
export function assertClearOfBadge(x: number, y: number, what: string) {
  if (x > BADGE_ZONE.x && y > BADGE_ZONE.y) throw new Error(`${what} at (${Math.round(x)}, ${Math.round(y)}) is under the duration badge.`);
}

/** Big glowing headline text with a dark outline. */
export function headline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 150) {
  ctx.save();
  ctx.font = `900 ${size}px ${FONTS.sans}`;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.round(size * 0.11);
  ctx.strokeStyle = '#05080f';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** The hook: one size for all lines, shrunk only if the longest line would pass HOOK_MAX_WIDTH. */
export function drawHook(hud: Hud, variant: ThumbnailVariant) {
  const { ctx } = hud;
  ctx.save();
  let size = 150;
  for (const line of variant.lines) {
    ctx.font = `900 ${size}px ${FONTS.sans}`;
    const w = ctx.measureText(line.text).width;
    if (w > HOOK_MAX_WIDTH) size = Math.max(100, Math.floor((size * HOOK_MAX_WIDTH) / w));
  }
  ctx.restore();
  variant.lines.forEach((line, i) => headline(ctx, line.text, HOOK_X, 150 + size * 0.55 + i * size * 1.0, line.color, size));
}

/** Additive colour glow (screen space) to light the subject from behind. */
export function glow(hud: Hud, x: number, y: number, radius: number, color: string, strength = 0.45) {
  const { ctx } = hud;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, withAlpha(color, strength));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Darken the edges and the hook area so the text and the subject stand out. */
export function vignette(hud: Hud) {
  const { ctx, width, height } = hud;
  ctx.save();
  const edge = ctx.createRadialGradient(width * 0.6, height * 0.55, height * 0.35, width * 0.6, height * 0.55, width * 0.75);
  edge.addColorStop(0, 'rgba(5, 8, 15, 0)');
  edge.addColorStop(1, 'rgba(5, 8, 15, 0.75)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
  const left = ctx.createLinearGradient(0, 0, 1150, 0);
  left.addColorStop(0, 'rgba(5, 8, 15, 0.8)');
  left.addColorStop(1, 'rgba(5, 8, 15, 0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 1150, 520);
  ctx.restore();
}

/** Large number badge (screen space), readable on a phone. */
export function numberBadge(hud: Hud, x: number, y: number, text: string, color: string, size = 64) {
  const w = hud.measure(text, { size, weight: 900 }) + size * 0.9;
  const h = size * 1.45;
  assertClearOfBadge(x + w / 2, y + h / 2, `Badge "${text}"`);
  hud.roundRect(x - w / 2, y - h / 2, w, h, h / 2.4, 'rgba(5, 8, 15, 0.92)', color, 1, 5);
  hud.text(text, x, y + 2, { size, weight: 900, color, align: 'center' });
}

function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
