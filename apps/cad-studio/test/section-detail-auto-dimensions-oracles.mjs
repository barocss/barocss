// D550: the exact D455 H12 drawing, one Auto and its annotation lifecycle.
// Reuse the D549 physical inspection code to capture one new current class.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
 seedDoc,seedPath,seedBytes,seedSHA256,seedText,seedJSON,observerSource,observerPageRead,
 currentWorkerPageRead,drawingPageRead as retainedPageRead,builderFiles as oldBuilders,
 observerPath,signedZeroComparisonPath,legacyOraclePath,legacyOracleSHA256,inspectorCore,
 oracleSource as physicalOracleSource,oracleStatus as physicalOracleStatus,
} from './section-detail-svg-oracles.mjs';
export {seedDoc,seedPath,seedBytes,seedSHA256,seedText,seedJSON,observerSource,observerPageRead,currentWorkerPageRead,signedZeroComparisonPath};
export const {zeroComparisonCopy}=await import(pathToFileURL(signedZeroComparisonPath).href);
const sha=x=>createHash('sha256').update(x).digest('hex');
const repoRoot=fileURLToPath(new URL('../../../',import.meta.url));
const evidenceRoot=join(homedir(),'.cache/barocss-cad-evidence/d550-2026-11-10');
const recoveryPath=join(dirname(seedPath),'recovery.json');
export const oracleStatus='PASS_ONE_DECLARED_D550_AUTO_DIMENSION_STATE';
const authority='ONE_NEW_CURRENT_D550_PHYSICAL_CLASS; EXACT_D455_A; NO_D549_PACKET_REUSE';
export const historicalD549={
 packetSHA256:'8043214d2177e848eabc7e005812be70de7312f64b7768fdbd49156508d94fe1',
 nativeBRepSHA256:'859ced0c726deb63d1f5b7669a517801e6f32d2778403cdb5e3b89f6f3fb075e',
 sourceRevision:'bafe7e865f28d750',
};
export const config={workId:'D550',seedPath,seedBytes,seedSHA256,authority,
 groups:['01-public-Auto','02-FIRST-Undo','03-FIRST-Redo','04-owned-native-Save','05-public-saved-Open','06-annotated-SVG'],
 counts:{selectedGroups:6,historicalPhysicalClassesReused:0,newPhysicalClasses:1,sourceEvaluations:1,explicitSplitEvaluations:1,projectionObservations:1,pureAutoLayoutInvocations:1,nativeDownloads:1,svgDownloads:1},
 requiredCoverage:{overallX:60,overallY:40,overallZ:12,boreDiameter:10,boreLocationX:15,boreLocationY:20},
 limits:['Original whole H12 source/filletH10 cache/SectionY23/TopDetailB stay exact; Auto changes only dimensions/views/room/scale, on A3/default-Y.',
  'One new current physical class, with separate source and split evaluations. A/B drawing Docs share its exact compiled source. The original D549 physical packet is historical only.',
  'All actual generated linear/diameter references and values are checked; candidate count/IDs are observed before freeze, not guessed. Sketch-hole label is plain Ø10, not an invented THRU callout.',
  'Six selected groups plus necessary baseline setup. Current Worker pair reuses are honest; public Open may naturally create another pair. Worker internal native calls remain NOT_MEASURED.',
  'Native1e-9 and SVG5.0001e-5 sheet-mm remain separate. Other issues, font/raster/standards/general visibility/curved hatch accuracy are not certified;16-per-quarter and512-gon approximations remain.',
  'No tolerance acceptance, source edit, feature creation, old project-loop replay, PDF/DXF, external acquisition, mobile, full kernel or release.']};
export const builderFiles=['apps/cad-studio/test/section-detail-auto-dimensions-oracles.mjs',...oldBuilders];
export const retainedFiles=[seedPath,legacyOraclePath,observerPath,signedZeroComparisonPath,recoveryPath];
export const inputFiles=[
 ...retainedFiles,
 'apps/cad-studio/handover/notes/section-detail-workflow-2026-11-03/README.md',
 'apps/cad-studio/handover/notes/section-detail-svg-output-2026-11-05/README.md',
];
// Keep the already-qualified base getter byte-exact, then add only actual page
// placements and per-dimension DOM. This function is self-contained in the page.
if(!retainedPageRead.toString().includes('return {doc:'))throw Error('Retained page getter boundary changed');
export const drawingPageRead=Function('return ('+retainedPageRead.toString().replace('return {doc:',`const placements={};for(const view of ['front','top','right','iso']){const box=summary.boxes[view];placements[view]=placement(view,box);}placements['section:A']=placement('section:A',section.box);placements['detail:B']=placement('detail:B',detail.box);const dimensionDOM=[...svg.querySelectorAll('g.dimension[data-dim]')].map(g=>({id:g.getAttribute('data-dim'),view:g.getAttribute('data-view'),svg:g.outerHTML,texts:[...g.querySelectorAll('text')].map(e=>e.textContent??'')}));return {placements,dimensionDOM,doc:`)+')')();

// Root builds this TS stdin with esbuild resolveDir apps/cad-studio, target node22.
// CLI: BUNDLE FRESH_CONTROL CURRENT_SOURCE_PINS. One new source and split.
export const preflightSource=inspectorCore+String.raw`
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {autoLayout,frontByInformation,information} from '../../packages/barocss-cad-model/src/drawing/layout.ts';
import {issueContext,drawingIssues} from '../../packages/barocss-cad-model/src/drawing/issues.ts';
import {placementOf,projectionOf} from '../../packages/barocss-cad-model/src/drawing/sheet.ts';
import {holeCallout,holeCalloutOwnerOf} from '../../packages/barocss-cad-model/src/drawing/callout.ts';
import {withFit,fitMiss} from '../../packages/barocss-cad-model/src/drawing/fits.ts';
import {withElements} from '../../packages/barocss-cad-model/src/drawing/elementCallouts.ts';
import {committedSettings} from './src/ui/drawing/commitSettings.ts';
const config=${JSON.stringify(config)},seedText=${JSON.stringify(seedText)};
const out=resolve(process.argv[2]??''),sourcePinsFile=resolve(process.argv[3]??''),repo=${JSON.stringify(repoRoot)};
const evidenceRoot=${JSON.stringify(evidenceRoot)};
assert.ok((out.startsWith(evidenceRoot+'/')||out.startsWith('/tmp/barocss-d550-'))&&!existsSync(out),'new owned D550 output required');
mkdirSync(out);
const save=(name:string,value:any)=>{
 const path=join(out,name),text=typeof value==='string'?value:JSON.stringify(value,null,2);
 writeFileSync(path,text);
 return {path,sha256:sha(text)};
};
const calls={sourceEvaluate:0,explicitSplitEvaluate:0,controlledSectionProvider:0,projectViews:0,nativeCutProjection:0,cutRings:0,pureAutoLayoutInvocations:0,pureDrawingObservations:0};
const receipt:any={status:'RUNNING_D550_CONTROL',calls,historicalNativeReuse:0,physicalClasses:0,independent:'NOT_RUN',actualStudio:'NOT_RUN',artifacts:[]};
let phase='current-source-pins';
const persist=()=>save('receipt.json',receipt);
persist();
try {
 const pinBytes=readFileSync(sourcePinsFile),pins=JSON.parse(pinBytes.toString('utf8'));
 const pinRows=Object.entries(pins);
 assert.ok(pinRows.length>0,'current producer pins required');
 for(const [file,digest] of pinRows)assert.equal(sha(readFileSync(resolve(repo,file))),digest,'current pinned input '+file);
 receipt.sourcePinsFile=sourcePinsFile;
 receipt.sourcePinsSHA256=sha(pinBytes);
 receipt.sourcePinsCompared=pinRows.length;
 receipt.artifacts.push({path:sourcePinsFile,sha256:receipt.sourcePinsSHA256});
 phase='exact-D455-A';
 const input=readFileSync(config.seedPath,'utf8');
 assert.equal(Buffer.byteLength(input),config.seedBytes);
 assert.equal(sha(input),config.seedSHA256);
 assert.equal(input,seedText);
 const A=JSON.parse(input);
 receipt.artifacts.push({path:config.seedPath,sha256:config.seedSHA256});
 phase='current-H12-native';
 const read=inspect(A,{label:'H12',parameters:{height:12},title:'section-detail-05-opfs-saved',date:'2026-11-10',captureAllViews:true});
 const packet=save('H12-native-before-assert.json',read);
 receipt.artifacts.push(packet);
 Object.assign(calls,read.calls);
 receipt.physicalClasses=1;
 persist();
 assert.equal(read.ok,true,JSON.stringify(read.error));
 assert.equal(read.documentJSON,JSON.stringify(A));
 assert.deepEqual(read.calls,{sourceEvaluate:1,explicitSplitEvaluate:1,controlledSectionProvider:0,projectViews:1,nativeCutProjection:1,cutRings:1});
 const reuse={packet,physicalDocumentSHA256:read.documentSHA256,nativeBRepSHA256:read.outputs[0].nativeBRepSHA256,sourceRevision:read.sourceRevision,authority:config.authority};
 receipt.physicalReuse=reuse;

 phase='default-front-choice';
 const views=read.projections;
 const pick=frontByInformation(views,A.drawing);
 const scores={front:information(views.front),right:information(views.right)};
 receipt.artifacts.push(save('front-choice-before-assert.json',{pick,scores}));
 assert.deepEqual(scores,{front:3,right:5});
 assert.equal(pick,null,'strict 5>3+2 is false; default front and Section Y23 retained');
 const sections=sheetSections([{id:'A',view:'front',at:23,result:read.provider.section}]),elements:any[]=[];
 const callout=withElements(A,withFit(A,(edge:any,f:any)=>holeCallout(A.nodes,edge,A.parameters,f)),elements);
 const locationOwner=(edge:string)=>holeCalloutOwnerOf(A,edge);
 const meta={title:'section-detail-05-opfs-saved',date:'2026-11-10',source:reuse.sourceRevision};
 const inputs={views,settings:A.drawing,sections,elements,callout,locationOwner,fitMiss:fitMiss(A),meta};

 phase='pure-auto-layout';
 calls.pureAutoLayoutInvocations++;
 const auto=autoLayout(inputs);
 const B={...A,drawing:committedSettings(auto.settings,{kind:'part'})};
 const candidateBytes=JSON.stringify(B);
 const candidate=save('B-candidate-before-assert.bcad',candidateBytes);
 receipt.artifacts.push(candidate,save('candidate-before-assert.json',{uncommittedSettings:auto.settings,report:auto.report,doc:B,documentJSON:candidateBytes,documentSHA256:candidate.sha256}));
 const compiledB=toPartDocument(B);
 assert.deepEqual(compiledB,read.partDocument,'new drawing Doc has exact original compiled model');
 const draw=(doc:any)=>{
  calls.pureDrawingObservations++;
  const ctx=issueContext({...inputs,settings:doc.drawing}),placements:any={},projections:any={};
  for(const view of ['front','top','right','iso','section:A','detail:B'] as const){
   const placement=placementOf(ctx.layout,ctx.sheet,view),projection=projectionOf(views,ctx.sheet,view);
   if(placement)placements[view]=placement;
   if(projection)projections[view]=projection;
  }
  const documentJSON=JSON.stringify(doc);
  return {doc,documentJSON,documentSHA256:sha(documentJSON),physicalDocumentSHA256:read.documentSHA256,nativeBRepSHA256:reuse.nativeBRepSHA256,sourceRevision:reuse.sourceRevision,compiledPartDocument:doc===A?read.partDocument:compiledB,layout:ctx.layout,placements,projections,dimensions:ctx.sheet.dimensions,issues:drawingIssues(ctx)};
 };
 const drawingReads={A:draw(A),B:draw(B)};
 const drawingReadsFile=save('drawing-reads-before-assert.json',drawingReads);
 const payload={label:'PURE_CANDIDATE',doc:B,documentJSON:candidateBytes,expectedDoc:B,seedDoc:A,physicalReuse:reuse,drawingRead:drawingReads.B};
 const oracleInput=save('candidate-oracle-input.json',payload);
 receipt.artifacts.push(drawingReadsFile,oracleInput);
 receipt.candidate=candidate;
 receipt.drawingReads=drawingReadsFile;
 receipt.oracleInput=oracleInput;
 receipt.frontChoice={pick,scores};
 receipt.status='CAPTURED_D550_PURE_CANDIDATE_PENDING_INDEPENDENT';
 persist();
 console.log(JSON.stringify({status:receipt.status,output:out,calls,candidate,oracleInput}));
} catch(cause) {
 receipt.status='FAIL_D550_CONTROL';
 receipt.firstFailure={phase,...error(cause)};
 persist();
 console.log(JSON.stringify(receipt));
 process.exitCode=1;
}
`;

const legacyParser=readFileSync(legacyOraclePath,'utf8');
if(sha(legacyParser)!==legacyOracleSHA256)throw Error('Retained D455 parser source changed');
const parserEnd=legacyParser.indexOf('\ndef main():');
if(parserEnd<0)throw Error('Retained pure SVG parser boundary changed');
export const oracleSource=String.raw`
import copy,hashlib,json,math,re,sys,traceback,xml.etree.ElementTree as ET
N=1e-9
SVG=5.0001e-5
AUTHORITY=${JSON.stringify(authority)}
PHYSICAL_ORACLE=${JSON.stringify(physicalOracleSource)}
PHYSICAL_STATUS=${JSON.stringify(physicalOracleStatus)}
SEED=json.loads(${JSON.stringify(seedJSON)})
LABELS=${JSON.stringify(config.groups)}
PARSER=${JSON.stringify(legacyParser.slice(0,parserEnd))}
def need(v,s):
 if not v:raise AssertionError(s)
def near(a,b,s,t=N):need(type(a) in [int,float] and math.isfinite(a) and abs(a-b)<=t,s+': '+str(a)+' != '+str(b))
def vec(a,b,s,t=N):
 need(isinstance(a,list) and len(a)==len(b),s+' dimensions')
 for i,(v,w) in enumerate(zip(a,b)):near(v,w,s+str(i),t)
def sha(b):return hashlib.sha256(b).hexdigest()
def load_item(item):
 with open(item['path'],'rb') as f:data=f.read()
 need(sha(data)==item['sha256'],'immutable input '+item['path'])
 return json.loads(data)
def physical_authority(reuse,pure):
 need(reuse['authority']==AUTHORITY,'new current D550 capture only')
 r=load_item(reuse['packet'])
 original=json.dumps(SEED,separators=(',',':'))
 need(r['documentJSON']==original and r['documentSHA256']==reuse['physicalDocumentSHA256']==sha(original.encode()),'exact original A native Doc and hash')
 need(r['sourceRevision']==reuse['sourceRevision'],'same current model source revision')
 need(r['outputs'][0]['nativeBRepSHA256']==reuse['nativeBRepSHA256'],'new native BRep association')
 if pure:
  ns={'__name__':'_d550_current_native_reference'}
  exec(compile(PHYSICAL_ORACLE,'<retained-D549-physical-contract>','exec'),ns)
  physical=ns['run']({'doc':SEED,'seedDoc':SEED,'expectedDoc':SEED,'documentJSON':original,'parameters':{'height':12},'read':r})
 else:
  independent=load_item(reuse['independent'])
  need(independent['status']=='${oracleStatus}' and independent['label']=='PURE_CANDIDATE' and independent['physicalPacketSHA256']==reuse['packet']['sha256'],'exact current independent result')
  physical=independent['currentPhysical']
 need(physical['status']==PHYSICAL_STATUS and physical['nativeBRepSHA256']==reuse['nativeBRepSHA256'] and physical['documentSHA256']==reuse['physicalDocumentSHA256'],'new physical PASS and source identity')
 need(physical['geometry']['genus']==1 and physical['geometry']['pcurveCount']==42 and physical['geometry']['pcurveStatus']=='EXERCISED_FINITE_ORIGINAL_UV_LIFTS','whole current body/UV authority')
 return r,physical
def model_source(doc):return {k:v for k,v in doc.items() if k!='drawing'}
def validate_doc(doc,expected,empty=False):
 need(doc==expected and model_source(doc)==model_source(SEED),'exact accepted expected Doc and all original source/cache/owners unchanged');s=doc['drawing'];base=SEED['drawing'];allowed={'dimensions','views','room','scale'};need({k:v for k,v in s.items() if k not in allowed}=={k:v for k,v in base.items() if k not in allowed},'only Auto dimensions/views/room/scale change; no tolerance/scope/section/detail mutation');need(s['sheet']=='A3' and 'orientation' not in s,'A3/default-Y preserved')
 if empty:need(s==base,'FIRST Undo returns exact unannotated A')
 need(set(s.get('views',['front','top','right','iso']))<={'front','top','right','iso'} and all(v in s.get('views',['front','top','right','iso']) for v in ['front','top']),'shown base views valid')
 if 'scale' in s:need(type(s['scale']) in [int,float] and math.isfinite(s['scale']) and s['scale']>0,'finite positive declared scale')
 return s
def dot(a,b):return sum(v*w for v,w in zip(a,b))
def project(p,pr):return [dot(p,pr['right']),dot(p,pr['up'])]
def paper(p,at):return [at['origin'][0]+at['scale']*p[0],at['origin'][1]-at['scale']*p[1]]
def same_line(a,b,c,d,t=N):return min(max(math.dist(a,c),math.dist(b,d)),max(math.dist(a,d),math.dist(b,c)))<=t
def edges_of(r):return r['outputs'][0]['brep']['edges']+r['cut']['brep']['edges']
def native_ends(r,name):
 out=[]
 for b in [r['outputs'][0]['brep'],r['cut']['brep']]:
  vs={v['id']:v['point'] for v in b['vertices']}
  for e in b['edges']:
   if e.get('name')==name:out.extend(vs[v] for v in e['vertices'])
 return out
def point_ref(ref,pr,r):
 need(set(ref)=={'edge','at','near'} and ref['at'] in ['end','center'],'generated exact unsigned endpoint/centre ref');vec(ref['near'],ref['near'],'finite near');need(len(ref['near'])==3,'3D original near');candidates=[]
 for e in pr['edges']:
  if e['name']!=ref['edge']:continue
  if ref['at']=='center' and e.get('circle'):candidates.append(e['circle']['center'])
  elif ref['at']=='end':
   for p in e.get('ends') or []:
    need(any(math.dist(p,q)<=N for q in native_ends(r,ref['edge'])),'reference endpoint belongs to original named BRep edge, no unsupported silhouette retarget');candidates.append(p)
 need(candidates,'current original named ref exists');p=min(candidates,key=lambda p:math.dist(p,ref['near']));near(math.dist(p,ref['near']),0,'Auto near is actual original source point')
 if ref['at']=='center':need(any(math.dist(p[:2],c)<=N for c in [[15,20],[57,37]]) and min(abs(p[2]),abs(p[2]-12))<=N,'declared original circular centre')
 return p
def plain(v):
 q=math.floor(v*100+.5)/100;return ('%.2f'%q).rstrip('0').rstrip('.')
def annotation_rows(doc,dr,r):
 dims=doc['drawing']['dimensions'];need(len({d['id'] for d in dims})==len(dims),'unique actual dimension IDs');observed=dr['dimensions'];need([q['dim'] for q in observed]==dims,'all product resolved rows own exact dimensions');rows=[];coverage=set()
 axes={'front':[[1,0,0],[0,0,1]],'top':[[1,0,0],[0,1,0]],'right':[[0,1,0],[0,0,1]],'section:A':[[1,0,0],[0,0,1]]}
 for d,q in zip(dims,observed):
  need(d['auto'] is True and d['kind'] in ['linear','diameter'] and isinstance(d['id'],str) and d['id'],'only observed automatic linear/diameter dimensions');need(d['view'] in axes,'bounded generated standard/SectionA view');pr=dr['projections'][d['view']];vec(pr['right'],axes[d['view']][0],'literal view right');vec(pr['up'],axes[d['view']][1],'literal view up');at=dr['placements'][d['view']];need(not at.get('hidden') and not at.get('breaks') and at['scale']>0,'current shown unbroken placement');vec(d['place'],d['place'],'finite authored place');need(len(d['place'])==2,'2D placement')
  need(q['ok'] is True and q['kind']==d['kind'],'current dimension resolves')
  if d['kind']=='linear':
   need(set(d)=={'id','view','kind','a','b','orient','place','auto'} and d['orient'] in ['horizontal','vertical'],'exact ordinary Auto linear fields');world=[point_ref(d[k],pr,r) for k in ['a','b']];a,z=[project(p,pr) for p in world];k=0 if d['orient']=='horizontal' else 1;value=abs(z[k]-a[k]);need(value>N,'nonzero independent linear value');vec(q['a'],a,'resolved original a');vec(q['b'],z,'resolved original b');text=plain(value);pa,pz=copy.deepcopy(a),copy.deepcopy(z)
   if k==0:pa[1]=pz[1]=d['place'][1]
   else:pa[0]=pz[0]=d['place'][0]
   A,Z=paper(pa,at),paper(pz,at);length=math.dist(A,Z)
   if length<7:
    u=[(b-a)/length for a,b in zip(A,Z)];A=[a-6*v for a,v in zip(A,u)];Z=[a+6*v for a,v in zip(Z,u)]
   axis=next(i for i,v in enumerate(pr['right' if k==0 else 'up']) if abs(v)>0.5);lo,hi=sorted(p[axis] for p in world)
   for index,(name,span) in enumerate([('overallX',60),('overallY',40),('overallZ',12)]):
    if axis==index and abs(lo)<=N and abs(hi-span)<=N:coverage.add(name)
   for index,name,target in [(0,'boreLocationX',15),(1,'boreLocationY',20)]:
    if axis==index and abs(lo)<=N and abs(hi-target)<=N and any(d[key]['at']=='center' and math.dist(p[:2],[15,20])<=N for key,p in zip(['a','b'],world)):coverage.add(name)
   result={'id':d['id'],'view':d['view'],'kind':'linear','value':value,'text':text,'world':world,'projected':[a,z],'primaryPaper':[A,Z]}
  else:
   need(set(d)=={'id','view','kind','edge','near','place','auto'},'exact ordinary Auto diameter fields');candidates=[e for e in pr['edges'] if e['name']==d['edge'] and e.get('circle')];need(candidates and native_ends(r,d['edge']),'actual original named circle ref');e=min(candidates,key=lambda e:math.dist(e['circle']['center'],d['near']));c=e['circle'];near(math.dist(c['center'],d['near']),0,'actual circle near');need(abs(dot(c['normal'],pr['toward']))>1-1e-9,'native circle round in selected view');need(any(math.dist(c['center'][:2],p)<=N and abs(c['radius']-radius)<=N for p,radius in [([15,20],5),([57,37],3)]),'declared original circle/radius');value=2*c['radius'];center=project(c['center'],pr);vec(q['center'],center,'resolved original circle centre');near(q['radius'],c['radius'],'resolved radius');text='Ø'+plain(value);C=paper(center,at);P=paper(d['place'],at);R=c['radius']*at['scale'];dist=math.dist(C,P);u=[(b-a)/dist for a,b in zip(C,P)] if dist>N else [1,0];rim=[a+R*v for a,v in zip(C,u)]
   primary=[rim,P] if dist>R+1 else [[a-R*v for a,v in zip(C,u)],rim]
   if abs(value-10)<=N and math.dist(c['center'][:2],[15,20])<=N:coverage.add('boreDiameter')
   result={'id':d['id'],'view':d['view'],'kind':'diameter','value':value,'text':text,'worldCenter':c['center'],'radius':c['radius'],'primaryPaper':primary}
  near(q['value'],value,'independent current numeric value');need(q['text']==text,'plain current text from measured value, no fabricated THRU/tolerance');rows.append(result)
 if dims:need(coverage=={'overallX','overallY','overallZ','boreLocationX','boreLocationY','boreDiameter'},'all six required semantic measurements, independent of count/IDs')
 return rows,sorted(coverage)
def lname(e):return e.tag.rsplit('}',1)[-1]
def svg_contract(text,doc,dr,rows,title,date,exported=False,actual_placements=None):
 root=ET.fromstring(text);need(lname(root)=='svg','original XML root');vec([float(v) for v in root.attrib['viewBox'].split()],[0,0,420,297] if exported else [-6,-6,432,309],'file/UI A3 root')
 if exported:need(root.attrib.get('width')=='420mm' and root.attrib.get('height')=='297mm' and [e.text for e in root if lname(e)=='title']==[title],'actual file millimetres/title')
 groups=[e for e in root.iter() if lname(e)=='g'];titles=[e for e in groups if 'title' in e.attrib.get('class','').split()];need(len(titles)==1,'one actual title block');tt=[e.text or '' for e in titles[0].iter() if lname(e)=='text'];field=lambda key:tt[tt.index(key)+1];scale=dr['layout']['scale'];st=str(int(scale))+':1' if scale>=1 else '1:'+str(int(1/scale));need(field('TITLE')==title and field('DATE')==date and field('UNITS')=='mm' and field('SCALE')==st and field('SHEET')=='A3' and 'SRC '+dr['sourceRevision'] in tt,'current observed title/date/units/scale/SRC')
 dims=[e for e in groups if 'dimension' in e.attrib.get('class','').split() and 'data-dim' in e.attrib];need([e.attrib['data-dim'] for e in dims]==[d['id'] for d in doc['drawing']['dimensions']],'all and only actual dimension groups in source order');maximum=0
 for group,row in zip(dims,rows):
  need(group.attrib.get('data-view')==row['view'],'local dimension view ownership');texts=[e.text or '' for e in group.iter() if lname(e)=='text'];need(texts==[row['text']],'actual native-bound numeric text');lines=[[[float(e.attrib[k]) for k in ['x1','y1']],[float(e.attrib[k]) for k in ['x2','y2']]] for e in group.iter() if lname(e)=='line'];A,Z=row['primaryPaper'];matched=[v for v in lines if same_line(v[0],v[1],A,Z,2*SVG)]
  need(len(matched)==1,'one independently located primary ruler/diameter leader')
  line=matched[0];expected=[A,Z] if math.dist(line[0],A)<=math.dist(line[0],Z) else [Z,A]
  for p,w in zip(line,expected):
   for v,q in zip(p,w):gap=abs(v-q);near(gap,0,'original serialized paper coordinate',SVG);maximum=max(maximum,gap)
 ns={};exec(compile(PARSER,'<retained-D455-pure-XML-functions>','exec'),ns);places=actual_placements or dr['placements'];legacy=ns['svg_consumer_contract']({'svg':text,'sectionPlacement':places['section:A'],'detailPlacement':places['detail:B']},12)
 detail=next(e for e in groups if 'detail' in e.attrib.get('class','').split() and e.attrib.get('data-dim')=='B' and e.attrib.get('data-view')=='detail:B');center=legacy['boreCenterSheet'];positive=[center[0]+12,center[1]];negative=[center[0]-12,center[1]];full=[];number=r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?'
 for e in detail.iter():
  if lname(e)!='path':continue
  path=e.attrib.get('d','');tokens=re.findall(number+r'|[A-Za-z]',path)
  if len(tokens)!=19 or tokens[0]!='M' or tokens[3]!='A' or tokens[11]!='A':continue
  need(re.sub(r'[\s,]','',path)==''.join(tokens),'complete clip path syntax');values=[float(tokens[k]) for k in [1,2,4,5,6,7,8,9,10,12,13,14,15,16,17,18]]
  if max(abs(values[k]-12) for k in [2,3,9,10])>SVG:continue
  vec(values[:2],positive,'clip R12 start',SVG);vec(values[7:9],negative,'clip R12 half end',SVG);vec(values[14:16],positive,'clip R12 full end',SVG);near(values[4],0,'clip rotation',SVG);near(values[11],0,'clip rotation',SVG);need(values[5]==values[12]==0 and values[6]==values[13] and values[6] in [0,1],'clip two complementary half flags');full.append(path)
 need(len(full)==1,'one actual R12 clip outline, separate from R10 bore')
 return {'status':'PASS_ALL_NATIVE_BOUND_DIMENSION_GROUPS_AND_RETAINED_SECTION_DETAIL_XML','dimensionCount':len(rows),'dimensions':[{'id':r['id'],'view':r['view'],'value':r['value'],'text':r['text']} for r in rows],'maximumPrimaryCoordinateErrorSheetMM':maximum,'coordinateEnvelopeSheetMM':SVG,'sectionDetail':legacy,'clipRadiusPaperMM':12,'clipOutlineCount':len(full),'sizeMM':[420,297],'scale':scale,'title':title,'date':date,'sourceRevision':dr['sourceRevision']}
def run(x):
 label=x['label'];pure=label=='PURE_CANDIDATE'
 need(pure or label in LABELS,'only pure candidate and six selected consumer groups')
 reuse=x['physicalReuse'];r,physical=physical_authority(reuse,pure)
 doc=x['doc'];s=validate_doc(doc,x['expectedDoc'],label==LABELS[1])
 need(x['seedDoc']==SEED,'exact recovered A seed')
 text=x['documentJSON'];need(json.loads(text)==doc,'original current accepted JSON')
 dr=x['drawingRead']
 need(dr['doc']==doc and json.loads(dr['documentJSON'])==doc and dr['physicalDocumentSHA256']==r['documentSHA256'] and dr['nativeBRepSHA256']==r['outputs'][0]['nativeBRepSHA256'] and dr['sourceRevision']==r['sourceRevision'] and dr['compiledPartDocument']==r['partDocument'],'separate physical/new drawing Doc/compiled source binding')
 need(dr['documentSHA256']==sha(dr['documentJSON'].encode()),'original pure drawing packet hash')
 for view in ['front','top','right','iso']:need(dr['projections'][view]==r['projections'][view],'pure drawing projection bound to current native capture '+view)
 need(dr['projections']['section:A']==r['provider']['section']['projection'],'pure section projection bound to current cut')
 rows,coverage=annotation_rows(doc,dr,r)
 if label=='PURE_CANDIDATE':need(rows,'Auto candidate adds actual annotations');need(not any(q['code'] in ['HOLE_SIZE_MISSING','HOLE_NOT_LOCATED','OVERALL_MISSING'] for q in dr['issues']),'selected missing-dimension coverage cleared; other issues remain separately reported')
 result={'status':'${oracleStatus}','label':label,'documentSHA256':sha(text.encode()),'physicalDocumentSHA256':r['documentSHA256'],'nativeBRepSHA256':r['outputs'][0]['nativeBRepSHA256'],'physicalAuthority':AUTHORITY,'physicalPacketSHA256':reuse['packet']['sha256'],'physicalExpected':physical['expected'],'sourceRevision':dr['sourceRevision'],'dimensions':rows,'semanticCoverage':coverage,'remainingIssues':dr['issues'],'consumer':'NOT_SUPPLIED_PURE_CANDIDATE_ONLY','actualSVGExport':None,'nativeSave':None,'budgets':{'nativeReferenceValueMM':N,'SVGCoordinateEnvelopeSheetMM':SVG},'limits':${JSON.stringify(config.limits)}}
 if pure:result['currentPhysical']=physical
 c=x.get('consumer')
 need(pure==(c is None),'actual current consumer for every selected group')
 if c is not None:
  need(label in LABELS,'six selected groups only');need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True and c['busy'] is False,'actual settled new Doc, separate from original physical Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b2','actual current b2 Worker');body=w['bodies'][0];near(body['volume'],float(physical['expected']['volumeMM3']),'actual Worker reused independent volume',N*float(physical['expected']['volumeMM3']));vec(body['centroid'],[float(v) for v in physical['expected']['centroidMM']],'actual Worker reused independent centroid');need(c['observerErrors']==[] and c['nativeWorkerConstructorPreserved'] is True and c['nativeWorkerPrototypePreserved'] is True,'actual passive observer identities')
  pair=c['workerPair'];need(pair['request']['doc']==r['bridge']['transportSource'] and pair['request']['options']=={'tangentEdges':False,'sections':[{'id':'A','view':'front','at':23}],'made':True},'same actual evaluated source/options even when drawing metadata differs');need(pair['reply']['drawing']['ok'] is True and pair['reply']['id']==pair['id'] and re.fullmatch('[0-9a-f]{64}',pair['rawV8SHA256']),'original actual pair/hash');section=next(a for a in pair['reply']['drawing']['sections'] if a['id']=='A');need(section['result']==r['bridge']['sectionResult'] and pair['reply']['drawing']['views']['top']==r['bridge']['topProjection'],'same original actual section/top provider, no forged new native Doc')
  for view in ['front','top','right','iso']:need(pair['reply']['drawing']['views'][view]==dr['projections'][view],'actual all-view projection matches frozen original-source pure observation '+view)
  key=str(pair['generation'])+'/'+str(pair['worker'])+'/'+str(pair['id']);need(pair['observationMode'] in ['NEW_CURRENT_PAIR','EXACT_CURRENT_DOC_PAIR_REUSE'],'honest actual pair mode')
  if pair['observationMode']=='EXACT_CURRENT_DOC_PAIR_REUSE' and key==pair['initialKey']:need(pair['rawV8SHA256']==pair['initialRawV8SHA256'],'exact initial original V8 custody on reuse')
  for view,at in dr['placements'].items():
   if at.get('hidden'):continue
   actual=c['placements'][view];vec(actual['origin'],at['origin'],'actual current '+view+' origin');near(actual['scale'],at['scale'],'actual scale');near(actual['yScale'],at['scale'],'actual yScale');vec(actual['crossAxis'],[0,0],'orthogonal actual axes');vec(actual['box'],at['box'],'actual current box')
  need([q['id'] for q in c['summary']['dimensions']]==[d['id'] for d in s['dimensions']],'actual all-dimension summary ownership')
  for q,row in zip(c['summary']['dimensions'],rows):near(q['value'],row['value'],'actual independent resolved value');need(q['text']==row['text'] and 'lost' not in q,'actual native-bound resolved text')
  result['consumer']='PASS_CURRENT_DOC_WORKER_ALL_ANNOTATIONS_AND_XML';result['currentDOM']=svg_contract(c['svg'],doc,dr,rows,c['titleObservation'],c['date'],actual_placements=c['placements'])
  if label==LABELS[0]:need(x['before']['doc']==SEED and x['before']['dirty'] is False,'one necessary exact original baseline before public Auto');need(c['dirty'] is True,'public Auto dirties drawing')
  if label in LABELS[3:]:need(c['dirty'] is False,'explicit Save and saved Open/export remain clean')
  if 'nativeSave' in x:
   saved=x['nativeSave'];data=bytes(saved['bytes']);need(sha(data)==saved['sha256'] and json.loads(data.decode('utf8'))==doc,'actual original native Save bytes/accepted annotations');result['nativeSave']={'bytes':len(data),'sha256':saved['sha256'],'filename':saved['filename']}
  if label==LABELS[3]:need('nativeSave' in x,'actual owned Save file required')
  if label==LABELS[4]:need('nativeSave' in x,'actual saved file source required on Open')
  if label==LABELS[5]:
   e=x['svgExport'];data=bytes(e['bytes']);need(e['sha256']==sha(data) and e['documentSHA256']==sha(text.encode()) and e['nativeBRepSHA256']==reuse['nativeBRepSHA256'] and e['sheetIndex']==0 and e['filename']==c['fileName']+'.svg' and e['title']==c['titleObservation'],'actual file/original native class/new Doc/current filename association');selected=svg_contract(e['domSVG'],doc,dr,rows,c['titleObservation'],c['date'],actual_placements=c['placements']);file=svg_contract(data.decode('utf8'),doc,dr,rows,c['titleObservation'],c['date'],True,c['placements']);before=x['exportBaseline'];need(before['documentJSON']==text and before['workerBodies']==w['bodies'] and before['historyRows']==c['historyRows'] and before['dirty']==c['dirty'],'export retains exact observed Doc/body/history/dirty');result['actualSVGExport']={'bytes':len(data),'sha256':e['sha256'],'filename':e['filename'],'file':file,'selectedDOM':selected,'retention':'PASS_EXACT_OBSERVED_BASELINE','authority':'Actual bytes plus independent native-reference/paper/XML checks; paired BRep is metadata, not embedded SVG'}
 return result
if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as e:print(json.dumps({'status':'FAIL_D550_ANNOTATION_CONTRACT','error':{'type':type(e).__name__,'message':str(e)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;

// Root runs after the independent candidate PASS. CLI: CONTROL ORACLE_JSON FRESH_FREEZE.
export const freezeSource=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const control=resolve(process.argv[2]),oracleFile=resolve(process.argv[3]),output=resolve(process.argv[4]);
const evidenceRoot=${JSON.stringify(evidenceRoot)};
assert.ok((output.startsWith(evidenceRoot+'/')||output.startsWith('/tmp/barocss-d550-'))&&!existsSync(output),'fresh owned freeze output required');
const read=path=>readFileSync(path,'utf8');
const capturePath=join(control,'receipt.json'),captureBytes=read(capturePath),capture=JSON.parse(captureBytes);
const oracleBytes=read(oracleFile),proof=JSON.parse(oracleBytes);
assert.equal(capture.status,'CAPTURED_D550_PURE_CANDIDATE_PENDING_INDEPENDENT');
assert.equal(proof.status,'${oracleStatus}');
assert.equal(proof.label,'PURE_CANDIDATE');
assert.equal(proof.physicalPacketSHA256,capture.physicalReuse.packet.sha256);
assert.equal(proof.nativeBRepSHA256,capture.physicalReuse.nativeBRepSHA256);
assert.equal(proof.physicalDocumentSHA256,capture.physicalReuse.physicalDocumentSHA256);
assert.equal(proof.documentSHA256,capture.candidate.sha256);
assert.equal(proof.currentPhysical.status,'${physicalOracleStatus}');
for(const item of capture.artifacts)assert.equal(sha(readFileSync(item.path)),item.sha256,item.path);
const oracleInput=JSON.parse(read(capture.oracleInput.path));
const candidateBytes=read(capture.candidate.path);
const A=${JSON.stringify(seedDoc)},B=JSON.parse(candidateBytes),drawings=JSON.parse(read(capture.drawingReads.path));
assert.deepEqual(oracleInput.doc,B);
assert.deepEqual(oracleInput.physicalReuse,capture.physicalReuse);
assert.deepEqual(oracleInput.drawingRead,drawings.B);
assert.deepEqual(drawings.A.doc,A);
assert.deepEqual(drawings.B.doc,B);
assert.equal(drawings.B.documentJSON,candidateBytes);
const state=(doc,documentJSON)=>({doc,documentJSON,documentSHA256:sha(documentJSON)});
const states={A:state(A,drawings.A.documentJSON),B:state(B,candidateBytes)};
mkdirSync(output);
const expectedFiles={A:join(output,'expected-A.bcad'),B:join(output,'expected-B.bcad')};
for(const name of ['A','B'])writeFileSync(expectedFiles[name],states[name].documentJSON);
const independent={path:oracleFile,sha256:sha(oracleBytes)};
const physicalReuse={...capture.physicalReuse,independent};
const artifacts=[...capture.artifacts,{path:capturePath,sha256:sha(captureBytes)},independent,
 ...['A','B'].map(name=>({path:expectedFiles[name],sha256:states[name].documentSHA256}))];
const runtime={workId:'D550',status:'PASS_D550_EXPECTED_ANNOTATION_CANDIDATE_FROZEN_AFTER_INDEPENDENT',
 seedPath:${JSON.stringify(seedPath)},seedSHA256:${JSON.stringify(seedSHA256)},physicalReuse,states,
 historicalD549:${JSON.stringify(historicalD549)},drawingReadsFile:capture.drawingReads.path,drawingReadsSHA256:capture.drawingReads.sha256,
 captureReceipt:capturePath,captureReceiptSHA256:sha(captureBytes),candidateFile:capture.candidate.path,candidateSHA256:capture.candidate.sha256,
 independentReceipt:oracleFile,independentReceiptSHA256:independent.sha256,inputFile:capture.oracleInput.path,inputSHA256:capture.oracleInput.sha256,
 sourcePinsFile:capture.sourcePinsFile,sourcePinsSHA256:capture.sourcePinsSHA256,expectedFiles,artifacts,calls:capture.calls};
writeFileSync(join(output,'runtime-config.json'),JSON.stringify(runtime,null,2));
console.log(JSON.stringify({status:runtime.status,output,physicalReuse,calls:capture.calls}));
`;
