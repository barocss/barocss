// D541 finite flanged-shaft observer and independent standard-library oracle.
import {seedText} from './flanged-shaft-admission-preflight.mjs';
import {inspectorSource as bracketInspector} from './bracket-baseline-oracles.mjs';
import {oracleSource as enclosureOracle} from './enclosure-baseline-oracles.mjs';
export {seedText};
const between=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<=i)throw Error('retained utility boundary changed: '+a);return s.slice(i,j);};
const displayStart=bracketInspector.indexOf('  const selected=snapshot.outputs.findIndex'),displayEnd=bracketInspector.indexOf('  result.outputIds=');
if(displayStart<0||displayEnd<=displayStart)throw Error('retained observer display boundary changed');
// Original capture/mass/graph observations remain unchanged. Replace only the
// B01 line mapper with real top/rim pointer maps from this part's native graph.
export const inspectorSource=bracketInspector.slice(0,displayStart)+`  result.display=safe(()=>displayMaps(doc,snapshot,result.outputs));\n`+bracketInspector.slice(displayEnd)+String.raw`
function displayMaps(doc:any,snapshot:any,outputs:any[]){
 const display:any={authority:'ORIGINAL_NATIVE_NAMES_TO_PUBLIC_POINTER_INDICES_ONLY',quality:8,bodies:outputs.map((r:any,i:number)=>({bodyIndex:i,bodyKey:r.bodyKey,outputId:r.outputId}))};
 if(outputs.length!==1||![5,6].includes(doc.nodes.length)){display.status='NOT_REQUESTED_FOR_THIS_STAGE';return display;}
 const raw=outputs[0],mesh=bodyMesh(snapshot.outputs[0].brep,0,8),H=Number(doc.nodes[3].from)+Number(doc.nodes[3].height);display.bodyIndex=0;display.bodyKey=raw.bodyKey;
 if(doc.nodes.length===5){
  const members=raw.surfaces.filter((f:any)=>f.geometry.kind==='plane'&&Math.abs(f.geometry.o[2]-H)<=1e-9&&Math.abs(f.geometry.n[0])<=1e-9&&Math.abs(f.geometry.n[1])<=1e-9&&Math.abs(f.geometry.n[2]-1)<=1e-9);if(members.length!==1)throw Error('one original upward shaft top required');
  const name=members[0].name,mapped=mesh.faces.filter((f:any)=>f.kind==='plane'&&f.name.split('+').includes(name));if(mapped.length!==1)throw Error('one real displayed shaft top required');
  display.top={index:mapped[0].index,bodyIndex:0,bodyKey:raw.bodyKey,nativeName:name,nativeNames:[name],nativeMembers:members,world:[5,0,H]};
 }else{
  const members=raw.edgeProbes.filter((e:any)=>e.degree>1&&e.probe?.samples?.length===9&&e.probe.samples.every((p:number[])=>Math.abs(p[2]-H)<=1e-9&&Math.abs(Math.hypot(p[0],p[1])-10)<=1e-9)),names=[...new Set(members.map((e:any)=>e.name))];if(!names.length)throw Error('original top outer rim absent');
  const mapped=mesh.edges.filter((e:any)=>!e.straight&&e.names.length===names.length&&e.names.every((n:string)=>names.includes(n)));if(mapped.length!==1)throw Error('one real complete outer rim required');
  const world=members.flatMap((e:any)=>e.probe.samples).sort((a:number[],b:number[])=>a[1]-b[1])[0];display.rim={index:mapped[0].index,bodyIndex:0,bodyKey:raw.bodyKey,nativeNames:[...mapped[0].names],nativeMembers:members,world,a:mapped[0].a,b:mapped[0].b};
 }return display;
}
`;

// Reuse only independent scalar, rational and graph algorithms. Their source
// boundaries are guarded; no product import or native evaluation occurs here.
const scalars=between(enclosureOracle,'def need(','def provenance(');
const rational=between(enclosureOracle,'def deboor(','def carriers(');
const trims=between(enclosureOracle,'def loop_area(','def native_geometry(');
const graph=between(enclosureOracle,'def native_geometry(',' observations=');
export const oracleSource=String.raw`
import copy,hashlib,json,math,re,sys,traceback
from decimal import Decimal,localcontext
N=1e-9
PI=Decimal('3.14159265358979323846264338327950288419716939937510')
SEED_TEXT=${JSON.stringify(seedText)}
RIM=['n3.side0#1|n3.top','n3.side0#2|n3.top']
${scalars}
${rational}
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
${trims}
def cylinder_receipt(made,r,h,z):
 if made is None: return 'ABSENT_CONTROLLED_OR_EDITED_SOURCE'
 need(isinstance(made,dict) and set(made)<= {'command','values','nodes'} and made.get('command')=='cylinder' and made.get('nodes',2)==2,'two-node public Cylinder receipt');v=made.get('values');need(isinstance(v,dict) and set(v)>= {'r','h','x','y','z'} and set(v)<= {'r','h','x','y','z','up'},'exact Cylinder receipt fields')
 for k,w in {'r':r,'h':h,'x':0,'y':0,'z':z}.items():
  q=v[k];need(type(q) in [int,float,str] and (not isinstance(q,str) or re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)',q)) and math.isfinite(float(q)) and float(q)==w,'Cylinder receipt agrees with source '+k)
 need(v.get('up','+z')=='+z','unrotated public Cylinder');return 'PRESERVED_PUBLIC_CYLINDER_RECEIPT'
def source(doc,H,seed,anchors):
 need(seed==json.loads(SEED_TEXT),'exact empty New-part source');stage={2:'flange',4:'shaftNew',5:'union',6:'hole',7:'finish'}.get(len(doc['nodes']));need(stage is not None and (H==30 or (H==40 and stage=='finish')),'finite declared stage/height classes')
 expected=copy.deepcopy(seed);nodes=[{'kind':'sketch','profile':'circle','center':[0,0],'radius':20,'id':'n0'},{'kind':'extrude','sketch':0,'height':6,'id':'n1'}]
 if stage!='flange': nodes += [{'kind':'sketch','profile':'circle','center':[0,0],'radius':10,'id':'n2'},{'kind':'extrude','sketch':2,'height':H-5,'from':5,'id':'n3'}]
 if stage in ['union','hole','finish']: nodes.append({'kind':'union','left':{'node':1,'side':'solid'},'right':{'node':3,'side':'solid'},'id':'n4'})
 if stage in ['hole','finish']: nodes.append({'kind':'hole','parent':{'node':4,'side':'solid'},'radius':3,'center':[0,0],'face':'n3.top','id':'n5'})
 if stage=='finish':
  need(isinstance(anchors,dict) and set(anchors)==set(RIM),'original A signature dictionary provided')
  for name,s in anchors.items(): need(s=={'k':'curve','p':[10,0,30],'s':0,'n':2},'actual admitted A shared-circle anchor retained')
  need(set(doc['nodes'][6]['edges'])==set(RIM) and len(doc['nodes'][6]['edges'])==2,'both actual native top-rim aliases');nodes.append({'kind':'fillet','parent':{'node':5,'side':'solid'},'edges':doc['nodes'][6]['edges'],'radius':1,'id':'n6','sigs':anchors})
 receipts={};actual=False
 for i in [1,3]:
  if i>=len(nodes): continue
  made=doc['nodes'][i].get('made');receipts['n'+str(i)]=cylinder_receipt(made,20 if i==1 else 10,6 if i==1 else 25,0 if i==1 else 5)
  if made is not None: actual=True;nodes[i]['made']=made
  if i==3 and made is not None: need(H==30,'shaft receipt is dropped after changed Distance')
 if actual: need('made'in doc['nodes'][1],'actual flange Cylinder receipt retained')
 if H==40: need('made'not in doc['nodes'][3],'B shaft stale receipt absent')
 expected.update({'nodes':nodes,'nextId':len(nodes),'outputs':{'b1':{'node':1,'side':'solid'},'b3':{'node':3,'side':'solid'}} if stage=='shaftNew' else {'b'+str(len(nodes)-1):{'node':len(nodes)-1,'side':'solid'}}});need(doc==expected,'exact entire original source, circles, positive overlap, DAG, references, metadata and output ownership')
 return stage,receipts
def compiled(doc):
 fs=[]
 for n in doc['nodes']:
  k=n['kind'];i=n['id']
  if k=='sketch': fs.append(dict(n))
  elif k=='extrude': fs.append(dict({'id':i,'kind':k,'sketch':'n'+str(n['sketch']),'height':n['height']},**({'from':n['from']} if 'from'in n else {})))
  elif k=='union': fs.append({'id':i,'kind':k,'target':'n1','tool':'n3'})
  elif k=='hole': fs.append({'id':i,'kind':k,'target':'n4','radius':3,'center':[0,0],'face':'n3.top'})
  elif k=='fillet': fs.append({'id':i,'kind':k,'target':'n5','edges':n['edges'],'radius':1})
 return {'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':fs}
def physical(H,stage):
 h=Decimal(H)
 def one(v,mz,bounds): return {'volume':v,'mass':v/1000,'centroid':[Decimal(0),Decimal(0),mz/v],'bounds':bounds}
 flange=one(2400*PI,7200*PI,{'min':[-20,-20,0],'max':[20,20,6]})
 if stage=='flange': return {'n1':flange}
 if stage=='shaftNew': return {'n1':flange,'n3':one(100*(h-5)*PI,50*(h*h-25)*PI,{'min':[-10,-10,5],'max':[10,10,H]})}
 holed=stage in ['hole','finish'];D=2*PI*(9*(1-PI/4)+Decimal(1)/6);v=PI*(1800+(91 if holed else 100)*h);mz=PI*(5400+(Decimal('45.5') if holed else 50)*h*h)
 if stage=='finish': v-=D;mz-=(h-1)*D+Decimal(13)*PI/4
 return {'n'+str({'union':4,'hole':5,'finish':6}[stage]):one(v,mz,{'min':[-20,-20,0],'max':[20,20,H]})}
def carriers(H,stage,owner):
 if owner=='n1': return [('bottom',0,-1,400*PI),('top',6,1,400*PI)],[{'role':'flange','c':[0,0],'r':20,'sign':1,'levels':[0,6]}]
 if owner=='n3': return [('bottom',5,-1,100*PI),('top',H,1,100*PI)],[{'role':'shaft','c':[0,0],'r':10,'sign':1,'levels':[5,H]}]
 holed=stage in ['hole','finish'];finished=stage=='finish';planes=[('bottom',0,-1,(391 if holed else 400)*PI),('shoulder',6,1,300*PI),('top',H,1,(72 if finished else 91 if holed else 100)*PI)];cs=[{'role':'flange','c':[0,0],'r':20,'sign':1,'levels':[0,6]},{'role':'shaft','c':[0,0],'r':10,'sign':1,'levels':[6,H-1 if finished else H]}]
 if holed: cs.append({'role':'bore','c':[0,0],'r':3,'sign':-1,'levels':[0,H]})
 return planes,cs
${graph}
 observations={s['id']:s for s in raw['surfaces']};need(len(observations)==len(raw['surfaces'])==len(faces) and set(observations)==set(faces),'all original face observations');planes,cylinders=carriers(width,wall,raw['outputId']);H=width;selectedStage=wall;roles=set();areas={p[0]:0. for p in planes};axial={c['role']:[] for c in cylinders};torus_faces=[];max_normal=0.;max_carrier=0.;max_probe=0.
 for f in faces.values():
  ob=observations[f['id']];need(ob['name']==f.get('name'),'original face observer name');g=ob['geometry'];matches=[]
  if g['kind']=='plane': matches=[('plane',p) for p in planes if abs(g['o'][2]-p[1])<=N and math.dist(g['n'],[0,0,p[2]])<=N]
  elif g['kind']=='cylinder': matches=[('cylinder',c) for c in cylinders if abs(g['r']-c['r'])<=N and math.dist(g['c'][:2],c['c'])<=N and math.dist([abs(v) for v in g['a']],[0,0,1])<=N and g['out']==c['sign']]
  elif g['kind']=='other' and selectedStage=='finish' and f.get('name','').startswith('n6.face'): matches=[('torus',{'role':'topFillet','major':9,'minor':1,'z':H-1})]
  need(len(matches)==1,'unique source-defined actual plane/cylinder/independent torus');kind,spec=matches[0];role=spec[0] if kind=='plane' else spec['role'];roles.add(role)
  def support(p):
   nonlocal max_carrier
   if kind=='plane': gap=abs(p[2]-spec[1]);normal=[0,0,spec[2]]
   elif kind=='cylinder': rho=math.hypot(p[0],p[1]);gap=abs(rho-spec['r']);normal=[spec['sign']*p[0]/rho,spec['sign']*p[1]/rho,0]
   else:
    rho=math.hypot(p[0],p[1]);a=rho-9;z=p[2]-(H-1);gap=abs(math.hypot(a,z)-1);need(a>=-N and z>=-N and a<=1+N and z<=1+N,'actual source outer-quarter torus domain');normal=unit([a*p[0]/rho,a*p[1]/rho,z])
   max_carrier=max(max_carrier,gap);near(gap,0,'independent original carrier equation');return normal
  boundary=[p for lid in f['loops'] for cid in loops[lid]['coedges'] for p in points[co[cid]['edge']]]
  for p in boundary: support(p)
  if kind=='plane': areas[role]+=abs(sum(loop_area(loops[lid],co,edges,points,2,cylinders+[{'c':[0,0],'r':9}]) for lid in f['loops']))
  elif kind=='cylinder':
   axial[role]+=boundary
   for p in boundary: need(spec['levels'][0]-N<=p[2]<=spec['levels'][1]+N,'original cylinder axial trim range')
  else: torus_faces.append(f['id'])
  sf=f['surface'];U=[sf['knotsU'][sf['degreeU']],sf['knotsU'][len(sf['controlPoints'])]];V=[sf['knotsV'][sf['degreeV']],sf['knotsV'][len(sf['controlPoints'][0])]];need(ob['probe']['domain']=={'u':U,'v':V} and len(ob['probe']['probes'])==2,'original observed surface domain/stations')
  for q,(a,z) in zip(ob['probe']['probes'],[(.21,.37),(.71,.63)]):
   near(q['u'],U[0]+a*(U[1]-U[0]),'original surface U station');near(q['v'],V[0]+z*(V[1]-V[0]),'original surface V station');p,du,dv=surface_d1(sf,q['u'],q['v']);vec(q['point'],p,'independent raw rational point');vec(q['du'],du,'independent raw rational du');vec(q['dv'],dv,'independent raw rational dv');normal=[v*(1 if f['sense']=='forward' else -1) for v in unit(cross(du,dv))];wanted=support(p);vec(normal,wanted,'independent outward source carrier normal');vec(q['normal'],normal,'observed native normal');need(q['normalNorm']>0,'regular observed derivatives');max_normal=max(max_normal,max(abs(a-b) for a,b in zip(normal,wanted)));max_probe=max(max_probe,max(abs(a-b) for a,b in zip(q['point']+q['du']+q['dv'],p+du+dv)))
 wanted_roles={p[0] for p in planes}|{c['role'] for c in cylinders}|({'topFillet'} if selectedStage=='finish' else set());need(roles==wanted_roles,'every declared original material carrier present');area_errors={}
 for role,z,sign,wanted in planes: area_errors[role]={'actualAreaMM2':areas[role],'expectedMM2':str(wanted),'errorMM2':decimal_close(areas[role],wanted,Decimal('1e-9'),'original oriented planar trim area '+role)}
 rim_checks=[]
 for c in cylinders:
  ps=axial[c['role']];need(ps,'original cylinder trim boundary');vec([min(p[2] for p in ps),max(p[2] for p in ps)],c['levels'],'complete original cylinder trim extents')
  for level in c['levels']: rim_checks.append({'role':c['role'],'zMM':level,'intervals':circle_coverage(points,edges,c,level)})
 if selectedStage=='finish':
  need(len(torus_faces)==2,'two original rational torus patches, product OTHER classification retained');rim_checks.append({'role':'topFilletTopContact','zMM':H,'intervals':circle_coverage(points,edges,{'c':[0,0],'r':9},H)})
 ep={e['id']:e for e in raw['edgeProbes']};need(len(ep)==len(raw['edgeProbes']) and set(ep)==set(edges),'all original edge observations')
 for eid,e in edges.items():
  q=ep[eid];a,z=domain(e['curve']);need(q['name']==e.get('name') and q['degree']==e['curve']['degree'] and q['probe']['domain']==[a,z] and len(q['probe']['samples'])==9,'original observed curve metadata/stations')
  for i,p in enumerate(q['probe']['samples']): vec(p,curve(e['curve'],a+(z-a)*i/8),'independent original edge sample')
 vertex_bounds={side:[fn(v['point'][i] for v in verts.values()) for i in range(3)] for side,fn in [('min',min),('max',max)]};boundary_bounds={side:[fn(p[i] for ps in points.values() for p in ps) for i in range(3)] for side,fn in [('min',min),('max',max)]}
 return {'counts':{k:len(b[k]) for k in keys},'genus':genus,'eulerCharacteristic':chi,'carrierRoles':sorted(roles),'originalPlanarTrimAreas':area_errors,'originalCompleteRims':rim_checks,'originalVertexBounds':vertex_bounds,'originalBoundaryWitnessBounds':boundary_bounds,'boundsAuthority':'ORIGINAL_RATIONAL_CURVE_EXTREMA_WITNESSES_WITH_COMPLETE_SOURCE_CIRCLE_RIMS_AND_CARRIER_LIMITS; VERTEX_EXTENTS_ALONE_ARE_NOT_MATERIAL_BOUNDS','torus':{'productClassification':'OTHER_RETAINED','independentCarrier':'OUTER_QUARTER_TORUS_MAJOR9_MINOR1_AXIS_Z' if torus_faces else 'NOT_PRESENT','originalFaceIds':torus_faces},'maximumEndpointGapMM':max_endpoint,'maximumCarrierGapMM':max_carrier,'maximumRationalObservationGapMM':max_probe,'maximumOutwardNormalComponentError':max_normal,'pcurveCount':pcurves,'pcurveStatus':'PASS_ORIGINAL_OPTIONAL_PCURVE_FINITE_WITNESSES' if pcurves else 'NOT_EXERCISED_ORIGINAL_PCURVES_ABSENT','maximumPcurveLiftGapMM':max_lift}
def display_check(read,doc,stage,H):
 d=read.get('display',{});status=d.get('status')
 if status=='NOT_REQUESTED_CONTROLLED_NATIVE_ADMISSION': return 'NOT_REQUESTED_PRESERVED_CONTROLLED_PACKET'
 need(d.get('authority')=='ORIGINAL_NATIVE_NAMES_TO_PUBLIC_POINTER_INDICES_ONLY' and d['quality']==8,'display is pointer observer only')
 if stage in ['union','hole']:
  r=read['outputs'][0];m=d['top' if stage=='union' else 'rim'];need(m['bodyIndex']==0 and m['bodyKey']==r['bodyKey'] and m['index']>=0,'real current pointer owner');members=m['nativeMembers']
  if stage=='union': need(len(members)==1 and members[0] in r['surfaces'] and m['nativeName']=='n3.top' and m['nativeNames']==['n3.top'],'actual original top face mapping');vec(m['world'],[5,0,H],'actual interior top point')
  else:
   need(set(m['nativeNames'])==set(RIM) and len(members)==2 and all(e in r['edgeProbes'] and e['name'] in RIM for e in members),'actual complete original outer-rim mapping');near(m['world'][2],H,'actual rim pointer height');near(math.hypot(*m['world'][:2]),10,'actual rim pointer radius');need(any(math.dist(m['world'],p)<=N for e in members for p in e['probe']['samples']),'pointer from actual original native curve')
 return 'PASS_CURRENT_NATIVE_TO_PUBLIC_POINTER_MAPPING_ONLY'
def run(x):
 params=x['parameters'];need(set(params)=={'height'} and type(params['height']) in [int,float] and params['height'] in [30,40],'two declared final height classes');H=params['height'];doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(doc==x['expectedDoc'],'exact caller-held accepted raw Doc');stage,receipts=source(doc,H,x['seedDoc'],x.get('referenceAnchors'));expected=physical(H,stage)
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[] and hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'original raw Doc/reader/hash identity');need(rd['partDocument']==compiled(doc),'exact current central native lowering/DAG/reference authority');request=rd.get('request',{});need(request.get('parameters')==params or request.get('parameters')=={'height':H,'shaftDistance':H-5,'stage':stage},'original inspector request/source class without metadata rewriting');need(len(rd['outputs'])==len(expected) and set(rd['outputIds'])==set(expected) and rd['bodyCount']==len(expected),'all live original outputs');native={}
 for raw in rd['outputs']:
  owner=raw['outputId'];e=expected[owner];need(raw['bodyKey']=='b'+owner[1:] and raw['nativeBodyCount']==1,'native body owner/count');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original BRep bytes/hash');need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'density1 native MMGS units');need(raw['productChecks']['authority']=='PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE','product checks labelled');genus=1 if stage in ['hole','finish'] else 0
  for name in ['default','strict','output']:
   c=raw['productChecks'][name];need(c['valid'] is True and c['issues']==[] and len(c['topology'])==1 and c['topology'][0]['genus']==genus,'observed product validity '+name)
  errors={}
  for key in ['massProperties','brepMass']:
   m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact','quadrature'],'native nonmesh mass observation');ve=decimal_close(m['volume'],e['volume'],Decimal('1e-9')*e['volume'],key+' independent declared-profile volume');me=decimal_close(m['mass'],e['mass'],Decimal('1e-9'),key+' density1 grams');ce=max(decimal_close(v,q,Decimal('1e-9'),key+' centroid') for v,q in zip(m['centroid'],e['centroid']));errors[key]={'volumeRelative':ve/float(e['volume']),'massAbsoluteG':me,'centroidAbsoluteMM':ce}
  g=native_geometry(raw,H,stage,genus,'HoleRow' if stage=='hole' else stage)
  for side in ['min','max']: vec(raw['bounds'][side],e['bounds'][side],'native material bounds');vec(g['originalBoundaryWitnessBounds'][side],e['bounds'][side],'independent original rational boundary extrema')
  native[owner]={'nativeBRepSHA256':raw['nativeBRepSHA256'],'massErrors':errors,'geometry':g}
 pointer=display_check(rd,doc,stage,H);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh exact Studio raw Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==len(expected),'fresh actual Worker body count');bs={b['key']:b for b in w['bodies']};need(set(bs)=={'b'+o[1:] for o in expected},'fresh Worker output ownership')
  for owner,e in expected.items():
   body=bs['b'+owner[1:]];decimal_close(body['volume'],e['volume'],Decimal('1e-9')*e['volume'],'fresh Worker volume')
   for v,q in zip(body['centroid'],e['centroid']): decimal_close(v,q,Decimal('1e-9'),'fresh Worker centroid')
  worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D541_FLANGED_SHAFT_STATE','stage':stage,'parameters':params,'documentSHA256':rd['documentSHA256'],'sourceProvenance':receipts,'expected':{o:{'volumeMM3':str(e['volume']),'massDensity1G':str(e['mass']),'centroidMM':[str(v) for v in e['centroid']],'bounds':e['bounds']} for o,e in expected.items()},'native':native,'pointerMapping':pointer,'worker':worker,'budgets':{'nativeVolumeRelative':N,'centroidBoundsCarrierEndpointD1PcurveMM':N,'nativeUnitNormalComponent':N,'density1MassAbsoluteG':N,'planarTrimAreaMM2':N},'limits':['Only flangeR20z0..6, shaftR10z5..30/40, positive1mm overlap, Union, central ThroughR3 and outer top FilletR1.','Original A signatures are historical shared-circle identity anchors; current physical trims are checked separately. Actual public Cylinder receipts may be removed by the accepted public Distance edit.','The two finish patches retain product OTHER classification. Independent raw rational equation/normal witnesses establish the declared torus carrier without inventing a product label.','Original directed graph, nominal complete rim intervals and finite raw rational/normal/UV witnesses are not a full-domain trim or general Boolean theorem. Absent pcurves stay NOT_EXERCISED.','No other B03 branch, catalog material mass/inertia, manufacturing/mobile/exchange/release acceptance.']}
if __name__=='__main__':
 try:
  with localcontext() as context: context.prec=60;result=run(json.load(sys.stdin))
  print(json.dumps(result,indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D541_DECLARED_FLANGED_SHAFT_STATE','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
