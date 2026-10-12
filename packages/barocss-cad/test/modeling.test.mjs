import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const api = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
const { cad, CadModelError } = api;
function refuses(fn, code) { assert.throws(fn, e => { assert.ok(e instanceof CadModelError, String(e)); if (code) assert.equal(e.code,code); return true; }); }
test('owned authoring inputs, handles and unsupported recipes refuse without geometry', () => {
  const a=cad.model(), b=cad.model(), p=a.parameter('width',8), x=a.sketch.rectangle({width:p,height:8}).extrude(8), y=b.sketch.rectangle({width:8,height:8}).extrude(8);
  refuses(()=>a.parameter('width',9),'PARAMETER'); refuses(()=>a.parameter('__proto__',9),'INPUT');
  refuses(()=>a.parameter('bad',Infinity),'PARAMETER'); refuses(()=>a.sketch.rectangle({width:8,height:8,min:[0,0]}),'INPUT');
  refuses(()=>b.sketch.rectangle({width:p,height:8}),'OWNERSHIP'); refuses(()=>x.cut(y,{axis:'x'}),'OWNERSHIP');
  refuses(()=>a.build({foreign:y}),'OWNERSHIP'); refuses(()=>x.chamfer(y.edges({}).one(),1),'OWNERSHIP');
  const other=a.sketch.rectangle({width:16,height:16}).extrude(8);
  refuses(()=>x.chamfer(other.edges({}).one(),1),'OWNERSHIP');
  const cut=x.cut(other,{axis:'x'}); refuses(()=>cut.positive.cut(other,{axis:'x'}),'CAPABILITY');
  let invoked=0; const getter={get width(){invoked++;return 8;},height:8}; refuses(()=>b.sketch.rectangle(getter),'INPUT'); assert.equal(invoked,0);
  const hostile = [[0,0],[8,0],[8,8],[0,8]]; Object.setPrototypeOf(hostile, {map(){invoked++;return [];}}); refuses(()=>b.sketch.polygon(hostile),'INPUT'); assert.equal(invoked,0);
  class ArraySubclass extends Array { static get [Symbol.species]() { invoked++; return Array; } }
  refuses(()=>b.sketch.polygon(new ArraySubclass([0,0],[8,0],[8,8])),'INPUT'); assert.equal(invoked,0);
  refuses(()=>cad.load('{"format":"x","format":"y"}'),'FORMAT'); refuses(()=>cad.load(' '.repeat(65537)),'BUDGET');
  refuses(()=>cad.load('{"format":"old","schema":2,"units":"mm","parameters":{},"nodes":[],"outputs":{}}'),'FORMAT');
});
