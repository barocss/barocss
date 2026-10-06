import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCadModel } from '../dist/index.js';
import * as api from '../dist/index.js';

test('the public namespace exposes one source compiler without old compiler aliases', () => {
  assert.equal(typeof api.compileCadModel, 'function');
  for (const name of ['parseModel', 'compileConstruction', 'CadSyntaxError', 'ConstructionSyntaxError']) assert.equal(Object.hasOwn(api, name), false);
});

test('undefined and wrong-kind references have distinct source diagnostics', () => {
  const source = '@model m {version:1;length-unit:mm;@curve #c {type:nurbs;degree:1;knots:[0,0,1,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}@extrude #s {curve:#c;vector:[0,0,1];}@extrude #t {curve:#INPUT;vector:[0,1,0];}}';
  const absent = source.replace('#INPUT', '#absent'), wrong = source.replace('#INPUT', '#s');
  const a = compileCadModel(absent, { sourceVersion: 1 }), b = compileCadModel(wrong, { sourceVersion: 1 });
  assert.equal(a.ok, false); assert.equal(b.ok, false);
  assert.match(a.diagnostics[0].message, /Undefined curve reference/);
  assert.match(b.diagnostics[0].message, /has kind extrude; a curve is required/);
  assert.notEqual(a.diagnostics[0].message, b.diagnostics[0].message);
  assert.equal(a.diagnostics[0].objectId, 't'); assert.equal(b.diagnostics[0].objectId, 't');
});

test('surface axis failures do not blame a valid field and knot count diagnostics remain distinct', () => {
  const surface = '@surface #s {type:nurbs;degree-u:1;degree-v:0;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:[[[0,0,0],[0,1,0]],[[1,0,0],[1,1,0]]];weights:[[1,1],[1,1]];}';
  for (const declaration of [surface, surface.replace('degree-u:1;degree-v:0;', 'degree-v:0;degree-u:1;')]) {
    const source = '@model m {version:0;length-unit:mm;' + declaration + '}';
    const result = compileCadModel(source, { sourceVersion: 0 });
    assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, 'DEGREE');
    const { start, end } = result.diagnostics[0].range;
    assert.equal(source.slice(start, end), declaration);
  }
  const source = '@model m {version:0;length-unit:mm;@curve #c {type:nurbs;degree:1;knots:[0,0,1];control-points:[[0,0,0],[1,0,0]];weights:[1,1];}}';
  const result = compileCadModel(source, { sourceVersion: 0 });
  assert.equal(result.ok, false); assert.equal(result.diagnostics[0].code, 'KNOTS');
  assert.equal(source.slice(result.diagnostics[0].range.start, result.diagnostics[0].range.end), '[0,0,1]');
});
