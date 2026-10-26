import * as THREE from 'three';
import { CSS, FONTS } from '../config/theme.ts';
import { DESIGN_HEIGHT } from '../config/video-settings.ts';

const DESIGN_WIDTH = (DESIGN_HEIGHT * 16) / 9;

export interface TextStyle {
  size?: number;
  weight?: number;
  color?: string;
  mono?: boolean;
  align?: CanvasTextAlign;
  alpha?: number;
}

/**
 * 2D overlay drawn on a canvas and composited on top of the 3D render.
 * All coordinates are in a 1920×1080 design space and scale to any output
 * resolution, so text is equally readable at 1080p and 4K.
 */
export class Hud {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly ctx: CanvasRenderingContext2D;
  readonly width = DESIGN_WIDTH;
  readonly height = DESIGN_HEIGHT;

  private readonly canvas: HTMLCanvasElement;
  private readonly texture: THREE.CanvasTexture;
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private readonly tmp = new THREE.Vector3();

  constructor(pixelWidth: number, pixelHeight: number, private readonly worldCamera: THREE.Camera) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.scene.add(this.quad);
  }

  begin() {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.height / DESIGN_HEIGHT;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.textBaseline = 'middle';
  }

  end() {
    this.texture.needsUpdate = true;
  }

  /** Project a world position into design-space pixels. */
  project(world: THREE.Vector3): { x: number; y: number; visible: boolean } {
    this.tmp.copy(world).project(this.worldCamera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * DESIGN_WIDTH,
      y: (-this.tmp.y * 0.5 + 0.5) * DESIGN_HEIGHT,
      visible: this.tmp.z < 1,
    };
  }

  font(style: TextStyle) {
    return `${style.weight ?? 600} ${style.size ?? 28}px ${style.mono ? FONTS.mono : FONTS.sans}`;
  }

  measure(text: string, style: TextStyle) {
    this.ctx.font = this.font(style);
    return this.ctx.measureText(text).width;
  }

  text(text: string, x: number, y: number, style: TextStyle = {}) {
    const { ctx } = this;
    if ((style.alpha ?? 1) <= 0) return;
    ctx.save();
    ctx.globalAlpha = style.alpha ?? 1;
    ctx.font = this.font(style);
    ctx.fillStyle = style.color ?? CSS.text;
    ctx.textAlign = style.align ?? 'left';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, alpha = 1, lineWidth = 2) {
    const { ctx } = this;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Pill label anchored above a world-space point. */
  label(
    world: THREE.Vector3,
    text: string,
    opts: { alpha?: number; accent?: string; sub?: string; offsetY?: number; size?: number; mono?: boolean; below?: boolean } = {},
  ) {
    const alpha = opts.alpha ?? 1;
    if (alpha <= 0.001) return;
    const p = this.project(world);
    if (!p.visible) return;
    const size = opts.size ?? 26;
    const subSize = Math.round(size * 0.72);
    const padX = size * 0.6;
    const titleW = this.measure(text, { size, mono: opts.mono });
    const subW = opts.sub ? this.measure(opts.sub, { size: subSize, weight: 500 }) : 0;
    const w = Math.max(titleW, subW) + padX * 2;
    const h = opts.sub ? size * 2.3 : size * 1.55;
    const gap = opts.offsetY ?? 34;
    const x = p.x - w / 2;
    const y = opts.below ? p.y + gap : p.y - gap - h;

    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Leader line from the anchor to the pill.
    ctx.strokeStyle = opts.accent ?? CSS.panelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, opts.below ? y : y + h);
    ctx.stroke();
    ctx.restore();

    this.roundRect(x, y, w, h, h / 2.6, CSS.panel, opts.accent ?? CSS.panelBorder, alpha);
    if (opts.sub) {
      this.text(text, p.x, y + h * 0.36, { size, align: 'center', alpha, mono: opts.mono });
      this.text(opts.sub, p.x, y + h * 0.72, { size: subSize, weight: 500, color: CSS.muted, align: 'center', alpha });
    } else {
      this.text(text, p.x, y + h / 2 + 1, { size, align: 'center', alpha, mono: opts.mono });
    }
  }

  /** Big status stamp (HIT / MISS / BYPASS) above a world point. */
  badge(world: THREE.Vector3, text: string, color: string, alpha: number, scale = 1, offsetY = 150) {
    if (alpha <= 0.001) return;
    const p = this.project(world);
    const size = 44 * scale;
    const w = this.measure(text, { size, weight: 800 }) + size * 1.2;
    const h = size * 1.6;
    const y = p.y - offsetY - h / 2;
    this.roundRect(p.x - w / 2, y - h / 2, w, h, 14, 'rgba(5, 8, 15, 0.9)', color, alpha, 4);
    this.text(text, p.x, y + 2, { size, weight: 800, color, align: 'center', alpha });
  }

  titleCard(title: string, subtitle: string, alpha: number) {
    if (alpha <= 0) return;
    const cx = this.width / 2;
    const cy = this.height / 2 - 40;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, 700);
    g.addColorStop(0, 'rgba(5,8,15,0.85)');
    g.addColorStop(1, 'rgba(5,8,15,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
    this.text(title, cx, cy, { size: 104, weight: 800, align: 'center', alpha });
    this.text(subtitle, cx, cy + 92, { size: 38, weight: 500, color: CSS.edge, align: 'center', alpha });
  }

  /** Section marker, top-left. */
  chip(index: string, text: string, alpha: number) {
    if (alpha <= 0) return;
    const x = 64;
    const y = 56;
    const indexW = this.measure(index, { size: 26, weight: 800 }) + 32;
    const textW = this.measure(text, { size: 26, weight: 600 });
    this.roundRect(x, y, indexW + textW + 28, 54, 27, CSS.panel, CSS.panelBorder, alpha);
    this.roundRect(x + 5, y + 5, indexW, 44, 22, CSS.edge, undefined, alpha);
    this.text(index, x + 5 + indexW / 2, y + 28, { size: 26, weight: 800, color: '#05080f', align: 'center', alpha });
    this.text(text, x + indexW + 18, y + 28, { size: 26, alpha });
  }

  /** Key-term callout centered near the bottom. */
  lowerThird(text: string, opts: { alpha: number; accent?: string; mono?: boolean; sub?: string; y?: number }) {
    if (opts.alpha <= 0) return;
    const size = opts.mono ? 34 : 38;
    const subSize = 26;
    const textW = this.measure(text, { size, mono: opts.mono, weight: 700 });
    const subW = opts.sub ? this.measure(opts.sub, { size: subSize, weight: 500 }) : 0;
    const w = Math.max(textW, subW) + 80;
    const h = opts.sub ? 120 : 82;
    const x = this.width / 2 - w / 2;
    const y = (opts.y ?? 930) - h / 2;
    const slide = (1 - opts.alpha) * 24;
    this.roundRect(x, y + slide, w, h, 18, CSS.panel, opts.accent ?? CSS.panelBorder, opts.alpha, 3);
    const titleY = opts.sub ? y + 42 : y + h / 2;
    this.text(text, this.width / 2, titleY + slide, { size, mono: opts.mono, weight: 700, align: 'center', alpha: opts.alpha });
    if (opts.sub) {
      this.text(opts.sub, this.width / 2, y + 88 + slide, { size: subSize, weight: 500, color: CSS.muted, align: 'center', alpha: opts.alpha });
    }
  }

  /** Burned-in caption (off for final renders; captions are added in editing). */
  caption(text: string) {
    if (!text) return;
    const size = 34;
    const w = Math.min(this.measure(text, { size, weight: 500 }) + 48, this.width - 160);
    this.roundRect(this.width / 2 - w / 2, 1010 - 26, w, 52, 10, 'rgba(0,0,0,0.7)');
    this.text(text, this.width / 2, 1010, { size, weight: 500, align: 'center' });
  }

  /** Full-screen fade to background color. */
  fade(alpha: number) {
    if (alpha <= 0) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  dispose() {
    this.texture.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}
