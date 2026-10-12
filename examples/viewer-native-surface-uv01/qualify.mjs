/** Bounded #1581 emitted/DTS/example smoke. No producer, cold/file or GPU campaign. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { root, loadModules, runJoinChecks, signed } from '../../packages/barocss-viewer/tests/native-surface-uv01-webgpu.test.mjs';
assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Node22 required');
const evidence = process.env.BAROCSS_1581_EVIDENCE ?? await mkdtemp(resolve(tmpdir(), 'barocss1581-qualify-'));
await mkdir(evidence, { recursive: true });
const m = await loadModules('emitted', evidence), joined = runJoinChecks(m);
const inputs = Object.keys(m.graph.inputs);
assert.ok(inputs.some(path => path.includes('barocss-viewer/dist/native-surface-uv01-webgpu.js')));
assert.equal(inputs.some(path => /packages\/barocss-(cad|cad-interop|gpu|viewer)\/src\//.test(path)), false, 'No emitted-to-source fallback');
const viewer = await m.viewer.createNativeSurfaceUV01WebGPUViewer({}, joined.input, { width: 16, height: 8 });
assert.deepEqual(viewer.accepted, joined.joined.accepted); viewer.dispose();
const runtime = ['VIEWER_POSE_LIMITS', 'Viewer', 'createViewer', 'prepareViewerNativeSceneAppearance',
  'createNativeDirectionalLightWebGPUViewer', 'ViewerNativeDirectionalLightError',
  'createNativeSurfaceUV01WebGPUViewer', 'ViewerNativeSurfaceUV01Error'];
assert.deepEqual(Object.keys(m.viewer).sort(), runtime.sort());
const declaration = await readFile(resolve(root, 'packages/barocss-viewer/dist/index.d.ts'), 'utf8');
const additions = declaration.slice(declaration.indexOf('export { createNativeSurfaceUV01WebGPUViewer'));
const types = ['ViewerNativeSurfaceUV01Code', 'ViewerNativeSurfaceUV01Owner', 'ViewerNativeSurfaceUV01Material',
  'ViewerNativeSurfaceUV01Input', 'ViewerNativeSurfaceUV01Accepted', 'ViewerNativeSurfaceUV01Pick', 'ViewerNativeSurfaceUV01WebGPU'];
const clauses = [...additions.matchAll(/export type \{([^}]+)\}/g)].flatMap(match => match[1].split(',').map(name => name.trim()));
assert.deepEqual(clauses.sort(), types.sort());
assert.equal(/prepareUV01Candidate|copyOwn|UV01Candidate/.test(declaration), false);
const consumer = resolve(evidence, 'public-consumer.ts');
const entry = JSON.stringify(resolve(root, 'packages/barocss-viewer/dist/index.js'));
await writeFile(consumer, `import {createNativeSurfaceUV01WebGPUViewer,ViewerNativeSurfaceUV01Error} from ${entry};
import type {${types.join(',')}} from ${entry};
declare const canvas:HTMLCanvasElement,input:ViewerNativeSurfaceUV01Input;
const promise:Promise<ViewerNativeSurfaceUV01WebGPU>=createNativeSurfaceUV01WebGPUViewer(canvas,input,{width:16,height:8});
const code:ViewerNativeSurfaceUV01Code='MATERIAL'; const error=new ViewerNativeSurfaceUV01Error(code,'refused');
const material:ViewerNativeSurfaceUV01Material={ref:{modelId:'a',surfaceId:'s'},source:'original'};
const owner:ViewerNativeSurfaceUV01Owner=input.owner;
async function read(){const v=await promise;const a:ViewerNativeSurfaceUV01Accepted=v.accepted;const p:ViewerNativeSurfaceUV01Pick=await v.pick(0,0);return [a,p,material,owner,error];}void read;
// @ts-expect-error preparation is private
import {prepareUV01Candidate} from ${entry};
// @ts-expect-error type-only code union is not a runtime value
void ViewerNativeSurfaceUV01Code;
// @ts-expect-error unsupported authored light catalog
input.lights={};
// @ts-expect-error fixed diagnostics
const wrong:ViewerNativeSurfaceUV01Code='FRAME';void wrong;
`);
const config = resolve(evidence, 'tsconfig.json');
await writeFile(config, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
  noEmit: true, skipLibCheck: true, lib: ['ES2022','DOM'], baseUrl: root,
  paths: { '@barocss/cad': ['packages/barocss-cad/dist/index.d.ts'], '@barocss/gpu': ['packages/barocss-gpu/dist/index.d.ts'],
    '@barocss/cad-interop/*': ['packages/barocss-cad-interop/dist/*.d.ts'] } }, files: [consumer] }));
function command(args, log) {
  try { const output = execFileSync(process.execPath, args, { cwd: root, timeout: 180000, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' } }); return writeFile(resolve(evidence, log), output); }
  catch (error) { return writeFile(resolve(evidence, log), String(error.stdout) + String(error.stderr)).then(() => { throw error; }); }
}
await command([resolve(root, 'node_modules/typescript/bin/tsc'), '-p', config, '--listFiles'], 'public-types.log');
await command([resolve(root, 'node_modules/vite/bin/vite.js'), 'build', 'examples/viewer-native-surface-uv01', '--outDir', resolve(evidence, 'example-dist')], 'example-build.log');
const receipt = { base: 'd36ed9bb2bd211376c241f3861069c483ebb6c0d', softwareOnly: true, realDevice: 'UNRUN externally owned',
  emittedOriginalJoin: joined.counts, runtimeAdditions: 2, typeAdditions: 7, publicDTS: 'PASS', exampleBundle: 'PASS',
  originalHash: createHash('sha256').update(signed(joined.input)).digest('hex'),
  requestHash: createHash('sha256').update(signed(joined.joined.gpuRequest)).digest('hex') };
await writeFile(resolve(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
