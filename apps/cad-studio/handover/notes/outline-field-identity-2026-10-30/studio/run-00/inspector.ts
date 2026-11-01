import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const EDGE='n1.side[e2]|n1.side[e3]';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,p=part('D348 observed',doc),body=p.body(key);
  out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;
  out.sideFaces=body.select().faces().names().filter((n:string)=>n.indexOf('side[')>=0).sort();
  out.edgeNames=body.select().edges().names().sort();
  const filletEdge=body.select().edges().where((e:any)=>e.names.indexOf(EDGE)>=0).list();out.finalBodyHasFilletEdge=filletEdge.length>0;}
// The extrude's body before the fillet consumes the corner edge: the reference the fillet resolves.
try{const pre:any={...doc,nodes:doc.nodes.slice(0,2),outputs:{b1:{node:1,side:'solid'}}};const pv=evaluateDoc(pre,0);
  if(pv.ok){const key=pv.bodies[0].key,b=part('D348 pre-fillet',pre).body(key);const list=b.select().edges().where((e:any)=>e.names.indexOf(EDGE)>=0).list();
    out.preFillet={ok:true,edgeFound:list.length>0,edge:list.map((e:any)=>({names:e.names,a:Array.from(e.a),b:Array.from(e.b)})),sideFaces:b.select().faces().names().filter((n:string)=>n.indexOf('side[')>=0).sort(),volume:pv.bodies[0].volume};}
  else out.preFillet={ok:false,error:String((pv as any).error??'evaluation failed')};}
catch(e){out.preFillet={ok:false,error:e instanceof Error?e.message:String(e)};}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));