import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { emptyDoc, rectanglePart, withNode, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { solveDoc } from '@barocss/cad-model/assembly/edit';
import { jointsOfInstance, setInstanceJoints, type InstanceJoint } from '@barocss/cad-model/assembly/flexible';
import type { Mate } from '@barocss/cad-model/assembly/mates';
import { InstancePanel } from '../src/ui/InstancePanel';
import { InstanceJointsControls, jointsEdit, limitsText } from '../src/ui/InstanceJoints';

// Roadmap 10 4 (RS7.4): the Instance panel's JOINTS (this occurrence) section for a sub-assembly occurrence: a row per
// joint with its value in degrees (mm for a slide) and limits, Apply on Enter or blur, Reset back to the saved pose.
const plate = (w: number, d: number, h: number, c: [number, number]) => { const p = rectanglePart(w, d, h); return withNode(p, { kind: 'hole', parent: { node: p.nodes.length - 1, side: 'solid' }, center: c, radius: 5 } as never); };
const mate = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string]): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] } });
const lid: PartInstance = { id: 'lid', name: 'Lid', doc: plate(60, 20, 5, [10, 10]), position: [0, 0, 30], rotation: [0, 0, 0] };
const sub = solveDoc({ ...plate(100, 40, 10, [20, 20]), robot: { version: 1, joints: { 'base~lid': { lower: 0, upper: 120 } } }, instances: [lid], mates: [mate('c', 'concentric', ['base', 'n2.side0'], ['lid', 'n2.side0']), mate('f', 'coincident', ['base', 'n1.top'], ['lid', 'n1.bottom'])] }).doc;
const door: PartInstance = { id: 'door', name: 'Door', doc: sub, position: [0, 0, 0], rotation: [90, 0, 0], grounded: true };
const html = (inst: PartInstance) => renderToStaticMarkup(createElement(InstanceJointsControls, { inst, onSet() {}, onReset() {} }));

test('jointsEdit sends only a box that holds a number that is not the value already (empty and unfinished boxes are left)', () => {
  const joints: InstanceJoint[] = [{ key: 'a~b', type: 'revolute', parent: 'a', child: 'b', value: 10 }, { key: 'b~c', type: 'prismatic', parent: 'b', child: 'c', value: 5, lower: 0, upper: 20 }];
  assert.deepEqual(jointsEdit(joints, {}), {});
  assert.deepEqual(jointsEdit(joints, { 'a~b': '10', 'b~c': '' }), {}, 'unchanged and empty');
  assert.deepEqual(jointsEdit(joints, { 'a~b': '45', 'b~c': '-' }), { 'a~b': 45 }, 'an unfinished box is not a number');
  assert.deepEqual(jointsEdit([joints[1]], { 'b~c': '7.5' }), { 'b~c': 7.5 });
  assert.equal(limitsText(joints[0]), ''); assert.equal(limitsText(joints[1]), '0 to 20 mm');
});

test('a hinge occurrence shows its joint with its limits and value; a plain part and a sub-assembly without joints show nothing', () => {
  const open = setInstanceJoints({ ...emptyDoc(), instances: [door] }, { part: 'door', joints: { 'base~lid': 30 } }).doc.instances![0];
  const shown = html(open);
  assert.match(shown, /JOINTS \(THIS OCCURRENCE\)/); assert.match(shown, /aria-label="Joint base~lid"/); assert.match(shown, /value="30"/); assert.match(shown, /0 to 120 °/);
  assert.match(shown, /Reset/);
  assert.match(html(door), /value="0"/);
  assert.doesNotMatch(html(door), /role="alert"/);
  assert.equal(html({ ...door, doc: plate(10, 10, 10, [5, 5]) }), '');
  assert.equal(jointsOfInstance({ ...door, doc: { ...sub, mates: [] } }).joints.length, 0);
  assert.equal(html({ ...door, doc: { ...sub, mates: [] } }), '');
});

test('a stored value the sub-assembly no longer reads is shown in words and still resettable; Reset clears it', () => {
  const stale: PartInstance = { ...door, joints: { gone: 1 } };
  const shown = html(stale);
  assert.match(shown, /role="alert"/); assert.match(shown, /has no joint &quot;gone&quot;/);
  const cleared = setInstanceJoints({ ...emptyDoc(), instances: [stale] }, { part: 'door', joints: {}, replace: true }).doc.instances![0];
  assert.equal('joints' in cleared, false);
});

test('one undo step: setInstanceJoints returns one new document, the previous one untouched; the saved file keeps the values', () => {
  const before: StudioDoc = { ...emptyDoc(), instances: [door] }, after = setInstanceJoints(before, { part: 'door', joints: { 'base~lid': 60 } }).doc;
  assert.equal(before.instances![0].joints, undefined);
  assert.ok(Math.abs(after.instances![0].joints!['base~lid'] - Math.PI / 3) < 1e-12);
  assert.deepEqual((JSON.parse(JSON.stringify(after)) as StudioDoc).instances![0].joints, after.instances![0].joints);
});

test('M1: a driven pattern occurrence offers no joint controls (its seed has them)', () => {
  const props = { bodies: undefined, onChange() {}, onDuplicate() {}, onRemove() {} };
  const joints = createElement(InstanceJointsControls, { inst: door, onSet() {}, onReset() {} });
  assert.match(renderToStaticMarkup(createElement(InstancePanel, { ...props, inst: door, joints })), /Instance joints/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(InstancePanel, { ...props, inst: { ...door, pattern: { id: 'pat1', k: 1 } }, joints })), /Instance joints/);
});
