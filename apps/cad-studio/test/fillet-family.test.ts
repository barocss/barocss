import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import { commands, type Ctx } from '@barocss/cad-model/app/commands';
import { rectanglePart, type ModelNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { FILLET_LAUNCHER, filletType, filletPaletteRows, filletSelection, newFilletActive, pickedFilletSelection, sourceFilletPick, prepareFilletPick, replaceFilletSelection, replaceFillet, nodeFilletType, filletApplyCurrent } from '../src/app/filletFamily';
import { GROUP_COMMANDS } from '../src/app/studioConstants';
import { paletteList } from '../src/ui/paletteList';
import { NodeEditor } from '../src/ui/NodeEditor';
import { useViewportPicking } from '../src/viewport/useViewportPicking';
import type { Active } from '../src/app/commandState';
import { createPreviewLifetime, ownedPreview } from '../src/state/previewLifetime';
import { createValueStore } from '../src/state/valueStore';
function context(): Ctx { const doc=rectanglePart(30,12,6),r=evaluateDoc(doc,0);assert.ok(r.ok);return {doc,bodies:r.bodies,selection:{faces:[],edges:[],bodies:[]}}; }
function deferred<T>() { let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject}; }
test('one primary Fillet family keeps Chamfer separate and all original model command IDs and labels intact',()=>{
 const ids=GROUP_COMMANDS.flat().filter(c=>filletType(c.id)).map(c=>c.id);assert.deepEqual(ids,['fillet']);assert.ok(GROUP_COMMANDS.flat().some(c=>c.id==='chamfer'));
 assert.deepEqual(commands.filter(c=>filletType(c.id)).map(c=>[c.id,c.label]).sort(),[['face-fillet','Face fillet'],['fillet','Fillet'],['full-round','Full round']]);
 const ctx=context();assert.equal(FILLET_LAUNCHER.available(ctx).ok,true);assert.equal(commands.find(c=>c.id==='fillet')!.available(ctx).ok,false);assert.throws(()=>newFilletActive('edge',ctx).cmd.build!(ctx,{radius:1}),/Select edges/);
});
test('palette collapses only the presentation, preserving the original best member action for every legacy label/ID/keyword',()=>{
 const ctx=context();for(const query of ['Face fillet','face-fillet','Full round','full-round','face fillet blend','round','fillet','']){
  const ranked=paletteList(query,ctx),expected=query?ranked.find(r=>filletType(r.c.id))?.c.id:'fillet',rows=filletPaletteRows(ranked,query,ctx),family=rows.filter(r=>filletType(r.c.id));assert.equal(family.length,expected?1:0,query);if(expected)assert.equal(family[0].c.id,expected,query);
  assert.deepEqual(rows.filter(r=>!filletType(r.c.id)).map(r=>r.c.id),ranked.filter(r=>!filletType(r.c.id)).map(r=>r.c.id));
 }
});
test('family fields use original defaults/build payloads without UI state leaking into authored nodes',()=>{
 const ctx=context();ctx.selection.edges=[{body:0,edge:0}];const active=newFilletActive('edge',ctx,{radius:1});assert.equal(active.fillet?.radiusMode,'constant');const out=active.cmd.build!(active.ctx,active.values);const node=out.nodes.at(-1)!;assert.equal(node.kind,'fillet');assert.equal(node.id,'n2');assert.ok(!('fillet' in node)&&!('radiusMode' in node));
 assert.deepEqual(newFilletActive('face',ctx).values,{r:2});assert.deepEqual(newFilletActive('full-round',ctx).values,{along:'auto'});
});
test('type selection removes invalid indices, wrong pick kinds and foreign bodies; fresh face picks remain possible',()=>{
 const ctx=context();ctx.selection={edges:[{body:0,edge:0},{body:99,edge:0}],faces:[{body:0,face:0},{body:99,face:0}],bodies:[0]};
 const face=filletSelection('face',ctx);assert.deepEqual(face.edges,[]);assert.deepEqual(face.faces,[{body:0,face:0}]);assert.deepEqual(face.bodies,[]);
 const active=newFilletActive('face',{...ctx,selection:face}),picked=pickedFilletSelection(active,{edge:null,face:{body:0,face:1}},true)!;assert.equal(picked.faces.length,2);
 assert.equal(pickedFilletSelection(active,{edge:{body:0,edge:0},face:null},true),null);
 assert.ok(filletSelection('full-round',ctx).faces.every(f=>ctx.bodies[f.body].mesh.faces[f.face].kind==='plane'));
});
for(const result of ['success','refusal','throw'] as const)test(`switch retires a deferred ${result}, queued work and pending Apply before publishing another type`,async()=>{
 const ctx=context(),owner=createPreviewLifetime(),old=newFilletActive('edge',ctx);let current=old,pending:unknown=old.cmd,queued=true;const order:string[]=[],work=deferred<{ok:boolean}>();const reply=ownedPreview(owner,owner.capture(),()=>work.promise);
 replaceFillet({current:()=>current,context:()=>ctx,retire:()=>{order.push('retire');owner.retire();queued=false;},clearApply:()=>{order.push('clearApply');pending=null;},select:()=>order.push('select'),set:a=>{assert.equal(pending,null);assert.equal(queued,false);order.push('set');current=a;}},'face');
 assert.deepEqual(order,['retire','clearApply','select','set']);assert.equal(current.cmd.id,'face-fillet');assert.equal(current.preview,'busy');assert.equal(filletApplyCurrent(old,current),false);
 if(result==='throw')work.reject(new Error('old worker'));else work.resolve({ok:result==='success'});assert.deepEqual(await reply,{stale:true});assert.equal(current.preview,'busy');assert.equal(pending,null);
 let called=false;const stale=await ownedPreview(owner,0,async()=>{called=true;return 1;});assert.equal(stale.stale,true);assert.equal(called,false,'retired queued work never starts');
});
test('same-command radius-mode switch retires old ready button owner and retains original endpoint semantics',()=>{
 const ctx=context();ctx.selection.edges=[{body:0,edge:0}];let current=newFilletActive('edge',ctx,{radius:1,endRadius:2,shape:'conic',rho:0.4});current.preview='ok';const old=current;
 const options={current:()=>current,context:()=>ctx,retire:()=>{},clearApply:()=>{},select:()=>{},set:(a:typeof current)=>{current=a;}};
 replaceFillet(options,'edge','constant');assert.equal(current.values.endRadius,0);assert.equal(current.values.radius,1);assert.equal(current.values.rho,0.4);assert.equal(filletApplyCurrent(old,current),false);
 replaceFillet(options,'edge','varying');assert.equal(current.values.endRadius,1);current.values={...current.values,endRadius:2,shape:'circular'};const built=current.cmd.build!(current.ctx,current.values).nodes.at(-1)!;assert.equal(built.kind,'fillet');if(built.kind==='fillet')assert.deepEqual(built.radii?.map(r=>r.radius),[1,2]);
});
test('existing file feature type is read-only and rendering its editor cannot change identity, refs, bindings or payload',()=>{
 const doc=rectanglePart(30,12,6),nodes:ModelNode[]=[...doc.nodes,{id:'n2',kind:'fillet',parent:{node:1,side:'solid'},edges:['n1.side0|n1.top'],radius:{parameter:'R'},radii:[{at:[0,0,0],radius:1,atEnd:true},{at:[30,0,0],radius:2,atEnd:true}]}];const before=JSON.stringify(nodes);
 const html=renderToStaticMarkup(createElement(NodeEditor,{nodes,index:2,parameters:{R:1},onApply:()=>{},onClose:()=>{},onRefuse:()=>{}}));assert.match(html,/aria-label="Fillet type"[^>]*disabled/);assert.match(html,/value="edge" selected/);assert.match(html,/value="varying" selected/);assert.equal(JSON.stringify(nodes),before);
 assert.equal(nodeFilletType({id:'n3',kind:'full-round',parent:{node:1,side:'solid'},faces:['n1.top']}),'full-round');assert.equal(nodeFilletType({id:'n4',kind:'face-fillet',parent:{node:1,side:'solid'},faces:['n1.top','n1.side0'],radius:1}),'face');
});

test('live Face third pick retires old ready preview and pending Apply before original selection refusal',async()=>{
 const ctx=context();ctx.selection.faces=[{body:0,face:0},{body:0,face:1}];let active=newFilletActive('face',ctx);active.preview='ok';const old=active,owner=createPreviewLifetime(),work=deferred<number>();const reply=ownedPreview(owner,owner.capture(),()=>work.promise);let pending=true;
 const selection=pickedFilletSelection(active,{edge:null,face:{body:0,face:2}},true)!;assert.equal(selection.faces.length,3);
 replaceFilletSelection({current:()=>active,context:()=>ctx,retire:()=>owner.retire(),clearApply:()=>{pending=false;},select:()=>{},set:a=>{assert.equal(pending,false);active=a;}},selection);
 assert.equal(active.cmd.id,'face-fillet');assert.equal(active.preview,'busy');assert.equal(filletApplyCurrent(old,active),false);assert.equal(active.cmd.available(active.ctx).ok,false);work.resolve(1);assert.deepEqual(await reply,{stale:true});
});
test('live Edge body change retires old source ownership, and preview indices resolve only by unique native names',async()=>{
 const ctx=context(),second={...ctx.bodies[0],key:'other',mesh:{...ctx.bodies[0].mesh,faces:ctx.bodies[0].mesh.faces.map(f=>({...f,name:'other.'+f.name})),edges:ctx.bodies[0].mesh.edges.map(e=>({...e,names:e.names.map(n=>'other.'+n)}))}};ctx.bodies=[ctx.bodies[0],second];ctx.selection.edges=[{body:0,edge:0}];let active=newFilletActive('edge',ctx);const owner=createPreviewLifetime(),work=deferred<number>(),reply=ownedPreview(owner,owner.capture(),()=>work.promise);let pending=true;
 const pick=sourceFilletPick(active,[second,ctx.bodies[0]],{face:null,edge:{body:0,edge:0}});assert.deepEqual(pick.edge,{body:1,edge:0});const selection=pickedFilletSelection(active,pick,true)!;assert.deepEqual(selection.edges,[{body:1,edge:0}]);
 replaceFilletSelection({current:()=>active,context:()=>ctx,retire:()=>owner.retire(),clearApply:()=>{pending=false;},select:()=>{},set:a=>{assert.equal(pending,false);active=a;}},selection);assert.equal(active.ctx.selection.edges[0].body,1);work.resolve(1);assert.deepEqual(await reply,{stale:true});
 const generated={...second,mesh:{...second.mesh,faces:second.mesh.faces.map(f=>({...f,name:'generated-only'}))}};assert.deepEqual(sourceFilletPick(active,[generated],{face:{body:0,face:0},edge:null}),{face:null,edge:null});
});
test('preview picks require exact unique names inside a proven source body, never merged aliases or another body',()=>{
 const ctx=context(),first=ctx.bodies[0],second={...first,key:'other',ref:{node:99,side:'solid' as const}};ctx.bodies=[first,second];ctx.selection.edges=[{body:0,edge:0}];const active=newFilletActive('edge',ctx,{radius:1});
 const reordered={...first,mesh:{...first.mesh,faces:[...first.mesh.faces].reverse(),edges:[...first.mesh.edges].reverse()}};
 assert.deepEqual(sourceFilletPick(active,[second,reordered],{face:{body:1,face:0},edge:{body:1,edge:0}}),{face:{body:0,face:first.mesh.faces.length-1},edge:{body:0,edge:first.mesh.edges.length-1}});
 assert.deepEqual(sourceFilletPick(active,[second],{face:{body:0,face:0},edge:{body:0,edge:0}}),{face:{body:1,face:0},edge:{body:1,edge:0}},'identical names on another proven body remain on that body');
 const unknown={...reordered,key:'unproven',ref:undefined};assert.deepEqual(sourceFilletPick(active,[unknown],{face:{body:0,face:0},edge:{body:0,edge:0}}),{face:null,edge:null});
 const merged={...first,mesh:{...first.mesh,faces:[{...first.mesh.faces[0],name:first.mesh.faces[0].name+'+'+first.mesh.faces[1].name}],edges:[{...first.mesh.edges[0],names:[...first.mesh.edges[0].names,'generated']}]}};
 assert.deepEqual(sourceFilletPick(active,[merged],{face:{body:0,face:0},edge:{body:0,edge:0}}),{face:null,edge:null});
 const duplicate={...first,mesh:{...first.mesh,faces:[first.mesh.faces[0],first.mesh.faces[0]],edges:[first.mesh.edges[0],first.mesh.edges[0]]}};const ambiguous={...active,ctx:{...ctx,bodies:[duplicate,second]}};
 assert.deepEqual(sourceFilletPick(ambiguous,[first],{face:{body:0,face:0},edge:{body:0,edge:0}}),{face:null,edge:null});
 const candidate=active.cmd.build!(active.ctx,active.values),preview=evaluateDoc(candidate,1);assert.ok(preview.ok);const output=preview.bodies.find(b=>b.ref?.node===candidate.nodes.length-1)!;assert.ok(output);
 const unchanged=output.mesh.faces.findIndex(f=>first.mesh.faces.some(source=>source.name===f.name));assert.ok(unchanged>=0);const picked=sourceFilletPick(active,[output],{face:{body:0,face:unchanged},edge:null});assert.equal(picked.face?.body,0,'explicit appended output parent proves original body');
});

test('rejected live pick clears queued Apply while unchanged selection and deferred valid preview can recover',async()=>{
 const ctx=context();ctx.selection.edges=[{body:0,edge:0}];const active=newFilletActive('edge',ctx,{radius:1}),owner=createPreviewLifetime(),work=deferred<{ok:boolean}>();let pending=true,commits=0;
 const reply=ownedPreview(owner,owner.capture(),()=>work.promise).then(result=>{if(!result.stale&&pending)commits++;return result;});
 const shown={...ctx.bodies[0],key:'unproven',ref:undefined},before=JSON.stringify(active.ctx.selection);
 assert.equal(prepareFilletPick(active,[shown],{face:null,edge:{body:0,edge:0}},true,()=>{pending=false;}),null);
 assert.equal(pending,false);assert.equal(JSON.stringify(active.ctx.selection),before);work.resolve({ok:true});assert.deepEqual(await reply,{stale:false,result:{ok:true}});assert.equal(commits,0);
 active.preview='ok';assert.equal(filletApplyCurrent(active,active),true);assert.equal(active.cmd.build!(active.ctx,active.values).nodes.at(-1)?.kind,'fillet','explicit Apply remains valid after refusal');
 pending=true;assert.equal(prepareFilletPick(active,ctx.bodies,{face:null,edge:{body:0,edge:0},instance:'placed'},false,()=>{pending=false;}),null);assert.equal(pending,false);
});

test('viewport route clears pending family Apply before rejecting hidden or missing instance hits',async()=>{
 const ctx=context();ctx.selection.edges=[{body:0,edge:0}];ctx.doc={...ctx.doc,instances:[{id:'hidden',hidden:true} as NonNullable<Ctx['doc']['instances']>[number]]};const active=newFilletActive('edge',ctx,{radius:1}),owner=createPreviewLifetime(),work=deferred<{ok:boolean}>();let pending=true,commits=0,onPick!:ReturnType<typeof useViewportPicking>['onPick'];const sectionRef={current:null} as Parameters<typeof useViewportPicking>[0]['sectionRef'],sectionFacePickRef={current:null as number|null};
 const reply=ownedPreview(owner,owner.capture(),()=>work.promise).then(result=>{if(!result.stale&&pending)commits++;return result;});
 function Picker() {
   const inputs: Partial<Parameters<typeof useViewportPicking>[0]> = {
     doc: ctx.doc, modelUnavailable: false, activeRef: { current: active }, sectionRef, sectionFacePickRef, halvesShownRef: { current: false },
     onExtrudeTargetPick: () => false,
     onFilletPick: (hit, additive) => {
       assert.equal(prepareFilletPick(active, ctx.bodies, hit, additive, () => { pending = false; }), null);
       return true;
     },
   };
   const activeStore = createValueStore<Active | null>(active);
   onPick = useViewportPicking({ ...inputs, activeStore } as Parameters<typeof useViewportPicking>[0]).onPick;
   return null;
 }
 renderToStaticMarkup(createElement(Picker));const before=JSON.stringify(active.ctx.selection);
 for(const instance of ['missing','hidden']){pending=true;onPick({face:null,edge:{body:0,edge:0},point:null,instance},false);assert.equal(pending,false,instance);assert.equal(JSON.stringify(active.ctx.selection),before);}
 pending=true;onPick({face:null,edge:null,point:null},false);assert.equal(pending,false,'empty genuine click clears queued Apply');
 sectionRef.current={} as NonNullable<typeof sectionRef.current>;sectionFacePickRef.current=0;pending=true;onPick({face:{body:99,face:0},edge:null,point:null},false);assert.equal(pending,false,'armed section-plane picker cannot bypass family rejection');assert.equal(JSON.stringify(active.ctx.selection),before);
 work.resolve({ok:true});await reply;assert.equal(commits,0);assert.equal(active.cmd.build!(active.ctx,active.values).nodes.at(-1)?.kind,'fillet');
 const withoutRefs={...ctx.bodies[0],ref:undefined};assert.deepEqual(sourceFilletPick({...active,ctx:{...ctx,bodies:[withoutRefs]}},[withoutRefs],{face:{body:0,face:0},edge:{body:0,edge:0}}),{face:null,edge:null},'same key with absent refs cannot prove body identity');
});
