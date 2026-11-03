// Root-only source transform. No candidate/runtime evaluation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url));
const productionFiles=Object.freeze(['candidate.ts','math-core.ts','production-context.ts','production-entry.ts','limits.ts','types.ts']);

/** Builder must authenticate the complete lifecycle/arithmetic03 inventories first. */
export function transformDynamicHostStage({stage,productionSourceDir}){
  const qualified=resolve(home,'../physics-coupled-arithmetic-2276/evidence/build-03/stage/physics-coupled-arithmetic-2276');
  assert.equal(realpathSync(productionSourceDir),realpathSync(qualified),'Only actual qualified arithmetic03 source');
  const src=resolve(stage,'physics/src'),destination=resolve(stage,'D');
  assert(readFileSync(resolve(stage,'C/candidate.ts')).equals(readFileSync(resolve(productionSourceDir,'../physics-coupled-contact-2276/candidate.ts'))),'Original qualified static C bytes unchanged');
  mkdirSync(destination);
  for(const name of productionFiles)copyFileSync(resolve(productionSourceDir,name),resolve(destination,name));
  const from='../physics-coupled-contact-2276/candidate.js',to='../C/candidate.js';
  const relocations=Object.freeze([['candidate.ts',1],['types.ts',2],['production-entry.ts',1]]);
  for(const[name,count]of relocations){
    const path=resolve(destination,name),text=readFileSync(path,'utf8');
    assert.equal(text.split(from).length-1,count,'Exact static import relocation '+name);
    writeFileSync(path,text.replaceAll(from,to));
  }
  copyFileSync(resolve(home,'coupled-plan.ts'),resolve(src,'coupled-plan.ts'));
  const once=(text,old,replacement)=>{assert.equal(text.split(old).length-1,1,'Unique actual lifecycle source anchor');return text.replace(old,replacement);};
  const path=resolve(src,'persistent-box-contact.ts');
  let text=readFileSync(path,'utf8');
  text=once(text,"'Coupled static target forbids restitution'","'Coupled target forbids restitution'");
  text=once(text,"phaseKind('coupled-static',{targetApplied:first,", "phaseKind(plan.target.status==='DYNAMIC_TARGET'?'coupled-dynamic':'coupled-static',{targetStatus:plan.target.status,targetApplied:first,");
  writeFileSync(path,text);
  const entry=resolve(stage,'entry.ts'),entryText=readFileSync(entry,'utf8');
  assert.equal(entryText.split("export {coupledStaticTarget} from './C/candidate.js';").length-1,1);
  assert.equal(entryText.includes('coupledContactTarget'),false,'No duplicate dynamic helper entry');
  writeFileSync(entry,entryText+"export {coupledContactTarget} from './D/production-entry.js';\n");
  return {productionSourceDir:realpathSync(productionSourceDir),productionFiles:[...productionFiles],
    importRelocations:relocations.map(([file,count])=>({file,from,to,count})),
    changedAncestor:['physics/src/coupled-plan.ts','physics/src/persistent-box-contact.ts','entry.ts'],
    untouchedAuthority:['physics/src/world.ts','physics/src/producer.ts','physics/src/private-phase.ts','physics/src/lifecycle-capture.ts','C/candidate.ts'],
    runtimeTestEntry:'EXCLUDED_NO_TEST_FILES_COPIED'};
}
