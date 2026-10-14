// #1995: ten frozen actual-source CPU/display groups, using retained native bytes.
// No native evaluation, provider validator, Worker, browser or GPU execution.
// Run only after approval: EVIDENCE_DIR=<new directory> node this-file.mjs
// --prepare-browser <new directory> only writes a later-reviewable static harness.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = realpathSync(resolve(import.meta.dirname, '../../..'));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const base = '233fc95f0312c39234d6e6b8da532c03142a9c26';
const scriptPath = 'packages/barocss-cad-editor/scripts/modeling-native-edges-test.mjs';
const source = name => resolve(root, 'packages/barocss-cad-editor/src/' + name + '.ts');
const gpuSource = name => resolve(root, 'packages/barocss-gpu/src/' + name + '.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const clone = value => structuredClone(value);
const json = value => JSON.stringify(value, null, 2) + '\n';
const signed = value => JSON.stringify(value, (_key, item) => Object.is(item, -0) ? '__NEGATIVE_ZERO__' : item);
const baseHashes = {
  'packages/barocss-cad-editor/src/prism-feature-scene.ts': 'c47a6de5b394ef08f1d12ba9c13efc8da33d85423f0eff635cdee69a53410d93',
  'packages/barocss-cad-editor/src/prism-feature-display.ts': 'ea08512c891479948e38d4622ab3758767862036553bb7348ecc5055d6d30147',
  'packages/barocss-cad-editor/src/modeling-scene.ts': '7090c8ae2a3bc02b95f25dd54ac4beff3b8ba16d736a6f3ded37a93909b88624',
};
const inputs = {
  single: ['packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json', '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af'],
  split: ['packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-split/baseline-transport.json', '6ccb5bbbcde6fd531e1700906fbef717132770ae1043498db4c170ab2c7ce4ca'],
  legacy: ['packages/barocss-cad-editor/scripts/fixtures/convex-display.packet.json', '5108c45bdb05abf888fa7c9fd1b26a65511c8b19b07bd732ac3e2fde7a41660c'],
  circle: ['packages/barocss-cad-editor/scripts/fixtures/modeling-circle/baseline-native.json', '7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8'],
  hole: ['packages/barocss-cad-editor/scripts/fixtures/modeling-hole/baseline-native.json', '3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024'],
  orthogonal: ['packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json', 'c0a29404b5ffb8dc66eb9e6f8073b9e1545e94f3fe4c055d65ca95a9ca8fd536'],
  orthogonalRaw: ['packages/barocss-cad/test/modeling-offset-evidence/baseline.preview.json', 'a002c69effe7ddb48890f1a3a76a7f0dcf04332483a441b3c5ddf80634c4413c'],
};
const ledger = Object.freeze([
  'genuine two-bevel: 18 native edges, 36 uses, 12 excluded fan diagonals, eight fill rows',
  'exact public 233fc95f triangle, normal, UV, winding and native pick-authority parity',
  'two-output 16-row/36-edge split; synthetic three-output 3-row/54-edge and eight-output fallback',
  'legacy, circle, plate-hole and orthogonal-cell have no overlay and exact baseline parity',
  'mixed-family selected convex forwards its pair; other selected family clears edges',
  'Top, Isometric and changed aspect regenerate matching camera/scene/edge pairs',
  'actual CPU interior and near-boundary rays retain original native face/triangle authority',
  'mocked display preview show/cancel/commit and update forward matched scene/edge pairs',
  'held preparation replaced before resolution; stale late result cannot mount or promote',
  'failed mount/update/resize and cleanup preserve accepted ownership with at most two canvases',
]);
function retained(name) {
  const [path, expected] = inputs[name], bytes = readFileSync(resolve(root, path));
  assert.equal(hash(bytes), expected, 'unchanged retained fixture: ' + path);
  return JSON.parse(bytes);
}
function gitSource(path) { return execFileSync('git', ['show', base + ':' + path], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }); }

// Each TS module is read once, hashed before esbuild sees it, and bound to the
// selected checkout or the immutable public base. No symlinked product packages.
async function buildActual(output, baseline = false, browserEntry = null) {
  const sourceHashes = {}, gpuModules = ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'];
  const facade = gpuModules.map(name => `export * from ${JSON.stringify(gpuSource(name))};`).join('\n')
    + (browserEntry ? `\nexport {mountEngineScene} from ${JSON.stringify(gpuSource('engine-scene-renderer'))};`
      : '\nexport function mountEngineScene() { throw new Error("Real GPU mount is forbidden in the CPU fixture"); }');
  const entry = browserEntry ?? ['prism-feature-scene', 'modeling-scene', 'modeling-circle', 'modeling-union', 'prism-feature-display']
    .map(name => `export * from ${JSON.stringify(source(name))};`).join('\n') + '\nexport * from "@barocss/gpu";';
  const built = await require('esbuild').build({ stdin: { contents: entry, resolveDir: root, loader: 'ts' },
    bundle: true, platform: browserEntry ? 'browser' : 'node', format: 'esm', write: false, metafile: true,
    plugins: [{ name: 'exact-public-base-or-current-source', setup(build) {
      build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu-facade', namespace: 'cpu-boundary' }));
      build.onResolve({ filter: /^@barocss\/(?:cad|viewer|cad-interop)$|(?:\.wasm|modeling-engine|modeling-worker)/ }, args => {
        throw new Error('Native/provider/Worker runtime is outside this retained fixture: ' + args.path);
      });
      build.onLoad({ filter: /.*/, namespace: 'cpu-boundary' }, () => ({ contents: facade, resolveDir: root, loader: 'ts' }));
      build.onLoad({ filter: /\.ts$/, namespace: 'file' }, args => {
        const absolute = realpathSync(args.path), path = relative(root, absolute);
        assert.ok(!isAbsolute(path) && !path.startsWith('..'), 'Product module must belong to this checkout');
        assert.match(path, /^packages\/barocss-(?:cad-editor|gpu)\/src\/[^/]+\.ts$/);
        if (!browserEntry) assert.ok(!path.endsWith('/engine-scene-renderer.ts'), 'CPU fixture never loads the renderer');
        const contents = baseline ? gitSource(path) : readFileSync(absolute, 'utf8');
        sourceHashes[path] = hash(contents);
        return { contents, resolveDir: resolve(absolute, '..'), loader: 'ts' };
      });
    } }],
  });
  if (baseline) for (const [path, expected] of Object.entries(baseHashes)) assert.equal(sourceHashes[path], expected);
  const name = browserEntry ? 'browser' : baseline ? 'baseline' : 'current';
  writeFileSync(resolve(output, name + '.mjs'), built.outputFiles[0].text, { flag: 'wx' });
  writeFileSync(resolve(output, name + '-metafile.json'), json(built.metafile), { flag: 'wx' });
  writeFileSync(resolve(output, name + '-gpu-facade.ts'), facade, { flag: 'wx' });
  const binding = { sourceHashes, bundleSHA256: hash(built.outputFiles[0].text), facadeSHA256: hash(facade),
    entrySHA256: hash(entry), inputs: Object.keys(built.metafile.inputs), ...(baseline ? { commit: base } : {}) };
  return { binding, api: browserEntry ? null : await import(pathToFileURL(resolve(output, name + '.mjs'))) };
}

async function prepareBrowser(output) {
  mkdirSync(output, { recursive: false });
  const capture = retained('single'), gpuIndex = readFileSync(gpuSource('index'), 'utf8');
  const transport = readFileSync(resolve(root, inputs.single[0]), 'utf8');
  assert.match(gpuIndex, /export\s*\{[^}]*mountEngineScene[^}]*\}\s*from\s*['"]\.\/engine-scene-renderer\.js['"]/);
  writeFileSync(resolve(output, 'retained-transport.json'), transport, { flag: 'wx' });
  const entry = `import {mountEngineScene} from '@barocss/gpu';
    import {preparePrismFeatureScene,pickPrismFeatureScene} from ${JSON.stringify(source('prism-feature-scene'))};
    const packet = JSON.parse(${JSON.stringify(transport)}).display, canvas = document.querySelector('canvas');
    let renderer, display, enabled = true, orientation = 'isometric';
    const status = document.querySelector('pre');
    function present() {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      const width = Math.max(1,Math.min(2048,Math.round(rect.width*dpr)));
      const height = Math.max(1,Math.min(2048,Math.round(rect.height*dpr)));
      const next = preparePrismFeatureScene(packet,'result',width/height,orientation);
      if (renderer) { const result = renderer.update(next.scene,enabled ? next.edges : undefined); if (!result.ok) throw result.error; renderer.resize(width,height); }
      else renderer = mountEngineScene(canvas,next.scene,{width,height},enabled ? next.edges : undefined);
      display = next;
      status.textContent = JSON.stringify({nativeCalls:0,retainedTransportSHA256:${JSON.stringify(inputs.single[1])},orientation,enabled,width,height,dpr,owners:next.edges.owners.length,segments:next.edges.owners.reduce((n,o)=>n+o.indices.length/2,0)},null,2);
    }
    document.querySelector('#edges').onchange = event => {enabled=event.target.checked;present();};
    document.querySelector('#view').onchange = event => {orientation=event.target.value;present();};
    document.querySelector('#resize').onclick = () => {const host=document.querySelector('#host');host.style.width=host.style.width==='480px'?'640px':'480px';present();};
    canvas.onclick = event => {const rect=canvas.getBoundingClientRect();const x=Math.floor((event.clientX-rect.left)*canvas.width/rect.width);const y=canvas.height-1-Math.floor((event.clientY-rect.top)*canvas.height/rect.height);const pick=pickPrismFeatureScene(display,canvas.width,canvas.height,x,y);document.querySelector('#pick').textContent=JSON.stringify(pick ? {role:pick.role,solidId:pick.solidId,sourceId:pick.face.sourceId,faceId:pick.face.faceId,triangleIndex:pick.triangleIndex,approximate:pick.approximate} : null,null,2);};
    document.querySelector('#dispose').onclick=()=>{renderer?.dispose();renderer=null;status.textContent='Disposed';};
    window.addEventListener('pagehide',()=>renderer?.dispose());present();`;
  const built = await buildActual(output, false, entry);
  writeFileSync(resolve(output, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Retained #1995 edge fixture</title><style>body{font:14px system-ui;background:#eef1f6;margin:20px}#host{width:640px;height:480px}canvas{width:100%;height:100%}pre{white-space:pre-wrap}</style><p>Retained genuine two-bevel packet. No native calls. Opening this page runs WebGL2; separate approval required.</p><label><input id="edges" type="checkbox" checked> Native edges</label> <select id="view"><option value="isometric">Isometric</option><option value="top">Top</option></select> <button id="resize">Resize 640/480</button> <button id="dispose">Dispose</button><div id="host"><canvas></canvas></div><pre></pre><pre id="pick">Click a face for original native authority</pre><script type="module" src="./browser.mjs"></script>\n', { flag: 'wx' });
  const receipt = { issue: 1995, status: 'PREPARED_NOT_EXECUTED', mode: 'browser-fixture-only', nativeCalls: 0,
    retainedTransport: inputs.single, retainedTransportSHA256: hash(readFileSync(resolve(output, 'retained-transport.json'))),
    geometrySHA256: Object.fromEntries(['positionsMM', 'normals', 'parametersUV', 'indices'].map(key => [key, hash(signed(capture.display.components[0].mesh[key]))])),
    publicGPUIndexSHA256: hash(gpuIndex), scriptSHA256: hash(readFileSync(resolve(root, scriptPath))), binding: built.binding,
    controls: ['edge on/off', 'Top/Isometric', '640/480 CSS-pixel width resize', 'original face hit', 'dispose'],
    limits: 'No server/browser launch, GPU run, pixel/readability pass, clipping campaign or native evaluation is performed by preparation.' };
  writeFileSync(resolve(output, 'preparation.json'), json(receipt), { flag: 'wx' });
  console.log(JSON.stringify(receipt));
}

function overlayInventory(display, components, expectedRows, expectedEdges) {
  const overlay = display.edges;
  assert.ok(overlay); assert.equal(overlay.format, 'barocss-gpu-engine-scene-edges');
  assert.equal(overlay.version, 0); assert.equal(overlay.sceneId, display.scene.id);
  assert.equal(overlay.owners.length, expectedRows); assert.equal(display.scene.nodes.length, expectedRows);
  assert.ok(expectedRows <= 16); assert.ok(expectedEdges <= 256);
  const seen = new Set(), perComponent = components.map(() => 0), empty = [];
  for (const owner of overlay.owners) {
    const node = display.scene.nodes.find(value => value.id === owner.nodeId);
    assert.ok(node); assert.equal(node.geometryId, owner.geometryId);
    const match = /^prism_geometry_(\d+)_(all|\d+)$/.exec(owner.geometryId); assert.ok(match);
    const componentIndex = Number(match[1]), faceIndex = match[2] === 'all' ? -1 : Number(match[2]);
    const component = components[componentIndex], geometry = display.scene.geometries.find(value => value.id === owner.geometryId);
    assert.ok(geometry); assert.equal(geometry.positions.length, component.mesh.positionsMM.length);
    assert.equal(owner.indices.length % 2, 0); assert.ok(owner.indices.length <= 64);
    if (!owner.indices.length) empty.push(owner.nodeId);
    const expected = component.lineage.graph.edges.map(edge => component.boundaries.find(use => use.solidEdgeId === edge.id))
      .filter(boundary => faceIndex === -1 || boundary.faceIndex === faceIndex).flatMap(boundary => boundary.vertexIndices);
    assert.deepEqual(owner.indices, expected, 'first incident use owns each segment in graph order');
    for (let offset = 0; offset < owner.indices.length; offset += 2) {
      const pair = owner.indices.slice(offset, offset + 2), nativeIds = pair.map(index => component.mesh.vertices[index].solidVertexId);
      const edges = component.lineage.graph.edges.filter(edge => edge.vertexIds.every(id => nativeIds.includes(id)));
      assert.equal(edges.length, 1, 'each emitted segment names one real native edge');
      const key = [component.role, component.report.solidId, edges[0].id].join('/');
      assert.ok(!seen.has(key), 'scoped native edge appears exactly once'); seen.add(key); perComponent[componentIndex]++;
      for (const diagonal of component.internalDiagonals) assert.notDeepEqual([...pair].sort((a, b) => a - b), [...diagonal.vertexIndices].sort((a, b) => a - b));
      const uses = component.boundaries.filter(use => use.solidEdgeId === edges[0].id);
      assert.equal(uses.length, 2); assert.deepEqual(uses[0].solidVertexIds, [...uses[1].solidVertexIds].reverse());
    }
  }
  assert.equal(new Set(overlay.owners.map(row => row.nodeId)).size, expectedRows);
  assert.equal(seen.size, expectedEdges);
  perComponent.forEach((count, i) => assert.equal(count, components[i].lineage.graph.edges.length));
  return { rows: expectedRows, edges: seen.size, emptyRows: empty.length, perComponent };
}
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = values => values.map(value => value / Math.hypot(...values));
const xyz = values => values.flatMap((value, i) => i % 3 ? [] : [value, values[i + 2], -values[i + 1]]);
function pixelAt(scene, point, width, height) {
  const camera = scene.camera, backward = unit(subtract(camera.eye, camera.target));
  const right = unit(cross(camera.up, backward)), vertical = cross(backward, right), relativePoint = subtract(point, camera.eye);
  const depth = -dot(relativePoint, backward); if (depth <= camera.near || depth >= camera.far) return null;
  const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  const pixel = [Math.round((dot(relativePoint, right) / (depth * tangent * width / height) + 1) * width / 2 - .5),
    Math.round((dot(relativePoint, vertical) / (depth * tangent) + 1) * height / 2 - .5)];
  return pixel[0] >= 0 && pixel[0] < width && pixel[1] >= 0 && pixel[1] < height ? pixel : null;
}
function rayAt(api, scene, width, height, x, y) {
  return api.prepareEngineCameraRay(scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
    pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: x, pixelY: y }).ray;
}
function assertNativePick(pick, packet) {
  assert.ok(pick); const component = packet.components.find(value => value.role === pick.role); assert.ok(component);
  assert.equal(pick.documentId, packet.documentId); assert.equal(pick.revision, packet.revision); assert.equal(pick.approximate, true);
  assert.equal(pick.solidId, component.report.solidId); assert.deepEqual(pick.lineage, component.lineage);
  const face = component.mesh.faces.find(value => value.sourceId === pick.face.sourceId && value.faceId === pick.face.faceId);
  assert.deepEqual(pick.face, face); assert.ok(pick.triangleIndex * 3 >= face.indexOffset && pick.triangleIndex * 3 < face.indexOffset + face.indexCount);
  assert.deepEqual(pick.vertices, component.mesh.indices.slice(pick.triangleIndex * 3, pick.triangleIndex * 3 + 3).map(index => component.mesh.vertices[index]));
  assert.deepEqual(pick.boundaries, component.boundaries.filter(value => value.sourceId === face.sourceId && value.faceId === face.faceId));
}

// The sole doubles are DOM, deterministic preparation yields and the injectable
// renderer boundary. The scene/edge pairs and all CPU preparation/picking are real.
async function withDisplay(api, run) {
  const originalTimer = globalThis.setTimeout, originalRatio = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  const jobs = [], hosts = [];
  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 0); const job = { ran: false, run() { assert.equal(this.ran, false); this.ran = true; callback(); } };
    jobs.push(job); return jobs.length;
  };
  Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true, writable: true });
  function harness() {
    const h = { width: 640, height: 480, children: [], canvases: [], renderers: [], mounts: [], updates: [], maxChildren: 0, failMount: false };
    const host = { getBoundingClientRect: () => ({ width: h.width, height: h.height }),
      appendChild(canvas) { h.children.push(canvas); h.maxChildren = Math.max(h.maxChildren, h.children.length); assert.ok(h.children.length <= 2); },
      ownerDocument: { createElement(tag) {
        assert.equal(tag, 'canvas'); assert.ok(h.children.length < 2, 'no third canvas may even be allocated');
        const canvas = { width: 0, height: 0, failRemove: false,
          style: { visibility: '', set cssText(value) { assert.match(value, /visibility:hidden/); this.visibility = 'hidden'; } },
          setAttribute() {}, remove() { if (this.failRemove) throw new Error('mock remove refusal'); const i = h.children.indexOf(this); if (i >= 0) h.children.splice(i, 1); } };
        h.canvases.push(canvas); return canvas;
      } },
    };
    const mount = (canvas, scene, viewport, edges) => {
      h.mounts.push({ canvas, scene, edges }); if (h.failMount) throw new Error('mock mount refusal');
      const renderer = { canvas, scene, edges, disposeCalls: 0, failResize: false, failUpdate: false, throwUpdate: false, failDispose: false,
        resize(width, height) { if (this.failResize) throw new Error('mock resize refusal'); canvas.width = width; canvas.height = height; },
        update(nextScene, nextEdges) {
          h.updates.push({ scene: nextScene, edges: nextEdges });
          if (this.throwUpdate) throw new Error('mock thrown update refusal');
          if (this.failUpdate) return { ok: false, error: new Error('mock update refusal') };
          this.scene = nextScene; this.edges = nextEdges; return { ok: true };
        },
        dispose() { this.disposeCalls++; assert.equal(this.disposeCalls, 1); if (this.failDispose) throw new Error('mock dispose refusal'); },
      };
      renderer.resize(viewport.width, viewport.height); h.renderers.push(renderer); return renderer;
    };
    h.display = api.createPrismFeatureDisplay(host, mount);
    h.prepare = async (display, preview = true) => {
      const result = preview ? h.display.preparePreview(display) : h.display.prepare(display); jobs.at(-1).run(); return result;
    };
    h.accept = async display => { const candidate = await h.prepare(display, false); candidate.commit(); candidate.dispose(); return h.renderers.at(-1); };
    hosts.push(h); return h;
  }
  try { await run(harness, jobs); assert.ok(jobs.every(job => job.ran), 'all finite preparation yields settled'); }
  finally {
    for (const h of hosts) { for (const canvas of h.canvases) canvas.failRemove = false; h.display.dispose(); }
    globalThis.setTimeout = originalTimer;
    if (originalRatio) Object.defineProperty(globalThis, 'devicePixelRatio', originalRatio); else delete globalThis.devicePixelRatio;
  }
  for (const h of hosts) { assert.equal(h.children.length, 0); assert.ok(h.maxChildren <= 2); h.renderers.forEach(renderer => assert.equal(renderer.disposeCalls, 1)); }
}

async function runCPU(output) {
  mkdirSync(output, { recursive: false });
  const receipt = { issue: 1995, status: 'STARTED', expectedGroups: 10, ledger, groups: [], observations: [], nativeCalls: 0,
    rawPanelLookups: 0, fixtureHashes: Object.fromEntries(Object.values(inputs)), scriptSHA256: hash(readFileSync(resolve(root, scriptPath))),
    scope: 'Actual current and immutable public-base CPU modules; unchanged retained native geometry. Synthetic role/request context is explicit. DOM/mount/renderer faults only. No browser/GPU/native/pixel/readability claim.' };
  const persist = () => writeFileSync(resolve(output, 'verification.json'), json(receipt));
  persist(); writeFileSync(resolve(output, 'case-ledger.json'), json(ledger), { flag: 'wx' });
  async function group(index, run) {
    assert.equal(receipt.groups.length, index); receipt.activeGroup = ledger[index]; persist();
    await run(); receipt.groups.push({ name: ledger[index], status: 'PASS' }); delete receipt.activeGroup; persist();
    console.log(JSON.stringify({ group: index + 1, name: ledger[index], status: 'PASS' }));
  }
  try {
    const current = await buildActual(output), baseline = await buildActual(output, true);
    receipt.current = current.binding; receipt.baseline = baseline.binding; persist();
    const api = current.api, old = baseline.api, captures = Object.fromEntries(Object.keys(inputs).map(name => [name, retained(name)]));
    const originals = clone(captures), packet = captures.single.display, split = captures.split.display;
    let first, firstOld, mixed, convexSelected, otherSelected;
    const compare = (value, aspect = 1, selected, orientation = 'isometric') => {
      const display = api.prepareModelingScene(value, aspect, selected, orientation), prior = old.prepareModelingScene(value, aspect, selected, orientation);
      assert.deepEqual(display.scene, prior.scene); assert.deepEqual(display.packet, prior.packet); return [display, prior];
    };
    await group(0, () => {
      assert.equal(captures.single.ok, true); assert.equal(JSON.parse(captures.single.text).nodes.filter(node => node.kind === 'chamfer').length, 2);
      const component = packet.components[0]; assert.equal(component.mesh.faces.length, 8); assert.equal(component.boundaries.length, 36);
      assert.equal(component.lineage.graph.edges.length, 18); assert.equal(component.internalDiagonals.length, 12);
      first = api.preparePrismFeatureScene(packet, 'result');
      const inventory = overlayInventory(first, packet.components, 8, 18); assert.ok(inventory.emptyRows > 0, 'every fill is covered even when no first use assigns a line');
      receipt.observations.push({ genuineTwoBevel: inventory, excludedFanDiagonals: 12 });
    });
    await group(1, () => {
      firstOld = old.preparePrismFeatureScene(packet, 'result'); assert.deepEqual(first.scene, firstOld.scene); assert.deepEqual(first.packet, firstOld.packet);
      assert.equal(firstOld.edges, undefined); const component = packet.components[0];
      for (const [i, face] of component.mesh.faces.entries()) {
        const geometry = first.scene.geometries[i]; assert.deepEqual(geometry.positions, xyz(component.mesh.positionsMM));
        assert.deepEqual(geometry.normals, xyz(component.mesh.normals)); assert.deepEqual(geometry.uvs, component.mesh.parametersUV);
        assert.deepEqual(geometry.indices, component.mesh.indices.slice(face.indexOffset, face.indexOffset + face.indexCount)); assert.equal(geometry.winding, 'ccw');
      }
      assert.throws(() => api.pickPrismFeatureScene(clone(first), 640, 640, 320, 320), /original convex draw authority/);
      assert.throws(() => old.pickPrismFeatureScene(clone(firstOld), 640, 640, 320, 320), /original convex draw authority/);
      let hits = 0;
      for (const geometry of first.scene.geometries) {
        const point = [0, 1, 2].map(axis => geometry.indices.slice(0, 3).reduce((sum, index) => sum + geometry.positions[index * 3 + axis], 0) / 3);
        const pixel = pixelAt(first.scene, point, 640, 640); if (!pixel) continue;
        const pick = api.pickPrismFeatureScene(first, 640, 640, ...pixel), prior = old.pickPrismFeatureScene(firstOld, 640, 640, ...pixel);
        assert.deepEqual(pick, prior); if (pick) { assertNativePick(pick, packet); hits++; }
      }
      assert.ok(hits > 0); receipt.observations.push({ exactPublicBase: base, nativePickPairs: hits });
    });
    await group(2, () => {
      const [two] = compare(split), inventories = [overlayInventory(two, split.components, 16, 36)];
      const three = clone(split), third = clone(three.components[0]); third.role = third.lineage.name = 'synthetic_third';
      three.components.push(third); three.outcomes.push({ role: third.role, solidId: third.report.solidId, status: 'solid' });
      const eight = clone(packet); eight.components = []; eight.outcomes = [];
      for (let i = 0; i < 8; i++) {
        const component = clone(packet.components[0]); component.role = component.lineage.name = 'synthetic_' + i;
        eight.components.push(component); eight.outcomes.push({ role: component.role, solidId: component.report.solidId, status: 'solid' });
      }
      for (const value of [three, eight]) {
        const [display, prior] = compare(value); inventories.push(overlayInventory(display, value.components, value.components.length, value.components.length * 18));
        display.scene.geometries.forEach((geometry, i) => { assert.match(geometry.id, /_all$/); assert.deepEqual(geometry.indices, value.components[i].mesh.indices); });
        let picked = null;
        for (let y = 16; y < 240 && !picked; y += 16) for (let x = 16; x < 240 && !picked; x += 16) {
          picked = api.pickModelingScene(display, 256, 256, x, y); assert.deepEqual(picked, old.pickModelingScene(prior, 256, 256, x, y));
        }
        assertNativePick(picked, value);
      }
      const nine = clone(eight), ninth = clone(packet.components[0]); ninth.role = ninth.lineage.name = 'synthetic_ninth';
      nine.components.push(ninth); nine.outcomes.push({ role: ninth.role, solidId: ninth.report.solidId, status: 'solid' });
      assert.throws(() => api.prepareModelingScene(nine), /component budget/);
      receipt.observations.push({ multiOutput: inventories, synthetic: 'Three/eight/nine-output inventories reuse unchanged retained bodies; only role envelopes change. Coincident outputs are never coordinate-deduplicated.' });
    });
    await group(3, () => {
      for (const view of ['source', 'result']) {
        const display = api.preparePrismFeatureScene(captures.legacy, view), prior = old.preparePrismFeatureScene(captures.legacy, view);
        assert.deepEqual(display, prior); assert.equal(display.edges, undefined);
      }
      const revision = 0, taskToken = 'native_edges_cpu_context', context = bodyId => ({ documentId: 'cad_model', bodyId,
        documentRevision: '0', kernelResultRevision: '0', topologyRevision: '0', taskToken });
      const circleNative = captures.circle.bodies.post.native, preview = clone(captures.circle.preview);
      preview.packet.surfaceId = preview.report.meshId = 'modeling_circle_post'; preview.packet.revision = preview.report.revision = revision;
      const circle = api.projectModelingCircle(circleNative, preview, 'post', context(circleNative.parent.bundle.topology.id));
      const native = captures.hole.bodies.plate.native, bundle = native.bundle;
      const qualificationKeys = ['kind', 'version', 'lengthUnit', 'geometryAuthority', 'solid', 'topologyCertified', 'embeddedStoredGeometryCertified',
        'materialComponentCount', 'genus', 'faceCount', 'vertexCount', 'edgeCount', 'loopCount', 'edgeUseCount', 'weightedEuler'];
      const hole = { family: 'stored-rational-plate-hole', role: 'plate', solidId: bundle.request.bodyId, preview: clone(captures.hole.holeMesh),
        qualification: Object.fromEntries(qualificationKeys.map(key => [key, native.certificate[key]])), lineage: { bodyId: bundle.request.bodyId,
          faces: bundle.faces.map(({ id, role, surface, orientation, outerLoopId, innerLoopIds }) => ({ id, role, surfaceId: surface.id, orientation, outerLoopId, innerLoopIds: [...innerLoopIds] })),
          vertices: clone(bundle.topology.vertices), edges: bundle.topology.edges.map(({ id, curve, vertexIds, sourceParameterRange }) => ({ id, curveId: curve.id, vertexIds: [...vertexIds], sourceParameterRange: [...sourceParameterRange] })),
          loops: bundle.topology.loops.map(({ id, faceId, role, uses }) => ({ id, faceId, role, uses: uses.map(({ id, edgeId, sense, pcurve }) => ({ id, edgeId, sense, pcurveId: pcurve.curve.id, domain: [...pcurve.domain] })) })) } };
      Object.assign(hole.preview.mesh.context, context(hole.solidId));
      const orthogonalNative = captures.orthogonal.bodies.part.native;
      // Exact retained raw lookup from the existing orthogonal fixture contract.
      // This never invents a sample or invokes a native/provider implementation.
      const orthogonal = api.projectModelingUnion(orthogonalNative, 'pocket', context(orthogonalNative.bodies[0].id), (surface, options) => {
        assert.deepEqual(options, { countU: 2, countV: 2, revision });
        const retainedPanel = captures.orthogonalRaw.find(value => value.surfaceId === surface.id); assert.ok(retainedPanel);
        const origin = orthogonalNative.sources.find(value => value.sourceId === retainedPanel.sourceId); assert.ok(origin);
        assert.equal(origin.panelId, retainedPanel.panelId); assert.deepEqual(origin.model.objects.find(value => value.kind === 'surface' && value.id === surface.id), surface);
        assert.deepEqual(retainedPanel.options, { countU: 2, countV: 2, revision: 0 }); receipt.rawPanelLookups++;
        return clone(retainedPanel.result);
      }, 'difference');
      const packetFor = components => ({ profile: 'model-body-faces', documentId: 'cad_model', revision, taskToken, components,
        outcomes: components.map(value => ({ role: value.family === 'convex-planar' ? value.component.role : value.role,
          solidId: value.family === 'convex-planar' ? value.component.report.solidId : value.solidId, family: value.family, status: 'solid' })) });
      for (const component of [circle, hole, orthogonal]) {
        const [display, prior] = compare(packetFor([component])); assert.equal(display.edges, undefined); assert.deepEqual(display, prior);
      }
      assert.deepEqual(hole.preview.mesh.chunks, captures.hole.holeMesh.mesh.chunks);
      assert.deepEqual(circle.mesh.chunks.flatMap(value => value.positionsMM), captures.circle.preview.packet.positions);
      assert.deepEqual(orthogonal.mesh.chunks.map(value => value.positionsMM), captures.orthogonalRaw.map(value => value.result.packet.positions));
      mixed = packetFor([{ family: 'convex-planar', component: clone(packet.components[0]) }, hole]);
      receipt.observations.push({ unchangedFamilies: ['legacy', 'stored-rational-circle-prism', 'stored-rational-plate-hole', 'orthogonal-cell'], requestContext: 'synthetic cad_model revision 0; retained geometry/provenance untouched' });
    });
    await group(4, () => {
      [convexSelected] = compare(mixed, 1, packet.components[0].role); [otherSelected] = compare(mixed, 1, 'plate');
      overlayInventory(convexSelected, [mixed.components[0].component], 8, 18); assert.equal(otherSelected.edges, undefined);
      assert.equal(convexSelected.selectedOutput, packet.components[0].role); assert.equal(otherSelected.selectedOutput, 'plate');
      assert.throws(() => api.pickModelingScene(clone(convexSelected), 640, 640, 320, 320), /original accepted/);
      let picked = null;
      for (let y = 16; y < 240 && !picked; y += 16) for (let x = 16; x < 240 && !picked; x += 16) picked = api.pickModelingScene(convexSelected, 256, 256, x, y);
      assertNativePick(picked, { ...packet, documentId: mixed.documentId, revision: mixed.revision });
    });
    await group(5, () => {
      const cases = [];
      for (const orientation of ['top', 'isometric']) for (const aspect of [.75, 1, 1.5]) {
        const [display] = compare(packet, aspect, undefined, orientation);
        assert.notStrictEqual(display.scene, first.scene); assert.notStrictEqual(display.edges, first.edges);
        assert.deepEqual(display.edges, first.edges); overlayInventory(display, packet.components, 8, 18);
        assert.deepEqual(display.scene.camera.up, orientation === 'top' ? [0, 0, -1] : [0, 1, 0]);
        cases.push({ orientation, aspect, sceneSHA256: hash(signed(display.scene)), edgesSHA256: hash(signed(display.edges)) });
      }
      receipt.observations.push({ cameraPairs: cases });
    });
    await group(6, () => {
      const [display, prior] = compare(packet, 4 / 3), width = 640, height = 480, pixels = new Map();
      for (const geometry of display.scene.geometries) for (let offset = 0; offset < geometry.indices.length; offset += 3) {
        const point = [0, 1, 2].map(axis => geometry.indices.slice(offset, offset + 3).reduce((sum, index) => sum + geometry.positions[index * 3 + axis], 0) / 3);
        const pixel = pixelAt(display.scene, point, width, height); if (pixel) pixels.set(pixel.join(','), pixel);
      }
      let interior = 0, bevelInterior = 0, nearBoundary = 0;
      const comparePixel = pixel => {
        const ray = rayAt(api, display.scene, width, height, ...pixel), hit = api.raycastEngineScene(display.scene, ray);
        assert.deepEqual(hit, old.raycastEngineScene(prior.scene, ray));
        const pick = api.pickModelingScene(display, width, height, ...pixel); assert.deepEqual(pick, old.pickModelingScene(prior, width, height, ...pixel));
        if (pick) assertNativePick(pick, packet); return { hit, pick };
      };
      for (const pixel of pixels.values()) {
        const { hit, pick } = comparePixel(pixel); if (!hit || Math.min(...hit.barycentric) <= .05) continue;
        interior++; const normal = packet.components[0].mesh.normals.slice(pick.face.vertexOffset * 3, pick.face.vertexOffset * 3 + 3);
        if (normal.every(value => Math.abs(value) < 1 - 1e-6)) bevelInterior++;
        const edges = display.edges; display.edges = undefined;
        assert.deepEqual(api.pickModelingScene(display, width, height, ...pixel), pick, 'sidecar does not participate in face authority'); display.edges = edges;
      }
      for (const edge of packet.components[0].lineage.graph.edges) {
        const uses = packet.components[0].boundaries.filter(value => value.solidEdgeId === edge.id), use = uses[0];
        const point = xyz([0, 1, 2].map(axis => use.vertexIndices.reduce((sum, index) => sum + packet.components[0].mesh.positionsMM[index * 3 + axis], 0) / 2));
        const pixel = pixelAt(display.scene, point, width, height); if (!pixel) continue;
        const { pick } = comparePixel(pixel);
        if (pick && uses.some(value => value.sourceId === pick.face.sourceId && value.faceId === pick.face.faceId)) nearBoundary++;
      }
      assert.ok(interior > 0); assert.ok(bevelInterior > 0); assert.ok(nearBoundary > 0);
      receipt.observations.push({ cpuRays: { interior, bevelInterior, nearBoundary }, limits: 'Near-boundary pixel-center rays may choose either original incident face. This is no actual-device usability or pixel proof.' });
    });
    await group(7, () => withDisplay(api, async harness => {
      const h = harness(), accepted = await h.accept(first), canvas = accepted.canvas;
      assert.strictEqual(accepted.scene, first.scene); assert.strictEqual(accepted.edges, first.edges);
      const candidate = await h.prepare(convexSelected), staged = h.renderers.at(-1);
      assert.strictEqual(staged.scene, convexSelected.scene); assert.strictEqual(staged.edges, convexSelected.edges);
      candidate.show(); assert.equal(canvas.style.visibility, 'hidden'); assert.equal(staged.canvas.style.visibility, 'visible');
      candidate.dispose(); assert.deepEqual(h.children, [canvas]); assert.equal(canvas.style.visibility, 'visible');
      assert.strictEqual(accepted.scene, first.scene); assert.strictEqual(accepted.edges, first.edges);
      const promoted = await h.prepare(convexSelected); promoted.show(); promoted.commit(); promoted.dispose();
      const next = h.renderers.at(-1); assert.equal(accepted.disposeCalls, 1); assert.deepEqual(h.children, [next.canvas]);
      h.display.updateScene(otherSelected); assert.strictEqual(next.scene, otherSelected.scene); assert.equal(next.edges, undefined);
      h.display.updateScene(first); assert.strictEqual(next.scene, first.scene); assert.strictEqual(next.edges, first.edges);
      h.width = 800; h.height = 400; const fit = h.display.fit(first); assert.deepEqual(fit, api.preparePrismFeatureScene(first.packet, first.view, 2));
      h.display.updateScene(fit); h.display.resize(); assert.strictEqual(next.edges, fit.edges); assert.deepEqual(h.display.dimensions(), { width: 800, height: 400 });
    }));
    await group(8, () => withDisplay(api, async (harness, jobs) => {
      const h = harness(), accepted = await h.accept(first), stalePromise = h.display.preparePreview(convexSelected);
      const staleRefusal = assert.rejects(stalePromise, /stale/), staleJob = jobs.at(-1), staleCanvas = h.children.at(-1);
      const newerPromise = h.display.preparePreview(otherSelected), newerJob = jobs.at(-1);
      assert.ok(!h.children.includes(staleCanvas)); newerJob.run(); const newer = await newerPromise;
      staleJob.run(); await staleRefusal; assert.equal(h.mounts.length, 2, 'unresolved stale scene/edge pair never reaches mount');
      newer.show(); newer.dispose(); assert.deepEqual(h.children, [accepted.canvas]);
      const late = await h.prepare(convexSelected), replacementPromise = h.display.preparePreview(first);
      jobs.at(-1).run(); const replacement = await replacementPromise;
      assert.throws(() => late.show(), /stale/); assert.throws(() => late.commit(), /stale/); late.dispose();
      replacement.commit(); replacement.dispose(); assert.strictEqual(h.renderers.at(-1).edges, first.edges);
      const pending = h.display.preparePreview(convexSelected), rejected = assert.rejects(pending, /stale/), job = jobs.at(-1);
      h.display.dispose(); job.run(); await rejected; assert.equal(h.children.length, 0);
    }));
    await group(9, () => withDisplay(api, async harness => {
      const h = harness(), accepted = await h.accept(first), canvas = accepted.canvas, unchanged = () => {
        assert.strictEqual(accepted.scene, first.scene); assert.strictEqual(accepted.edges, first.edges);
        assert.deepEqual(h.children, [canvas]); assert.equal(canvas.style.visibility, 'visible');
      };
      h.failMount = true; await assert.rejects(h.prepare(convexSelected), /mount refusal/); h.failMount = false; unchanged();
      accepted.failUpdate = true; assert.throws(() => h.display.updateScene(convexSelected), /update refusal/); accepted.failUpdate = false; unchanged();
      accepted.throwUpdate = true; assert.throws(() => h.display.updateScene(otherSelected), /thrown update refusal/); accepted.throwUpdate = false; unchanged();
      for (const action of ['show', 'commit']) {
        const candidate = await h.prepare(convexSelected), renderer = h.renderers.at(-1); renderer.failResize = true;
        assert.throws(() => candidate[action](), /resize refusal/); candidate.dispose(); unchanged();
      }
      h.width = 800; h.height = 400; accepted.failResize = true;
      assert.throws(() => h.display.resize(), /resize refusal/); assert.deepEqual(h.display.dimensions(), { width: 640, height: 480 }); unchanged();
      accepted.failResize = false; h.display.resize(); assert.deepEqual(h.display.dimensions(), { width: 800, height: 400 });
      const candidate = await h.prepare(convexSelected), renderer = h.renderers.at(-1); candidate.show();
      renderer.failDispose = true; renderer.canvas.failRemove = true; candidate.dispose();
      assert.equal(canvas.style.visibility, 'visible'); assert.equal(h.children.length, 2); const allocations = h.canvases.length;
      await assert.rejects(h.display.preparePreview(otherSelected), /could not remove/); assert.equal(h.canvases.length, allocations);
      renderer.canvas.failRemove = false; const replacement = await h.prepare(first); replacement.commit(); replacement.dispose();
      assert.equal(accepted.disposeCalls, 1); assert.equal(h.children.length, 1); assert.strictEqual(h.renderers.at(-1).edges, first.edges);
    }));
    assert.deepEqual(captures, originals, 'all retained native data unchanged');
    for (const name of Object.keys(inputs)) retained(name);
    for (const [path, expected] of Object.entries(current.binding.sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), expected, 'current source changed during fixture: ' + path);
    assert.equal(hash(readFileSync(resolve(root, scriptPath))), receipt.scriptSHA256);
    assert.equal(receipt.groups.length, 10); receipt.status = 'PASS'; persist(); console.log(JSON.stringify(receipt));
  } catch (cause) {
    receipt.status = 'FAIL'; receipt.failure = { message: cause.message, stack: cause.stack }; persist();
    writeFileSync(resolve(output, 'first-failure.json'), json(receipt.failure), { flag: 'wx' }); throw cause;
  }
}

if (process.argv[2] === '--prepare-browser') {
  assert.equal(process.argv.length, 4, '--prepare-browser requires exactly one fresh output directory');
  await prepareBrowser(resolve(process.argv[3]));
} else {
  assert.equal(process.argv.length, 2, 'No implicit browser/GPU mode or unbounded case selection');
  await runCPU(resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1995-native-edges'));
}
