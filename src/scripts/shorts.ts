/**
 * Cuts vertical YouTube Shorts (1080×1920) out of the full render:
 * blurred background, the 16:9 clip in the middle, hook title on top and
 * large burned-in captions below, with the narration from the voiceover.
 *
 *   npm run shorts                       # all Shorts of the latest episode
 *   npm run shorts -- --episode cdn --only cache-hit-vs-miss
 *
 * Needs the episode's 1080p or 1440p render (npm run record) and voiceover .wav
 * (npm run voiceover). Writes one .mp4 per Short to output/renders/shorts/<episode>/,
 * a clean cover frame per Short (-cover.png, hook + step pill, no captions) for
 * use as its thumbnail, plus SHORTS.md with titles and descriptions ready to paste.
 *
 *   npm run shorts -- --episode sharding --instagram
 *
 * --instagram cuts the same clips as Instagram Reels into
 * output/renders/shorts/<episode>/instagram/, with a layout that clears
 * Instagram's overlays (top bar, right-side buttons): kicker and title moved
 * down, captions in a narrower box. Writes REELS.md with captions to paste.
 * --notes-only rewrites SHORTS.md / REELS.md without cutting the videos again.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Short } from '../components/Script.ts';
import { SFX, type SfxName } from '../config/sfx.ts';
import { getEpisode } from '../scenes/episodes.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const RENDERS = join(ROOT, 'output/renders');
const SFX_DIR = join(ROOT, 'src/assets/sfx');

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
    instagram: { type: 'boolean', default: false },
    'notes-only': { type: 'boolean', default: false },
  },
});

/**
 * Text placement per platform. Instagram draws a taller top bar and a column of
 * buttons along the right edge (x ≈ 960–1080) over the lower half, so Reels move
 * the kicker and title down and keep captions inside x 160–920.
 */
const LAYOUT = args.instagram
  ? { kickerY: 270, titleY: 335, captionMargin: 160, titleMargin: 100 }
  : { kickerY: 230, titleY: 295, captionMargin: 90, titleMargin: 80 };

const episode = getEpisode(args.episode);
const { cues: CUES, shorts: SHORTS } = episode;
const OUT_DIR = join(RENDERS, 'shorts', episode.id, ...(args.instagram ? ['instagram'] : []));
// Any render works (the clip is scaled to 1080 wide); prefer 1080p, else the 1440p upload render.
const inputVideo = args.video ?? [`${episode.slug}-1080p.mp4`, `${episode.slug}-1440p.mp4`].map((f) => join(RENDERS, f)).find((f) => existsSync(f)) ?? join(RENDERS, `${episode.slug}-1080p.mp4`);
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

/** Pieces of the full video played in order: the cold open (if any), then the main clip. */
interface Segment {
  start: number;
  end: number;
  /** Where this piece begins inside the Short. */
  offset: number;
}
/** Stop gap before the next line, so no syllable of it leaks into the cut. */
const NEXT_LINE_GAP = 0.08;

/**
 * Pull a segment's end back to just before the next narration line starts:
 * `to()` pads the last line, and with TAIL that padding can run into a line
 * that follows straight on.
 */
function clampEnd(start: number, end: number): number {
  // The last line meant to be in the segment: the last one that starts well before its end.
  const last = [...CUES].reverse().find((c) => c.start >= start - 0.5 && c.start < end - 0.8);
  if (!last) return end;
  const next = CUES.find((c) => c.start > last.start);
  return next ? Math.min(end, next.start - NEXT_LINE_GAP) : end;
}

function segments(short: Short): Segment[] {
  const out: Segment[] = [];
  let offset = 0;
  for (const [start, rawEnd] of [...(short.open ? [[short.open.start, short.open.end]] : []), [short.start, short.end + TAIL]]) {
    const end = clampEnd(start, rawEnd);
    if (end <= start) throw new Error(`${short.slug}: empty segment ${start}–${end}`);
    out.push({ start, end, offset });
    offset += end - start;
  }
  return out;
}
const shortDuration = (short: Short) => segments(short).reduce((n, s) => n + s.end - s.start, 0);

/** Video time of the Short's cover frame. */
const coverTime = (short: Short) => short.cover ?? (short.beats?.length ? short.beats[0].at + 2 : short.start + 4);

/**
 * Title, step pills and captions as an ASS subtitle script. With `at`, builds a
 * single still instead: the pill active at that time and no captions.
 */
function buildAss(short: Short, duration: number, at?: number): string {
  const end = assTime(duration);
  const captionY = CLIP_Y + CLIP_HEIGHT + 70;
  const events = [
    `Dialogue: 0,0:00:00.00,${end},Kicker,,0,0,0,,{\\an8\\pos(${WIDTH / 2},${LAYOUT.kickerY})}${assText(episode.kicker)}`,
    `Dialogue: 0,0:00:00.00,${end},Title,,0,0,0,,{\\an8\\pos(${WIDTH / 2},${LAYOUT.titleY})}${assText(short.hook)}`,
  ];
  const beats = short.beats ?? [];
  const beatLine = (a: number, b: number, beat: (typeof beats)[number], fade: boolean) =>
    events.push(`Dialogue: 0,${assTime(a)},${assTime(b)},Beat,,0,0,0,,{\\an2\\pos(${WIDTH / 2},${CLIP_Y - 28})\\c${assColor(beat.color)}${fade ? '\\fad(150,0)' : ''}}${assText(beat.text)}`);
  if (at !== undefined) {
    // Cover still: the pill active at that video time, no captions.
    const active = beats.filter((b) => b.at <= at).pop();
    if (active) beatLine(0, duration, active, false);
  } else {
    for (const seg of segments(short)) {
      const toShort = (t: number) => seg.offset + Math.min(seg.end, Math.max(seg.start, t)) - seg.start;
      beats.forEach((beat, i) => {
        const next = i + 1 < beats.length ? beats[i + 1].at : Infinity;
        if (next <= seg.start || beat.at >= seg.end) return;
        // A pill already active when the segment starts shows without fading in.
        beatLine(toShort(beat.at), toShort(next), beat, beat.at > seg.start);
      });
      for (const cue of CUES) {
        // The main clip's tail is padding for the last word, not room for the next line.
        const captionEnd = seg.start === short.start ? short.end : seg.end;
        // Only lines that start inside the segment: a cue ending just after the cut isn't heard.
        if (cue.start < seg.start - 0.35 || cue.start >= captionEnd) continue;
        events.push(`Dialogue: 1,${assTime(toShort(cue.start))},${assTime(toShort(cue.end))},Caption,,0,0,0,,{\\an8\\pos(${WIDTH / 2},${captionY})\\fad(120,120)}${assText(cue.text)}`);
      }
    }
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
Style: Title,${FONT},78,&H00F9F5F1,&H00FFFFFF,&H000F0805,&H00000000,1,0,0,0,100,100,0,0,1,6,0,8,${LAYOUT.titleMargin},${LAYOUT.titleMargin},0,1
Style: Caption,${FONT},62,&H00FFFFFF,&H00FFFFFF,&H000F0805,&H00000000,1,0,0,0,100,100,0,0,1,6,0,8,${LAYOUT.captionMargin},${LAYOUT.captionMargin},0,1
Style: Beat,${FONT},48,&H00FFFFFF,&H00FFFFFF,&H00200F0A,&H00200F0A,1,0,0,0,100,100,1,0,3,14,0,2,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;
}

/** Blurred background + centred 16:9 clip + the ASS overlay, ending in [framed]. */
function frameFilter(assFile: string, input = '[0:v]') {
  return [
    `${input}split[bgsrc][fgsrc]`,
    `[bgsrc]scale=-2:${HEIGHT},crop=${WIDTH}:${HEIGHT},boxblur=28:2,eq=brightness=-0.22:saturation=1.2[bg]`,
    `[fgsrc]scale=${WIDTH}:${CLIP_HEIGHT}[fg]`,
    `[bg][fg]overlay=0:${CLIP_Y}[frame]`,
    // The .ass path sits inside the filter graph, so escape it for ffmpeg.
    `[frame]ass='${assFile.replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:')}'[framed]`,
  ].join(';');
}

/** Sound accents in Short time: explicit cues, plus beat pops and cut whooshes with `beatSounds`. */
function soundEvents(short: Short): Array<{ at: number; sound: SfxName; gain: number }> {
  const segs = segments(short);
  const toShort = (v: number) => {
    const s = segs.find((seg) => v >= seg.start && v < seg.end);
    return s ? s.offset + (v - s.start) : null;
  };
  const out: Array<{ at: number; sound: SfxName; gain: number }> = [];
  for (const c of short.sfx ?? []) {
    // A cue inside both the cold open and the main clip plays in both.
    for (const seg of segs) if (c.at >= seg.start && c.at < seg.end) out.push({ at: seg.offset + (c.at - seg.start), sound: c.sound, gain: c.gain ?? SFX[c.sound].gain });
  }
  if (short.beatSounds) {
    for (const b of short.beats ?? []) {
      const at = toShort(b.at);
      if (at !== null) out.push({ at, sound: 'pop', gain: SFX.pop.gain });
    }
    for (const seg of segs.slice(1)) out.push({ at: Math.max(0, seg.offset - 0.25), sound: 'whoosh', gain: SFX.whoosh.gain });
  }
  for (const e of out) if (!existsSync(join(SFX_DIR, `${e.sound}.mp3`))) throw new Error(`Missing sound ${e.sound}; run npm run sfx`);
  return out.sort((a, b) => a.at - b.at);
}

async function renderShort(short: Short, index: number) {
  const duration = shortDuration(short);
  if (duration > 60) throw new Error(`${short.slug} is ${duration.toFixed(1)} s; Shorts in this series stay under 60 s`);
  const base = join(OUT_DIR, `${String(index + 1).padStart(2, '0')}-${short.slug}`);
  const assFile = `${base}.ass`;
  await writeFile(assFile, buildAss(short, duration));

  // Each segment is cut from the video and the voiceover, then joined with a hard cut.
  const segs = segments(short);
  const inputs = segs.flatMap((s) => {
    const len = (s.end - s.start).toFixed(2);
    return ['-ss', String(s.start), '-t', len, '-i', inputVideo, '-ss', String(s.start), '-t', len, '-i', inputAudio];
  });
  const joins = segs.map((s, i) => {
    const len = s.end - s.start;
    // Tiny audio fades at each cut so the join doesn't click.
    return `[${2 * i + 1}:a]afade=t=in:st=0:d=0.04,afade=t=out:st=${(len - 0.06).toFixed(2)}:d=0.06[a${i}]`;
  });
  const concat = `${segs.map((_, i) => `[${2 * i}:v][a${i}]`).join('')}concat=n=${segs.length}:v=1:a=1[joined][ja]`;
  // Sound accents: one input per event, delayed to its time and mixed under the narration.
  const sounds = soundEvents(short);
  const sfxInputs = sounds.flatMap((e) => ['-i', join(SFX_DIR, `${e.sound}.mp3`)]);
  const first = 2 * segs.length;
  const sfxChains = sounds.map((e, i) => {
    const ms = Math.round(e.at * 1000);
    return `[${first + i}:a]aresample=48000,aformat=channel_layouts=mono,volume=${e.gain},adelay=${ms}|${ms}[s${i}]`;
  });
  const mixed = sounds.length ? `[ja]${sounds.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sounds.length + 1}:duration=first:normalize=0,alimiter=limit=0.89:level=false[jm]` : '[ja]anull[jm]';
  // The limiter keeps an accent over a loud word from clipping (ceiling ≈ −1 dBFS).
  const filter = [
    ...joins,
    concat,
    ...sfxChains,
    mixed,
    frameFilter(assFile, '[joined]'),
    `[framed]fade=t=in:st=0:d=${FADE},fade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}[v]`,
    `[jm]afade=t=in:st=0:d=0.15,afade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}[a]`,
  ].join(';');

  const output = `${base}.mp4`;
  await ffmpeg([
    ...inputs,
    ...sfxInputs,
    '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output,
  ]);
  console.log(`  ${output} (${duration.toFixed(1)} s)`);

  // Cover: one clean frame (hook + current step pill, no captions) to use as the thumbnail.
  const at = coverTime(short);
  if (!segments(short).some((s) => at >= s.start && at < s.end)) throw new Error(`${short.slug}: cover ${at} s is outside the Short`);
  const coverAss = `${base}-cover.ass`;
  await writeFile(coverAss, buildAss(short, 1, at));
  const cover = `${base}-cover.png`;
  await ffmpeg(['-ss', String(at), '-i', inputVideo, '-filter_complex', frameFilter(coverAss), '-map', '[framed]', '-frames:v', '1', cover]);
  console.log(`  ${cover}`);
}

/** Where the cover frame sits inside the Short (for Studio's frame picker). */
function coverOffset(short: Short) {
  const at = coverTime(short);
  const seg = segments(short).find((s) => at >= s.start && at < s.end);
  return seg ? seg.offset + at - seg.start : 0;
}

function metadata(): string {
  const blocks = SHORTS.map((s, i) => {
    const title = `${s.title} #Shorts`;
    if (title.length > 100) throw new Error(`Title too long for ${s.slug}: ${title.length} characters`);
    return `## ${i + 1}. ${s.hook}

File: \`${String(i + 1).padStart(2, '0')}-${s.slug}.mp4\` · ${s.open ? `cold open ${s.open.start.toFixed(1)}–${s.open.end.toFixed(1)} s, then ` : ''}source ${s.start.toFixed(1)}–${s.end.toFixed(1)} s of the full video

Thumbnail: \`${String(i + 1).padStart(2, '0')}-${s.slug}-cover.png\` (1080×1920). If Studio shows an upload button for Shorts thumbnails, upload it; otherwise pick the frame at **${coverOffset(s).toFixed(1)} s** into the Short.

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

/** Saves weigh heavily in Instagram's ranking, so every Reel asks for one. */
const REEL_SAVE_LINE = 'Save this for your next system design interview.';

/** Instagram Reels: no titles or related video, so one caption per Reel and a bio link. */
function reelsMetadata(): string {
  const blocks = SHORTS.map((s, i) => {
    const ask = [REEL_SAVE_LINE, s.question ? `${s.question} 👇` : ''].filter(Boolean).join('\n');
    const caption = `${s.hook}\n\n${s.description}\n\n${ask}\n\nFull video: link in bio (Data Packet on YouTube)\n\n${s.hashtags.slice(0, 5).join(' ')}`;
    if (caption.length > 2200) throw new Error(`Reel caption too long for ${s.slug}: ${caption.length} characters`);
    const file = `${String(i + 1).padStart(2, '0')}-${s.slug}`;
    return `## ${i + 1}. ${s.hook}

File: \`${file}.mp4\` · Cover: \`${file}-cover.png\` (upload it as the cover; the profile grid shows its middle 3:4)

Caption:

\`\`\`
${caption}
\`\`\`
`;
  });
  return `# Instagram Reels: ${episode.title}

Same clips as the YouTube Shorts, laid out to clear Instagram's overlays. Put the full video's YouTube link in the bio before posting.

${blocks.join('\n')}`;
}

async function main() {
  for (const file of [inputVideo, inputAudio]) {
    if (!existsSync(file)) throw new Error(`Missing ${file}. Run npm run record and npm run voiceover first.`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const selected = SHORTS.map((s, i) => [s, i] as const).filter(([s]) => !args.only || args.only.split(',').includes(s.slug));
  if (!args['notes-only']) console.log(`Cutting ${selected.length} Shorts`);
  if (!args['notes-only']) for (const [short, index] of selected) await renderShort(short, index);
  const notes = args.instagram ? 'REELS.md' : 'SHORTS.md';
  await writeFile(join(OUT_DIR, notes), args.instagram ? reelsMetadata() : metadata());
  console.log(`  ${join(OUT_DIR, notes)}`);
}

await main();
