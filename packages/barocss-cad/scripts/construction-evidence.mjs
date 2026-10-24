import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => createHash('sha256').update(value).digest('hex');
export const constructionEvidenceRoot = () => resolve(process.env.BAROCSS_CAD_CONSTRUCTION_EVIDENCE ?? '/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-505/construction');

/** The host supplies the actual extracted package API. Files remain test evidence. */
export function writeConstructionEvidence(api) {
  const output = constructionEvidenceRoot();
  mkdirSync(output, { recursive: true });
  const fixtures = [];
  const fractionsU = [0, .03, .07, .123, .2, .271, .33, .41, .5, .57, .66, .719, .8, .877, .93, .97, 1];
  const fractionsV = [0, .11, .23, .37, .5, .61, .79, .91, 1];
  for (const name of ['extruded-cylinder', 'extruded-asymmetric', 'extruded-straight']) {
    const source = readFileSync(resolve(root, 'examples/cad-nurbs/' + name + '.css'), 'utf8');
    assert.equal(api.compileCadModel(source,{sourceVersion:0}).ok,false);
    const compiled = api.compileCadModel(source,{sourceVersion:1});
    assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
    assert.equal(compiled.ir.sourceVersion, 1); assert.equal(compiled.model.version, 0);
    assert.deepEqual(api.compileCadModel(source,{sourceVersion:1}), compiled);
    const before = json(compiled), feature = compiled.constructions[0];
    assert.equal(compiled.constructions.length, 1);
    const curve = compiled.model.objects.find(object => object.id === feature.inputId);
    const surface = compiled.model.objects.find(object => object.id === feature.outputId);
    assert.equal(curve.kind, 'curve'); assert.equal(surface.kind, 'surface');
    const { packet, report } = api.tessellateSurface(surface, { countU: 17, countV: 9, revision: 505 });
    api.validatePreviewPacket(packet); assert.equal(packet.version, 0);
    const exported = api.exportIGES(compiled.model, [feature.outputId]);
    assert.equal(exported.report.objects.length, 1); assert.equal(exported.report.objects[0].entity, 128);
    assert.equal(exported.report.objects[0].id, feature.outputId);
    assert.equal(json(compiled), before);
    const domain = api.surfaceDomain(surface), samples = [];
    for (const fu of fractionsU) for (const v of fractionsV) {
      const u = (1 - fu) * domain.u[0] + fu * domain.u[1];
      const sourceCurvePoint = api.evaluateCurve(curve, u);
      samples.push({ u, v, point: api.evaluateSurface(surface, u, v), sourceCurvePoint,
        affinePoint: sourceCurvePoint.map((value, axis) => value + v * feature.vector[axis]) });
    }
    const featureData = { sourceVersion: compiled.ir.sourceVersion, constructions: compiled.constructions };
    const contents = { 'css': source, 'features.json': json(featureData), 'native.json': json(compiled.model),
      'packet.json': json(packet), 'preview-report.json': json(report), 'iges': exported.iges,
      'export-report.json': json(exported.report), 'samples.json': json(samples) };
    const hashes = {};
    for (const [suffix, bytes] of Object.entries(contents)) {
      writeFileSync(resolve(output, name + '.' + suffix), bytes); hashes[suffix] = hash(bytes);
    }
    fixtures.push({ name, inputId: feature.inputId, outputId: feature.outputId, feature, domain, samples,
      sourceVersion: 1, geometryVersion: 0, packetVersion: 0, revision: 505, entity: 128, grid: report.grid,
      maxSampledPreviewDeviationMM: report.maxSampledDeviation, hashes });
  }
  const manifest = { base: '6185396138c91c6971943410de690e296837dd09',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    producer: 'Actual extracted @barocss/cad ESM archive; original construction/evaluator/exporter',
    node: process.version, fixtures, limitations: ['Open untrimmed surfaces only; no caps, solids, B-Rep or STEP.',
      'Exact rational affine construction in binary64 representation; selected-fixture accuracy only.',
      'Preview distance is finite sampled evidence; normals are averaged triangle normals; no GPU pixel claim.'] };
  writeFileSync(resolve(output, 'manifest.json'), json(manifest));
  writeFileSync(resolve(output, 'manifest.sha256'), hash(json(manifest)) + '\n');
  console.log('Packed construction evidence: ' + output + '; SHA-256 ' + hash(json(manifest)));
  return manifest;
}
