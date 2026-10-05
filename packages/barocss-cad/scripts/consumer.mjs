import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const temp = mkdtempSync(join(tmpdir(), 'cad-consumer-'));
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
try {
  execFileSync('pnpm', ['pack', '--pack-destination', temp], { stdio: 'pipe' });
  const destination = join(temp, 'node_modules/@barocss/cad'); mkdirSync(destination, {recursive:true});
  execFileSync('tar', ['-xzf', join(temp,'barocss-cad-0.0.0-private-experimental.tgz'), '-C',destination,'--strip-components=1']);
  const manifest = JSON.parse(readFileSync(join(destination,'package.json')));
  assert.equal(manifest.private,true); assert.equal(manifest.dependencies,undefined);
  const source = readFileSync(join(root,'examples/cad-nurbs/quarter-circle.css'),'utf8');
  writeFileSync(join(temp,'smoke.mjs'), `import assert from 'node:assert/strict'; import {parseModel,evaluateCurve,exportIGES} from '@barocss/cad'; const m=parseModel(${JSON.stringify(source)}); assert.ok(Math.abs(evaluateCurve(m.objects[0],0.5)[0]-Math.sqrt(50))<1e-9); assert.ok(exportIGES(m,['arc']).iges.includes('126'));`);
  execFileSync(process.execPath,[join(temp,'smoke.mjs')],{stdio:'inherit'});
  writeFileSync(join(temp,'smoke.ts'), "import {parseModel,evaluateCurve,exportIGES} from '@barocss/cad'; import type {Point, Curve} from '@barocss/cad'; const m=parseModel(''); const p:Point=evaluateCurve(m.objects[0] as Curve,0.5); void [p,exportIGES(m,['arc'])];");
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',join(temp,'smoke.ts')],{stdio:'inherit'});
  console.log('Packed CAD ESM, runtime math/export, and external TypeScript consumer passed');
} finally {rmSync(temp,{recursive:true,force:true});}
