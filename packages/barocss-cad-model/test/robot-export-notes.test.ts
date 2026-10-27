import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluatePart, type BodyResult } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { robotOfDoc } from '../src/chat/robot';
import type { JointTree } from '../src/robot/joints';
import { exportUrdf } from '../src/robot/urdf';
import { exportMjcf } from '../src/robot/mjcf';
import { exportSdf } from '../src/robot/sdf';
import { exportUsd } from '../src/robot/usd';

const exporters = [exportUrdf, exportMjcf, exportSdf, exportUsd] as const;
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);

// Use the existing RM gear assembly, not a manually authored warning/result row.
// A different module on g2 keeps its bore and mate references but prevents gear coupling.
test('a real gear incompatibility stays visible in all four successful exports without changing their payloads', async () => {
  const path = resolve(import.meta.dirname, '../../barocss-cad/conformance/rm/gears/case.json');
  const doc: StudioDoc = JSON.parse(readFileSync(path, 'utf8')).input.document;
  const second = doc.instances?.find(instance => instance.id === 'g2');
  assert.ok(second);
  const gear = second.doc.nodes.find(node => node.kind === 'gear');
  assert.ok(gear && gear.kind === 'gear');
  assert.equal(gear.module, 2);
  gear.module = 2.1;
  const built = await evaluate(doc);
  assert.ok(built.ok);
  const { tree, partOf } = await robotOfDoc(doc, built.bodies as BodyResult[], evaluate);
  const warnings = tree.notes.filter(note => note.code === 'GEAR_NOT_COUPLED');
  assert.ok(warnings.length > 0, 'the real gear check must produce the warning');
  assert.ok(warnings.some(note => /modules.*do not mesh/.test(note.message)));
  assert.equal(tree.couplings.length, 0);
  assert.ok(tree.joints.every(joint => !joint.mimic));
  const snapshot = structuredClone(tree);
  for (const exportRobot of exporters) {
    const result = exportRobot(tree, partOf, 'gear_notes');
    const withoutNotes = exportRobot({ ...tree, notes: [] }, partOf, 'gear_notes');
    assert.ok(result.ok, JSON.stringify(!result.ok && result.refusals));
    assert.ok(withoutNotes.ok, JSON.stringify(!withoutNotes.ok && withoutNotes.refusals));
    for (const warning of tree.notes) assert.ok(result.notes.includes(warning.message));
    assert.deepEqual(result.notes, [...tree.notes.map(note => note.message), ...withoutNotes.notes]);
    assert.deepEqual({ ...result, notes: [] }, { ...withoutNotes, notes: [] },
      'only notes differ; geometry, mass, joint and file outputs stay the same');
    result.notes.push('caller-local change');
    assert.deepEqual(tree, snapshot, 'export and returned notes do not mutate the input tree');
  }
});

test('tree notes do not turn an existing typed export refusal into success', () => {
  const tree: JointTree = { version: 1, base: 'base', links: [], joints: [], loops: [], couplings: [],
    problems: [{ code: 'MOTION_UNSUPPORTED', message: 'unsupported motion' }],
    notes: [{ code: 'GEAR_NOT_COUPLED', message: 'unit-contract warning' }] };
  for (const exportRobot of exporters) {
    const result = exportRobot(tree, () => null, 'refused');
    const withoutNotes = exportRobot({ ...tree, notes: [] }, () => null, 'refused');
    assert.equal(result.ok, false);
    assert.deepEqual(result, withoutNotes);
    if (!result.ok) assert.deepEqual(result.refusals.map(refusal => refusal.code), ['MOTION_UNSUPPORTED', 'EMPTY']);
  }
});
