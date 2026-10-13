/** #1572 pass-count convergence counterfactual; no tracked Physics files changed.
 * Fail closed if the production World pair-iteration anchor ever drifts.
 */
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const temporary=await mkdtemp(join(tmpdir(),'p1572-pair-order-'));
let hooks=0;
try{
  const outfile=join(temporary,'counterfactual.mjs');
  await build({
    entryPoints:[resolve('examples/physics-contact-impulse-audit-1572/pass-count-convergence.ts')],
    outfile,bundle:true,platform:'node',format:'esm',target:'node22',
    plugins:[{name:'temporary-pair-order-1572',setup(api){
      api.onLoad({filter:/world\.ts$/},async args=>{
        hooks++;
        let source=await readFile(args.path,'utf8');
        const passLoop='      for (let pass = 0; pass < SOLVER_PASSES; pass++) {';
        if(source.split(passLoop).length!==2)
          throw Error('PASS_CONVERGENCE_SOURCE_LOOP_MISMATCH');
        source=source.replace(passLoop,
          '      for (let pass = 0; pass < ((globalThis as {__p1572PassCount?: number}).__p1572PassCount ?? SOLVER_PASSES); pass++) {');
        const original='        for (const [aIndex, bIndex] of pairs) {';
        if(source.split(original).length!==2)
          throw Error('PAIR_ORDER_EXACT_WORLD_SOURCE_MISMATCH');
        const transformed=`
        const __pairOrder=(globalThis as {__p1572PairOrder?:string}).__p1572PairOrder;
        const __supportRank=(pair:[number,number]):number=>{
          const key=next[pair[0]].id+'/'+next[pair[1]].id;
          if(key==='b0/floor')return 0;
          if(key==='b0/b1')return 1;
          if(key==='b1/b2')return 2;
          return 3;
        };
        const __orderedPairs=__pairOrder==='supportUp'||__pairOrder==='supportDown'
          ? [...pairs].sort((left,right)=>{
              const a=__supportRank(left),b=__supportRank(right);
              const first=__pairOrder==='supportUp'?a:(a===3?10:2-a);
              const second=__pairOrder==='supportUp'?b:(b===3?10:2-b);
              return first-second;
            })
          : (__pairOrder==='reverse'||(__pairOrder==='alternate'&&pass%2===1))
            ? [...pairs].reverse():pairs;
        for (const [aIndex,bIndex] of __orderedPairs) {
          (globalThis as {__p1572PairVisit?:(event:unknown)=>void}).__p1572PairVisit?.({
            step:stepIndex+1,pass,pair:next[aIndex].id+'/'+next[bIndex].id
          });
`;
        return {contents:source.replace(original,transformed),loader:'ts'};
      });
    }}]
  });
  if(hooks!==1)throw Error('PASS_CONVERGENCE_WORLD_HOOK_COUNT:'+hooks);
  await import(pathToFileURL(outfile).href);
}finally{
  await rm(temporary,{recursive:true,force:true});
}
