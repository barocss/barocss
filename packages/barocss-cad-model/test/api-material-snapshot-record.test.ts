import test from 'node:test';
import assert from 'node:assert/strict';
import { Robot } from '../src/api/robot';
import { GravityExperimentRecord } from '../src/api/experimentRecord';
import { MATERIALS } from '../src/library/materials';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

// Authored catalogue fixture evidence, not measured material or authenticated producer provenance.
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);
function object(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function bodyOf(report: unknown): Record<string, unknown> {
  const links = object(object(report).inertia).links;
  assert.ok(Array.isArray(links));
  const moving = links.find(link => object(link).link === 'rod');
  assert.ok(moving);
  const bodies = object(moving).bodies;
  assert.ok(Array.isArray(bodies)); assert.equal(bodies.length, 1);
  return object(bodies[0]);
}
function bodyMassOf(report: unknown): number {
  const mass = bodyOf(report).mass;
  assert.equal(typeof mass, 'number'); assert.ok(typeof mass === 'number' && Number.isFinite(mass));
  return mass;
}
const snapshotOf = (report: unknown) => object(bodyOf(report).materialSnapshot);
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

test('material snapshot record: the pure rod retains the density actually used in its independent mass oracle', () => {
  const experiment = new Robot(rodDoc()).gravityExperiment(options()), report = experiment.report;
  const moving = report.inertia.links.find(link => link.link === 'rod'); assert.ok(moving);
  const snapshot = snapshotOf(report);
  assert.equal(snapshot.bodyMaterialId, 'al6061'); assert.equal(snapshot.inputMaterialId, 'al6061');
  assert.equal(snapshot.resolvedMaterialId, 'al6061'); assert.equal(snapshot.fallback, 'none');
  assert.equal(snapshot.densityGPerCm3, 2.7); assert.equal(snapshot.catalogueDensityGPerCm3, 2.7);
  assert.equal(snapshot.libraryVersion, '0.7.0');
  assert.equal(snapshot.densitySourceId, 'S-DENS'); assert.equal(snapshot.basis, 'builtin-catalogue-not-measured');
  near(moving.mass, 100 * 10 * 10 * 2.7 / 1000);
  near(bodyMassOf(report), 27);
  const reopened = GravityExperimentRecord.parse(JSON.stringify(experiment.record()));
  assert.deepEqual(reopened.report, json(report));
  assert.deepEqual(snapshotOf(reopened.report), json(snapshot));
});

test('material snapshot record: caller edits to report and exported metadata do not alter the past calculation', () => {
  const experiment = new Robot(rodDoc()).gravityExperiment(options()), saved = experiment.record();
  const before = saved.toJSON(), report = experiment.report, exported = saved.toJSON();
  snapshotOf(report).densityGPerCm3 = 99;
  snapshotOf(exported.report).resolvedMaterialId = 'caller-replaced';
  snapshotOf(saved.report).densitySourceText = 'caller-replaced';
  assert.deepEqual(saved.toJSON(), before);
  assert.equal(snapshotOf(experiment.report).densityGPerCm3, 2.7);
  assert.deepEqual(GravityExperimentRecord.parse(JSON.stringify(saved)).toJSON(), json(before));
});

test('material snapshot record: later catalogue density changes affect only a new calculation', { concurrency: false }, () => {
  const material = MATERIALS.find(row => row.id === 'al6061'); assert.ok(material);
  const originalDensity = material.density;
  const doc = rodDoc(), input = options(), experiment = new Robot(doc).gravityExperiment(input);
  const saved = experiment.record(), before = saved.toJSON(), originalReport = experiment.report;
  try {
    material.density = originalDensity * 2;
    assert.deepEqual(saved.toJSON(), before);
    assert.deepEqual(experiment.report, originalReport);
    const reopened = GravityExperimentRecord.parse(JSON.stringify(saved));
    assert.equal(snapshotOf(reopened.report).densityGPerCm3, originalDensity);
    assert.equal(reopened.matches(doc, input), true, 'document/input equality does not certify current catalogue compatibility');
    const next = new Robot(doc).gravityExperiment(input).report;
    assert.equal(snapshotOf(next).densityGPerCm3, originalDensity * 2);
    // Only the runtime material changed: source/version metadata still describes the unchanged declared row.
    assert.equal(snapshotOf(next).catalogueDensityGPerCm3, originalDensity);
    assert.equal(snapshotOf(next).densitySourceId, 'S-DENS');
    near(bodyMassOf(next), 100 * 10 * 10 * (originalDensity * 2) / 1000);
    near(next.result.torques[KEY], originalReport.result.torques[KEY] * 2);
    assert.deepEqual(reopened.toJSON(), json(before));
  } finally {
    material.density = originalDensity;
  }
  assert.equal(material.density, originalDensity);
});
