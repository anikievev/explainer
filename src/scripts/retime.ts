/**
 * Locks an episode's cue timings to its measured voiceover: each line lasts
 * its natural length + PAD (+ the cue's `hold`), sections are separated by
 * SECTION_GAP, and DURATION ends END_HOLD after the last line. Rewrites the
 * numbers in src/scenes/<episode>/script.ts in place.
 *
 *   npm run voiceover -- --episode load-balancer   # make/measure clips
 *   npm run retime -- --episode load-balancer      # rewrite timings
 *   npm run voiceover -- --episode load-balancer   # rebuild the track
 *
 * Only for episodes marked `autoTimed` (episode 1 was timed by hand).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Section } from '../components/Script.ts';
import { getEpisode } from '../scenes/episodes.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const CACHE_DIR = join(ROOT, 'output/renders/voiceover-cache');
const LEAD = 0.3;
const PAD = 0.7;
const SECTION_GAP = 1.5;
const END_HOLD = 4.5;

const { values: args } = parseArgs({ options: { episode: { type: 'string' } } });
const episode = getEpisode(args.episode);
if (!episode.autoTimed) throw new Error(`Episode "${episode.id}" is timed by hand; retime would overwrite it.`);

const scriptPath = join(ROOT, 'src/scenes', episode.id, 'script.ts');
const { SECTIONS } = (await import(scriptPath)) as { SECTIONS: Section[] };
const cues = episode.cues;

const natural = cues.map((_, i) => {
  const file = join(CACHE_DIR, `${episode.id}-fit-${String(i).padStart(2, '0')}-trim.wav`);
  const out = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`Missing ${file}. Run npm run voiceover -- --episode ${episode.id} first.`);
  return Number(out.stdout);
});

const sectionOf = (time: number) => SECTIONS.findIndex((s) => time >= s.start && time < s.end);
const round = (v: number) => Math.round(v * 10) / 10;

const times: Array<[number, number]> = [];
const sectionStarts: number[] = [];
let t = LEAD;
let currentSection = -1;
cues.forEach((cue, i) => {
  const section = sectionOf(cue.start);
  if (section !== currentSection) {
    if (currentSection !== -1) t += SECTION_GAP;
    sectionStarts.push(currentSection === -1 ? 0 : round(t - LEAD));
    currentSection = section;
  }
  const start = round(t);
  const end = round(t + natural[i] + PAD + (cue.hold ?? 0));
  times.push([start, end]);
  t = end;
});
const duration = Math.floor(t + END_HOLD);
if (sectionStarts.length !== SECTIONS.length) throw new Error('Every section needs at least one cue.');

let source = readFileSync(scriptPath, 'utf8');
let cueIndex = 0;
let sectionIndex = 0;
source = source.replace(/\{ start: [\d.]+, end: [\d.]+, (text|index):/g, (_, kind: string) => {
  if (kind === 'text') {
    const [start, end] = times[cueIndex++];
    return `{ start: ${start}, end: ${end}, text:`;
  }
  const start = sectionStarts[sectionIndex];
  const end = sectionStarts[sectionIndex + 1] ?? duration;
  sectionIndex++;
  return `{ start: ${start}, end: ${end}, index:`;
});
source = source.replace(/export const DURATION = [\d.]+;/, `export const DURATION = ${duration};`);
if (cueIndex !== cues.length || sectionIndex !== SECTIONS.length) throw new Error('Could not match every cue/section line in script.ts');
writeFileSync(scriptPath, source);

const drift = Math.max(...times.map(([start], i) => Math.abs(start - cues[i].start)));
console.log(`${episode.id}: ${cues.length} cues retimed, duration ${duration} s (largest shift ${drift.toFixed(1)} s)`);
