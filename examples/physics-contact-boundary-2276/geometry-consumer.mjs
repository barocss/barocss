import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as m from './geometry-entry.js';
import { controls } from '../physics-rigid-feature-geometry/controls.mjs';
import { observer } from '../physics-rigid-contact-diagnostic/observer.mjs';

const [fixturePath, out, referencePath] = process.argv.slice(2);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const generated = { version: 1, cases: [] }, pairRecords = [];
const reference = observer(referencePath);
function save(name, data) { writeFileSync(join(out, name + '.json'), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); }
function restoreBodies(source, rawHex) {
  const bodies = structuredClone(source), bytes = Buffer.from(rawHex, 'hex'); let offset = 0;
  for (const body of bodies) for (const [field, count] of [['positionM', 3], ['velocityMps', 3], ['orientation', 4], ['angularVelocityRadps', 3]]) {
    body[field] = Array.from({ length: count }, () => { const value = bytes.readDoubleLE(offset); offset += 8; return value; });
  }
  assert.equal(offset, bytes.length); return bodies;
}
function operands(points) {
  const bytes = Buffer.alloc(points.length * 48); let offset = 0;
  for (const point of points) for (const value of [...point.pointM, ...point.normal]) { bytes.writeDoubleLE(value, offset); offset += 8; }
  return bytes.toString('hex');
}
try {
  for (const selected of fixture.cases) {
    const bodies = restoreBodies(selected.freeBodies, selected.freeBodyRawHex), saved = structuredClone(bodies);
    const groups = new Map();
    for (const point of selected.originalPointLedger) {
      if (!groups.has(point.pairKey)) groups.set(point.pairKey, []);
      groups.get(point.pairKey).push(point);
    }
    const replacement = new Map();
    for (const [pairKey, original] of groups) {
      const a = bodies[original[0].aIndex], b = bodies[original[0].bIndex];
      const geometry = m.featureContact(a, b);
      assert.ok(geometry && geometry.family === 'face');
      assert.equal(geometry.points.length, original.length, 'row count changed');
      for (let i = 0; i < original.length; i++) {
        assert.equal(geometry.points[i].key, original[i].pointId, 'point identity/order changed');
        replacement.set(pairKey + '\0' + original[i].pointId, { ...structuredClone(original[i]),
          pointM: [...geometry.points[i].midpointM], normal: [...geometry.planeNormalAtoB] });
      }
      assert.deepEqual(bodies, saved, 'generator changed input');
      assert.deepEqual(m.featureContact(a, b), geometry, 'same-input geometry differs');
      const result = await reference.ask({ a, b, geometry });
      pairRecords.push({ caseId: selected.caseId, pairKey, geometry, reference: result });
      assert.ok(result.ok && result.resolved, 'paired surface reference: ' + JSON.stringify(result.violations));
    }
    const pointLedger = selected.originalPointLedger.map(point => replacement.get(point.pairKey + '\0' + point.pointId));
    assert.equal(pointLedger.length, 32);
    generated.cases.push({ caseId: selected.caseId, pointLedger, pointOperandF64leHex: operands(pointLedger) });
  }
  save('generated', generated); save('paired-witnesses', pairRecords);
  const result = await controls(m, reference); save('controls', result);
  assert.equal(reference.stderr(), '');
  process.stdout.write(JSON.stringify({ cases: generated.cases.length, rows: generated.cases.reduce((n, c) => n + c.pointLedger.length, 0),
    pairedReferences: pairRecords.length, featureControls: result.passed }) + '\n');
} catch (error) {
  save('generation-failure', { name: error.name, message: error.message, partial: generated, pairedWitnesses: pairRecords });
  throw error;
} finally { reference.close(); }
