import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputIndex = process.argv.indexOf('--output');
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error('--output EVIDENCE_DIR is required');
const output = resolve(process.argv[outputIndex + 1]), root = process.cwd();
const distBefore = { cad: existsSync(resolve(root, 'packages/barocss-cad/dist')), interop: existsSync(resolve(root, 'packages/barocss-cad-interop/dist')) };
await mkdir(output, { recursive: true });
const consumer = String.raw`
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileCadModel } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { Scene, Mesh, BufferGeometry, MeshBasicMaterial } from 'three';
const output = process.env.CURVE_CONVERSION_EVIDENCE;
const unsafeMessage = 'BaroCAD Curve position is unsafe in renderer Float32 units';
const collapseMessage = 'BaroCAD Curve has a collapsed Float32 display segment';
function sourceFor(y, x0 = '0', x1 = '1') {
  return '@model underflow_probe {version:0; length-unit:mm; @curve #tiny_offset {type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[' + x0 + ',' + y + ',0],[' + x1 + ',' + y + ',0]]; weights:[1,1];}}';
}
const tiny = '0.' + '0'.repeat(319) + '1', unsafeSource = sourceFor(tiny);
assert.equal(Buffer.byteLength(unsafeSource), 803);
const sourceHash = createHash('sha256').update(unsafeSource).digest('hex');
assert.equal(sourceHash, 'dd1e0a5aa462b3ed78d1f86cc3649f0358f6f263e0a88479bbe35d55b3e414c3');
assert.equal(Number(tiny), 1e-320); assert.notEqual(Number(tiny), 0); assert.equal(Number(tiny) * 1e-10, 0);
function optionsFor(profile, scale) {
  const curveDisplay = { chordToleranceMM: 0.01, maxSegments: 16, maxDepth: 16 };
  if (profile === 'v1') curveDisplay.version = 1;
  return { sourceVersion: 0, countU: 2, countV: 2, unitsPerMillimeter: scale, curveDisplay };
}
function track(result) {
  assert.equal(result.group.children.length, 1);
  const line = result.group.children[0], events = { geometry: 0, material: 0 };
  assert.equal(line.isLine, true);
  line.geometry.addEventListener('dispose', () => { events.geometry++; });
  line.material.addEventListener('dispose', () => { events.material++; });
  return { line, events };
}
const refusals = [], safeCases = [], standing = [];
for (const profile of ['legacy', 'v1']) {
  const scene = new Scene(), callerGeometry = new BufferGeometry(), callerMaterial = new MeshBasicMaterial(), marker = new Mesh(callerGeometry, callerMaterial);
  scene.add(marker);
  const caller = { geometry: 0, material: 0 };
  callerGeometry.addEventListener('dispose', () => { caller.geometry++; }); callerMaterial.addEventListener('dispose', () => { caller.material++; });
  const mountedSource = sourceFor('0.25'), mountedOptions = optionsFor(profile, 0.001), mounted = new BaroCADLoader(mountedOptions).parse(mountedSource), mountedTrack = track(mounted);
  scene.add(mounted.group);
  const retainedModel = structuredClone(mounted.model), retainedPositions = Array.from(mountedTrack.line.geometry.getAttribute('position').array);
  function refuse(kind, source, scale, message) {
    const options = optionsFor(profile, scale), originalOptions = structuredClone(options), compiled = compileCadModel(source, { sourceVersion: 0 });
    assert.equal(compiled.ok, true);
    const originalModel = structuredClone(compiled.model), sceneChildren = [...scene.children];
    for (const entry of ['neutral', 'three']) {
      assert.throws(() => entry === 'neutral' ? parseBaroCadSource(source, options) : new BaroCADLoader(options).parse(source), error => {
        assert.ok(error instanceof RangeError); assert.equal(error.message, message);
        refusals.push({ profile, kind, entry, name: error.name, message: error.message }); return true;
      });
      assert.deepEqual(options, originalOptions); assert.deepEqual(compiled.model, originalModel);
      assert.deepEqual(compileCadModel(source, { sourceVersion: 0 }).model, originalModel);
      assert.deepEqual(scene.children, sceneChildren); assert.deepEqual(mountedTrack.events, { geometry: 0, material: 0 }); assert.deepEqual(caller, { geometry: 0, material: 0 });
      assert.equal(mounted.source, mountedSource); assert.deepEqual(mounted.model, retainedModel);
      assert.deepEqual(Array.from(mountedTrack.line.geometry.getAttribute('position').array), retainedPositions);
    }
  }
  // This is the expected-red assertion against the old binary64 underflow guard.
  refuse('binary64-product-underflow', unsafeSource, 1e-10, unsafeMessage);
  refuse('existing-float32-underflow', sourceFor('0.25'), 1e-100, unsafeMessage);
  refuse('existing-float32-overflow', sourceFor('0.25'), 1e308, unsafeMessage);
  refuse('existing-float32-segment-collapse', sourceFor('0.25', '1', '1.00000001'), 1, collapseMessage);
  for (const scale of [0.001, 1e-10]) for (const y of ['0.25', '0', '-0']) {
    const source = sourceFor(y), options = optionsFor(profile, scale), originalOptions = structuredClone(options);
    const compiled = compileCadModel(source, { sourceVersion: 0 }); assert.equal(compiled.ok, true);
    const neutral = parseBaroCadSource(source, options), target = new BaroCADLoader(options).parse(source), tracked = track(target);
    assert.equal(neutral.source, source); assert.equal(target.source, source); assert.deepEqual(neutral.model, compiled.model); assert.deepEqual(target.model, compiled.model);
    const nativeCurve = target.model.objects[0];
    assert.equal(nativeCurve.degree, 1); assert.deepEqual(nativeCurve.knots, [0,0,1,1]); assert.deepEqual(nativeCurve.weights, [1,1]);
    for (const pole of nativeCurve.controlPoints) assert.ok(Object.is(pole[1], Number(y)), 'Authored native zero sign and coordinate bits');
    assert.equal(neutral.curves[0].sample.pointsMM.length, 2); assert.equal(neutral.curves[0].sample.segments.length, 1);
    assert.deepEqual(neutral.curves[0].sample.parameters, [0,1]); assert.deepEqual(target.curves[0].sample.parameters, [0,1]);
    assert.deepEqual(tracked.line.userData.barocss.nativeParameters, [0,1]); assert.deepEqual(tracked.line.userData.barocss.nativeIntervals, [[0,1]]);
    const positions = tracked.line.geometry.getAttribute('position').array;
    for (let index = 0; index < positions.length; index++) {
      const expected = Math.fround(neutral.curves[0].sample.pointsMM[Math.floor(index / 3)][index % 3] * scale);
      assert.ok(Object.is(positions[index], expected)); assert.ok(Object.is(neutral.curves[0].positions[index], expected));
    }
    if (y === '0.25') assert.notEqual(positions[1], 0);
    assert.deepEqual(options, originalOptions);
    target.dispose(); target.dispose(); assert.deepEqual(tracked.events, { geometry: 1, material: 1 });
    assert.deepEqual(target.model, compiled.model);
    safeCases.push({ profile, scale, yLiteral: y, nativeYIsNegativeZero: Object.is(nativeCurve.controlPoints[0][1], -0), positions: Array.from(positions), events: { ...tracked.events } });
  }
  assert.deepEqual(mountedTrack.events, { geometry: 0, material: 0 }); assert.deepEqual(scene.children, [marker, mounted.group]);
  mounted.dispose(); mounted.dispose(); assert.deepEqual(mountedTrack.events, { geometry: 1, material: 1 });
  assert.deepEqual(caller, { geometry: 0, material: 0 }); assert.deepEqual(scene.children, [marker]); assert.deepEqual(mounted.model, retainedModel);
  standing.push({ profile, ownSafeLine: { ...mountedTrack.events }, caller: { ...caller }, sceneRetained: true, sourceAndModelRetained: true });
}
const compiledUnsafe = compileCadModel(unsafeSource, { sourceVersion: 0 }); assert.equal(compiledUnsafe.ok, true);
assert.deepEqual(compiledUnsafe.model.objects[0].controlPoints.map(pole => pole[1]), [1e-320,1e-320]);
const flow = { node: process.version, originalSource: unsafeSource, sourceBytes: Buffer.byteLength(unsafeSource), sourceSha256: sourceHash,
  originalNativeY: compiledUnsafe.model.objects[0].controlPoints.map(pole => pole[1]), binary64Product: 1e-320 * 1e-10, refusals, safeCases, standing,
  scope: 'Existing source/public native + real Three CPU conversion refusal and safe controls. No target result returned for rejected parse. No allocator counter, GPU, Surface or other-engine proof.' };
writeFileSync(resolve(output, 'curve-conversion-flow.json'), JSON.stringify(flow, null, 2) + '\n');
console.log(JSON.stringify({ sourceBytes: flow.sourceBytes, sourceSha256: sourceHash, refusals: refusals.length, safeCases: safeCases.length, standing, scope: flow.scope }));
`;
try {
  const built = await build({ stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'curve-conversion-consumer.mjs', loader: 'js' },
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true });
  const inputs = Object.keys(built.metafile.inputs), cadSource = inputs.filter(path => path.includes('packages/barocss-cad/src/')),
    interopSource = inputs.filter(path => path.includes('packages/barocss-cad-interop/src/')), ownDist = inputs.filter(path => /packages\/barocss-cad(?:-interop)?\/dist\//.test(path));
  const graph = { cadSource, interopSource, ownDist, sourceCount: cadSource.length + interopSource.length, compiledCount: ownDist.length };
  await writeFile(resolve(output, 'curve-conversion-inputs.json'), JSON.stringify({ distBefore, graph, metafile: built.metafile }, null, 2) + '\n');
  if (!cadSource.length || !interopSource.length || ownDist.length) throw new Error('Actual public source graph with zero dist inputs required');
  const child = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: built.outputFiles[0].text, encoding: 'utf8', env: { ...process.env, CURVE_CONVERSION_EVIDENCE: output }, maxBuffer: 8 * 1024 * 1024 });
  await writeFile(resolve(output, 'cpu.stdout.log'), child.stdout ?? ''); await writeFile(resolve(output, 'cpu.stderr.log'), child.stderr ?? ''); await writeFile(resolve(output, 'cpu.exit'), String(child.status) + '\n');
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error('Actual focused Curve conversion flow failed: ' + child.stderr);
  const summary = { node: process.version, distBefore, graph: { cadSource: cadSource.length, interopSource: interopSource.length, sourceCount: graph.sourceCount, compiledCount: 0 }, cpu: JSON.parse(child.stdout.trim()), scope: 'Source/native/real Three CPU; browser and publication not run.' };
  await writeFile(resolve(output, 'curve-conversion-summary.json'), JSON.stringify(summary, null, 2) + '\n'); console.log(JSON.stringify(summary, null, 2));
} catch (error) { await writeFile(resolve(output, 'curve-conversion-failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2) + '\n'); throw error; }
