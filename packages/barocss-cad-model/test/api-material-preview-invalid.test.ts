// Optional recorded-metadata shape checks only; no catalogue lookup, recalculation or physical certification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError, Robot } from '../src/api';
import { GravityExperimentRecord } from '../src/api/experimentRecord';
import { options, rodDoc } from './fixtures/static-gravity-rod';

const object = (value: unknown): Record<string, unknown> => {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
};
function linksOf(source: ReturnType<GravityExperimentRecord['toJSON']>): unknown[] {
  const links = object(object(source.report).inertia).links; assert.ok(Array.isArray(links)); return links;
}
function bodyOf(source: ReturnType<GravityExperimentRecord['toJSON']>): Record<string, unknown> {
  const link = linksOf(source).find(link => object(link).link === 'rod'); assert.ok(link);
  const bodies = object(link).bodies; assert.ok(Array.isArray(bodies)); assert.equal(bodies.length, 1); return object(bodies[0]);
}
function fixture() {
  const source = new Robot(rodDoc()).gravityExperiment(options()).record().toJSON();
  assert.ok(bodyOf(source).materialSnapshot, 'the explicit producer fixture includes the optional recorded snapshot');
  return source;
}
function getterOnlyRefuses(source: ReturnType<GravityExperimentRecord['toJSON']>, label: string): void {
  const before = structuredClone(source), imported = GravityExperimentRecord.parse(JSON.stringify(source));
  const report = imported.report, preview = imported.preview, json = imported.toJSON();
  assert.equal(imported.matches(rodDoc(), options()), true, 'metadata changes do not rewrite the captured document/input binding');
  assert.throws(() => imported.materialPreview, error => error instanceof BarocssError && error.code === 'VALUE', label);
  assert.deepEqual(imported.report, report); assert.deepEqual(imported.preview, preview); assert.deepEqual(imported.toJSON(), json);
  assert.deepEqual(source, before, 'refusing the optional projection does not repair or discard the archived input');
  assert.deepEqual(json, JSON.parse(JSON.stringify(before)), 'the existing finite JSON reader still retains this untrusted data');
}

test('material preview invalid: finite but wrong scalar, density and nullable field types refuse only the new getter', () => {
  const base = fixture();
  const cases: [string, unknown][] = [
    ['densityGPerCm3', '2.7'], ['densityGPerCm3', true], ['densityGPerCm3', null],
    ['densityGPerCm3', 0], ['densityGPerCm3', -2.7],
    ['catalogueDensityGPerCm3', '2.7'], ['catalogueDensityGPerCm3', false],
    ['bodyMaterialId', 1], ['bodyMaterialId', {}], ['inputMaterialId', false], ['inputMaterialId', []],
    ['resolvedMaterialId', null], ['resolvedMaterialId', 1], ['resolvedMaterialId', ' '],
    ['libraryVersion', null], ['libraryVersion', 7],
    ['densitySourceId', 1], ['densitySourceId', []], ['densitySourceText', true], ['densitySourceText', {}],
    ['rowEstimate', 1], ['rowEstimate', 'true'],
  ];
  for (const [field, value] of cases) {
    const copy = structuredClone(base); object(bodyOf(copy).materialSnapshot)[field] = value;
    getterOnlyRefuses(copy, `${field}: ${JSON.stringify(value)}`);
  }
});

test('material preview invalid: enums, partial snapshots and malformed source pages cannot be displayed as valid metadata', () => {
  const base = fixture();
  for (const [field, value] of [['fallback', 'default'], ['fallback', null], ['basis', 'measured'], ['basis', null]] as const) {
    const copy = structuredClone(base); object(bodyOf(copy).materialSnapshot)[field] = value; getterOnlyRefuses(copy, field);
  }
  for (const field of ['bodyMaterialId', 'inputMaterialId', 'resolvedMaterialId', 'fallback', 'densityGPerCm3',
    'catalogueDensityGPerCm3', 'libraryVersion', 'densitySourceId', 'densitySourceText', 'rowEstimate', 'basis']) {
    const copy = structuredClone(base); Reflect.deleteProperty(object(bodyOf(copy).materialSnapshot), field);
    getterOnlyRefuses(copy, `partial snapshot missing ${field}`);
  }
  for (const value of [null, [], {}, { url: 1, read: '2026-10-26', label: 'source' },
    { url: 'https://example.invalid', label: 'source' }, { url: 'https://example.invalid', read: false, label: 'source' },
    { url: 'https://example.invalid', read: '2026-10-26', label: [] },
    { url: 'https://example.invalid', read: '2026-10-26', label: 'source', note: 1 }]) {
    const copy = structuredClone(base); object(bodyOf(copy).materialSnapshot).densityPage = value;
    getterOnlyRefuses(copy, `page: ${JSON.stringify(value)}`);
  }
});

test('material preview invalid: malformed links, bodies, keys and source enums stay archived but their projection is refused', () => {
  const base = fixture();
  for (const value of [null, {}, 'links', [null], [1], [{ bodies: [] }], [{ link: ' ', bodies: [] }],
    [{ link: 'rod', bodies: null }], [{ link: 'rod', bodies: {} }], [{ link: 'rod', bodies: [null] }],
    [{ link: 'rod', bodies: [{}] }], [{ link: 'rod', bodies: [{ key: '' }] }], [{ link: 'rod', bodies: [{ key: 1 }] }]]) {
    const copy = structuredClone(base); object(object(copy.report).inertia).links = value;
    getterOnlyRefuses(copy, `links: ${JSON.stringify(value)}`);
  }
  for (const [field, value] of [['materialSnapshot', null], ['materialSnapshot', []], ['materialSnapshot', 'snapshot'],
    ['inertiaSource', null], ['inertiaSource', 'native-si'], ['inertiaSource', 1]] as const) {
    const copy = structuredClone(base); bodyOf(copy)[field] = value; getterOnlyRefuses(copy, field);
  }
  // Nonfinite numbers and sparse arrays are already rejected by the original JSON reader, not this lazy projection.
});

test('material preview invalid: unknown optional fields remain raw data and never leak into the typed projection', () => {
  const source = fixture(), link = linksOf(source).find(link => object(link).link === 'rod'); assert.ok(link);
  object(link).extraLink = { historical: 'unverified' }; bodyOf(source).extraBody = { authentication: false };
  const snapshot = object(bodyOf(source).materialSnapshot);
  snapshot.extraSnapshot = { arbitrary: 'retained, not a validated material field' };
  snapshot.densityPage = { url: 'https://example.invalid/not-fetched', read: 'authored text', label: 'unverified page declaration',
    note: 'No network verification', extraPage: 'retained only' };
  const before = structuredClone(source), imported = GravityExperimentRecord.parse(JSON.stringify(source));
  assert.deepEqual(imported.toJSON(), before);
  const projection = imported.materialPreview; assert.ok(projection);
  const projected = projection.bodies.find(body => body.link === 'rod'); assert.ok(projected); assert.ok(projected.materialSnapshot);
  assert.equal(Object.hasOwn(projected, 'extraLink'), false); assert.equal(Object.hasOwn(projected, 'extraBody'), false);
  assert.equal(Object.hasOwn(projected.materialSnapshot, 'extraSnapshot'), false);
  assert.ok(projected.materialSnapshot.densityPage); assert.equal(Object.hasOwn(projected.materialSnapshot.densityPage, 'extraPage'), false);
  assert.equal(projected.materialSnapshot.densityPage.url, 'https://example.invalid/not-fetched');
  projected.materialSnapshot.densityGPerCm3 = 99;
  assert.deepEqual(imported.toJSON(), before, 'caller edits of the projection do not alter retained optional fields or recorded density');
  assert.deepEqual(imported.preview, new GravityExperimentRecord(source).preview, 'the original display preview contract is separate');
});
