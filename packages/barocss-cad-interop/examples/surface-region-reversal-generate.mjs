import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { compileCadModel, extractSurfaceRegion, reverseSurfaceAxis, surfaceDomain,
  validateExtractedSurfaceRegion, validateReversedSurfaceAxis } from '@barocss/cad';

const file = name => new URL(`./${name}`, import.meta.url);
const input = readFileSync(file('two-surfaces.barocad'), 'utf8');
const compiled = compileCadModel(input, { sourceVersion: 0 });
assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
const original = compiled.model.objects.find(object => object.kind === 'surface' && object.id === 'rational_panel');
assert(original);
assert.deepEqual(surfaceDomain(original), { u: [2, 5], v: [10, 20] });
assert(original.weights.some(row => row.some(weight => weight !== 1)));

const region = extractSurfaceRegion(original, {
  surfaceId: 'region_patch', uInterval: [2.5, 4.5], vInterval: [12, 18], resultIdPrefix: 'region',
});
validateExtractedSurfaceRegion(region);
const reversed = reverseSurfaceAxis(region.surface, {
  surfaceId: 'reversed_patch', axis: 'u', resultIdPrefix: 'reverse',
});
validateReversedSurfaceAxis(reversed);
assert.deepEqual(surfaceDomain(region.surface), { u: [2.5, 4.5], v: [12, 18] });
assert.deepEqual(surfaceDomain(reversed.surface), { u: [2.5, 4.5], v: [12, 18] });

for (const [name, source, expected] of [
  ['surface-region-input.barocad', region.originalSource, region.originalModel],
  ['surface-region.barocad', region.source, region.model],
  ['surface-reverse-input.barocad', reversed.originalSource, reversed.originalModel],
  ['surface-reversed.barocad', reversed.source, reversed.model],
]) {
  const parsed = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(parsed.ok, true, `${name}: ${JSON.stringify(parsed.diagnostics)}`);
  assert.deepEqual(parsed.model, expected);
  writeFileSync(file(name), source);
}

console.log(JSON.stringify({
  inputId: original.id, regionId: region.surface.id, reversedId: reversed.surface.id,
  inputDomain: surfaceDomain(original), outputDomain: surfaceDomain(region.surface),
  regionBytes: Buffer.byteLength(region.source), reversedBytes: Buffer.byteLength(reversed.source),
  regionSourceExact: readFileSync(file('surface-region.barocad'), 'utf8') === region.source,
  reversedSourceExact: readFileSync(file('surface-reversed.barocad'), 'utf8') === reversed.source,
}));
