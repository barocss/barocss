import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const PROFILES = ['cloth-pinned-sphere-visual-v1', 'fluid-basin-visual-v1',
  'fluid-basin-xsph-visual-v1', 'fluid-static-box-visual-v1'];
const OUTPUTS = ['packages/barocss-physics/src/domain/cloth-reference.generated.ts',
  'examples/physics-model-data-2276/model-data.mjs', 'apps/library-docs/docs/public/physics/model-data.mjs'];
const LIMIT = 8 * 1024 * 1024;
const COUNTS = { createSheet: 0, triangleMassAccumulations: 0, canonicalEncode: 0,
  presetCopies: 0, WorldCalls: 0, WorldSteps: 0, CADCalls: 0, initialRestDensity: 0, solverCalls: 0 };

function exact(left, right, path = '$') {
  if (Object.is(left, right)) return;
  assert.equal(typeof left, typeof right, path);
  assert(left && right && typeof left === 'object', `${path}: scalar/IEEE representation differs`);
  assert.equal(Array.isArray(left), Array.isArray(right), path);
  assert.deepEqual(Object.keys(left), Object.keys(right), `${path}: keys/order`);
  for (const key of Object.keys(left)) exact(left[key], right[key], `${path}/${key}`);
}
function render(value) {
  if (typeof value === 'number') {
    assert(Number.isFinite(value));
    const text = Object.is(value, -0) ? '-0' : String(value);
    assert(Object.is(Number(text), value), 'binary64 literal roundtrip');
    return text;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(render).join(',')}]`;
  assert(value && Object.getPrototypeOf(value) === Object.prototype);
  return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${render(item)}`).join(',')}}`;
}
function frozen(value) {
  if (!value || typeof value !== 'object') return;
  assert(Object.isFrozen(value), 'shared generated data must be deeply immutable');
  for (const item of Object.values(value)) frozen(item);
}
function references(value, into = new Set()) {
  if (value && typeof value === 'object') {
    assert(!into.has(value), 'generated public data must be an ordinary tree');
    into.add(value); for (const child of Object.values(value)) references(child, into);
  }
  return into;
}
function detached(left, right) {
  const owned = references(left);
  for (const value of references(right)) assert(!owned.has(value), 'generated/caller data aliases another target');
}
const helpersText = `function freeze(value){if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function copy(value){if(Array.isArray(value))return value.map(copy);if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)]));return value;}
`;

async function main() {
  const args = process.argv.slice(2);
  assert(args.length === 4 && args[0] === '--run-id' && args[2] === '--freeze', 'expected --run-id FRESH --freeze ABS_JSON');
  const runId = args[1]; assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(runId));
  const freezePath = resolve(args[3]); const freezeBytes = await readFile(freezePath);
  const freeze = JSON.parse(freezeBytes);
  assert.equal(freeze.status, 'parent_frozen_model_data_generation');
  assert.equal(freeze.generator, 'examples/physics-world-p5-2276/generate-model-data.mjs');
  assert.deepEqual(freeze.outputs, OUTPUTS);
  assert.equal(freeze.maximums.createSheet, 1); assert.equal(freeze.maximums.triangleMassAccumulations, 1);
  assert.equal(freeze.maximums.canonicalEncode, 12);
  assert(!process.env.ESBUILD_BINARY_PATH, 'unfrozen esbuild override');
  async function authenticate() {
    for (const [name, pin] of Object.entries(freeze.files)) {
      const path = resolve(ROOT, name); assert(!relative(ROOT, path).startsWith('..'));
      assert(!(await lstat(path)).isSymbolicLink(), `unfrozen symbolic input: ${name}`);
      const data = await readFile(path); assert.equal(data.length, pin.bytes, name); assert.equal(sha(data), pin.sha256, name);
    }
  }
  await authenticate();
  assert(freeze.files[freeze.generator], 'generator itself must be pinned');
  for (const path of OUTPUTS) {
    let exists = false; try { await lstat(resolve(ROOT, path)); exists = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    assert(!exists, `refuse overwrite of existing generated target: ${path}`);
  }
  const out = resolve(HERE, 'evidence', runId); await mkdir(out, { recursive: false });
  let charged = 0; const started = performance.now(); let status = 'IN_PROGRESS', firstFailure = null;
  const write = async (name, bytes) => {
    assert(charged + Buffer.byteLength(bytes) <= LIMIT, 'generator evidence8MiB');
    await writeFile(resolve(out, name), bytes, { flag: 'wx' }); charged += Buffer.byteLength(bytes);
  };
  const deadline = setTimeout(() => { throw new Error('170s model-data generation deadline'); }, 170000);
  const receipts = [], graphPins = {};
  try {
    assert.equal(Number(process.versions.node.split('.')[0]), 22, 'use pinned Node22');
    assert.equal(render(-0), '-0'); assert(Object.is(Number(render(-0)), -0));
    const esbuild = await import(pathToFileURL(resolve(ROOT, 'node_modules/esbuild/lib/main.js')).href);
    const entry = ["export {createSheet} from './packages/barocss-physics/src/cloth/topology.ts';",
      "export {CLOTH_PROFILE,CLOTH_STEP_SECONDS} from './packages/barocss-physics/src/cloth/profile.ts';",
      "export {FLUID_PARTICLE_RADIUS_M,FLUID_SMOOTHING_RADIUS_M,FLUID_STEP_SECONDS} from './packages/barocss-physics/src/fluid/constants.ts';",
      "export {canonicalEncode} from './packages/barocss-physics/src/identity.ts';"].join('\n');
    const built = await esbuild.build({ absWorkingDir: ROOT, stdin: { contents: entry, resolveDir: ROOT, sourcefile: 'frozen-model-data-entry.mjs' },
      bundle: true, write: false, metafile: true, platform: 'node', format: 'esm', target: 'node22', plugins: [{ name: 'frozen-data-only-inputs', setup(build) {
        build.onLoad({ filter: /\.[jt]s$/ }, async args => {
          const name = relative(ROOT, args.path); const pin = freeze.files[name]; assert(pin, `unfrozen provider input ${name}`);
          assert(!/\/(?:world|solver|pbf|domain|cad-|replay|recording-owner)/.test(name), `forbidden generation provider ${name}`);
          const bytes = await readFile(args.path); assert.equal(sha(bytes), pin.sha256, name);
          graphPins[name] = { bytes: bytes.length, sha256: sha(bytes) };
          return { contents: bytes.toString(), loader: args.path.endsWith('.ts') ? 'ts' : 'js' };
        });
      } }] });
    for (const name of Object.keys(built.metafile.inputs)) if (name !== 'frozen-model-data-entry.mjs') assert(graphPins[name], name);
    const helperBundle = built.outputFiles[0].contents;
    await write('data-helpers.mjs', helperBundle);
    const h = await import(pathToFileURL(resolve(out, 'data-helpers.mjs')).href);
    assert(Object.is(h.CLOTH_STEP_SECONDS, h.FLUID_STEP_SECONDS));
    const staticReceiptPath = 'examples/physics-world-p5-2276/evidence/static-input-01/summary.json';
    assert(freeze.files[staticReceiptPath]);
    const selected = JSON.parse(await readFile(resolve(ROOT, staticReceiptPath), 'utf8'));
    assert.equal(selected.status, 'PASS_STATIC_INPUT_OPERANDS');
    const bits = value => { const data = Buffer.alloc(8); data.writeDoubleLE(value); return data.toString('hex'); };
    assert.deepEqual(selected.operands.body.initial.positionM.map(bits), selected.operands.positionF64LE);
    assert.deepEqual(selected.operands.collider.geometry.halfExtentsM.map(bits), selected.operands.halfExtentsF64LE);
    const fixturePath = 'examples/physics-world-p5-2276/kernel-fixture.mjs'; assert(freeze.files[fixturePath]);
    const { buildKernelModels } = await import(pathToFileURL(resolve(ROOT, fixturePath)).href);
    const helpers = { ...h, createSheet: () => { assert(++COUNTS.createSheet <= 1); return h.createSheet(); } };
    const models = buildKernelModels(helpers, { centerM: selected.operands.body.initial.positionM,
      halfExtentsM: selected.operands.collider.geometry.halfExtentsM }, name => {
      assert.equal(name, 'triangleMassAccumulations'); assert(++COUNTS.triangleMassAccumulations <= 1);
    });
    assert.deepEqual(models.map(x => x.profile), PROFILES);
    const presets = Object.fromEntries(models.map(item => [item.profile, { model: item.model,
      options: { profile: item.profile, fixedStepSeconds: h.CLOTH_STEP_SECONDS, broadPhase: 'domain-fixed' } }]));
    const encode = model => { assert(++COUNTS.canonicalEncode <= 12); return Buffer.from(h.canonicalEncode(model)); };
    const canonical = Object.fromEntries(PROFILES.map(profile => [profile, encode(presets[profile].model)]));
    for (const profile of PROFILES) {
      const path = `examples/physics-world-p5-2276/evidence/kernel-source-01/model-size-${profile}.json`;
      assert(freeze.files[path]); const expected = JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
      assert.equal(canonical[profile].length, expected.canonicalModelBytes, profile);
      assert.equal(sha(canonical[profile]), expected.sha256, `${profile}: original P5a canonical target`);
    }
    const header = `// Generated from the frozen original P5a helper/fixture authority. Input-freeze SHA256 ${sha(freezeBytes)}.\n`;
    const asset = header + helpersText + `export const physicsModelPresets=freeze(${render(presets)});\nexport function copyPhysicsModelPreset(profile){if(!Object.hasOwn(physicsModelPresets,profile))throw new RangeError('Unsupported Physics model preset');return copy(physicsModelPresets[profile]);}\n`;
    assert(!asset.includes('Math.') && !/^\s*import\b/m.test(asset) && !/^\s*export[^\n]*\bfrom\s/m.test(asset), 'presets have no Physics/runtime/math import');
    const leaf = presets[PROFILES[0]].model.cloths[0];
    const reference = header + "import type { Cloth } from '../types.js';\n" +
      "function freeze<T>(value:T):T{if(value!==null&&typeof value==='object'){for(const child of Object.values(value as object))freeze(child);Object.freeze(value);}return value;}\n" +
      `export const nativeClothReference:Cloth=freeze(${render(leaf)} as const);\n`;
    for (const [index, path] of OUTPUTS.entries()) {
      const bytes = index === 0 ? reference : asset; assert(Buffer.byteLength(bytes) <= 2 * 1024 * 1024);
      await mkdir(dirname(resolve(ROOT, path)), { recursive: true }); await writeFile(resolve(ROOT, path), bytes, { flag: 'wx' });
      receipts.push({ path, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) });
    }
    const transformed = await esbuild.transform(reference, { loader: 'ts', format: 'esm', target: 'node22' });
    assert(!/\b(?:from|import)\s/.test(transformed.code), 'internal reference runtime has no Physics import');
    await write('native-reference-data.mjs', transformed.code);
    const internal = await import(pathToFileURL(resolve(out, 'native-reference-data.mjs')).href);
    exact(leaf, internal.nativeClothReference); frozen(internal.nativeClothReference);
    const codecReceipts = [];
    for (const path of OUTPUTS.slice(1)) {
      const module = await import(pathToFileURL(resolve(ROOT, path)).href);
      frozen(module.physicsModelPresets); detached(internal.nativeClothReference, module.physicsModelPresets);
      for (const profile of PROFILES) {
        const copied = module.copyPhysicsModelPreset(profile); COUNTS.presetCopies++;
        exact(presets[profile], copied); detached(module.physicsModelPresets[profile], copied);
        const bytes = encode(copied.model); assert(bytes.equals(canonical[profile]));
        codecReceipts.push({ path, profile, bytes: bytes.length, sha256: sha(bytes) });
        copied.model.revision = 'detachedCopyMutation';
        const again = module.copyPhysicsModelPreset(profile); COUNTS.presetCopies++;
        exact(presets[profile], again);
      }
    }
    assert.equal(COUNTS.createSheet, 1); assert.equal(COUNTS.triangleMassAccumulations, 1);
    assert.equal(COUNTS.canonicalEncode, 12); assert.equal(COUNTS.presetCopies, 16);
    await authenticate();
    await write('provider-graph.json', JSON.stringify({ inputs: graphPins, bundleSha256: sha(helperBundle) }, null, 2) + '\n');
    await write('canonical-models.json', JSON.stringify({ originalTargets: PROFILES.map(profile => ({ profile,
      bytes: canonical[profile].length, sha256: sha(canonical[profile]) })), literalChecks: codecReceipts,
      negativeZeroRenderer: 'Object.is(-0) literal; binary64 Number(text) roundtrip; all recursive comparisons use Object.is',
      massAccounting: 'createSheet includes its own original local mass accumulation; triangleMassAccumulations counts the single additional fixture accumulation of explicit physical vertex masses' }, null, 2) + '\n');
    status = 'PASS_P5B_MODEL_DATA_GENERATION';
  } catch (error) {
    firstFailure = { name: error.name, message: error.message }; status = 'FAIL';
  } finally {
    clearTimeout(deadline);
    await write('summary.json', JSON.stringify({ status, runId, counts: COUNTS, firstFailure, outputs: receipts,
      freeze: { path: relative(ROOT, freezePath), bytes: freezeBytes.length, sha256: sha(freezeBytes) },
      elapsedMs: performance.now() - started, chargedEvidenceBytes: charged,
      outputState: 'Generated files remain for review even after failure; never overwrite/retry automatically',
      publicAdmission: 'NOT_RUN', initializerCalls: 0 }, null, 2) + '\n');
  }
  if (status !== 'PASS_P5B_MODEL_DATA_GENERATION') process.exitCode = 1;
}
await main();
