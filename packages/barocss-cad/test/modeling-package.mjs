// Build first. Verify the actual public package artifact without executing geometry.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const temp = mkdtempSync(join(tmpdir(), 'cad-model-public-'));
try {
  execFileSync('pnpm', ['pack', '--pack-destination', temp], { cwd: resolve(import.meta.dirname, '..'), stdio: 'pipe' });
  const archives = readdirSync(temp).filter(n => n.endsWith('.tgz')); assert.equal(archives.length, 1);
  console.log('Packed artifact SHA256 ' + createHash('sha256').update(readFileSync(join(temp, archives[0]))).digest('hex'));
  const destination=join(temp,'node_modules/@barocss/cad');mkdirSync(destination,{recursive:true});
  execFileSync('tar',['-xzf',join(temp,archives[0]),'-C',destination,'--strip-components=1']);
  const manifest=JSON.parse(readFileSync(join(destination,'package.json'),'utf8'));
  assert.equal(manifest.private,false);assert.equal(manifest.exports['.'].import,'./dist/index.js');assert.equal(manifest.exports['.'].types,'./dist/index.d.ts');
  writeFileSync(join(temp,'package.json'),' {"type":"module"} ');
  writeFileSync(join(temp,'consumer.mjs'),"import assert from 'node:assert/strict';import{cad,CadModelError,CadModelLimits}from'@barocss/cad';const m=cad.model();const p=m.parameter('width',32);m.sketch.rectangle({width:p,height:16}).extrude(8);assert.equal(typeof cad.load,'function');assert.equal(CadModelLimits.cuts,1);assert.throws(()=>m.parameter('width',33),e=>e instanceof CadModelError);console.log('PASS public packed modeling import and ownership');");
  writeFileSync(join(temp,'consumer.ts'),"import{cad,type CadModelSnapshot}from'@barocss/cad';const m=cad.model();const p=m.parameter('width',32);const shape=m.sketch.rectangle({width:p,height:16}).extrude(8);const result:CadModelSnapshot=m.build({part:shape});const open=cad.load(result.withParameters({width:40}).save());if(open.bodies.part.family!=='convex-planar')throw new Error('Expected convex part');open.bodies.part.native.certificate.volumeMM3;");
  execFileSync(process.execPath,[join(temp,'consumer.mjs')],{stdio:'inherit'});
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--strict','--target','es2022','--module','nodenext','--moduleResolution','nodenext','--skipLibCheck','--noEmit',join(temp,'consumer.ts')],{stdio:'inherit'});
  console.log('PASS public packed modeling declarations; geometry deliberately not executed');
}finally{rmSync(temp,{recursive:true,force:true});}
