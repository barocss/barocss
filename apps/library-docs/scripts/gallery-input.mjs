import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { app } from './example-runtime.mjs';

export async function readGallery() {
  const gallery = {};
  for (const filename of ['cad', 'scene', 'materials', 'viewer', 'canvas2d', 'physics']) {
    const data = JSON.parse(await readFile(resolve(app, `scripts/snippets/presets/${filename}.json`), 'utf8'));
    for (const [key, preset] of Object.entries(data)) {
      if (gallery[key] || !/^[a-z][a-z0-9-]+$/.test(key) || !['surface', 'scene', 'material', 'viewer', 'canvas2d', 'physics'].includes(preset.kind) || typeof preset.source !== 'string') throw Error(`Invalid gallery preset: ${key}`);
      if (preset.actions && (!Array.isArray(preset.actions) || preset.actions.some(action => typeof action.id !== 'string' || typeof action.label !== 'string'))) throw Error(`Invalid sample actions: ${key}`);
      gallery[key] = preset;
    }
  }
  if (Object.keys(gallery).length !== 17) throw Error('Expected seventeen additional sample presets');
  return gallery;
}

export async function visualEntry() {
  const gallery = await readGallery();
  const text = await readFile(resolve(app, 'scripts/snippets/visual.mjs'), 'utf8');
  const marker = '// DOCS_GALLERY_PRESETS';
  if (text.split(marker).length !== 2) throw Error('Visual gallery composition marker is missing or duplicated');
  const hostMarker = '// DOCS_HOST_FACTORIES';
  if (text.split(hostMarker).length !== 2) throw Error('Host factory composition marker is missing or duplicated');
  const fragments = [];
  const factories = { viewer: 'createViewerExample', canvas2d: 'createCanvas2DExample', physics: 'createPhysicsExample' };
  for (const [name, factory] of Object.entries(factories)) {
    const fragment = await readFile(resolve(app, `scripts/snippets/hosts/${name}.mjs`), 'utf8');
    const importPattern = /^import .+ from ['"][^'"]+['"];?\s*$/gm;
    const imports = fragment.match(importPattern) || [];
    if (!imports.length || !fragment.includes(`export function ${factory}(`)) throw Error(`Invalid host factory: ${name}`);
    // Each authored module retains a private closure and its bare public imports.
    const body = fragment.replace(importPattern, '').replace(/^export function /gm, 'function ');
    fragments.push(`${imports.join('\n')}\nconst ${factory} = (() => {\n${body}\nreturn ${factory};\n})();`);
  }
  const directory = resolve(app, 'docs/.vitepress/cache');
  await mkdir(directory, { recursive: true });
  const entry = resolve(directory, 'visual-entry.mjs');
  // Data literals preserve a standalone entry with ordinary public bare imports.
  await writeFile(entry, text.replace(hostMarker, fragments.join('\n')).replace(marker, `Object.assign(presets, ${JSON.stringify(gallery)});`));
  return entry;
}
