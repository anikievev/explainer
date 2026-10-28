/**
 * Cuts vertical YouTube Shorts (1080×1920) out of the full render:
 * blurred background, the 16:9 clip in the middle, hook title on top and
 * large burned-in captions below, with the narration from the voiceover.
 *
 *   npm run shorts                       # all Shorts of the latest episode
 *   npm run shorts -- --episode cdn --only cache-hit-vs-miss
 *
 * Needs the episode's 1080p render (npm run record) and voiceover .wav
 * (npm run voiceover). Writes one .mp4 per Short to output/renders/shorts/<episode>/
 * plus SHORTS.md with titles and descriptions ready to paste.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Short } from '../components/Script.ts';
import { getEpisode } from '../scenes/episodes.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const RENDERS = join(ROOT, 'output/renders');

const WIDTH = 1080;
const HEIGHT = 1920;
/** Top of the 16:9 clip inside the vertical frame. */
const CLIP_Y = 640;
const CLIP_HEIGHT = Math.round((WIDTH * 9) / 16);
/** Extra time after the last cue so a late-running line isn't clipped. */
const TAIL = 0.6;
const FADE = 0.4;
const FONT = 'Helvetica Neue';

const { values: args } = parseArgs({
  options: {
    episode: { type: 'string' },
    video: { type: 'string' },
    audio: { type: 'string' },
    only: { type: 'string' },
  },
});

const episode = getEpisode(args.episode);
const { cues: CUES, shorts: SHORTS } = episode;
const OUT_DIR = join(RENDERS, 'shorts', episode.id);
const inputVideo = args.video ?? join(RENDERS, `${episode.slug}-1080p.mp4`);
const inputAudio = args.audio ?? join(RENDERS, `${episode.slug}-voiceover.wav`);

function ffmpeg(argv: string[]): Promise<void> {
  return new Promise((ok, fail) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { stdio: ['ignore', 'inherit', 'inherit'] });
    proc.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited with ${code}`))));
  });
}

const assTime = (s: number) => {
  const cs = Math.max(0, Math.round(s * 100));
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
/** '#rrggbb' → ASS '&HBBGGRR&'. */
const assColor = (hex: string) => `&H${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}&`.toUpperCase();
const assText = (s: string) => s.replace(/[{}]/g, '').replace(/\n/g, '\\N');

/** Title, part counter, captions and footer as an ASS subtitle script. */
function buildAss(short: Short, index: number, duration: number): string {
  const end = assTime(duration);
  const captionY = CLIP_Y + CLIP_HEIGHT + 70;
  const events = [
    `Dialogue: 0,0:00:00.00,${end},Kicker,,0,0,0,,{\\an8\\pos(${WIDTH / 2},230)}${assText(episode.kicker)}`,
    `Dialogue: 0,0:00:00.00,${end},Title,,0,0,0,,{\\an8\\pos(${WIDTH / 2},295)}${assText(short.hook)}`,
  ];
  const beats = short.beats ?? [];
  beats.forEach((beat, i) => {
    const a = Math.max(0, beat.at - short.start);
    const b = i + 1 < beats.length ? beats[i + 1].at - short.start : duration;
    events.push(`Dialogue: 0,${assTime(a)},${assTime(b)},Beat,,0,0,0,,{\\an2\\pos(${WIDTH / 2},${CLIP_Y - 28})\\c${assColor(beat.color)}\\fad(150,0)}${assText(beat.text)}`);
  });
  for (const cue of CUES) {
    if (cue.end <= short.start || cue.start >= short.end) continue;
    const a = Math.max(0, cue.start - short.start);
    const b = Math.min(duration, cue.end - short.start);
    events.push(`Dialogue: 1,${assTime(a)},${assTime(b)},Caption,,0,0,0,,{\\an8\\pos(${WIDTH / 2},${captionY})\\fad(120,120)}${assText(cue.text)}`);
  }
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${WIDTH}
PlayResY: ${HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kicker,${FONT},40,&H00EED322,&H00FFFFFF,&H000F0805,&H00000000,1,0,0,0,100,100,2,0,1,3,0,8,80,80,0,1
Style: Title,${FONT},78,&H00F9F5F1,&H00FFFFFF,&H000F0805,&H00000000,1,0,0,0,100,100,0,0,1,6,0,8,80,80,0,1
Style: Caption,${FONT},62,&H00FFFFFF,&H00FFFFFF,&H000F0805,&H00000000,1,0,0,0,100,100,0,0,1,6,0,8,90,90,0,1
Style: Beat,${FONT},48,&H00FFFFFF,&H00FFFFFF,&H00200F0A,&H00200F0A,1,0,0,0,100,100,1,0,3,14,0,2,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

async function renderShort(short: Short, index: number) {
  const duration = short.end - short.start + TAIL;
  if (duration > 60) throw new Error(`${short.slug} is ${duration.toFixed(1)} s; Shorts in this series stay under 60 s`);
  const base = join(OUT_DIR, `${String(index + 1).padStart(2, '0')}-${short.slug}`);
  const assFile = `${base}.ass`;
  await writeFile(assFile, buildAss(short, index, duration));

  const filter = [
    '[0:v]split[bgsrc][fgsrc]',
    `[bgsrc]scale=-2:${HEIGHT},crop=${WIDTH}:${HEIGHT},boxblur=28:2,eq=brightness=-0.22:saturation=1.2[bg]`,
    `[fgsrc]scale=${WIDTH}:${CLIP_HEIGHT}[fg]`,
    `[bg][fg]overlay=0:${CLIP_Y}[frame]`,
    // The .ass path sits inside the filter graph, so escape it for ffmpeg.
    `[frame]ass='${assFile.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:')}',fade=t=in:st=0:d=${FADE},fade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}[v]`,
    `[1:a]afade=t=in:st=0:d=0.15,afade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}[a]`,
  ].join(';');

  const output = `${base}.mp4`;
  await ffmpeg([
    '-ss', String(short.start), '-t', duration.toFixed(2), '-i', inputVideo,
    '-ss', String(short.start), '-t', duration.toFixed(2), '-i', inputAudio,
    '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output,
  ]);
  console.log(`  ${output} (${duration.toFixed(1)} s)`);
}

function metadata(): string {
  const blocks = SHORTS.map((s, i) => {
    const title = `${s.title} #Shorts`;
    if (title.length > 100) throw new Error(`Title too long for ${s.slug}: ${title.length} characters`);
    return `## ${i + 1}. ${s.hook}

File: \`${String(i + 1).padStart(2, '0')}-${s.slug}.mp4\` · source ${s.start}–${s.end} s of the full video

Title:

\`\`\`
${title}
\`\`\`

Description:

\`\`\`
${s.description}

Full explainer: [link to "${episode.title}"]

${['#Shorts', ...s.hashtags].join(' ')}
\`\`\`
`;
  });
  return `# Shorts: ${episode.title}

Upload each Short after the full video is live, then replace \`[link to "${episode.title}"]\` with its URL and set the Short's "Related video" to the full video.

${blocks.join('\n')}`;
}

async function main() {
  for (const file of [inputVideo, inputAudio]) {
    if (!existsSync(file)) throw new Error(`Missing ${file}. Run npm run record and npm run voiceover first.`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const selected = SHORTS.map((s, i) => [s, i] as const).filter(([s]) => !args.only || args.only.split(',').includes(s.slug));
  console.log(`Cutting ${selected.length} Shorts`);
  for (const [short, index] of selected) await renderShort(short, index);
  await writeFile(join(OUT_DIR, 'SHORTS.md'), metadata());
  console.log(`  ${join(OUT_DIR, 'SHORTS.md')}`);
}

await main();
