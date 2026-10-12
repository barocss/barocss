import assert from 'node:assert/strict';
import { Session } from 'node:inspector';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { serial } from '../test/modeling-fixture.mjs';
const [mode,directory,modulePath]=process.argv.slice(2);assert.ok(['source','emitted','cold'].includes(mode)&&directory);
assert.ok(process.execArgv.includes('--no-opt'));const out=resolve(directory);
const entry=modulePath?resolve(modulePath):resolve(import.meta.dirname,'../dist/index.js');const {cad,CadModelError}=await import(pathToFileURL(entry).href);
const inspector=new Session();inspector.connect();const post=(method,params={})=>new Promise((yes,no)=>inspector.post(method,params,(e,r)=>e?no(e):yes(r)));
await post('Profiler.enable');await post('Profiler.startPreciseCoverage',{callCount:true,detailed:true});
const names=['compileCadModel','buildConvexPlanarFace','evaluateCurveD1','evaluateSurfaceD1','ExactAffinePlane','SectionRationalContext'];const stages=[];
const volume=(s,n)=>assert.deepEqual(s.certificate.volumeMM3,{numerator:String(n),denominator:'1'});
const write=(name,data)=>{const fs=statfsSync(out);assert.ok(fs.bavail*fs.bsize>=500*1024*1024);writeFileSync(resolve(out,name),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');};
async function stage(label,fn){const value=fn();const raw=await post('Profiler.takePreciseCoverage');const actual=Object.fromEntries(names.map(n=>[n,raw.result.flatMap(s=>s.functions.filter(f=>f.functionName===n)).reduce((v,f)=>v+f.ranges[0].count,0)]));assert.ok(actual.compileCadModel<=600&&actual.buildConvexPlanarFace<=600&&actual.evaluateCurveD1+actual.evaluateSurfaceD1<=25000);stages.push({label,actual});write(mode+'-final-counts.json',{entry,entrySHA256:createHash('sha256').update(readFileSync(entry)).digest('hex'),stages});return value;}
try{
  if(mode==='source'){
    const m=cad.model(), width=m.parameter('width',32), depth=m.parameter('depth',16), height=m.parameter('height',8), plate=m.sketch.rectangle({width,height:depth}).extrude(height);
    m.sketch.rectangle({width:2,height:2});assert.throws(()=>m.sketch.rectangle({width:3,height:3}),e=>e instanceof CadModelError&&e.code==='CAPABILITY');
    let invoked=0;const points=[[0,0],[8,0],[8,8]];Object.setPrototypeOf(points,{map(){invoked++;return [];}});assert.throws(()=>m.sketch.polygon(points),e=>e.code==='INPUT');assert.equal(invoked,0);
    const result=await stage('final source minimal plate after rejected third sketch',()=>m.build({part:plate}));volume(result.bodies.part,4096);write('minimal.cad-model.json',result.save());
  }else if(mode==='emitted'){
    const f=serial(cad,{},false);assert.throws(()=>f.blank.cut(f.tool,{axis:'x'}),e=>e.code==='CAPABILITY');assert.throws(()=>f.model.sketch.rectangle({width:8,height:8}),e=>e.code==='CAPABILITY');
    const result=await stage('emitted cut-only after rejected second cut and third sketch',f.build);volume(result.bodies.part,3072);volume(result.bodies.other,2048);write('cut-final.cad-model.json',result.save());
  }else{
    const plate=await stage('cold standalone extrusion',()=>cad.load(readFileSync(resolve(out,'rectangle.cad-model.json'),'utf8')));volume(plate.bodies.plate,60000);
    const cut=await stage('cold cut-only',()=>cad.load(readFileSync(resolve(out,'cut-final.cad-model.json'),'utf8')));volume(cut.bodies.part,3072);
    const serial=await stage('cold serial authored graph',()=>cad.load(readFileSync(resolve(out,'serial.cad-model.json'),'utf8')));volume(serial.bodies.part,2488);const before=serial.save();
    const next=await stage('cold serial re-edit setback2',()=>serial.withParameters({setback:2}));volume(next.bodies.part,2464);assert.equal(serial.save(),before);write('cold-reedited.cad-model.json',next.save());
  }
  write(mode+'-final-result.json',{status:'passed',evaluations:stages.length,stages});
}catch(e){write(mode+'-final-failure.json',{message:e.message,stack:e.stack,cause:e.cause?.message,stages});throw e;}
finally{await post('Profiler.stopPreciseCoverage');inspector.disconnect();}
