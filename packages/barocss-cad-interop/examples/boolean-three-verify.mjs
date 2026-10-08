import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { evaluateCurve, validateCoplanarFaceBoolean } from '@barocss/cad';
import { Line, Scene } from 'three';
import { BaroCADLoader } from '@barocss/cad-interop/three';
import { createBaroCadBooleanThreeContours } from '@barocss/cad-interop/three-boolean-contours';

const fixtures = [
  ['containment_hole', 111465, '5acc31a130188b90fd9b4372cd363d888d8267baed1ef0fe60d1655aa137af21', 1, 2, 8],
  ['strip_two_components', 183376, '5d911a4f60fc2c1d88affd0476b0544544fb8cf57f07d61508f73a88d543a25f', 2, 2, 8],
  ['coincident_difference', 33515, '3e55056c94fa10d77a38cf7e0dab54842704b4b400fe84e74a5efe5b5587516b', 0, 0, 0],
  ['octagons_two_chunks', 238126, '80372d62ce5d5a83c64148885f9dad475c8a812af43bc04855ea531a91bf0dc7', 2, 2, 16],
];
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.01,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup' };
const read = ([name, bytes, hash]) => {
  const source = readFileSync(new URL(`./boolean-three-data/${name}.owned-region.json`, import.meta.url));
  assert.equal(source.length, bytes);
  assert.equal(createHash('sha256').update(source).digest('hex'), hash);
  const result = JSON.parse(source.toString('utf8'));
  assert.deepEqual(validateCoplanarFaceBoolean(result), result.report);
  return result;
};
const results = fixtures.map(read);
let pointWitnesses = 0, ownedDisposed = 0;
for (const [index, result] of results.entries()) {
  const [name, , , components, loops, fragments] = fixtures[index];
  const before = structuredClone(result);
  const scene = new Scene();
  const caller = new Line(); caller.name = 'caller'; scene.add(caller);
  const parsed = [];
  const originalParse = BaroCADLoader.prototype.parse;
  let display;
  try {
    BaroCADLoader.prototype.parse = function (source) {
      const loaded = originalParse.call(this, source);
      parsed.push(loaded);
      return loaded;
    };
    display = createBaroCadBooleanThreeContours(result, options);
  } finally { BaroCADLoader.prototype.parse = originalParse; }
  scene.add(display.root);
  assert.equal(display.componentGroups.length, components, name);
  assert.equal(display.loopGroups.length, loops, name);
  assert.equal(display.bindings.length, fragments, name);
  assert.equal(parsed.length, fragments, name);
  assert.ok(display.bindings.every(binding => binding.line instanceof Line &&
    binding.line.parent?.name === binding.loopId && binding.line.name === binding.source.curveId));
  assert.ok(!display.root.getObjectByProperty('type', 'Mesh'));
  assert.equal(display.root.children.length, components);
  for (const binding of display.bindings) {
    const fragment = result.fragments.find(value => value.id === binding.fragmentId);
    const attr = binding.line.geometry.getAttribute('position');
    const parameters = binding.line.userData.barocss.nativeParameters;
    assert.deepEqual(binding.source, fragment.source);
    assert.deepEqual(binding.contributor, fragment.contributor);
    assert.deepEqual(binding.interval, fragment.interval);
    assert.deepEqual(binding.traversalInterval, fragment.traversalInterval);
    assert.equal(binding.pcurve.lengthUnit, 'dimensionless');
    for (const sampleIndex of [0, Math.floor((parameters.length - 1) / 2), parameters.length - 1]) {
      const nativePoint = evaluateCurve(fragment.curve, parameters[sampleIndex]);
      const target = [attr.getX(sampleIndex), attr.getY(sampleIndex), attr.getZ(sampleIndex)];
      nativePoint.forEach((value, axis) => assert.ok(
        Math.abs(target[axis] - value * native.unitsPerMillimeter) < 1e-6,
        `${name}/${binding.fragmentId}/${sampleIndex}/${axis}`));
      pointWitnesses++;
    }
  }
  const owned = display.bindings.map(binding => binding.line);
  const disposeEvents = [];
  for (const object of owned) {
    object.geometry.addEventListener('dispose', () => disposeEvents.push(object.geometry));
    object.material.addEventListener('dispose', () => disposeEvents.push(object.material));
  }
  display.dispose(); display.dispose();
  assert.ok(!scene.children.includes(display.root) && scene.children.includes(caller));
  assert.ok(display.loopGroups.every(group => group.children.length === 0));
  assert.ok(parsed.every(value => value.group.children.length === 0));
  assert.equal(disposeEvents.length, new Set(owned).size * 2);
  ownedDisposed += new Set(owned).size;
  assert.deepEqual(result, before);
  scene.clear();
}

const accepted = createBaroCadBooleanThreeContours(results[0], options);
const invalid = structuredClone(results[0]); invalid.fragments[0].source.curveId = 'forged';
let refused = 0;
const refuse = action => { assert.throws(action); refused++; };
refuse(() => createBaroCadBooleanThreeContours(invalid, options));
refuse(() => createBaroCadBooleanThreeContours(results[0], { ...options, basis: 'unknown' }));
refuse(() => createBaroCadBooleanThreeContours(results[0], { ...options,
  native: { ...native, curveDisplay: undefined } }));
let getterCalls = 0;
const getter = { ...options };
Object.defineProperty(getter, 'basis', { enumerable: true, get() { getterCalls++; return options.basis; } });
refuse(() => createBaroCadBooleanThreeContours(results[0], getter));
assert.equal(getterCalls, 0);

const staged = [];
const originalParse = BaroCADLoader.prototype.parse;
try {
  BaroCADLoader.prototype.parse = function (source) {
    const loaded = originalParse.call(this, source);
    const originalDispose = loaded.dispose;
    let disposed = false;
    loaded.dispose = () => { disposed = true; originalDispose(); };
    staged.push({ loaded, isDisposed: () => disposed });
    if (staged.length === 2) loaded.model.name = 'forged_second_source';
    return loaded;
  };
  refuse(() => createBaroCadBooleanThreeContours(results[3], options));
} finally { BaroCADLoader.prototype.parse = originalParse; }
assert.equal(staged.length, 2);
assert.ok(staged.every(value => value.isDisposed() && value.loaded.group.children.length === 0));
assert.ok(accepted.bindings.every(binding => binding.line.geometry.getAttribute('position')));
accepted.dispose();
console.log(JSON.stringify({ fixtures: fixtures.map(value => value[0]), fragments: fixtures.map(value => value[5]),
  pointWitnesses, refused, stagedSourcesDisposed: staged.length, ownedDisposed,
  emptyAccepted: true, callerSceneRetained: true }));
