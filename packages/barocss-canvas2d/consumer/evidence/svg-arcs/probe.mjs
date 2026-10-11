import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),esbuild=require('esbuild'),ts=require('typescript');
const here=path.dirname(fileURLToPath(import.meta.url)),pkg=path.resolve(here,'../../..'),root=path.resolve(pkg,'../..');
const sourceBundle=await esbuild.build({entryPoints:[path.join(pkg,'src/index.ts')],bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const source=await import('data:text/javascript;base64,'+Buffer.from(sourceBundle.outputFiles[0].text).toString('base64'));
const emitted=await import(path.join(pkg,'dist/index.js'));
const prior=execFileSync('git',['show','c8a914debde531fcb78c225e4f1e637bf5d78894:packages/barocss-canvas2d/src/svg.ts'],{cwd:root,encoding:'utf8'});
const baselineBundle=await esbuild.build({stdin:{contents:prior,resolveDir:path.join(pkg,'src'),sourcefile:'baseline-svg.ts',loader:'ts'},bundle:true,format:'esm',platform:'node',write:false,target:'es2022'});
const baseline=await import('data:text/javascript;base64,'+Buffer.from(baselineBundle.outputFiles[0].text).toString('base64'));
class Element{
 constructor(name,attrs={},children=[]){this.nodeType=1;this.localName=name;this.namespaceURI='http://www.w3.org/2000/svg';this.ownerDocument={doctype:null};this.attributes=Object.entries(attrs).map(([name,value])=>({name,value}));this.childNodes=children;}
 getAttribute(name){return this.attributes.find(a=>a.name===name)?.value??null;}
 hasAttribute(name){return this.getAttribute(name)!==null;}
}
const item=(d,id='Curve',attrs={})=>new Element('path',{id,fill:'none',stroke:'#2266cc','stroke-width':'1','stroke-linejoin':'bevel',d,...attrs});
const svg=(children,attrs={})=>new Element('svg',{xmlns:'http://www.w3.org/2000/svg',id:'ArcProbe',width:'600',height:'300',viewBox:'0 0 600 300',...attrs},children);
const flat=nodes=>nodes.flatMap(n=>[n,...(n.children?flat(n.children):[])]);
const semantic=value=>JSON.parse(JSON.stringify(value));
const sourceText=fs.readFileSync(path.join(here,'source.svg'),'utf8');
const fixtureJSON=JSON.parse(execFileSync('python3',['-c',`import json,sys,xml.etree.ElementTree as E\ndef convert(e): return {'name':e.tag.split('}')[-1],'attrs':e.attrib,'children':[convert(c) for c in e]}\nprint(json.dumps(convert(E.fromstring(sys.stdin.read()))))`],{input:sourceText,encoding:'utf8'}));
const fixture=()=>{const convert=r=>new Element(r.name,r.attrs,r.children.map(convert));return convert(fixtureJSON);};
const hostText=fs.readFileSync(path.join(pkg,'consumer/svg-arcs.mjs'),'utf8');
const hostAST=ts.createSourceFile('host.mjs',hostText,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const bridgeDeclaration=hostAST.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createArcDisplayTree').getText().replace(/^export\s+/,'');
const bridge=api=>Function('createDisplayTree','clone','invalid',bridgeDeclaration+';return createArcDisplayTree;')(api.createDisplayTree,semantic,m=>{throw new api.Canvas2DError('INVALID_SCENE',m);});
let assertions=0;
const check=(value,label)=>{assert.ok(value,label);assertions++;},eq=(a,b,label)=>{assert.deepEqual(semantic(a),semantic(b),label);assertions++;};
const close=(a,b,t,label)=>{check(Number.isFinite(a)&&Math.abs(a-b)<=t,label+': '+a+' / '+b);};
// Independent Decimal80 endpoint conversion uses the direct W3C squared-radius formula,
// unlike the product's normalized-hypot center. Cubic conic residual is checked separately.
const referenceCode=String.raw`import sys,json,decimal
from decimal import Decimal as D
from math import atan2,pi
C=decimal.getcontext();C.prec=80
P=D('3.14159265358979323846264338327950288419716939937510582097494459230781640628620899')
def trig(x):
 x=x%(2*P);s=D(0);c=D(0);st=x;ct=D(1)
 for k in range(100):
  s+=st;c+=ct;st*=-(x*x)/D((2*k+2)*(2*k+3));ct*=-(x*x)/D((2*k+1)*(2*k+2))
 return s,c
out=[]
for r in json.load(sys.stdin):
 x1,y1,rx,ry,deg,large,sweep,x2,y2=map(lambda x:D(str(x)),r)
 sn,cs=trig(deg*P/180);xp=cs*(x1-x2)/2+sn*(y1-y2)/2;yp=-sn*(x1-x2)/2+cs*(y1-y2)/2
 lam=xp*xp/(rx*rx)+yp*yp/(ry*ry)
 if lam>1: rx*=lam.sqrt();ry*=lam.sqrt()
 num=rx*rx*ry*ry-rx*rx*yp*yp-ry*ry*xp*xp;den=rx*rx*yp*yp+ry*ry*xp*xp
 q=(max(D(0),num)/den).sqrt() * (-1 if large==sweep else 1)
 cpX=q*rx*yp/ry;cpY=-q*ry*xp/rx;cx=cs*cpX-sn*cpY+(x1+x2)/2;cy=sn*cpX+cs*cpY+(y1+y2)/2
 ax=(xp-cpX)/rx;ay=(yp-cpY)/ry;bx=(-xp-cpX)/rx;by=(-yp-cpY)/ry
 theta=atan2(float(ay),float(ax));delta=atan2(float(ax*by-ay*bx),float(ax*bx+ay*by))
 if not sweep and delta>0:delta-=2*pi
 if sweep and delta<0:delta+=2*pi
 out.append(dict(cx=float(cx),cy=float(cy),rx=float(rx),ry=float(ry),sin=float(sn),cos=float(cs),theta=theta,delta=delta))
print(json.dumps(out))`;
const arcs=[];
for(const flags of [[0,0],[0,1],[1,0],[1,1]])for(const config of [[140,120,20,40,90,100,100],[20,30,60,25,30,90,60],[0,0,2,1,0,20,0]])arcs.push([config[0],config[1],config[2],config[3],config[4],...flags,config[5],config[6]]);
const references=JSON.parse(execFileSync('python3',['-c',referenceCode],{input:JSON.stringify(arcs),encoding:'utf8'}));
const bernstein=(p0,c,t)=>{const u=1-t;return{x:u**3*p0.x+3*u*u*t*c.c1x+3*u*t*t*c.c2x+t**3*c.x,y:u**3*p0.y+3*u*u*t*c.c1y+3*u*t*t*c.c2y+t**3*c.y};};
const entries=[];
for(const [entry,api]of [['source',source],['emitted',emitted]]){
 let accepted=0,refused=0,legacy=0,maxResidual=0;
 const imported=api.importSVGArcElement(fixture());accepted++;eq(imported.scene.version,5,'source remains5');eq(Object.keys(imported.diagnostics).sort(),['generatedIds','groupIds','pathIds','viewBox','viewport'],'same diagnostics shape');
 const inputCommands=flat(imported.scene.nodes).find(n=>n.id==='ArcPath').commands;eq(inputCommands.map(c=>c.kind),['M','L','C','C','L','Z'],'fixed quarter two cubics');eq(inputCommands[3].x,100,'pinned x');eq(inputCommands[3].y,100,'pinned y');
 const current=bridge(api)(imported.scene),snapshot=current.snapshot();eq(snapshot.version,29,'public constructed29');eq(flat(snapshot.nodes).map(n=>n.id),flat(imported.scene.nodes).map(n=>n.id),'IDs/order');
 for(const old of flat(imported.scene.nodes)){const now=flat(snapshot.nodes).find(n=>n.id===old.id);for(const key of ['kind','id','layer','transform','width','height','clip','commands','fill'])if(key in old)eq(now[key],old[key],'authored '+old.id+'.'+key);if(old.stroke){eq(now.stroke.color,old.stroke.color,'stroke color');eq(now.stroke.width,old.stroke.width,'stroke width');eq({cap:now.stroke.cap,join:now.stroke.join,dash:now.stroke.dash,miterLimit:now.stroke.miterLimit},{cap:'butt',join:'bevel',dash:{lengths:[],offset:0},miterLimit:4},'explicit stroke defaults');}eq([now.visible,now.alpha,now.hitMode],[true,1,'auto'],'explicit common defaults');}
 const copy=semantic(imported.scene);copy.nodes[0].children[0].children[1].children[0].commands[2].c1y=9;eq(current.snapshot(),snapshot,'bridge owns command copies');
 const handle=current.get('ArcPath'),candidate=semantic(handle.data.commands);candidate[2].c1y-=12;handle.setPath({commands:candidate,fill:handle.data.fill,stroke:handle.data.stroke});candidate[2].c1y=99;eq(handle.data.commands[2].c1y,snapshot.nodes[0].children[0].children[1].children[0].commands[2].c1y-12,'actual handle edit owns input');eq(imported.scene,api.importSVGArcElement(fixture()).scene,'bridge/edit did not mutate source5');
 for(let index=0;index<arcs.length;index++){
  const a=arcs[index],ref=references[index],root=svg([item(`M ${a[0]} ${a[1]} A ${a.slice(2).join(' ')}`)]),before=JSON.stringify(root),scene=api.importSVGArcElement(root).scene;accepted++;
  check(JSON.stringify(root)===before,'caller DOM unchanged');const cmds=flat(scene.nodes).find(n=>n.kind==='path').commands;check(cmds.length>=2&&cmds.length<=9,'1..8 generated cubics');eq([cmds.at(-1).x,cmds.at(-1).y],[a[7],a[8]],'literal final endpoint');let p0={x:a[0],y:a[1]};let angle=ref.theta;
  for(const c of cmds.slice(1)){eq(c.kind,'C','only cubic');const ex=c.x-ref.cx,ey=c.y-ref.cy,ux=(ref.cos*ex+ref.sin*ey)/ref.rx,uy=(-ref.sin*ex+ref.cos*ey)/ref.ry;let delta=Math.atan2(uy,ux)-angle;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;check((a[6]?delta>=-1e-12:delta<=1e-12)&&Math.abs(delta)<=Math.PI/4+1e-12,'flag direction/segment angle');angle+=delta;
   for(const t of [0,.125,.25,.5,.75,.875,1]){const p=bernstein(p0,c,t),x=p.x-ref.cx,y=p.y-ref.cy,u=(ref.cos*x+ref.sin*y)/ref.rx,v=(-ref.sin*x+ref.cos*y)/ref.ry,residual=Math.abs(u*u+v*v-1);maxResidual=Math.max(maxResidual,residual);check(residual<=.00001,'independent highprecision conic residual');}p0=c;
  }
 }
 for(const d of ['M 0 0 A 0 10 0 0 1 20 0','M 0 0 A 10 0 0 1 0 20 0']){eq(flat(api.importSVGArcElement(svg([item(d)])).scene.nodes).find(n=>n.kind==='path').commands,[{kind:'M',x:0,y:0},{kind:'L',x:20,y:0}],'zero radius line');accepted++;}
 eq(flat(api.importSVGArcElement(svg([item('M 0 0 A 10 10 0 0 1 0 0 L 20 0')])).scene.nodes).find(n=>n.kind==='path').commands,[{kind:'M',x:0,y:0},{kind:'L',x:20,y:0}],'equal endpoints omit');accepted++;
 const refuse=(root,code,fragment)=>{let error;try{api.importSVGArcElement(root);}catch(e){error=e;}check(error?.code===code,'refusal '+code);if(fragment)check(error.message.includes(fragment),'causal '+fragment);refused++;};
 for(const d of ['M 0 0 A 10 10 0 2 1 20 0','M 0 0 A 10 10 0 1.0 1 20 0','M 0 0 A .0001 10 0 0 1 20 0','M 0 0 A -10 10 0 0 1 20 0','M 0 0 A 10 10 361 0 1 20 0','M -0 0 A 10 10 0 0 1 20 0','M 0 0 A 10 10 0 0 1 0 0','A 10 10 0 0 1 20 0','M 1000000 1000000 A 1000000 1000000 0 0 0 -1000000 -1000000'])refuse(svg([item(d)]),'INVALID_SCENE');
 for(const d of ['M 0 0 a 10 10 0 0 1 20 0','M 0 0 H 20','M 0 0 A 10 10 0 0 1'])refuse(svg([item(d)]),'UNSUPPORTED_FEATURE');
 const explicit='M 0 0 '+Array.from({length:255},(_,i)=>`L ${i+1} 0`).join(' ')+' Z';refuse(svg([item(explicit)]),'SCENE_LIMIT','explicit');
 const normalize='M -10 0 '+Array.from({length:64},(_,i)=>`A 10 10 0 0 1 ${i%2?-10:10} 0`).join(' ');refuse(svg([item(normalize)]),'SCENE_LIMIT','normalized');
 const legal='M 0 0 '+Array.from({length:254},(_,i)=>`L ${i+1} 0`).join(' ')+' Z';eq(flat(api.importSVGArcElement(svg([item(legal)])).scene.nodes).find(n=>n.kind==='path').commands.length,256,'exact command allowance');accepted++;
 eq(api.importSVGArcElement(svg(Array.from({length:32},(_,i)=>item('M 0 0 L 10 0','P'+i)))).diagnostics.pathIds.length,32,'32 paths');accepted++;refuse(svg(Array.from({length:33},(_,i)=>item('M 0 0 L 10 0','P'+i))),'SCENE_LIMIT','32 paths');
 const large=svg([...Array.from({length:253},(_,i)=>new Element('g',{id:'G'+i})),item('M 0 0 L 10 0')]);eq(flat(api.importSVGArcElement(large).scene.nodes).length,256,'255Elements produces256Nodes');accepted++;refuse(svg([...large.childNodes,new Element('g',{id:'Extra'})]),'SCENE_LIMIT','255 elements');
 const nest=depth=>{let n=item('M 0 0 L 10 0');for(let i=0;i<depth-2;i++)n=new Element('g',{id:'Nested'+i},[n]);return svg([n]);};api.importSVGArcElement(nest(15));accepted++;refuse(nest(16),'SCENE_LIMIT','depth');refuse(nest(17),'SCENE_LIMIT','depth');
 const comment=()=>({nodeType:8,childNodes:[],textContent:''});api.importSVGArcElement(svg([item('M 0 0 L 10 0'),...Array.from({length:1022},comment)]));accepted++;refuse(svg([item('M 0 0 L 10 0'),...Array.from({length:1023},comment)]),'SCENE_LIMIT','1024');
 let attrReads=0;const attrBig=svg([item('M 0 0 L 10 0')]);attrBig.attributes=new Proxy({length:17},{get(t,k){if(k==='length')return 17;attrReads++;throw Error('attribute materialized before bound');}});refuse(attrBig,'SCENE_LIMIT','16 attributes');eq(attrReads,0,'attribute guard before native indices');
 let childReads=0;const childBig=svg([]);childBig.childNodes=new Proxy({length:1025},{get(t,k){if(k==='length')return 1025;childReads++;throw Error('child materialized before bound');}});refuse(childBig,'SCENE_LIMIT','1024');eq(childReads,0,'child guard before native indices');
 const strings=svg([item('M 0 0 L 10 0')]);strings.attributes.push({name:'oversize',value:'x'.repeat(1048577)});refuse(strings,'SCENE_LIMIT','string budget');const utf8=svg([item('M 0 0 L 10 0')]);utf8.attributes.push({name:'oversize',value:'국'.repeat(350000)});refuse(utf8,'SCENE_LIMIT','1 MiB');
 for(const root of [svg([item('M 0 0 L 10 0')]),svg([new Element('g',{id:'SvgViewBox1'},[item('M 0 0 C 3 2 7 2 10 0','SvgViewport1')])])]){eq(api.importSVGElement(root),baseline.importSVGElement(root),'legacy accepted exact');legacy++;}
 for(const root of [fixture(),svg([item('M 0 0 H 10')]),svg([new Element('use',{href:'https://example.com/x'})])]){const error=f=>{try{f(root);return null;}catch(e){return{code:e.code,message:e.message};}};eq(error(api.importSVGElement),error(baseline.importSVGElement),'legacy refusal exact');legacy++;}
 for(const name of ['sample.svg','unsupported-arc.svg','unsupported-filter.svg','unsupported-external.svg']){
  const xml=fs.readFileSync(path.join(root,'examples/canvas2d-scene/evidence/svg-v5',name),'utf8');
  const data=JSON.parse(execFileSync('python3',['-c',`import json,sys,xml.etree.ElementTree as E\ndef convert(e): return {'name':e.tag.split('}')[-1],'attrs':e.attrib,'children':[convert(c) for c in e]}\nprint(json.dumps(convert(E.fromstring(sys.stdin.read()))))`],{input:xml,encoding:'utf8'}));
  const convert=r=>new Element(r.name,r.attrs,r.children.map(convert)),oldRoot=convert(data);
  const result=f=>{try{return{ok:true,result:f(oldRoot)};}catch(e){return{ok:false,code:e.code,message:e.message};}};
  eq(result(api.importSVGElement),result(baseline.importSVGElement),'retained707 '+name+' exact full result/error');legacy++;
 }
 // Execute actual adopt/release declarations with controlled DOM/bind/renderer facilities.
 const declared=name=>hostAST.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText();
 const factory=Function('initial','bind','element','Canvas2DError',`let accepted=initial,disposed=false,generation=1;const counts={accepted:0,disposes:0},sessions=[];${declared('active')};${declared('release')};${declared('adopt')};return {adopt,release,accepted:()=>accepted,counts,sessions};`);
 const make=()=>{const trace={unbind:0,off:0,dispose:0},session={closed:false,canvas:{replaceWith(){}},unbind(){trace.unbind++;},unsubscribe(){trace.off++;},renderer:{dispose(){trace.dispose++;}}};return{session,trace};};
 const initial=make(),next=make(),swapError=Error('controlled DOM swap');initial.session.canvas.replaceWith=()=>{throw swapError;};const life=factory(initial.session,()=>{},()=>null,api.Canvas2DError);let caught;try{life.adopt(next.session);}catch(e){caught=e;}check(caught===swapError,'actual pretransfer original error');check(life.accepted()===initial.session,'old accepted ownership retained');eq(next.trace,{unbind:1,off:1,dispose:1},'failed candidate bound resources closed once');eq(initial.trace,{unbind:0,off:0,dispose:0},'old session not released');life.release(next.session);eq(next.trace,{unbind:1,off:1,dispose:1},'actual release idempotent');
 const prior=make(),live=make(),closeError=Error('controlled old cleanup');prior.session.renderer.dispose=()=>{prior.trace.dispose++;throw closeError;};const moved=factory(prior.session,()=>{},()=>null,api.Canvas2DError);try{moved.adopt(live.session);}catch(e){caught=e;}check(caught===closeError,'old close error retained');check(moved.accepted()===live.session&&!live.session.closed,'transferred renderer not disposed by catch');eq(live.trace,{unbind:0,off:0,dispose:0},'new live ownership');
 entries.push({entry,accepted,refused,legacyComparisons:legacy,maximumConicResidual:maxResidual,highPrecisionDecimalDigits:80,bridge:'actual host declaration/public constructors/field comparisons/copies',DOM:'controlled Element facilities; not native DOM proof',approximation:'sampled conic residual at frozen parameters; no universal bound',importsInertnessMeasured:false});
}
console.log(JSON.stringify({status:'PASS',assertions,successfulPairedRuns:1,actualBrowser:false,entries},null,2));
