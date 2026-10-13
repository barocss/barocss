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
    assert.equal(orient(a,b,{x:0.1,y:0},{maxAbsCoordinateMM:0,determinantUncertaintyMM2:0}).status,'unsupported');
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
