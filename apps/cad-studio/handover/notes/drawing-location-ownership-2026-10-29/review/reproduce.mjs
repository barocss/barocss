// Synthetic projection-level controls. This does not evaluate kernel geometry or run Studio.
// Usage: node /tmp/d331/review/reproduce.mjs /absolute/worktree
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(process.argv[2]);
const require = createRequire(root + '/packages/barocss-cad-model/package.json');
const { build } = require('esbuild');
for (const file of ['src/drawing/measurement.ts', 'src/drawing/auto.ts', 'src/drawing/issues.ts']) {
  const bytes = readFileSync(root + '/packages/barocss-cad-model/' + file);
  console.log('source_sha256', file, createHash('sha256').update(bytes).digest('hex'));
}
const result = await build({stdin:{contents:`import { sameLinearDependency, samePointDependency } from './src/drawing/measurement.ts'; export { sameLinearDependency, samePointDependency };`,resolveDir:root+'/packages/barocss-cad-model',loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {sameLinearDependency,samePointDependency}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const end0={edge:'n0.side0|n0.top0',at:'end',near:[0,0,0]}, end1={...end0,near:[10,0,0]};
const forward={ok:true,kind:'linear',dim:{kind:'linear',a:end0,b:end1,count:3}}, reverse={ok:true,kind:'linear',dim:{kind:'linear',a:end1,b:end0,count:3}};
console.log('counted_reversed_same_owner_dependency',sameLinearDependency(forward,{},reverse,{},'X'));
const ca={center:[10,20,0],normal:[0,0,1],radius:3}, cb={center:[10,20,20],normal:[0,0,1],radius:3};
const a={edge:'n0.face|n2.side0',at:'center',near:ca.center}, b={edge:'n0.face|n5.side0',at:'center',near:cb.center}, pr={edges:[{name:a.edge,circle:ca},{name:b.edge,circle:cb}]};
console.log('independent_coaxial_equal_cbore_dependency',samePointDependency(a,pr,b,pr,'X',()=> 'Ø6 THRU  CBORE Ø11 × 6 DEEP'));
