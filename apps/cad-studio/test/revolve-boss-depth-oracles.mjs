// D540: retained support-boss Depth interaction; no shaft/flange claim.
import {seedText,seedSHA256,inspectorSource,oracleSource as bracketOracleSource} from './bracket-baseline-oracles.mjs';
export {seedText,seedSHA256,inspectorSource};

// The observer is unchanged. Only its CLI is replaced for this finite control.
const inspectorMain='\nconst inputFile=';
if(!inspectorSource.includes(inspectorMain))throw Error('retained inspector CLI boundary changed');
// CLI: PREFLIGHT OUT_DIR EXACT_SEED ARCHIVED_A_PACKET. Root owns execution.
export const preflightSource=inspectorSource.slice(0,inspectorSource.indexOf(inspectorMain))+String.raw`
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
const assert=(v:any,m:string)=>{if(!v)throw Error(m);};
const out=process.argv[2],seedFile=process.argv[3],archiveFile=process.argv[4];
assert(out&&!existsSync(out),'control output must be new');mkdirSync(out,{recursive:true});
const save=(name:string,value:any)=>writeFileSync(join(out,name),typeof value==='string'?value:JSON.stringify(value,null,2));
const original=readFileSync(seedFile,'utf8');save('seed.bcad',original);
assert(Buffer.byteLength(original)===3431&&sha(original)==='${seedSHA256}','exact retained D448 seed');
const seed=JSON.parse(original),archiveBytes=readFileSync(archiveFile,'utf8'),archive=JSON.parse(archiveBytes);
save('archived-A-native.stdout.json',archiveBytes);
assert(archive.ok&&archive.documentJSON===JSON.stringify(seed),'archived A exact source identity');
const setDepth=(doc:any,depth:number)=>{const field=editFields(doc.nodes,3,doc.parameters).find((f:any)=>f.key==='d');assert(field&&field.label==='Depth','public Revolve Depth field');return {...doc,nodes:field.set(doc.nodes,depth)};};
const B=setDepth(seed,20);save('B.bcad',JSON.stringify(B));
const expected=structuredClone(seed);expected.nodes[2].max[1]=29;
assert(JSON.stringify(B)===JSON.stringify(expected)&&JSON.stringify(seed)===JSON.stringify(JSON.parse(original)),'only original meridian top changes');
const positive=inspect(B,{label:'B20',parameters:{depth:20}});save('B-native.stdout.json',positive);
assert(positive.ok===true&&positive.inputUnchanged===true,'new B native evaluation');
const invalid=setDepth(B,0);save('Depth0.bcad',JSON.stringify(invalid));
const negative=inspect(invalid,{label:'Depth0',parameters:{depth:0}});save('Depth0-native.stdout.json',negative);
assert(negative.ok===false&&negative.inputUnchanged===true&&typeof negative.error?.code==='string','collapsed meridian must return typed native refusal');
assert(JSON.stringify(B)===JSON.stringify(expected),'rejected control did not mutate accepted B');
const receipt={status:'PASS_D540_CONTROLLED_SOURCE_ADMISSION_ONLY',seedSHA256:sha(original),archivedA:{path:archiveFile,packetSHA256:sha(archiveBytes),request:archive.request,role:'UNCHANGED_ARCHIVED_NATIVE_PACKET_NO_NATIVE_A_REPLAY'},B:{path:join(out,'B-native.stdout.json'),documentSHA256:positive.documentSHA256},Depth0:{path:join(out,'Depth0-native.stdout.json'),error:negative.error},limits:['Controlled public field setter and native observations only; no GUI/history/independent physical qualification.']};
save('receipt.json',receipt);console.log(JSON.stringify(receipt));
`;

// Reuse the independent B01 rational/graph mathematics, stopping before its
// width-specific entry point. No product code runs inside this Python oracle.
const oracleMain='\ndef run(x):';
if(!bracketOracleSource.includes(oracleMain))throw Error('retained Python entry boundary changed');
export const oracleSource=bracketOracleSource.slice(0,bracketOracleSource.indexOf(oracleMain))+String.raw`
H=None
_retained_carriers=carriers
_retained_native_geometry=native_geometry
def carriers(width):
 planes,cylinders=_retained_carriers(width)
 return [(role,([0,0,H] if role=='bossTop' else origin),normal) for role,origin,normal in planes],cylinders
def physical_depth(depth):
 h=Decimal(9+depth);P=Decimal(23840)+40*PI;V=P+PI*(91*h-1000)
 return {'volume':V,'mass':V/1000,'centroid':[10*P/V,Decimal(0),(5*P+PI*(Decimal('45.5')*h*h-5000))/V],'bounds':{'min':[-20,-20,0],'max':[40,20,9+depth]}}
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
def loop_area(loop,co,edges,points,axis,circles):
 keep=[i for i in range(3) if i!=axis];area=0.
 for cid in loop['coedges']:
  use=co[cid];edge=edges[use['edge']];ps=points[edge['id']];ps=ps if use['sense']=='forward' else list(reversed(ps));a=[ps[0][k] for k in keep];b=[ps[-1][k] for k in keep];area+=(a[0]*b[1]-a[1]*b[0])/2
  if edge['curve']['degree']!=1:
   need(axis==2,'only declared horizontal circular cap trims');matches=[c for c in circles if all(abs(math.dist(p[:2],c['c'])-c['r'])<=N for p in ps)];need(len(matches)==1,'one original declared circle for curved cap trim');c=matches[0];angles=[math.atan2(p[1]-c['c'][1],p[0]-c['c'][0]) for p in ps];sweep=sum(wrap(z-a) for a,z in zip(angles,angles[1:]));need(0<abs(sweep)<=2*math.pi+N,'directed original circular trim');area+=c['r']**2*(sweep-math.sin(sweep))/2
 return area
def circle_coverage(points,spec,level):
 intervals=[]
 for ps in points.values():
  if not all(abs(p[2]-level)<=N and abs(math.dist(p[:2],spec['c'])-spec['r'])<=N for p in ps): continue
  angles=[math.atan2(p[1]-spec['c'][1],p[0]-spec['c'][0]) for p in ps];turns=[wrap(z-a) for a,z in zip(angles,angles[1:])];need(all(abs(t)<math.pi for t in turns),'ordered original rim witnesses');sweep=sum(turns);need(abs(sweep)>0,'positive rim interval');start=angles[0] if sweep>0 else angles[-1];a=start%(2*math.pi);z=a+abs(sweep)
  if z<=2*math.pi+N: intervals.append((a,min(z,2*math.pi)))
  else: intervals.extend([(a,2*math.pi),(0,z-2*math.pi)])
 need(intervals,'original rim present');end=0.
 for a,z in sorted(intervals): need(a<=end+N/spec['r'],'original full rim has no angular gap');end=max(end,z)
 near(end,2*math.pi,'complete original circular-rim extent',N/spec['r']);return len(intervals)
def depth_geometry(raw):
 graph=_retained_native_geometry(raw,60);b=raw['brep'];faces={f['id']:f for f in b['faces']};loops={v['id']:v for v in b['loops']};co={v['id']:v for v in b['coedges']};edges={e['id']:e for e in b['edges']};points={}
 for eid,e in edges.items():
  a,z=domain(e['curve']);points[eid]=[curve(e['curve'],a+(z-a)*i/8) for i in range(9)]
  if e['curve']['degree']==1:
   start,end=points[eid][0],points[eid][-1];direction=sub(end,start);length=math.sqrt(dot(direction,direction));need(length>0,'noncollapsed original straight trim');stations=[]
   for p in points[eid]: d=sub(p,start);near(math.sqrt(dot(cross(direction,d),cross(direction,d)))/length,0,'original straight trim carrier');stations.append(dot(d,direction)/length)
   need(all(z>=a-N for a,z in zip(stations,stations[1:])),'ordered original straight trim')
 planes,cylinders=carriers(60);circles=[{'role':role,'c':c,'r':r,'sign':sign,'levels':[10,H] if role=='boss' else [0,H] if role=='bore' else [0,10]} for role,c,r,sign in cylinders];areas={role:0. for role,o,n in planes};cylinder_bounds={c['role']:[] for c in circles}
 for ob in raw['surfaces']:
  f=faces[ob['id']];need(ob['name']==f.get('name'),'original carrier name join');g=ob['geometry'];boundary=[p for lid in f['loops'] for cid in loops[lid]['coedges'] for p in points[co[cid]['edge']]]
  if g['kind']=='plane':
   matches=[(role,o,n) for role,o,n in planes if math.dist(g['n'],n)<=N and abs(dot(n,sub(g['o'],o)))<=N];need(len(matches)==1,'declared original plane');role,o,n=matches[0];axis=next(i for i,v in enumerate(n) if abs(v)==1);areas[role]+=abs(sum(loop_area(loops[lid],co,edges,points,axis,circles) for lid in f['loops']))
  else:
   matches=[c for c in circles if abs(g['r']-c['r'])<=N and math.dist(g['c'][:2],c['c'])<=N];need(len(matches)==1,'declared original cylinder');c=matches[0];vec([abs(g['a'][0]),abs(g['a'][1]),abs(g['a'][2])],[0,0,1],'source cylinder axis');need(g['out']==c['sign'],'source cylinder outward sense');cylinder_bounds[c['role']]+=boundary
   for p in boundary: need(c['levels'][0]-N<=p[2]<=c['levels'][1]+N,'original cylinder trimmed axial range')
 wanted={'left':Decimal(360),'right':Decimal(360),'front':Decimal(560),'back':Decimal(560),'bottom':2384-5*PI,'plateTop':2384-96*PI,'bossTop':91*PI};area_errors={}
 for role,value in wanted.items(): area_errors[role]={'areaMM2':areas[role],'expectedMM2':str(value),'errorMM2':decimal_close(areas[role],value,Decimal('1e-9'),'original directed planar trim area '+role)}
 rims=[]
 for c in circles:
  ps=cylinder_bounds[c['role']];need(ps,'original cylinder boundary present');vec([min(p[2] for p in ps),max(p[2] for p in ps)],c['levels'],'actual complete original cylinder axial extent')
  if c['role'] in ['boss','bore']:
   for level in c['levels']: rims.append({'role':c['role'],'zMM':level,'intervals':circle_coverage(points,c,level)})
 bounds={side:[fn(v['point'][i] for v in b['vertices']) for i in range(3)] for side,fn in [('min',min),('max',max)]}
 for side in ['min','max']: vec(bounds[side],{'min':[-20,-20,0],'max':[40,20,H]}[side],'independent original boundary extrema')
 graph.update({'originalPlanarTrimAreas':area_errors,'originalCompleteRims':rims,'originalVertexBounds':bounds,'pcurveStatus':'PASS_ORIGINAL_OPTIONAL_PCURVE_FINITE_WITNESSES' if graph['pcurveCount'] else 'NOT_EXERCISED_ORIGINAL_PCURVES_ABSENT'})
 if not graph['pcurveCount']: graph['maximumPcurveLiftGapMM']=None
 return graph
def compiled(doc):
 features=[]
 for n in doc['nodes']:
  if n['kind']=='sketch': features.append({k:v for k,v in n.items() if k not in ['outline','on','construction','association']})
  elif n['kind']=='extrude': features.append({'id':'n1','kind':'extrude','sketch':'n0','height':10})
  elif n['kind']=='revolve': features.append({'id':'n3','kind':'revolve','sketch':'n2','axis':{'origin':[0,0],'direction':'y'},'angle':360})
  elif n['kind']=='union': features.append({'id':'n4','kind':'union','target':'n1','tool':'n3'})
  elif n['kind']=='hole': features.append({'id':'n5','kind':'hole','target':'n4','radius':3,'center':[0,0],'face':'n3.side[e3]'})
  elif n['kind']=='fillet': features.append({'id':'n6','kind':'fillet','target':'n5','edges':n['edges'],'radius':2,'expect':{k:{'kind':v['k'],'at':v['p'],'dir':v['d'],'size':v['s']} for k,v in n['sigs'].items()}})
 return {'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':features}
def run(x):
 global H
 need(len(SEED_TEXT.encode())==3431 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained D448 actual seed');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller exact retained antecedent');params=x['parameters'];need(set(params)=={'depth'} and type(params['depth']) in [int,float] and params['depth'] in [16,20],'only finite declared Depth16/20 classes');depth=params['depth'];H=9+depth
 doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);expectedDoc=json.loads(SEED_TEXT);expectedDoc['nodes'][2]['max'][1]=H;need(doc==x['expectedDoc']==expectedDoc,'only original compact meridian maxY changes; entire DAG/plane/side tags/historical signatures retained');residuals=source(seed,60,seed);expected=physical_depth(depth)
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[] and hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'original raw Doc/reader/hash identity');need(rd['partDocument']==compiled(doc),'current central native lowering with exact source DAG/reference authority')
 request=rd['request'];archived=request=={'label':'W60','width':60};need((archived and depth==16) or request.get('parameters')==params,'original request metadata joins exact source class');requestRole='UNCHANGED_ARCHIVED_D538_A_REQUEST' if archived else 'CURRENT_DEPTH_REQUEST'
 need(rd['outputIds']==['n6'] and rd['bodyCount']==1 and rd['bodyKey']=='b6' and rd['outputId']=='n6' and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0],'sole original n6/b6 ownership');raw=rd['outputs'][0];need(raw['outputId']=='n6' and raw['bodyKey']=='b6' and raw['nativeBodyCount']==1,'original output ownership');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original BRep bytes/hash')
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit density1 native MMGS');need(raw['productChecks']['authority']=='PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE','product checks labelled')
 for label in ['default','strict','output']:
  observed=raw['productChecks'][label];need(observed['valid'] is True and observed['issues']==[] and len(observed['topology'])==1 and observed['topology'][0]['genus']==1,'observed product validity '+label)
 errors={}
 for method in ['massProperties','brepMass']:
  m=raw[method];need(finite(m) and m['method'] in ['closed-form','planar-exact','quadrature'],'native nonmesh mass observation');ve=decimal_close(m['volume'],expected['volume'],Decimal('1e-9')*expected['volume'],method+' independent support/boss/bore/fillet volume');me=decimal_close(m['mass'],expected['mass'],Decimal('1e-9'),method+' density1 grams');ce=max(decimal_close(v,q,Decimal('1e-9'),method+' centroid') for v,q in zip(m['centroid'],expected['centroid']));errors[method]={'volumeRelative':ve/float(expected['volume']),'massAbsoluteG':me,'centroidAbsoluteMM':ce}
 for side in ['min','max']: vec(raw['bounds'][side],expected['bounds'][side],'native material bounds')
 graph=depth_geometry(raw);measure=measurement(raw,rd['display'],60);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh exact actual Studio Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b6','fresh current Worker b6');body=w['bodies'][0];decimal_close(body['volume'],expected['volume'],Decimal('1e-9')*expected['volume'],'fresh Worker volume')
  for v,q in zip(body['centroid'],expected['centroid']): decimal_close(v,q,Decimal('1e-9'),'fresh Worker centroid')
  worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D540_REVOLVE_BOSS_DEPTH_STATE','parameters':params,'heightMM':H,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'request':{'role':requestRole,'original':request},'constraintResiduals':residuals,'expected':{'volumeMM3':str(expected['volume']),'massDensity1G':str(expected['mass']),'centroidMM':[str(v) for v in expected['centroid']],'bounds':expected['bounds']},'native':{'massErrors':errors,'geometry':graph},'unchangedCurrentPlateEdge':measure,'worker':worker,'budgets':{'sourceLinearMM':LINEAR,'sourceAngularRad':ANGULAR,'nativeVolumeRelative':N,'nativeCentroidBoundsCarrierEndpointD1PcurveMM':N,'nativeUnitNormalComponent':N,'density1MassAbsoluteG':N,'planarTrimAreaAbsoluteMM2':N},'limits':['Only exact retained support: plate60x40x10, full360 R10 meridian z9..25/29, positive1mm overlap, Union, R3 bore z0..25/29, four original vertical R2 finishes.','Original stored Fillet signatures remain historical identity anchors, distinct from current physical boundaries.','Original raw graphs, complete nominal boss/bore rims, planar trim areas and finite rational carrier/normal witnesses are not a full-domain trim or general Boolean theorem.','Absent optional pcurves leave UV lift NOT_EXERCISED. Density1 mass is not catalog material mass. No true shaft/flange/B03 completion, inertia/manufacturing/mobile/exchange/release claim.']}
if __name__=='__main__':
 try:
  with localcontext() as context: context.prec=60;result=run(json.load(sys.stdin))
  print(json.dumps(result,indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D540_DECLARED_REVOLVE_BOSS_DEPTH_STATE','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
