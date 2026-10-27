/** #1286: original Source2 local XYZ scale semantics and trusted shader text.
 * node examples/gpu-scene/affine-scene-source-flow.mjs --output <fresh-directory>
 * No shader execution, WebGL, rendered pixels, marching or normal certificate.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = process.argv.indexOf('--output');
assert(at >= 0 && process.argv[at + 1], '--output <fresh-directory> is required');
const output = resolve(process.argv[at + 1]); await mkdir(output, { recursive: false });
const pkg = resolve(repo, 'packages/barocss-gpu');
const manifest = JSON.parse(await readFile(resolve(pkg, 'package.json'), 'utf8'));
const emitted = manifest.publishConfig.exports['.'];
const ordinaryPath = resolve(output, 'ordinary-source.mjs');
const bundle = await build({ entryPoints: [resolve(pkg, manifest.exports['.'].import)], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', outfile: ordinaryPath, metafile: true });
const graph = Object.keys(bundle.metafile.inputs);
assert(graph.some(p => p.endsWith('/src/scene/affine-scene-source.ts')));
assert(!graph.some(p => /barocss-(gpu|cad)\/dist\//.test(p)));
const providers = [['ordinary-source', await import(pathToFileURL(ordinaryPath).href)],
  ['emitted-public', await import(pathToFileURL(resolve(pkg, emitted.import)).href)]];
assert.deepEqual(Object.keys(providers[0][1]).sort(), Object.keys(providers[1][1]).sort());

const declarationPath = resolve(pkg, emitted.types), declarations = await readFile(declarationPath, 'utf8');
for (const type of ['AffineSceneObject2', 'AffineScene2', 'CompiledAffineSceneSource'])
  assert(new RegExp('\\b' + type + '\\b').test(declarations));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function receipt(path) { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }
function frozen(value) { if (value && typeof value === 'object') {
  assert(Object.isFrozen(value)); for (const item of Object.values(value)) frozen(item);
} }
const near = (a, b, tolerance = 1e-10) => assert(Math.abs(a - b) <= tolerance, `actual ${a}; expected ${b}`);
const vector = (a, b, tolerance) => { assert.equal(a.length, b.length); a.forEach((n, i) => near(n, b[i], tolerance)); };
const norm = v => Math.hypot(...v);
const add = (a, b) => a.map((n, i) => n + b[i]);
const multiply = (a, b) => a.map((n, i) => n * b[i]);
const scalar = n => Math.fround(n).toExponential(8);
const glVector = values => 'vec3(' + values.map(scalar).join(',') + ')';
// Independent ordered ideal rotations, used only for example arithmetic/text checks.
function rotate(v, degrees) {
  const [x, y, z] = degrees.map(n => n * Math.PI / 180);
  const rx = [v[0], Math.cos(x) * v[1] - Math.sin(x) * v[2], Math.sin(x) * v[1] + Math.cos(x) * v[2]];
  const ry = [Math.cos(y) * rx[0] + Math.sin(y) * rx[2], rx[1], -Math.sin(y) * rx[0] + Math.cos(y) * rx[2]];
  return [Math.cos(z) * ry[0] - Math.sin(z) * ry[1], Math.sin(z) * ry[0] + Math.cos(z) * ry[1], ry[2]];
}
function inverseRotate(v, degrees) {
  const [x, y, z] = degrees.map(n => -n * Math.PI / 180);
  const rz = [Math.cos(z) * v[0] - Math.sin(z) * v[1], Math.sin(z) * v[0] + Math.cos(z) * v[1], v[2]];
  const ry = [Math.cos(y) * rz[0] + Math.sin(y) * rz[2], rz[1], -Math.sin(y) * rz[0] + Math.cos(y) * rz[2]];
  return [ry[0], Math.cos(x) * ry[1] - Math.sin(x) * ry[2], Math.sin(x) * ry[1] + Math.cos(x) * ry[2]];
}
const fixturePath = resolve(repo, 'examples/gpu-scene/affine-scene-authoring.css');
const source = await readFile(fixturePath, 'utf8');
assert(source.includes('Original Source2')); assert.equal((source.match(/(?:translate|start)\s*:[^;]*-0/g) ?? []).length, 3);
const expected = [
  { id: 'orb', type: 'sphere', color: [.2, .4, .6], radius: .75, size: [2, 2, 2], translate: [-2, 0, 0], rotation: [23, -37, 41], scaleXYZ: [2, .5, 1.5] },
  { id: 'brick', type: 'box', color: [.8, .4, .2], radius: 1, size: [1.5, 2, .5], translate: [0, 0, 0], rotation: [0, 0, 0], scaleXYZ: [1.25, .75, .5] },
  { id: 'column', type: 'cylinder', color: [.4, .6, .2], radius: .4, size: [2, 2, 2], height: 1.6, translate: [2, 0, 0], rotation: [0, 0, 0], scaleXYZ: [.8, 1.2, 1.6] },
  { id: 'link', type: 'capsule', color: [.6, .2, .8], radius: .2, size: [2, 2, 2], start: [0, -.6, 0], end: [.3, .6, .2], translate: [-2, 0, -2], rotation: [0, 0, 0], scaleXYZ: [1.5, .5, 2] },
  { id: 'rounded', type: 'rounded-box', color: [.2, .8, .8], radius: .15, size: [1.2, 1.6, 2], translate: [0, 0, -2], rotation: [0, 0, 0], scaleXYZ: [.75, 1.25, 1.5] },
  { id: 'ring', type: 'torus', color: [.8, .2, .6], radius: 1, size: [2, 2, 2], majorRadius: .7, minorRadius: .15, translate: [2, 0, -2], rotation: [0, 0, 0], scaleXYZ: [.01, 100, 1] },
];
const originalFiles = [], results = []; let accepted = 0, refused = 0;
for (const [provider, gpu] of providers) {
  assert.equal(typeof gpu.compileAffineSceneSource, 'function');
  assert.equal(gpu.parseAffineSceneAst, undefined); assert.equal(gpu.lowerAffineSceneShaders, undefined);
  const current = gpu.compileAffineSceneSource(source); frozen(current);
  assert.deepEqual(Object.keys(current).sort(), ['format', 'version', 'profile', 'source', 'scene', 'shaders'].sort());
  assert.equal(current.format, 'barocss-gpu-affine-scene-source'); assert.equal(current.version, 0);
  assert.equal(current.profile, 'source2-local-positive-xyz-min-step-v0'); assert.equal(current.source, source);
  assert.deepEqual(Object.keys(current.scene).sort(), ['version', 'name', 'background', 'objects'].sort());
  assert.equal(current.scene.version, 2); assert.equal(current.scene.name, 'affine_authoring');
  vector(current.scene.background, [16 / 255, 32 / 255, 48 / 255]);
  assert.deepEqual(current.scene.objects, expected);
  assert(!Object.is(current.scene.objects[0].translate[1], -0));
  assert(!Object.is(current.scene.objects[3].start[0], -0));
  assert.deepEqual(Object.keys(current.shaders).sort(), ['fragment', 'vertex']);
  const fragment = current.shaders.fragment;
  assert(!fragment.includes('Original Source2')); assert(!fragment.includes('#orb'));
  const statements = fragment.match(/d=.*?; if\(d<nearest\)\{nearest=d; material=vec3\([^\n]*?\);\}/g);
  assert.equal(statements.length, 6);
  const checks = [];
  expected.forEach((object, i) => {
    const statement = statements[i]; const minScale = Math.min(...object.scaleXYZ.map(Math.fround));
    assert(statement.includes('p-' + glVector(object.translate)));
    assert(statement.includes('/' + glVector(object.scaleXYZ)));
    assert(statement.includes(')*' + scalar(minScale) + '; if(d<nearest)'));
    assert(statement.endsWith('material=' + glVector(object.color) + ';}'));
    if (object.type === 'sphere') {
      const matrixText = /mat3\(([^)]+)\)/.exec(statement)[1];
      const expectedMatrix = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].flatMap(v => inverseRotate(v, object.rotation));
      vector(matrixText.split(',').map(Number), expectedMatrix.map(Math.fround), 1e-7);
      assert(statement.includes('length(')); assert(statement.includes('-' + scalar(object.radius) + ')*'));
      assert(statement.indexOf('mat3(') < statement.indexOf('/' + glVector(object.scaleXYZ)));
    } else {
      assert(!statement.includes('mat3('));
      if (object.type === 'box') assert(statement.includes(',' + glVector(object.size.map(n => n / 2)) + '))*'));
      if (object.type === 'cylinder') assert(statement.includes('cylinderDistance(') && statement.includes(',' + scalar(.4) + ',' + scalar(.8) + '))*'));
      if (object.type === 'capsule') assert(statement.includes('capsuleDistance(') && statement.includes(',' + glVector(object.start) + ',' + glVector(object.end) + ',' + scalar(.2) + '))*'));
      if (object.type === 'rounded-box') assert(statement.includes('boxDistance(') && statement.includes(',' + glVector(object.size.map(n => Math.fround(Math.fround(n / 2) - Math.fround(object.radius)))) + ')-' + scalar(.15) + ')*'));
      if (object.type === 'torus') assert(statement.includes('torusDistance(') && statement.includes(',' + scalar(.7) + ',' + scalar(.15) + '))*'));
    }
    checks.push({ id: object.id, sourceScale: object.scaleXYZ, executedScale: object.scaleXYZ.map(Math.fround),
      executedMinScale: minScale, trustedStatement: statement });
  });
  const orb = expected[0], axisArithmetic = [];
  for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
    const local = [0, 0, 0]; local[axis] = sign * orb.radius;
    const rotated = rotate(multiply(local, orb.scaleXYZ), orb.rotation), world = add(rotated, orb.translate);
    const inverse = inverseRotate(world.map((n, i) => n - orb.translate[i]), orb.rotation)
      .map((n, i) => n / orb.scaleXYZ[i]);
    near(norm(inverse) - orb.radius, 0); near(norm(rotated), orb.radius * orb.scaleXYZ[axis]);
    axisArithmetic.push({ axis, sign, local, world, idealLocalZeroField: norm(inverse) - orb.radius });
  }
  const localNormal = [Math.SQRT1_2, Math.SQRT1_2, 0];
  const unnormalized = rotate(localNormal.map((n, i) => n / orb.scaleXYZ[i]), orb.rotation);
  const idealNormal = unnormalized.map(n => n / norm(unnormalized)); near(norm(idealNormal), 1);
  const tangent = rotate(multiply([-Math.SQRT1_2, Math.SQRT1_2, 0], orb.scaleXYZ), orb.rotation);
  near(idealNormal.reduce((sum, n, i) => sum + n * tangent[i], 0), 0);
  const localOutside = [2 * orb.radius, 0, 0];
  const idealConservativeField = (norm(localOutside) - orb.radius) * Math.min(...orb.scaleXYZ);
  near(idealConservativeField, .375);
  const arithmetic = { stage: 'independent-example-ideal-arithmetic-only', axisSemiaxes: [1.5, .375, 1.125],
    axisArithmetic, localNormal, idealInverseTransposeNormal: idealNormal, idealTangentDot: 0,
    exampleConservativeField: idealConservativeField, exactWorldDistanceClaim: false, actualShaderEvaluation: false };
  const sourceFile = resolve(output, provider + '.original-source2.css');
  const resultFile = resolve(output, provider + '.compiled-source2.json');
  await writeFile(sourceFile, source); await writeFile(resultFile, JSON.stringify(current, null, 2) + '\n');
  const cold = gpu.compileAffineSceneSource(await readFile(sourceFile, 'utf8'));
  assert.deepEqual(cold, current); assert.notStrictEqual(cold.scene, current.scene);
  assert.notStrictEqual(cold.scene.objects, current.scene.objects);
  assert.notStrictEqual(cold.scene.background, current.scene.background);
  assert.notStrictEqual(cold.shaders, current.shaders);
  for (let i = 0; i < expected.length; i++) {
    assert.notStrictEqual(cold.scene.objects[i], current.scene.objects[i]);
    for (const field of ['scaleXYZ', 'translate', 'rotation', 'color', 'size', ...(expected[i].type === 'capsule' ? ['start', 'end'] : [])])
      assert.notStrictEqual(cold.scene.objects[i][field], current.scene.objects[i][field]);
  }
  frozen(cold); assert.deepEqual(JSON.parse(await readFile(resultFile, 'utf8')), current);
  const callerCopy = structuredClone(current); callerCopy.scene.objects[0].scaleXYZ[0] = 99;
  assert.equal(current.scene.objects[0].scaleXYZ[0], 2);
  accepted++;
  const identitySource2 = source.replace(/scale\s*:[^;]+;/g, '');
  const oldSource1 = identitySource2.replace('version: 2;', 'version: 1;');
  const identity = gpu.compileAffineSceneSource(identitySource2);
  const old = gpu.compileGpu({ kind: 'scene', sourceVersion: 1, source: oldSource1 });
  assert(old.ok, JSON.stringify(old.diagnostics));
  assert.deepEqual(identity.shaders, old.execution.shaders);
  assert(identity.scene.objects.every(o => o.scaleXYZ.every(n => n === 1))); accepted++;
  const empty = gpu.compileAffineSceneSource('@scene empty { version:2; background:#000; }');
  assert.equal(empty.scene.objects.length, 0); frozen(empty); accepted++;
  const saved = await readFile(sourceFile), savedResult = await readFile(resultFile), snapshot = JSON.stringify(current);
  const prefix = '// original 😀 UTF16 location\r\n';
  const failures = [];
  function bad(label, body, span, offset = undefined) {
    const input = prefix + body;
    failures.push({ label, input, span, start: offset === undefined ? input.lastIndexOf(span) : prefix.length + offset });
  }
  bad('version1', '@scene bad { version:1; sphere #s; }', '1');
  bad('scale_zero', '@scene bad { version:2; sphere #s; } #s { scale:0 1 1; }', '0');
  bad('scale_negative', '@scene bad { version:2; sphere #s; } #s { scale:-1 1 1; }', '-1');
  bad('scale_low', '@scene bad { version:2; sphere #s; } #s { scale:.009 1 1; }', '.009');
  bad('scale_high', '@scene bad { version:2; sphere #s; } #s { scale:100.001 1 1; }', '100.001');
  bad('scale_units', '@scene bad { version:2; sphere #s; } #s { scale:2mm 1 1; }', '2mm');
  bad('scale_count', '@scene bad { version:2; sphere #s; } #s { scale:2 1; }', '2', '@scene bad { version:2; sphere #s; } #s { scale:'.length);
  bad('unmatched_invalid_type_rule', '@scene bad { version:2; sphere #s; } box { scale:0 1 1; }', '0');
  bad('overridden_invalid_declaration', '@scene bad { version:2; sphere #s; } #s { scale:0 1 1; scale:1 1 1; }', '0');
  bad('unknown_id', '@scene bad { version:2; sphere #s; } #absent { scale:1 1 1; }', '#absent');
  bad('unknown_property', '@scene bad { version:2; sphere #s; } #s { shear:1; }', 'shear');
  bad('actual_radius_provider', '@scene bad { version:2; sphere #s; } #s { radius:0; }', '0');
  bad('actual_capsule_provider', '@scene bad { version:2; capsule #c; } #c { start:0 0 0; end:0 0 0; }', '0', '@scene bad { version:2; capsule #c; } #c { start:0 0 0; end:'.length);
  bad('actual_torus_provider', '@scene bad { version:2; torus #t; } #t { major-radius:.5; minor-radius:.5; }', '.5');
  bad('actual_rounded_box_provider', '@scene bad { version:2; rounded-box #r; } #r { size:1 1 1; radius:.6; }', '.6');
  const byteInput = '// ' + '😀'.repeat(16384) + '\n@scene bytes { version:2; }';
  failures.push({ label: 'UTF8_budget_before_parsing', input: byteInput, span: byteInput, start: 0 });
  failures.push({ label: 'nonstring_input', input: { source }, span: '', start: 0 });
  const refusals = [];
  for (const { label, input, span, start } of failures) {
    let error; try { gpu.compileAffineSceneSource(input); } catch (e) { error = e; }
    assert(error instanceof gpu.SceneError, label + ' actual public SceneError');
    const diagnostic = error.diagnostics[0]; assert(diagnostic);
    assert.equal(diagnostic.start, start, label + ' original start');
    assert.equal(diagnostic.end, start + span.length, label + ' original end');
    const text = typeof input === 'string' ? input : '';
    assert.equal(text.slice(diagnostic.start, diagnostic.end), span);
    const priorLF = text.slice(0, start).lastIndexOf('\n');
    assert.equal(diagnostic.line, text.slice(0, start).split('\n').length);
    assert.equal(diagnostic.column, start - priorLF);
    assert.equal(JSON.stringify(current), snapshot); assert.deepEqual(await readFile(sourceFile), saved);
    assert.deepEqual(await readFile(resultFile), savedResult); refused++;
    refusals.push({ label, diagnostic, originalSpan: span.length < 128 ? span : null,
      originalSpanSHA256: hash(span), actualCause: error.cause instanceof Error ? error.cause.message : null,
      previousCompiledSourceAndFilesRetained: true });
  }
  const oldHeader = gpu.compileGpu({ kind: 'scene', sourceVersion: 1, source }); assert.equal(oldHeader.ok, false);
  const scaleSource1 = '@scene old { version:1; sphere #s; } #s { scale:2 1 1; }';
  const oldScale = gpu.compileGpu({ kind: 'scene', sourceVersion: 1, source: scaleSource1 }); assert.equal(oldScale.ok, false);
  assert.equal(scaleSource1.slice(oldScale.diagnostics[0].range.start, oldScale.diagnostics[0].range.end), 'scale');
  let oldStructured; try { gpu.compileScene(current.scene); } catch (e) { oldStructured = e; }
  assert(oldStructured instanceof Error); refused += 3;
  const files = await Promise.all([sourceFile, resultFile].map(receipt)); originalFiles.push(...files);
  results.push({ provider, exports: Object.keys(gpu).sort(), trustedTextChecks: checks, independentIdealArithmetic: arithmetic,
    identityScaleEqualsActualOldSource1: true, emptyScene: true, fullOriginalSourceAndColdCopies: true,
    compatibilityRefusals: { oldHeader: oldHeader.diagnostics[0], oldScale: oldScale.diagnostics[0], oldStructured: oldStructured.message },
    refusals, files, compiledSHA256: hash(snapshot), fragmentSHA256: hash(fragment) });
}
assert.equal(results[0].compiledSHA256, results[1].compiledSHA256);
const report = { issue: 1286, accepted, refused, actualGL: false, actualShaderEvaluation: false, sourceGraph: graph,
  source: await receipt(resolve(pkg, 'src/scene/affine-scene-source.ts')), fixture: await receipt(fixturePath),
  ordinary: await receipt(ordinaryPath), emitted: await receipt(resolve(pkg, emitted.import)), declarations: await receipt(declarationPath),
  results, originalFiles, support: 'Original Source2 parsing and semantics, trusted inverse rotation/component scale/min-F32-step shader text, all six unchanged distance helpers. Independent ideal transform/zero-set/normal arithmetic is example arithmetic only. No hardware field evaluation, marching convergence, finite-difference normal precision, renderer/profile adoption, pixels, visibility, exact world distance, performance or publication claim.' };
const reportPath = resolve(output, 'actual-result.json'); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ issue: 1286, accepted, refused, exports: results[0].exports.length,
  resultSHA256: (await receipt(reportPath)).sha256, actualGL: false, actualShaderEvaluation: false }));
