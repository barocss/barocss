// Actual Presenter, GPU Viewer scene methods, Mesh and Geometry; no device or rendering is simulated as WebGPU proof.
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const root = new URL('../../../../', import.meta.url);
export async function loadLifetimeSource(source = new URL('../../src/presenter.ts', import.meta.url), snapshot) {
  const built = await build({ stdin: { contents: `export { Presenter } from ${JSON.stringify(source.pathname)};
export { Viewer as CoreViewer, Geometry, ImageTexture } from '@barocss/gpu/viewer';
export { Viewer as PublicViewer } from './packages/barocss-viewer/src/index.ts';`, resolveDir: root.pathname },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
    plugins: [{ name: 'own-source', setup(builder) {
      builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
        const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
        const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
        const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
        return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
      });
    } }] });
  const bytes = built.outputFiles[0].contents;
  if (snapshot) {
    await writeFile(new URL(`${snapshot.name}.mjs.gz`, snapshot.base), gzipSync(bytes));
    const inputs = {};
    for (const key of Object.keys(built.metafile.inputs)) {
      if (key === '<stdin>') continue;
      const file = new URL(key, root), content = await readFile(file);
      inputs[key] = { sha256: createHash('sha256').update(content).digest('hex'), bytes: content.length };
    }
    await writeFile(new URL(`${snapshot.name}.inputs.json`, snapshot.base), JSON.stringify({ bundle: createHash('sha256').update(bytes).digest('hex'), inputs }, null, 2) + '\n');
  }
  const temp = await mkdtemp(tmpdir() + '/presenter-lifetime-');
  try { await writeFile(temp + '/bundle.mjs', bytes); return await import(pathToFileURL(temp + '/bundle.mjs').href); }
  finally { await rm(temp, { recursive: true }); }
}

export function setup(api) {
  const core = Object.create(api.CoreViewer.prototype);
  Object.assign(core, { disposed: false, geometries: new Set(), meshes: [], costRecords: new Map(), freeSlots: [], nextSlot: 0, nextId: 1,
    objectCapacity: 1024, scene: null, canvas: { width: 320, height: 240 }, camera: {}, lights: [], environment: {},
    requests: 0, options: {}, scheduled: 0, pathTraces: new Set(), renderTargets: new Set(), textures: new Set(), shadowFrameBuffers: [], waiters: [] });
  core.requestRender = () => { core.requests++; };
  core.setBackground = value => { core.background = value; };
  const all = [], create = core.createGeometry.bind(core);
  core.createGeometry = input => {
    const g = create(input), dispose = g.dispose.bind(g); g.disposals = 0;
    g.dispose = () => { g.disposals++; dispose(); }; all.push(g); return g;
  };
  return { core, all, presenter: new api.Presenter(core) };
}
export function drawing(items, distance = 5) {
  return { items, camera: { eye: [0, 0, distance], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: 0.01, far: 100 },
    lighting: null, background: [0, 0, 0], mmToScene: 0.1 };
}
export function items() {
  return [{ kind: 'triangles', positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2], color: [1, 0, 0], name: 'face' },
    { kind: 'lines', positions: [0, 0, 0, 1, 0, 0], color: [0, 1, 0], name: 'edge' },
    { kind: 'points', positions: [0.5, 0.5, 0], color: [0, 0, 1], sizePx: 6 }];
}
export function buffer() { return { destroyed: 0, destroy() { this.destroyed++; } }; }
export function attachBuffers(g, sharedUV) {
  const owned = [buffer(), buffer(), buffer(), buffer(), buffer(), buffer(), buffer()];
  g.gpu = { positions: owned[0], normals: owned[1], colors: owned[2], indices: owned[3], uvs: sharedUV ?? owned[4], ownUVs: !sharedUV };
  g.scalarGpu = { positions: owned[5], normals: null, values: owned[6] };
  return sharedUV ? owned.filter((_, i) => i !== 4) : owned;
}
export function growth(api) {
  const f = setup(api), source = items()[0], before = structuredClone(source), counts = [];
  f.presenter.show(drawing([source])); counts.push({ phase: 'initial', retained: f.core.geometries.size, meshes: f.core.meshList.length });
  for (let i = 0; i < 32; i++) f.presenter.show(drawing([source], 5 + i / 100));
  counts.push({ phase: '32-camera-replacements', retained: f.core.geometries.size, meshes: f.core.meshList.length });
  f.presenter.show(drawing([])); counts.push({ phase: 'empty', retained: f.core.geometries.size, meshes: f.core.meshList.length });
  const preserved = JSON.stringify(before) === JSON.stringify(source);
  f.presenter.dispose(); counts.push({ phase: 'disposed', retained: f.core.geometries.size, meshes: f.core.meshList.length });
  return { counts, preserved, made: f.all.length, explicitDisposals: f.all.reduce((n, g) => n + g.disposals, 0) };
}
