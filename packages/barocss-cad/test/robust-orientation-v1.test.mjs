import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
test('qualified orient2d exact, bounded, and refusal behavior', { timeout: 120000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'barocss-orient2d-'));
  try {
    const output = await build({
      entryPoints:[resolve(root,'packages/barocss-cad/src/robust-orientation-v1.ts')],
      bundle:true, platform:'node', format:'esm', target:'es2022', write:false,
    });
    const file = join(dir,'orientation.mjs');
    writeFileSync(file,output.outputFiles[0].text);
    const { orient2dQualified: orient } = await import(pathToFileURL(file));
    const a={x:0,y:0}, b={x:5,y:0};
    assert.deepEqual(orient(a,b,{x:0,y:3}),
      {status:'exact',sign:'positive',method:'safe-integer-bigint'});
    assert.equal(orient(a,{x:0,y:3},b).sign,'negative');
    assert.equal(orient(a,b,{x:10,y:0}).sign,'zero');
    // Metamorphic invariants: translation must not change exact orientation;
    // swapping two vertices reverses the sign without approximation.
    for (const offset of [-9999, -10, 0, 10, 9990]) {
      const translate = p => ({x:p.x+offset,y:p.y+offset});
      const forward = orient(translate(a),translate(b),translate({x:0,y:3}));
      const reversed = orient(translate(b),translate(a),translate({x:0,y:3}));
      assert.equal(forward.status,'exact');
      assert.equal(forward.sign,'positive');
      assert.equal(reversed.status,'exact');
      assert.equal(reversed.sign,'negative');
    }
    // Repeated identical points have zero determinant even at the boundary.
    assert.equal(orient({x:10000,y:10000},{x:10000,y:10000},
      {x:-10000,y:-10000}).sign,'zero');
    const near=orient({x:0,y:0},{x:0.1,y:0},{x:0.1,y:0.1});
    assert.equal(near.status,'qualified');
    assert.equal(near.sign,'positive');
    const uncertain=orient({x:0,y:0},{x:0.1,y:0},{x:0.2,y:0});
    assert.equal(uncertain.status,'indeterminate');
    const withUncertainty=orient({x:0,y:0},{x:0.1,y:0},{x:0.1,y:0.1},
      {maxAbsCoordinateMM:10000,determinantUncertaintyMM2:1});
    assert.equal(withUncertainty.status,'indeterminate');
    assert.deepEqual(orient(a,b,{x:Infinity,y:0}),
      {status:'unsupported',reason:'non-finite-coordinate'});
    assert.deepEqual(orient(a,b,{x:10001,y:0}),
      {status:'unsupported',reason:'out-of-range-coordinate'});
    assert.equal(orient(null,b,a).status,'unsupported');
    let getterReads = 0;
    const hostile = { y: 1 };
    Object.defineProperty(hostile, 'x', { enumerable: true, get() { getterReads++; return 1; } });
    assert.equal(orient(hostile,b,a).status,'unsupported');
    assert.equal(getterReads,0,'untrusted coordinate getter must never run');
    let optionGetterReads = 0;
    const hostileOptions = { determinantUncertaintyMM2: 0 };
    Object.defineProperty(hostileOptions,'maxAbsCoordinateMM',
      { enumerable:true, get() { optionGetterReads++; return 10000; } });
    assert.equal(orient(a,b,{x:0,y:3},hostileOptions).status,'unsupported');
    assert.equal(optionGetterReads,0,'untrusted options getter must never run');
    assert.equal(orient(a,b,{x:0.1,y:0},{maxAbsCoordinateMM:0,determinantUncertaintyMM2:0}).status,'unsupported');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
