import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS_DATA, checkMaterials, printerProfile, processProfile } from '../src/library/materials';

// AM (D72–): 3D printing — process and printer profiles (AM1).
test('AM1 profiles: five processes (SLS and MJF added), every printing one with every printing threshold sourced; five generic printers on printing processes with their build volumes; the data checks clean', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  assert.deepEqual(MATERIALS_DATA.profiles.map(p => [p.id, !!p.additive]), [['injection', false], ['fdm', true], ['sla', true], ['sls', true], ['mjf', true]]);
  for (const p of MATERIALS_DATA.profiles.filter(x => x.additive)) for (const k of ['minWallUnsupported', 'maxOverhangDeg', 'maxBridgeMM', 'minHoleMM', 'fitGap', 'escapeHoleMM', 'escapeHoles', 'horizontalHoleMM']) {
    const t = p.thresholds[k]; assert.ok(t && Number.isFinite(t.value) && t.source in MATERIALS_DATA.sources, `${p.id}.${k}`);
  }
  // (Powder supports itself: no overhang limit, escape holes for the powder; FDM needs none.)
  assert.deepEqual([processProfile('sls')!.thresholds.maxOverhangDeg.value, processProfile('sls')!.thresholds.escapeHoles.value, processProfile('fdm')!.thresholds.escapeHoles.value], [90, 2, 0]);
  assert.deepEqual(MATERIALS_DATA.printers.map(p => [p.id, p.process]), [['fdm-256', 'fdm'], ['fdm-220', 'fdm'], ['sla-desktop', 'sla'], ['sls-300', 'sls'], ['mjf-380', 'mjf']]);
  assert.deepEqual(printerProfile('fdm-256')!.buildMM, [256, 256, 256]);
  // A broken entry is caught: a printer on a moulding process, a threshold missing.
  const bad = { ...MATERIALS_DATA, printers: [...MATERIALS_DATA.printers, { ...MATERIALS_DATA.printers[0], id: 'x', process: 'injection' }], profiles: MATERIALS_DATA.profiles.map(p => p.id === 'sla' ? { ...p, thresholds: { ...p.thresholds, minHoleMM: undefined as never } } : p) };
  const problems = checkMaterials(bad as never);
  assert.ok(problems.includes('printer x: injection is not a printing process') && problems.includes('sla: no minHoleMM'), problems.join(' | '));
});
