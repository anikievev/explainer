/**
 * Frame-exact recorder: renders every frame of the scene in headless Chrome
 * and pipes PNGs into ffmpeg. Deterministic, so frames can be split across
 * parallel workers and re-rendered identically.
 *
 *   node src/scripts/record.ts                    # full 1080p video of the latest episode
 *   node src/scripts/record.ts --episode cdn      # a specific episode (see src/scenes/episodes.ts)
 *   node src/scripts/record.ts --4k               # 3840×2160
 *   node src/scripts/record.ts --from 210 --to 240 --workers 4
 *   node src/scripts/record.ts --stills 2,60,150  # PNG stills only
 *   node src/scripts/record.ts --export-mascot    # mascot model → src/assets/models/mascot.glb
 *   node src/scripts/record.ts --thumbnail        # 1280×720 YouTube thumbnail (rendered at 4K)
 *   node src/scripts/record.ts --banner           # 2560×1440 YouTube channel banner (rendered at 4K)
 *
 * Requires ffmpeg on PATH and Google Chrome installed.
 */
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';
import { toSrt } from '../components/Script.ts';
import { getEpisode } from '../scenes/episodes.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT_DIR = join(ROOT, 'output/renders');

const { values: args } = parseArgs({
  options: {
    '4k': { type: 'boolean', default: false },
    workers: { type: 'string', default: String(Math.max(1, Math.min(6, Math.floor(cpus().length / 2)))) },
    from: { type: 'string' },
    to: { type: 'string' },
    stills: { type: 'string' },
    crf: { type: 'string', default: '16' },
    'export-mascot': { type: 'boolean', default: false },
    thumbnail: { type: 'boolean', default: false },
    banner: { type: 'boolean', default: false },
    episode: { type: 'string' },
  },
});

const episode = getEpisode(args.episode);
const VIDEO_SLUG = episode.slug;

const res = args['4k'] || args.thumbnail || args.banner ? '4k' : '1080p';

interface Explainer {
  width: number;
  height: number;
  fps: number;
  duration: number;
  frameCount: number;
}

function ffmpeg(argv: string[]) {
  const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise<void>((ok, fail) =>
    proc.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited with ${code}`)))),
  );
  return { proc, done };
}

async function grabFrame(page: Page, frame: number): Promise<Buffer> {
  const dataUrl = await page.evaluate((f) => window.__explainer!.renderFrame(f), frame);
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0 } });
  await server.listen();
  const address = server.httpServer!.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const url = `http://localhost:${port}/?render=1&res=${res}&episode=${episode.id}${args.thumbnail ? '&thumbnail=1' : ''}${args.banner ? '&banner=1' : ''}`;

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal', '--disable-background-timer-throttling'],
  });

  const openPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (err) => console.error('[page]', err.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__explainer !== undefined, undefined, { timeout: 60_000 });
    return page;
  };

  try {
    const first = await openPage();
    const info = (await first.evaluate(() => {
      const { width, height, fps, duration, frameCount } = window.__explainer!;
      return { width, height, fps, duration, frameCount };
    })) as Explainer;

    if (args['export-mascot']) {
      const glb = await first.evaluate(() => window.__explainer!.exportMascotGlb());
      const dir = join(ROOT, 'src/assets/models');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mascot.glb'), Buffer.from(glb, 'base64'));
      console.log(join(dir, 'mascot.glb'));
      return;
    }

    if (args.banner) {
      const source = join(OUT_DIR, 'channel-banner-4k.png');
      await writeFile(source, await grabFrame(first, 0));
      const png = join(OUT_DIR, 'channel-banner.png');
      await ffmpeg(['-i', source, '-vf', 'scale=2560:1440:flags=lanczos', png]).done;
      console.log(png);
      return;
    }

    if (args.thumbnail) {
      const source = join(OUT_DIR, `${VIDEO_SLUG}-thumbnail-4k.png`);
      await writeFile(source, await grabFrame(first, 0));
      const png = join(OUT_DIR, `${VIDEO_SLUG}-thumbnail.png`);
      const jpg = join(OUT_DIR, `${VIDEO_SLUG}-thumbnail.jpg`);
      await ffmpeg(['-i', source, '-vf', 'scale=1280:720:flags=lanczos', png]).done;
      await ffmpeg(['-i', source, '-vf', 'scale=1280:720:flags=lanczos', '-q:v', '2', jpg]).done;
      console.log(`${png}\n${jpg}`);
      return;
    }

    if (args.stills) {
      const stillsDir = join(OUT_DIR, 'stills', episode.id);
      await mkdir(stillsDir, { recursive: true });
      for (const s of args.stills.split(',').map(Number)) {
        const png = await grabFrame(first, Math.round(s * info.fps));
        const file = join(stillsDir, `t${String(s).padStart(6, '0')}.png`);
        await writeFile(file, png);
        console.log(file);
      }
      return;
    }

    const startFrame = Math.round(Number(args.from ?? 0) * info.fps);
    const endFrame = Math.min(info.frameCount, Math.round(Number(args.to ?? info.duration) * info.fps));
    const total = endFrame - startFrame;
    const workers = Math.max(1, Math.min(Number(args.workers), total));
    const pages = [first, ...(await Promise.all(Array.from({ length: workers - 1 }, openPage)))];
    const segDir = join(OUT_DIR, `.segments-${res}`);
    await rm(segDir, { recursive: true, force: true });
    await mkdir(segDir, { recursive: true });

    console.log(`Rendering ${total} frames (${(total / info.fps).toFixed(1)} s) at ${info.width}×${info.height}@${info.fps} with ${workers} workers`);
    const started = Date.now();
    let rendered = 0;
    const report = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      const rate = rendered / Math.max(elapsed, 0.001);
      const eta = (total - rendered) / Math.max(rate, 0.001);
      console.log(`  ${rendered}/${total} frames · ${rate.toFixed(1)} fps · ETA ${Math.round(eta / 60)} min`);
    }, 10_000);

    const chunk = Math.ceil(total / workers);
    const segments = await Promise.all(
      pages.map(async (page, i) => {
        const a = startFrame + i * chunk;
        const b = Math.min(endFrame, a + chunk);
        const file = join(segDir, `seg-${String(i).padStart(2, '0')}.mp4`);
        if (a >= b) return null;
        const { proc, done } = ffmpeg([
          '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'png', '-i', '-',
          '-c:v', 'libx264', '-preset', 'medium', '-crf', args.crf!, '-pix_fmt', 'yuv420p',
          '-r', String(info.fps), file,
        ]);
        for (let f = a; f < b; f++) {
          const png = await grabFrame(page, f);
          if (!proc.stdin.write(png)) await new Promise((ok) => proc.stdin.once('drain', ok));
          rendered++;
        }
        proc.stdin.end();
        await done;
        return file;
      }),
    );
    clearInterval(report);

    const list = join(segDir, 'list.txt');
    await writeFile(list, segments.filter(Boolean).map((f) => `file '${f}'`).join('\n'));
    const partial = args.from || args.to ? `-${args.from ?? 0}-${args.to ?? 'end'}s` : '';
    const output = join(OUT_DIR, `${VIDEO_SLUG}-${res}${partial}.mp4`);
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', output]).done;
    await rm(segDir, { recursive: true, force: true });

    const srt = join(OUT_DIR, `${VIDEO_SLUG}.srt`);
    await writeFile(srt, toSrt(episode.cues));
    console.log(`Done in ${((Date.now() - started) / 60000).toFixed(1)} min\n  ${output}\n  ${srt}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

await main();
