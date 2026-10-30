// Immutable existing-command baseline; parent granted the serial heavy slot.
import { writeFileSync } from 'node:fs';
import { brepMassProperties, brepSurfaceArea, checkBrep } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/index.ts';
import { rectanglePart, cylinderPart, withNode, type StudioDoc } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/doc.ts';
import { evaluateDoc, partBreps } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/evaluate.ts';
import { offsetFaceCommand } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/app/profileCommands.ts';
import type { Ctx } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/app/commands.ts';
const out = '/tmp/d342-probe';
function error(e: unknown): unknown { if (!(e instanceof Error)) return e; return { name: e.name, message: e.message, stack: e.stack, ...e, cause: error(e.cause) }; }
function native(doc: StudioDoc): unknown[] {
  return partBreps(doc).map(({key,brep}) => {
    let mass: unknown, area: unknown, check: unknown;
    try { mass = brepMassProperties(brep, 1); } catch(e) { mass = {error:error(e)}; }
    try { area = brepSurfaceArea(brep); } catch(e) { area = {error:error(e)}; }
    try { check = checkBrep(brep, {strict:true}); } catch(e) { check = {error:error(e)}; }
    return { key, mass, area, check, brep };
  });
}
const fractional = rectanglePart(20.00003, 10, 5);
const translated = withNode(rectanglePart(20.00003, 10, 5), {kind:'translate',parent:{node:1,side:'solid'},offset:[0.1234567,-0.2345678,0.3456789]});
const draftedBase = rectanglePart(20, 10, 5);
const drafted = {...draftedBase,nodes:draftedBase.nodes.map((n,i)=>i===1?{...n,draft:5}:n)} as StudioDoc;
const cases = [
  {name:'fractional-box',doc:fractional,expected:{kind:'right-box',min:[0,0,0],max:[20.00003,10,5],distance:2}},
  {name:'translated-fractional-box',doc:translated,expected:{kind:'right-box',min:[0.1234567,-0.2345678,0.3456789],dimensions:[20.00003,10,5],distance:2}},
  {name:'drafted-rectangle',doc:drafted,expected:{kind:'drafted-control',distance:2,draft:5}},
  {name:'integer-cylinder',doc:cylinderPart(3,5),expected:{kind:'cylinder-control',radius:3,height:5,distance:2}},
];
const results: unknown[]=[];
for(const fixture of cases) {
  const record: Record<string,unknown>={name:fixture.name,expectedInput:fixture.expected,inputRecipe:structuredClone(fixture.doc)};
  const before=JSON.stringify(fixture.doc); let phase='evaluate-input';
  try {
    const evaluation=evaluateDoc(fixture.doc,1); record.inputEvaluation=evaluation;
    if(!evaluation.ok) throw new Error(`Input evaluation refused: ${JSON.stringify(evaluation.error)}`);
    phase='capture-input-native';record.inputNative=native(fixture.doc);
    const body=evaluation.bodies[0];
    const tops=body.mesh.faces.map((f,index)=>({f,index})).filter(({f})=>f.name.split('+').some(name=>name.endsWith('.top')));
    if(tops.length!==1) throw new Error(`Top selection is missing or ambiguous: ${tops.length}`);
    const top=tops[0].index;
    record.selectedDisplayFace={body:0,face:top,value:body.mesh.faces[top]};
    if(top<0) throw new Error('No unique named top face found');
    const names=body.mesh.faces[top].name.split('+');
    record.selectedNativeFaces=partBreps(fixture.doc).filter(n=>n.key===body.key).flatMap(n=>n.brep.faces.filter(f=>f.name&&names.includes(f.name)));
    const ctx:Ctx={doc:fixture.doc,bodies:evaluation.bodies,selection:{faces:[{body:0,face:top}],edges:[],bodies:[]}};
    phase='availability';record.available=offsetFaceCommand.available(ctx);
    phase='handles';record.handles=offsetFaceCommand.handles?.(ctx,{d:2});
    phase='build-existing-offset-face';const candidate=offsetFaceCommand.build!(ctx,{d:2});
    record.outputRecipe=candidate;record.generatedNodes=candidate.nodes.slice(fixture.doc.nodes.length);
    writeFileSync(`${out}/${fixture.name}-candidate.json`,JSON.stringify(candidate,null,2));
    phase='evaluate-candidate';const evaluated=evaluateDoc(candidate,2);record.outputEvaluation=evaluated;
    if(evaluated.ok){phase='capture-output-native';record.outputNative=native(candidate);record.status='SUCCESS';}
    else record.status='EVALUATION_REFUSAL';
  } catch(e) {record.status='THREW';record.failurePhase=phase;record.error=error(e);}
  record.inputRecipeUnchanged=JSON.stringify(fixture.doc)===before;
  writeFileSync(`${out}/${fixture.name}.json`,JSON.stringify(record,null,2));
  console.log(JSON.stringify({name:fixture.name,status:record.status,failurePhase:record.failurePhase,error:record.error,inputRecipeUnchanged:record.inputRecipeUnchanged}));
  results.push(record);
}
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
