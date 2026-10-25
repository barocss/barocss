import test from 'node:test';
import assert from 'node:assert/strict';
import { pathClearanceJson, timedClearanceJson } from '../src/robot/reports';
import { outputSchemaOf, validate } from '../src/chat/contract';

test('public clearance separates a 0.25 path fraction from 0.5 elapsed seconds, with unchanged mm and precision', () => {
  const path = { mm: 12.3456789, s: .25, links: ['a', 'b'] as [string, string] }, timed = { mm: 12.3456789, t: .5, links: ['a', 'b'] as [string, string] };
  const before = JSON.stringify([path, timed]);
  const a = pathClearanceJson(path), b = timedClearanceJson(timed);
  assert.deepEqual(a, { value: 12.345679, fraction: .25, links: ['a', 'b'] });
  assert.deepEqual(b, { value: 12.345679, time: .5, links: ['a', 'b'] });
  assert.ok(a && b); assert.equal('time' in a || 'fraction' in b, false);
  assert.equal('mm' in a || 's' in a || 'mm' in b || 't' in b, false);
  assert.equal(pathClearanceJson(undefined), null); assert.equal(timedClearanceJson(null), null);
  assert.equal(JSON.stringify([path, timed]), before);
});

test('fixed public schemas require canonical clearance fields and reject old mm/s aliases or a time/fraction substitution', () => {
  const path = outputSchemaOf('sweep_path')!.properties!.minClearance, timed = outputSchemaOf('check_path')!.properties!.minClearance;
  assert.deepEqual(validate(path, { value: 7, fraction: .25, links: ['a', 'b'] }), []);
  assert.deepEqual(validate(timed, { value: 7, time: .5, links: ['a', 'b'] }), []);
  assert.deepEqual(validate(path, null), []); assert.deepEqual(validate(timed, null), []);
  for (const wrong of [{ mm: 7, s: .25, links: ['a', 'b'] }, { value: 7, time: .5, links: ['a', 'b'] }]) assert.ok(validate(path, wrong).length);
  for (const wrong of [{ mm: 7, time: .5, links: ['a', 'b'] }, { value: 7, fraction: .25, links: ['a', 'b'] }]) assert.ok(validate(timed, wrong).length);
  assert.equal('min_clearance' in outputSchemaOf('sweep_path')!.properties!, false);
  assert.equal('min_clearance' in outputSchemaOf('check_path')!.properties!, false);
});
