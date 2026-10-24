import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS_DATA, checkMaterials, printerProfile, processProfile } from '../src/library/materials';

test('canonical printer profiles preserve all five mm vectors, scalar layers and optional nozzles', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  assert.deepEqual(MATERIALS_DATA.printers.map(p => [p.id, p.buildVolume, p.layerHeight, p.nozzleDiameter ?? null]), [
    ['fdm-256', [256, 256, 256], 0.2, 0.4], ['fdm-220', [220, 220, 250], 0.2, 0.4],
    ['sla-desktop', [145, 145, 185], 0.05, null], ['sls-300', [300, 300, 300], 0.1, null],
    ['mjf-380', [380, 284, 380], 0.08, null],
  ]);
  for (const p of MATERIALS_DATA.printers) {
    assert.equal(printerProfile(p.id), p); assert.equal(p.source, 'P-PRN');
    assert.ok(Array.isArray(p.buildVolume) && p.buildVolume.length === 3);
    assert.equal(typeof p.layerHeight, 'number');
    for (const old of ['buildMM', 'layerMM', 'nozzleMM']) assert.ok(!(old in p));
    if (p.process !== 'fdm') assert.ok(!('nozzleDiameter' in p));
  }
  assert.equal(printerProfile('unknown'), undefined);
});

test('canonical mould finishes retain degree values and source pages; threshold lookup IDs remain separate', () => {
  const finishes = processProfile('injection')!.finishes!;
  assert.deepEqual(finishes.map(f => [f.id, f.draftMin, f.draftRecommended ?? null]), [['smooth', 0.5, 1], ['pm-t1', 3, null], ['pm-t2', 5, null]]);
  for (const f of finishes) {
    assert.equal(f.source, 'W-WEB'); assert.equal(f.page!.read, '2026-10-21');
    assert.match(f.page!.url, /^https:\/\/www\.protolabs\.com\//);
    assert.ok(!('draftMinDeg' in f) && !('draftRecDeg' in f));
    if (f.id !== 'smooth') assert.ok(!('draftRecommended' in f));
  }
  const thresholds = MATERIALS_DATA.profiles.filter(p => p.thresholds.draftRecDeg).map(p => [p.id, p.thresholds.draftRecDeg.unit]);
  assert.deepEqual(thresholds, [['injection', 'deg'], ['fdm', 'deg'], ['sla', 'deg'], ['sls', 'deg'], ['mjf', 'deg']]);
});

test('canonical profile validator retains existing build, layer, process, finish and page rules', () => {
  const badBed = { ...MATERIALS_DATA, printers: MATERIALS_DATA.printers.map((p, i) => i ? p : { ...p, buildVolume: [0, 256, 256] as const }) };
  assert.ok(checkMaterials(badBed).includes('printer fdm-256: its build volume or layer'));
  const badLayer = { ...MATERIALS_DATA, printers: MATERIALS_DATA.printers.map((p, i) => i ? p : { ...p, layerHeight: 0 }) };
  assert.ok(checkMaterials(badLayer).includes('printer fdm-256: its build volume or layer'));
  const badProcess = { ...MATERIALS_DATA, printers: MATERIALS_DATA.printers.map((p, i) => i ? p : { ...p, process: 'injection' }) };
  assert.ok(checkMaterials(badProcess).includes('printer fdm-256: injection is not a printing process'));
  for (const change of [{ draftMin: -1 }, { draftMin: 45 }, { draftRecommended: 0.25 }, { page: undefined }]) {
    const bad = { ...MATERIALS_DATA, profiles: MATERIALS_DATA.profiles.map(p => p.id !== 'injection' ? p : { ...p, finishes: p.finishes!.map((f, i) => i ? f : { ...f, ...change }) }) };
    assert.ok(checkMaterials(bad).some(p => p.startsWith('injection.finish smooth:')));
  }
});
