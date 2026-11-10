/**
 * ElevenLabs text-to-speech with an on-disk cache, shared by the episode
 * voiceover and the Short-only intro lines so both use the same voice.
 *
 * Clips are cached by (voice, model, text, context), so re-runs only pay for
 * lines whose text changed. Needs ELEVENLABS_API_KEY (from .env.local via the
 * npm scripts) only when a line isn't cached yet.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export const CACHE_DIR = join(resolve(import.meta.dirname, '../..'), 'output/renders/voiceover-cache');

const VOICE_ID = 'Gfpl8Yo74Is0W6cPUWWT';
const MODEL_ID = 'eleven_v4';
const VOICE_SETTINGS = { stability: 0.5, similarityBoost: 0.75 };

let client: ElevenLabsClient | undefined;
let clipNames: string[] | undefined;
const cachedClips = () => (clipNames ??= existsSync(CACHE_DIR) ? readdirSync(CACHE_DIR).filter((n) => n.endsWith('.mp3')) : []);

export const describeVoice = () => `voice ${VOICE_ID} (${MODEL_ID})`;

/**
 * Synthesizes one line and returns the cached .mp3. `previousText` / `nextText`
 * give the model the surrounding lines so intonation flows across clips.
 */
export async function synthesize(text: string, context: { previousText?: string; nextText?: string } = {}): Promise<string> {
  // Field order is part of the cache key: keep it as it was when the cache was built.
  const request = {
    text,
    modelId: MODEL_ID,
    outputFormat: 'mp3_44100_128' as const,
    voiceSettings: VOICE_SETTINGS,
    previousText: context.previousText,
    nextText: context.nextText,
  };
  const key = createHash('sha1').update(JSON.stringify([VOICE_ID, request])).digest('hex').slice(0, 12);
  // Keyed by content only, so inserting a line doesn't invalidate the ones after it.
  // Older clips were named cue-<index>-<key>.mp3; reuse them too.
  const file = join(CACHE_DIR, `clip-${key}.mp3`);
  if (existsSync(file)) return file;
  const legacy = cachedClips().find((name) => name.endsWith(`-${key}.mp3`));
  if (legacy) return join(CACHE_DIR, legacy);

  if (!process.env.ELEVENLABS_API_KEY) throw new Error(`"${text}" isn't cached yet; set ELEVENLABS_API_KEY (npm scripts load it from .env.local)`);
  await mkdir(CACHE_DIR, { recursive: true });
  client ??= new ElevenLabsClient();
  // 409: a library voice is being added to the account by a parallel request.
  let audio;
  for (let attempt = 0; ; attempt++) {
    try {
      audio = await client.textToSpeech.convert(VOICE_ID, request);
      break;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (attempt >= 5 || (status !== 409 && status !== 429)) throw err;
      await new Promise((ok) => setTimeout(ok, 2000 * (attempt + 1)));
    }
  }
  await writeFile(file, Buffer.from(await new Response(audio).arrayBuffer()));
  return file;
}
