/** Test-only AST insertions. Original arithmetic statements stay byte-for-byte intact. */
import assert from 'node:assert/strict';
const H='globalThis.__p5Public';
export function instrumentPublic(ts,path,source){
 const sf=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 assert.equal(sf.parseDiagnostics.length,0,`parse overlay ${path}`);
 const edits=[],sites={};
 const add=(at,text,site)=>{edits.push({at,text});sites[site]=(sites[site]??0)+1;};
 const enter=(n,text,site)=>add(n.body.getStart(sf)+1,`\n${text}\n`,site);
 const text=n=>n.getText(sf);
 function functionName(n){if(ts.isFunctionDeclaration(n))return n.name?.text;if(ts.isMethodDeclaration(n))return n.name.getText(sf);return null;}
 function enclosing(n,name){for(let p=n.parent;p;p=p.parent)if(functionName(p)===name)return p;return null;}
 function className(n){for(let p=n.parent;p;p=p.parent)if(ts.isClassDeclaration(p)||ts.isClassExpression(p))return p.name?.text??(ts.isVariableDeclaration(p.parent)?p.parent.name.getText(sf):'');return '';}
 const helpers=['initializeCloth','initializeFluid','prepareCloth','prepareFluid','clothDiagnostics','fluidDiagnostics','initialRestDensity','densities','floorSamples','inflatedBoxBounds','blendVisualViscosity','projectDistance','projectSphere','canonicalEncode','admitCadFluidStaticData','admitCadSurfaceProxy','assertCadProxyCurrent','compileCadModel'];
 function visit(n){
  const name=functionName(n);
  if(n.body&&helpers.includes(name))enter(n,`${H}.hit(${JSON.stringify(name)});`,name);
  if(n.body&&name==='createPhysicsWorld')enter(n,`${H}.factory();`,'factory');
  if(n.body&&['copyClothCandidateOutput','copyFluidCandidateOutput'].includes(name))enter(n,`${H}.hit('outputCopies');`,'public-copy');
  if(n.body&&name==='publicDomainState')enter(n,`if(prepared)${H}.fault('public-copy');`,'public-copy');
  if(n.body&&name==='step'&&enclosing(n,'createPhysicsWorld'))enter(n,`${H}.step();`,'step');
  if(n.body&&['getState','getModel'].includes(name)&&enclosing(n,'createPhysicsWorld'))enter(n,`${H}.hit('reads');`,name);
  if(n.body&&name==='step'&&['ClothSolver','PbfSolver'].includes(className(n)))enter(n,`${H}.hit('${className(n)}Steps');`,'solver-step');
  if(ts.isNewExpression(n)&&['ClothSolver','PbfSolver'].includes(text(n.expression))){add(n.getStart(sf),`(${H}.hit('${text(n.expression)}Constructions'),`,'solver-construction');add(n.end,')','solver-construction-close');}
  if(ts.isExpressionStatement(n)){
   const t=text(n);
   if(enclosing(n,'prepareCloth')||enclosing(n,'prepareFluid')){
    if(/solver\.step\(/.test(t))add(n.end,`\n${H}.hit('solverReturns');${H}.numeric(positions);`,'numeric');
   }
   if(/(?:projectDistance|projectDensity)\(/.test(t)&&['ClothSolver','PbfSolver'].includes(className(n))){const single=ts.isForOfStatement(n.parent)||ts.isForStatement(n.parent)||ts.isWhileStatement(n.parent);if(single)add(n.getStart(sf),'{','mid-block');add(n.end,`\n${H}.fault('mid-kernel');${single?'}':''}`,'mid-kernel');}
   if(t==='stepIndex++;'&&enclosing(n,'createPhysicsWorld'))add(n.end,`${H}.accepted(stepIndex);`,'commit');
   if(/encodeRecordingData\(recording\)/.test(t)&&enclosing(n,'prepare'))add(n.end,`${H}.fault('log-prepare');`,'log-prepare');
  }
  if(ts.isVariableStatement(n)&&(enclosing(n,'prepareCloth')||enclosing(n,'prepareFluid'))&&/solver\.step\(/.test(text(n)))add(n.end,`\n${H}.hit('solverReturns');${H}.numeric(positions);`,'numeric');
  if(ts.isVariableStatement(n)&&(enclosing(n,'prepareCloth')||enclosing(n,'prepareFluid'))&&/(?:clothDiagnostics|fluidDiagnostics)\(/.test(text(n)))add(n.end,`\n${H}.fault('post-diagnostic');`,'diagnostic');
  if(ts.isReturnStatement(n)&&n.expression&&text(n.expression)==='world'&&enclosing(n,'createPhysicsWorld'))add(n.getStart(sf),`${H}.returned(world,()=>({domainState,modelCopy,optionsCopy,bodies,joints,stepIndex,owner,disposed}));\n`,'return-world');
  ts.forEachChild(n,visit);
 }
 visit(sf);
 // This outer wrapper counts idempotent disposal entries, including repeated calls.
 const dispose=/world\.dispose = \(\) => \{/g;let m;while((m=dispose.exec(source)))add(m.index+m[0].length,`${H}.hit('disposes');`,'dispose');
 edits.sort((a,b)=>b.at-a.at);let effective=source;for(const e of edits)effective=effective.slice(0,e.at)+e.text+effective.slice(e.at);
 return {source:effective,sites};
}
