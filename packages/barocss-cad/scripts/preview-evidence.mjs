import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

// Independent preview evidence uses the actual extracted ESM package supplied by
// the packed consumer, not TypeScript source or a repository resolution fallback.
export function writePreviewEvidence(api) {
  const output = resolve(process.env.BAROCSS_CAD_PREVIEW_EVIDENCE ?? '/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-502/preview');
  mkdirSync(output, { recursive: true });
  const artifacts = [];
  const cases = [
    ['quarter-cylinder', 'cylinder-coarse', 5, 3],
    ['quarter-cylinder', 'cylinder-fine', 17, 9],
    ['preview-flat', 'flat', 2, 2],
    ['preview-weighted', 'weighted', 9, 9],
  ];
  for (const [fixture, name, countU, countV] of cases) {
    const source = readFileSync(resolve(root, `examples/cad-nurbs/${fixture}.css`), 'utf8');
    const compilation = api.compileCadModel(source,{sourceVersion:0}); assert.equal(compilation.ok,true,JSON.stringify(compilation.diagnostics));
    const model = compilation.model, before = json(model), surface = model.objects[0];
    const originalIGES = api.exportIGES(model, [surface.id]).iges;
    const result = api.tessellateSurface(surface, { countU, countV, revision: 7 });
    assert.equal(json(model), before, 'Tessellation changed authoritative model');
    assert.equal(api.exportIGES(model, [surface.id]).iges, originalIGES, 'Tessellation changed IGES');
    assert.deepEqual(api.tessellateSurface(surface, { countU, countV, revision: 7 }), result);
    api.validatePreviewPacket(JSON.parse(json(result.packet)));
    if (name === 'flat') assert.deepEqual(result.packet, JSON.parse(readFileSync(resolve(root, 'examples/cad-nurbs/preview-flat-packet.json'), 'utf8')));
    for (const [suffix, text] of [['css', source], ['native.json', before], ['iges', originalIGES], ['packet.json', json(result.packet)], ['samples.json', json(api.sampleSurface(surface, countU, countV))], ['report.json', json(result.report)]]) {
      writeFileSync(resolve(output, `${name}.${suffix}`), text);
    }
    artifacts.push({ name, fixture, revision: 7, grid: result.report.grid, normalMethod: result.report.normalMethod,
      vertices: result.report.vertexCount, triangles: result.report.triangleCount, probes: result.report.probeCount,
      maxSampledDeviationMM: result.report.maxSampledDeviation, sourceHash: hash(source), nativeHash: hash(before), igesHash: hash(originalIGES), packetHash: hash(json(result.packet)), reportHash: hash(json(result.report)), samplesHash: hash(json(api.sampleSurface(surface, countU, countV))) });
  }
  assert.ok(artifacts[1].maxSampledDeviationMM < artifacts[0].maxSampledDeviationMM);
  const report = { version: 0, base: '6e0dd51e524d7eb109db2e153e602d21d974d171', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), evaluator: '@barocss/cad 0.0.0-private-experimental (extracted package)', consumer: { node: process.version }, artifacts,
    limitations: ['Finite deterministic probe maxima are not certified tolerance or global distance bounds.', 'Normals are area-weighted incident-triangle preview normals, not exact NURBS derivatives.', 'Positions retain native millimetres and U/V orientation; no closed-solid outward orientation is inferred.', 'No GPU runtime, pixels, manufacturing or watertight-solid claim.'] };
  writeFileSync(resolve(output, 'evidence.json'), json(report));
  writeFileSync(resolve(output, 'evidence.sha256'), hash(json(report)) + '\n');
  console.log(`Packed preview evidence: ${output}; SHA-256 ${hash(json(report))}`);
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const api = await import(pathToFileURL(resolve(import.meta.dirname, '../dist/index.js')).href);
  writePreviewEvidence(api);
}
