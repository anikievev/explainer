/**
 * Voiceover: synthesizes every narration cue with ElevenLabs, fits each clip
 * into its cue slot, mixes them into one track and muxes it onto the render.
 *
 *   npm run voiceover                          # latest episode, muxed onto its 1440p render (else 1080p)
 *   npm run voiceover -- --episode cdn
 *   npm run voiceover -- --input output/renders/how-a-cdn-works-4k.mp4
 *
 * Clips are cached by (voice, model, text, context), so re-runs only pay for
 * cues whose text changed. Requires ffmpeg/ffprobe and ELEVENLABS_API_KEY
 * (loaded from .env.local by the npm script).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { getEpisode } from '../scenes/episodes.ts';
import { CACHE_DIR, describeVoice, synthesize as synthesizeLine } from './tts.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT_DIR = join(ROOT, 'output/renders');
/** Silence before each line, and the gap kept before the next cue starts. */
const LEAD_IN = 0.12;
const TAIL_GAP = 0.2;
/** Clips longer than their slot are sped up slightly, never beyond this... */
const MAX_TEMPO = 1.12;
/** ...and any remainder pushes the following lines later, at least this far apart. */
const MIN_PAUSE = 0.25;
const CONCURRENCY = 3;

const { values: args } = parseArgs({
  options: {
    episode: { type: 'string' },
    input: { type: 'string' },
  },
});

const episode = getEpisode(args.episode);
const VIDEO_SLUG = episode.slug;
const CUES = episode.cues;
const DURATION = episode.duration;
// Mux onto the upload render (1440p) when it exists, else the 1080p working render.
const inputVideo = args.input ?? [`${VIDEO_SLUG}-1440p.mp4`, `${VIDEO_SLUG}-1080p.mp4`].map((f) => join(OUT_DIR, f)).find((f) => existsSync(f)) ?? join(OUT_DIR, `${VIDEO_SLUG}-1080p.mp4`);

function run(cmd: string, argv: string[]): Promise<string> {
  return new Promise((ok, fail) => {
    const proc = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('exit', (code) => (code === 0 ? ok(out) : fail(new Error(`${cmd} exited with ${code}\n${err}`))));
  });
}

const ffmpeg = (argv: string[]) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv]);
const duration = async (file: string) =>
  Number(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]));

const spoken = (i: number) => CUES[i].say ?? CUES[i].text;

const synthesize = (i: number) =>
  synthesizeLine(spoken(i), {
    previousText: i > 0 ? spoken(i - 1) : undefined,
    nextText: i < CUES.length - 1 ? spoken(i + 1) : undefined,
  });

/** Trims leading/trailing silence and speeds the clip up if it overruns its slot. */
async function fit(i: number, source: string) {
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03';
  const trimmed = join(CACHE_DIR, `${episode.id}-fit-${String(i).padStart(2, '0')}-trim.wav`);
  await ffmpeg(['-i', source, '-af', `${trim},areverse,${trim},areverse`, '-ar', '48000', '-ac', '1', trimmed]);

  const natural = await duration(trimmed);
  const slot = CUES[i].end - CUES[i].start - LEAD_IN - TAIL_GAP;
  const tempo = Math.min(MAX_TEMPO, Math.max(1, natural / slot));
  const fitted = join(CACHE_DIR, `${episode.id}-fit-${String(i).padStart(2, '0')}.wav`);
  await ffmpeg(['-i', trimmed, '-af', `atempo=${tempo.toFixed(4)}`, fitted]);
  return { file: fitted, natural, slot, tempo, length: natural / tempo };
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });

  console.log(`Synthesizing ${CUES.length} cues with ${describeVoice()}`);
  const clips: string[] = new Array(CUES.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < CUES.length) {
        const i = next++;
        clips[i] = await synthesize(i);
        process.stdout.write('.');
      }
    }),
  );
  console.log();

  const fitted = await Promise.all(clips.map((file, i) => fit(i, file)));

  // Each line starts at its cue, or right after the previous line if that ran long.
  const starts: number[] = [];
  let previousEnd = 0;
  for (const [i, f] of fitted.entries()) {
    const at = Math.max(CUES[i].start + LEAD_IN, previousEnd + MIN_PAUSE);
    starts.push(at);
    previousEnd = at + f.length;
    const drift = at - (CUES[i].start + LEAD_IN);
    if (f.tempo > 1.001 || drift > 0.01) {
      console.log(`  cue ${i} @${CUES[i].start}s: ${f.natural.toFixed(2)} s in ${f.slot.toFixed(2)} s slot · ×${f.tempo.toFixed(2)} · starts ${drift.toFixed(2)} s late`);
    }
  }
  if (previousEnd > DURATION) throw new Error(`Narration ends at ${previousEnd.toFixed(2)} s, after the video (${DURATION} s)`);

  // Place each clip and sum into one mono track.
  const inputs = fitted.flatMap((f) => ['-i', f.file]);
  const delays = fitted.map((_, i) => `[${i}:a]adelay=${Math.round(starts[i] * 1000)}:all=1[d${i}]`);
  const mix = `${fitted.map((_, i) => `[d${i}]`).join('')}amix=inputs=${fitted.length}:normalize=0,apad,atrim=0:${DURATION},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  const track = join(OUT_DIR, `${VIDEO_SLUG}-voiceover.wav`);
  await ffmpeg([...inputs, '-filter_complex', [...delays, mix].join(';'), '-map', '[out]', '-ar', '48000', track]);
  console.log(`  ${track}`);

  if (!existsSync(inputVideo)) {
    console.log(`No video at ${inputVideo}; skipped muxing.`);
    return;
  }
  const voiced = inputVideo.replace(/\.mp4$/, '-voiced.mp4');
  await ffmpeg(['-i', inputVideo, '-i', track, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', voiced]);
  console.log(`  ${voiced}`);
}

await main();
