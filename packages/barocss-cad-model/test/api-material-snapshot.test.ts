import test from 'node:test';
import assert from 'node:assert/strict';
import { Robot } from '../src/api/robot';
import { rodDoc } from './fixtures/static-gravity-rod';

// These are catalogue-based mass calculations, not measured material evidence.
const VOLUME_MM3 = 100 * 10 * 10;
const DENSITY_G_PER_CM3 = 2.7;
const MASS_G = VOLUME_MM3 * DENSITY_G_PER_CM3 / 1000;

function moving(doc: ReturnType<typeof rodDoc>) {
  const link = new Robot(doc).inertia().links.find(link => link.part === 'rod');
  assert.ok(link);
  assert.equal(link.bodies.length, 1);
  const body = link.bodies[0];
  assert.ok(body.materialSnapshot);
  return { link, body, snapshot: body.materialSnapshot };
}

test('material snapshot: an authored rod retains the density actually used by the original mass formula', () => {
  const { link, body, snapshot } = moving(rodDoc());
  assert.equal(MASS_G, 27, 'independent 10000 mm³ × 2.7 g/cm³ conversion');
  assert.equal(link.mass, MASS_G);
  assert.equal(body.mass, MASS_G);
  assert.equal(body.assumed, false);
  assert.equal(body.material, 'Aluminium 6061');
  assert.equal(body.inertiaSource, 'mmgs-density-scaled');
  assert.equal(snapshot.bodyMaterialId, 'al6061');
  assert.equal(snapshot.inputMaterialId, 'al6061');
  assert.equal(snapshot.resolvedMaterialId, 'al6061');
  assert.equal(snapshot.fallback, 'none');
  assert.equal(snapshot.densityGPerCm3, DENSITY_G_PER_CM3);
  assert.equal(snapshot.catalogueDensityGPerCm3, 2.7);
  assert.equal(snapshot.libraryVersion, '0.7.0');
  assert.equal(snapshot.densitySourceId, 'S-DENS');
  assert.equal(snapshot.densitySourceText, "BaroCSS typical density for the family, written for this table (the studio's earlier density list, kept)");
  assert.equal(snapshot.rowEstimate, true);
  assert.equal(snapshot.basis, 'builtin-catalogue-not-measured');
});

test('material snapshot: an unset material records the real fallback without changing assumed mass or issues', () => {
  const doc = rodDoc();
  delete doc.instances![0].doc.bodies!.b1.material;
  const { link, body, snapshot } = moving(doc);
  assert.equal(link.mass, MASS_G);
  assert.equal(body.mass, MASS_G);
  assert.equal(body.assumed, true);
  assert.equal(body.material, 'Aluminium 6061');
  assert.equal(snapshot.bodyMaterialId, null);
  assert.equal(snapshot.inputMaterialId, null);
  assert.equal(snapshot.resolvedMaterialId, 'al6061');
  assert.equal(snapshot.fallback, 'unset');
  assert.equal(snapshot.densityGPerCm3, DENSITY_G_PER_CM3);
  assert.equal(snapshot.catalogueDensityGPerCm3, 2.7);
  assert.ok(link.issues.some(issue => issue.code === 'MATERIAL_ASSUMED'));
});

test('material snapshot: an unknown requested id stays distinct from the selected density and keeps existing assumed semantics', () => {
  const doc = rodDoc();
  doc.instances![0].doc.bodies!.b1.material = 'unlisted-material-for-snapshot';
  const { link, body, snapshot } = moving(doc);
  assert.equal(link.mass, MASS_G);
  assert.equal(body.mass, MASS_G);
  assert.equal(body.material, 'Aluminium 6061');
  assert.equal(body.assumed, false, 'the existing assumed flag is !inputMaterialId, not a catalogue-membership test');
  assert.equal(snapshot.bodyMaterialId, 'unlisted-material-for-snapshot');
  assert.equal(snapshot.inputMaterialId, 'unlisted-material-for-snapshot');
  assert.equal(snapshot.resolvedMaterialId, 'al6061');
  assert.notEqual(snapshot.inputMaterialId, snapshot.resolvedMaterialId);
  assert.equal(snapshot.fallback, 'unknown-id');
  assert.equal(snapshot.densityGPerCm3, DENSITY_G_PER_CM3);
  assert.equal(snapshot.catalogueDensityGPerCm3, 2.7);
  assert.equal(link.issues.some(issue => issue.code === 'MATERIAL_ASSUMED'), false);
});
