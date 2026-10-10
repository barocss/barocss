import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from './example-runtime.mjs';

export async function readGallery() {
  const gallery = {};
  for (const filename of ['cad', 'scene', 'materials']) {
    const data = JSON.parse(await readFile(resolve(app, `scripts/snippets/presets/${filename}.json`), 'utf8'));
    for (const [key, preset] of Object.entries(data)) {
      if (gallery[key] || !/^[a-z][a-z0-9-]+$/.test(key) || !['surface', 'scene', 'material'].includes(preset.kind) || typeof preset.source !== 'string') throw Error(`Invalid gallery preset: ${key}`);
      gallery[key] = preset;
    }
  }
  if (Object.keys(gallery).length !== 14) throw Error('Expected fourteen selected gallery presets');
  return gallery;
}

export async function visualEntry() {
  const gallery = await readGallery();
  const text = await readFile(resolve(app, 'scripts/snippets/visual.mjs'), 'utf8');
  const marker = '// DOCS_GALLERY_PRESETS';
  if (text.split(marker).length !== 2) throw Error('Visual gallery composition marker is missing or duplicated');
  const directory = resolve(app, 'docs/.vitepress/cache');
  await mkdir(directory, { recursive: true });
  const entry = resolve(directory, 'visual-entry.mjs');
  // Data literals preserve a standalone entry with ordinary public bare imports.
  await writeFile(entry, text.replace(marker, `Object.assign(presets, ${JSON.stringify(gallery)});`));
  return entry;
}
