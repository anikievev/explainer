/**
 * Generates the channel's small sound-effect library with ElevenLabs
 * (text to sound effects) into src/assets/sfx/<name>.mp3. Files that already
 * exist are kept, so this only pays for new or changed sounds.
 *
 *   npm run sfx              # generate missing sounds
 *   npm run sfx -- --force   # regenerate all
 *
 * Requires ELEVENLABS_API_KEY (read by the SDK from .env.local via npm run).
 */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { SFX, type SfxName } from '../config/sfx.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT_DIR = join(ROOT, 'src/assets/sfx');

const { values: args } = parseArgs({ options: { force: { type: 'boolean', default: false } } });

async function toBuffer(audio: unknown): Promise<Buffer> {
  // The SDK returns a web ReadableStream (or an async iterable in older versions).
  const chunks: Uint8Array[] = [];
  const stream = audio as { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } & AsyncIterable<Uint8Array>;
  if (stream.getReader) {
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } else {
    for await (const chunk of stream) chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const client = new ElevenLabsClient();
  for (const [name, spec] of Object.entries(SFX) as Array<[SfxName, (typeof SFX)[SfxName]]>) {
    const file = join(OUT_DIR, `${name}.mp3`);
    if (existsSync(file) && !args.force) {
      console.log(`  ${name}: kept`);
      continue;
    }
    const audio = await client.textToSoundEffects.convert({
      text: spec.prompt,
      durationSeconds: spec.duration,
      promptInfluence: 0.7,
    });
    await writeFile(file, await toBuffer(audio));
    console.log(`  ${name}: ${file}`);
  }
}

await main();
