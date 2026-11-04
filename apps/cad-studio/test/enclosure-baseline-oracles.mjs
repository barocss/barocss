// D539 finite enclosure observer and independent physical oracle.
// The retained seed and controlled admission source remain immutable.
import {seedText, seedSHA256} from './enclosure-admission-preflight.mjs';
export {seedText, seedSHA256};

// Bundle TS stdin from apps/cad-studio. CLI: inspector.mjs RAW_DOC OPTIONS_JSON.
// Packet fields match the preserved controlled admission packets. Python can
// inspect their original BReps without replaying native evaluation.
export const inspectorSource = String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {bodyMesh} from '../../packages/barocss-cad-model/src/engine/mesh.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,curveDomain,curveEvaluator} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const close=(a:number[],b:number[])=>a.length===b.length&&a.every((v,i)=>Number.isFinite(v)&&Math.abs(v-b[i])<=1e-9);
function displayMaps(doc:any,snapshot:any,outputs:any[]){
 const stage=doc.nodes.length,display:any={authority:'ORIGINAL_NATIVE_NAMES_TO_PUBLIC_POINTER_INDICES_ONLY',quality:8,sourceRole:'bodyMesh maps original native names and endpoints to real pointer indices; no display geometry is physical authority',bodies:[]};
 const meshes=snapshot.outputs.map((output:any,i:number)=>{const mesh=bodyMesh(output.brep,0,8);display.bodies.push({bodyIndex:i,bodyKey:outputs[i].bodyKey,outputId:output.id});return mesh;});
 if(outputs.length===1){display.bodyIndex=0;display.bodyKey=outputs[0].bodyKey;}
 if(stage===6){
  const i=outputs.findIndex((o:any)=>o.outputId==='n5');if(i<0)throw Error('current Union output absent');const raw=outputs[i],mesh=meshes[i];
  const members=raw.faces.filter((f:any)=>{const g=f.geometry;return g.kind==='plane'&&Math.abs(g.o[2]-6)<=1e-9&&close(g.n,[0,0,1]);});if(members.length!==1)throw Error('one original current rail top required');
  const name=members[0].name,faces=mesh.faces.filter((f:any)=>f.kind==='plane'&&f.name.split('+').includes(name));if(faces.length!==1)throw Error('one displayed current rail top required');
  display.railTop={index:faces[0].index,nativeName:name,nativeNames:members.map((f:any)=>f.name),nativeMembers:members,world:[5,0,6],bodyIndex:i,bodyKey:raw.bodyKey};
 }
 if(stage===7){
  const i=outputs.findIndex((o:any)=>o.outputId==='n6');if(i<0)throw Error('current Hole-row output absent');const raw=outputs[i],mesh=meshes[i],width=Number(doc.nodes[0].max[0])-Number(doc.nodes[0].min[0]);
  display.corners=[[width-20,-20],[-20,-20],[width-20,20],[-20,20]].map(([x,y])=>{
   const expected=[[x,y,0],[x,y,10]],members=raw.edges.filter((e:any)=>e.curve.degree===1&&e.curve.controlPoints.length===2&&expected.every(p=>e.endpoints.some((q:number[])=>close(p,q))));if(members.length!==1)throw Error('one original complete outer vertical corner required');
   const member=members[0],edges=mesh.edges.filter((e:any)=>e.straight&&e.names.includes(member.name)&&expected.every(p=>[e.a,e.b].some((q:number[])=>close(p,q))));if(edges.length!==1)throw Error('one displayed current outer corner required');const e=edges[0],a=member.endpoints[0],b=member.endpoints[1];
   return {index:e.index,nativeNames:[...e.names],nativeMembers:members,world:a.map((v:number,j:number)=>(v+b[j])/2),a:e.a,b:e.b,bodyIndex:i,bodyKey:raw.bodyKey};
  });
 }
 return display;
}
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),packet:any={ok:false,status:'FAIL_CAPTURE_READINESS',authority:'ORIGINAL_RAW_MODEL_DOC_CURRENT_TO_PART_DOCUMENT',request,documentJSON,documentSHA256:sha(documentJSON),outputs:[]};
 try{
  packet.partDocument=toPartDocument(doc);const snapshot=evaluateCadPart(packet.partDocument);
  // ALL original native output graphs and bytes precede selected assertions.
  for(const output of snapshot.outputs){const nativeBRepJSON=JSON.stringify(output.brep);packet.outputs.push({outputId:output.id,bodyKey:bodyKeyOf(output.id,doc.nodes),representation:output.representation,nativeBodyCount:output.bodyCount,brep:output.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  packet.reader=safe(()=>readStudioDoc(documentJSON));
  snapshot.outputs.forEach((output:any,i:number)=>{const raw=packet.outputs[i],b=output.brep,vertices=new Map(b.vertices.map((v:any)=>[v.id,v.point]));
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
   raw.mass=safe(()=>massPropertiesOf(output,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));raw.productChecks={authority:'PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE',default:safe(()=>checkBrep(b)),strict:safe(()=>checkBrep(b,{strict:true})),output:safe(()=>checkOutput(output))};
   raw.faces=b.faces.map((f:any)=>({id:f.id,name:f.name,sense:f.sense,loops:f.loops,geometry:safe(()=>faceGeometry(f))}));
   raw.edges=b.edges.map((e:any)=>({id:e.id,name:e.name,curve:e.curve,endpoints:e.vertices.map((v:string)=>vertices.get(v)),probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.25,.5,.75,1].map(t=>at(a+(z-a)*t))};})}));
  });
  packet.display=safe(()=>displayMaps(doc,snapshot,packet.outputs));packet.outputIds=packet.outputs.map((o:any)=>o.outputId);packet.bodyCount=packet.outputs.length;packet.target=packet.outputs.length===1?packet.outputs[0]:null;packet.bodyKey=packet.target?.bodyKey??null;
  packet.ok=true;packet.status='CAPTURED';
 }catch(cause){packet.error=error(cause);}
 packet.inputUnchanged=JSON.stringify(doc)===documentJSON;return packet;
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

// Independent Python: standard-library Decimal, topology and raw rational math.
// It accepts preserved NON_UI packets as well as fresh actual Studio packets.
export const oracleSource = String.raw`
import copy,hashlib,json,math,re,sys,traceback
from decimal import Decimal,localcontext
N=1e-9
LINEAR=1e-7
ANGULAR=1e-9
PI=Decimal('3.14159265358979323846264338327950288419716939937510')
SEED_TEXT=${JSON.stringify(seedText)}
SEED_SHA='${seedSHA256}'
CORNERS=['n1.side[e1]|n1.side[e2]','n1.side[e1]|n1.side[e4]','n1.side[e2]|n1.side[e3]','n1.side[e3]|n1.side[e4]']
def need(v,label):
 if not v: raise AssertionError(label)
def near(a,b,label,t=N):
 need(isinstance(a,(int,float)) and not isinstance(a,bool) and math.isfinite(a) and abs(a-b)<=t,f'{label}: {a} != {b}; budget {t}')
def vec(a,b,label,t=N):
 need(isinstance(a,list) and len(a)==len(b),label+' dimensions')
 for i,(v,w) in enumerate(zip(a,b)): near(v,w,label+str(i),t)
def finite(x):
 if x is None or isinstance(x,(str,bool)): return True
 if isinstance(x,(int,float)): return math.isfinite(x)
 if isinstance(x,list): return all(finite(v) for v in x)
 if isinstance(x,dict): return all(finite(v) for v in x.values())
 return False
def sub(a,b): return [v-w for v,w in zip(a,b)]
def dot(a,b): return sum(v*w for v,w in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(v):
 size=math.sqrt(dot(v,v));need(size>0,'nondegenerate direction');return [x/size for x in v]
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
def decimal_close(actual,wanted,t,label):
 need(isinstance(actual,(int,float)) and not isinstance(actual,bool) and math.isfinite(actual),label+' finite');value=Decimal(actual) if isinstance(actual,int) else Decimal.from_float(actual);gap=abs(value-wanted);need(gap<=t,f'{label}: {value} != {wanted}; budget {t}');return float(gap)
def provenance(made):
 if made is None: return 'ABSENT_CONTROLLED_AUTHORED_BLUEPRINT'
 need(isinstance(made,dict) and set(made)<= {'command','values','nodes'} and made.get('command')=='box' and made.get('nodes',2)==2,'only original two-node Box provenance')
 values=made.get('values');need(isinstance(values,dict) and set(values)<= {'w','d','h','x','y','z','up'} and set(values)>= {'w','d','h','x','y','z'},'original Box provenance fields')
 for k,wanted in {'w':30,'d':6,'h':5,'x':0,'y':-3,'z':1}.items():
  v=values[k];need(type(v) in [int,float,str] and (not isinstance(v,str) or re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)',v)) and math.isfinite(float(v)) and float(v)==wanted,'Box provenance agrees with actual source '+k)
 need(values.get('up','+z')=='+z','Box is unrotated +Z');return 'PRESERVED_ACTUAL_BOX_COMMAND_PROVENANCE'
def source(doc,width,wall,copies,seed,anchors):
 stage={3:'baseShell',5:'railNew',6:'union',7:'HoleRow',8:'finish'}.get(len(doc['nodes']));need(stage is not None,'selected finite source stage')
 need((width,wall,copies) in ([(80,2,3)] if stage!='finish' else [(80,2,3),(90,2,3),(90,3,3),(90,3,2)]),'predeclared positive classes only')
 need(doc['format']=='barocss-cad-model' and doc['schema']==3 and doc['units']=='mm' and doc['parameters']=={} and doc['nextId']==len(doc['nodes']),'ordinary schema3/mm source ownership')
 need(set(doc)==set(seed) and {k:v for k,v in doc.items() if k not in ['nodes','outputs','nextId']}=={k:v for k,v in seed.items() if k not in ['nodes','outputs','nextId']},'root configuration/metadata retained')
 ns=doc['nodes'];stock=copy.deepcopy(seed['nodes'][0]);stock['max'][0]=width-20;stock['outline']['points']=[[-20,-20],[width-20,-20],[width-20,20],[-20,20]];stock['outline']['lengths']['0']=width
 need(ns[0]==stock and ns[1]==seed['nodes'][1] and ns[2]==dict(seed['nodes'][2],thickness=wall),'actual stock/locked outline/HV/tags/Extrude10/Shell/open/historical signature')
 made='NO_RAIL_AT_THIS_STAGE'
 if len(ns)>=5:
  sketch=ns[3];need(set(sketch)<= {'kind','profile','min','max','sideTags','id'} and {k:v for k,v in sketch.items() if k!='sideTags'}=={'kind':'sketch','profile':'rectangle','min':[0,-3],'max':[30,3],'id':'n3'},'actual rail rectangle source')
  need('sideTags' not in sketch or sketch['sideTags']=={'outer':['e1','e2','e3','e4']},'only absent public Box tags or declared controlled stable tags')
  rail=ns[4];need(set(rail)<= {'kind','sketch','height','from','id','made'} and {k:v for k,v in rail.items() if k!='made'}=={'kind':'extrude','sketch':3,'height':5,'from':1,'id':'n4'},'actual rail worldz1..6 source');made=provenance(rail.get('made'))
 if len(ns)>=6: need(ns[5]=={'kind':'union','left':{'node':2,'side':'solid'},'right':{'node':4,'side':'solid'},'id':'n5'},'same actual Shell/rail Union parents')
 if len(ns)>=7: need(ns[6]=={'kind':'hole','parent':{'node':5,'side':'solid'},'radius':1,'center':[5,0],'face':'n4.top','pattern':{'count':copies,'step':[10,0]},'id':'n6'},'world-coordinate real rail-top Through Hole row and original parent')
 if len(ns)>=8:
  f=ns[7];need(set(f)=={'kind','parent','edges','radius','id','sigs'} and {k:v for k,v in f.items() if k not in ['edges','sigs']}=={'kind':'fillet','parent':{'node':6,'side':'solid'},'radius':1,'id':'n7'} and len(f['edges'])==4 and set(f['edges'])==set(CORNERS),'four original outer vertical R1 references')
  need(isinstance(anchors,dict) and f['sigs']==anchors and set(anchors)==set(CORNERS),'actual A signature dictionary remains immutable')
  for name,sig in anchors.items():
   need(set(sig)=={'k','p','d','s'} and sig['k']=='line','actual helper line signature fields');near(sig['s'],10,'historical A edge length');vec([abs(v) for v in sig['d']],[0,0,1],'historical A vertical direction');point=[60 if 'side[e2]' in name else -20,-20 if 'side[e1]' in name else 20,5];vec(sig['p'],point,'historical A identity anchor')
 outputs={'b2':{'node':2,'side':'solid'},'b4':{'node':4,'side':'solid'}} if stage=='railNew' else {'b'+str(len(ns)-1):{'node':len(ns)-1,'side':'solid'}};need(doc['outputs']==outputs,'all raw live output aliases')
 pts=stock['outline']['points'];linear=[];angular=[]
 for i in range(4):
  edge=sub(pts[(i+1)%4],pts[i]);linear.append(abs(edge[1] if i%2==0 else edge[0]));angular.append(abs(math.atan2(abs(edge[1] if i%2==0 else edge[0]),abs(edge[0] if i%2==0 else edge[1]))))
 for i,wanted in stock['outline']['lengths'].items(): linear.append(abs(math.dist(pts[int(i)],pts[(int(i)+1)%4])-wanted))
 need(max(linear)<=LINEAR and max(angular)<=ANGULAR,'existing source linear/angular budgets');need(180*(wall-1)>0 and 180*(6-wall)>0,'positive floor overlap and positive rail addition, never contact-only')
 return stage,made,{'linearMaximumMM':max(linear),'angularMaximumRad':max(angular),'linearLimitMM':LINEAR,'angularLimitRad':ANGULAR}
def compiled(doc):
 result=[]
 def expect(sigs): return {k:{'kind':v['k'],'at':v['p'],'dir':v['d'],'size':v['s']} for k,v in sigs.items()}
 for node in doc['nodes']:
  kind=node['kind'];fid=node['id']
  if kind=='sketch': result.append({k:v for k,v in node.items() if k not in ['outline','on','construction','association']})
  elif kind=='extrude': result.append(dict({'id':fid,'kind':kind,'sketch':'n'+str(node['sketch']),'height':node['height']},**({'from':node['from']} if 'from' in node else {})))
  elif kind=='shell': result.append({'id':fid,'kind':kind,'target':'n1','thickness':node['thickness'],'open':node['open'],'expect':expect(node['sigs'])})
  elif kind=='union': result.append({'id':fid,'kind':kind,'target':'n2','tool':'n4'})
  elif kind=='hole':
   count=node['pattern']['count']
   for j in range(count): result.append({'id':fid if j==count-1 else fid+'_p'+str(j),'kind':'hole','target':'n5' if j==0 else fid+'_p'+str(j-1),'center':[5+10*j,0],'radius':1,'face':'n4.top'})
  elif kind=='fillet': result.append({'id':fid,'kind':kind,'target':'n6','edges':node['edges'],'radius':1,'expect':expect(node['sigs'])})
 return {'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':result}
def physical(width,wall,copies,stage):
 w=Decimal(width);t=Decimal(wall);vc=(w-2*t)*(40-2*t)*(10-t);S=400*w-vc;R=180*(6-t);F=10*(4-PI);Q=6*copies*PI;mx=(w/2-20)*S;mz=2000*w-vc*(10+t)/2;bounds={'min':[-20,-20,0],'max':[width-20,20,10]}
 def item(v,x,z,box=bounds): return {'volume':v,'mass':v/1000,'centroid':[x/v,Decimal(0),z/v],'bounds':box}
 if stage=='baseShell': return {'n2':item(S,mx,mz)}
 if stage=='railNew': return {'n2':item(S,mx,mz),'n4':item(Decimal(900),Decimal(13500),Decimal(3150),{'min':[0,-3,1],'max':[30,3,6]})}
 holes=stage in ['HoleRow','finish'];finish=stage=='finish';hole_mx=6*PI*sum(5+10*i for i in range(copies)) if holes else 0;V=S+R-(Q if holes else 0)-(F if finish else 0);X=(w/2-20)*(S-(F if finish else 0))+15*R-hole_mx;Z=mz+R*(t+6)/2-(3*Q if holes else 0)-(5*F if finish else 0)
 return {'n'+str({'union':5,'HoleRow':6,'finish':7}[stage]):item(V,X,Z)}
def deboor(points,knots,degree,t):
 n=len(points)-1;need(n>=degree>=0 and len(knots)==len(points)+degree+1,'original rational dimensions');lo,hi=knots[degree],knots[n+1];need(lo<=t<=hi and lo<hi,'original rational domain');k=n if t==hi else next(i for i in range(degree,n+1) if knots[i]<=t<knots[i+1]);q=[list(points[j]) for j in range(k-degree,k+1)]
 for r in range(1,degree+1):
  for j in range(degree,r-1,-1):
   i=k-degree+j;den=knots[i+degree-r+1]-knots[i];a=(t-knots[i])/den if den else 0;q[j]=[(1-a)*v+a*w for v,w in zip(q[j-1],q[j])]
 return q[degree]
def derivative(points,knots,degree,t):
 need(degree>=1,'positive rational degree');d=[]
 for i in range(len(points)-1):
  den=knots[i+degree+1]-knots[i+1];d.append([degree*(b-a)/den if den else 0 for a,b in zip(points[i],points[i+1])])
 return deboor(d,knots[1:-1],degree-1,t)
def domain(c): return c['knots'][c['degree']],c['knots'][len(c['controlPoints'])]
def curve(c,t):
 p=c['controlPoints'];w=c['weights'];need(len(p)==len(w) and all(v>0 for v in w),'positive original curve weights');q=deboor([[v*ww for v in pp]+[ww] for pp,ww in zip(p,w)],c['knots'],c['degree'],t);need(q[-1]>0,'positive curve denominator');return [v/q[-1] for v in q[:-1]]
def surface_d1(s,u,v):
 need(s['kind']=='surface','native rational surface');p=s['controlPoints'];w=s['weights'];need(len(p)==len(w) and all(len(a)==len(b) for a,b in zip(p,w)) and all(ww>0 for row in w for ww in row),'positive original surface weights');h=[[[q*ww for q in pp]+[ww] for pp,ww in zip(row,weights)] for row,weights in zip(p,w)];rows=[deboor(row,s['knotsV'],s['degreeV'],v) for row in h];rowsv=[derivative(row,s['knotsV'],s['degreeV'],v) for row in h];q=deboor(rows,s['knotsU'],s['degreeU'],u);du=derivative(rows,s['knotsU'],s['degreeU'],u);dv=deboor(rowsv,s['knotsU'],s['degreeU'],u);need(q[3]>0,'positive surface denominator');return [a/q[3] for a in q[:3]],[(a*q[3]-b*du[3])/q[3]**2 for a,b in zip(du[:3],q[:3])],[(a*q[3]-b*dv[3])/q[3]**2 for a,b in zip(dv[:3],q[:3])]
def carriers(width,wall,copies,stage,owner):
 planes=[];cylinders=[]
 def plane(role,origin,normal,area): planes.append({'role':role,'o':origin,'n':normal,'area':area})
 if owner=='n4':
  for role,o,n,a in [('railLeft',[0,0,0],[-1,0,0],30),('railRight',[30,0,0],[1,0,0],30),('railFront',[0,-3,0],[0,-1,0],150),('railBack',[0,3,0],[0,1,0],150),('railBottom',[0,0,1],[0,0,-1],180),('railTop',[0,0,6],[0,0,1],180)]: plane(role,o,n,a)
  return planes,cylinders
 holes=stage in ['HoleRow','finish'];finish=stage=='finish';rail=stage in ['union','HoleRow','finish'];P=Decimal(40*width)-(4-PI if finish else 0);inner=Decimal((width-2*wall)*(40-2*wall));Q=Decimal(copies)*PI if holes else 0
 for role,o,n,a in [('outerLeft',[-20,0,0],[-1,0,0],10*(40-(2 if finish else 0))),('outerRight',[width-20,0,0],[1,0,0],10*(40-(2 if finish else 0))),('outerFront',[0,-20,0],[0,-1,0],10*(width-(2 if finish else 0))),('outerBack',[0,20,0],[0,1,0],10*(width-(2 if finish else 0))),('innerLeft',[-20+wall,0,0],[1,0,0],(40-2*wall)*(10-wall)),('innerRight',[width-20-wall,0,0],[-1,0,0],(40-2*wall)*(10-wall)),('innerFront',[0,-20+wall,0],[0,1,0],(width-2*wall)*(10-wall)),('innerBack',[0,20-wall,0],[0,-1,0],(width-2*wall)*(10-wall)),('bottom',[0,0,0],[0,0,-1],P-Q),('floor',[0,0,wall],[0,0,1],inner-(180 if rail else 0)),('rim',[0,0,10],[0,0,1],P-inner)]: plane(role,o,n,a)
 if rail:
  for role,o,n,a in [('railLeft',[0,0,0],[-1,0,0],6*(6-wall)),('railRight',[30,0,0],[1,0,0],6*(6-wall)),('railFront',[0,-3,0],[0,-1,0],30*(6-wall)),('railBack',[0,3,0],[0,1,0],30*(6-wall)),('railTop',[0,0,6],[0,0,1],Decimal(180)-Q)]: plane(role,o,n,a)
 if holes:
  for i in range(copies): cylinders.append({'role':'bore'+str(i),'c':[5+10*i,0],'r':1,'sign':-1,'levels':[0,6]})
 if finish:
  for i,c in enumerate([[-19,-19],[width-21,-19],[width-21,19],[-19,19]]): cylinders.append({'role':'fillet'+str(i),'c':c,'r':1,'sign':1,'levels':[0,10]})
 return planes,cylinders
def loop_area(loop,co,edges,points,axis,circles):
 keep=[i for i in range(3) if i!=axis];A=0.
 for cid in loop['coedges']:
  use=co[cid];edge=edges[use['edge']];ps=points[edge['id']];ps=ps if use['sense']=='forward' else list(reversed(ps));a=[ps[0][k] for k in keep];b=[ps[-1][k] for k in keep];A+=(a[0]*b[1]-a[1]*b[0])/2
  if edge['curve']['degree']!=1:
   need(axis==2,'only declared horizontal circular cap trims');matches=[c for c in circles if all(abs(math.dist(p[:2],c['c'])-c['r'])<=N for p in ps)];need(len(matches)==1,'one original circle for curved planar trim');c=matches[0];angles=[math.atan2(p[1]-c['c'][1],p[0]-c['c'][0]) for p in ps];sweep=sum(wrap(z-a) for a,z in zip(angles,angles[1:]));need(0<abs(sweep)<=2*math.pi+N,'directed original circle trim');A+=c['r']**2*(sweep-math.sin(sweep))/2
 return A
def circle_coverage(points,edges,spec,level):
 intervals=[]
 for eid,ps in points.items():
  if not all(abs(p[2]-level)<=N and abs(math.dist(p[:2],spec['c'])-spec['r'])<=N for p in ps): continue
  angles=[math.atan2(p[1]-spec['c'][1],p[0]-spec['c'][0]) for p in ps];turns=[wrap(z-a) for a,z in zip(angles,angles[1:])];need(all(abs(t)<math.pi for t in turns),'finite ordered original rim witnesses');sweep=sum(turns);need(abs(sweep)>0,'positive rim interval');start=angles[0] if sweep>0 else angles[-1];a=start%(2*math.pi);z=a+abs(sweep)
  if z<=2*math.pi+N: intervals.append((a,min(z,2*math.pi)))
  else: intervals.extend([(a,2*math.pi),(0,z-2*math.pi)])
 need(intervals,'original bore rim present');end=0.
 for a,z in sorted(intervals): need(a<=end+N/spec['r'],'original full bore rim has no angular gap');end=max(end,z)
 near(end,2*math.pi,'complete original bore-rim extent',N/spec['r']);return len(intervals)
def native_geometry(raw,width,wall,copies,stage):
 b=raw['brep'];need(finite(b),'finite original native coefficients');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{v['id']:v for v in b[k]} for k in keys};need(all(len(tab[k])==len(b[k]) for k in keys),'unique original IDs');need(len(b['bodies'])==len(b['shells'])==1 and b['bodies'][0]['kind']=='solid' and b['shells'][0]['closed'],'one original closed solid for each live output');body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]];need(set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'complete original solid ownership');cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']));points={};max_endpoint=0.;owned_l=[];owned_c=[];graph={f:set() for f in faces};pcurves=0;max_lift=None
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict native vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge references/tolerance');a,z=domain(e['curve']);points[e['id']]=[curve(e['curve'],a+(z-a)*i/8) for i in range(9)]
  for p,vid in zip([points[e['id']][0],points[e['id']][-1]],e['vertices']): gap=math.dist(p,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent original curve/vertex endpoint',min(N,e['tolerance']))
  if e['curve']['degree']==1:
   start,end=points[e['id']][0],points[e['id']][-1];v=sub(end,start);length=math.sqrt(dot(v,v));need(length>0,'noncollapsed original line');stations=[]
   for p in points[e['id']]: d=sub(p,start);near(math.sqrt(dot(cross(v,d),cross(v,d)))/length,0,'original straight-edge carrier');stations.append(dot(d,v)/length)
   need(all(z>=a-N for a,z in zip(stations,stations[1:])),'ordered original straight trim')
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell reciprocity');owned_l+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'face/loop reciprocity');owned_c+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%len(lp['coedges'])]];need(c['loop']==lid and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'ordered original native loop');need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'directed original loop endpoints')
 for c in co.values():
  twin=co[c['twin']];need(twin['twin']==c['id'] and twin['edge']==c['edge'] and twin['sense']!=c['sense'],'original opposed twins');graph[loops[c['loop']]['face']].add(loops[twin['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurves+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    tt=a+(z-a)*i/4;uv=curve(c['pcurve'],tt);lift=surface_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,curve(e['curve'],tt));max_lift=max(max_lift or 0,gap);near(gap,0,'independent original pcurve lift',min(N,e['tolerance']))
 need(len(owned_l)==len(loops) and set(owned_l)==set(loops) and len(owned_c)==len(co) and set(owned_c)==set(co),'all original loops/coedges owned once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original edge uses')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan original vertices');seen=set();todo=[next(iter(faces))]
 while todo:
  f=todo.pop()
  if f not in seen: seen.add(f);todo+=list(graph[f]-seen)
 need(seen==set(faces),'one connected original material shell');chi=len(verts)-len(edges)+2*len(faces)-len(loops);genus=copies if stage in ['HoleRow','finish'] else 0;need(chi==2-2*genus,'independent original Euler/genus')
 observations={f['id']:f for f in raw['faces']};need(len(observations)==len(raw['faces'])==len(faces) and set(observations)==set(faces),'all original face observations');planes,cylinders=carriers(width,wall,copies,stage,raw['outputId']);roles=set();areas={p['role']:0. for p in planes};max_support=0.;max_normal=0.
 for f in faces.values():
  ob=observations[f['id']];need(ob['name']==f.get('name') and ob['sense']==f['sense'] and ob['loops']==f['loops'],'face observer binds original graph');g=ob['geometry'];matches=[]
  if g['kind']=='plane': matches=[('plane',p) for p in planes if math.dist(g['n'],p['n'])<=N and abs(dot(p['n'],sub(g['o'],p['o'])))<=N]
  elif g['kind']=='cylinder': matches=[('cylinder',c) for c in cylinders if abs(g['r']-c['r'])<=N and math.dist(g['c'][:2],c['c'])<=N and abs(abs(g['a'][2])-1)<=N and abs(g['a'][0])<=N and abs(g['a'][1])<=N and g['out']==c['sign']]
  need(len(matches)==1,'unique source-defined original plane/cylinder carrier');kind,spec=matches[0];roles.add(spec['role'])
  def support(p):
   nonlocal max_support
   gap=abs(dot(spec['n'],sub(p,spec['o']))) if kind=='plane' else abs(math.dist(p[:2],spec['c'])-spec['r']);max_support=max(max_support,gap);near(gap,0,'independent actual source carrier')
   return spec['n'] if kind=='plane' else [spec['sign']*(p[0]-spec['c'][0])/spec['r'],spec['sign']*(p[1]-spec['c'][1])/spec['r'],0]
  boundary=[p for lid in f['loops'] for cid in loops[lid]['coedges'] for p in points[co[cid]['edge']]]
  for p in boundary: support(p)
  if kind=='plane':
   axis=next(i for i,v in enumerate(spec['n']) if abs(v)==1);areas[spec['role']]+=abs(sum(loop_area(loops[lid],co,edges,points,axis,cylinders) for lid in f['loops']))
  else:
   for p in boundary: need(spec['levels'][0]-N<=p[2]<=spec['levels'][1]+N,'declared original cylinder trim axial extent')
  sf=f['surface'];U=[sf['knotsU'][sf['degreeU']],sf['knotsU'][len(sf['controlPoints'])]];V=[sf['knotsV'][sf['degreeV']],sf['knotsV'][len(sf['controlPoints'][0])]]
  for a,z in [(.21,.37),(.71,.63)]:
   p,du,dv=surface_d1(sf,U[0]+a*(U[1]-U[0]),V[0]+z*(V[1]-V[0]));normal=[v*(1 if f['sense']=='forward' else -1) for v in unit(cross(du,dv))];wanted=support(p);vec(normal,wanted,'independent raw rational outward normal');max_normal=max(max_normal,max(abs(a-b) for a,b in zip(normal,wanted)))
 need(roles=={p['role'] for p in planes}|{c['role'] for c in cylinders},'all declared actual carriers present')
 area_errors={}
 for p in planes:
  wanted=Decimal(p['area']) if isinstance(p['area'],int) else p['area'];gap=decimal_close(areas[p['role']],wanted,Decimal('1e-9'),'independent original oriented planar trim area '+p['role']);area_errors[p['role']]={'actualAreaMM2':areas[p['role']],'expectedAreaMM2':str(wanted),'absoluteErrorMM2':gap}
 rim_checks=[]
 for c in cylinders:
  if c['role'].startswith('bore'):
   for level in c['levels']: rim_checks.append({'role':c['role'],'levelMM':level,'intervals':circle_coverage(points,edges,c,level)})
 observed_edges={e['id']:e for e in raw['edges']};need(len(observed_edges)==len(raw['edges']) and set(observed_edges)==set(edges),'all original edge observations')
 for eid,e in edges.items():
  ob=observed_edges[eid];need(ob['curve']==e['curve'] and ob['name']==e.get('name'),'edge observer retains original curve/name');a,z=domain(e['curve']);need(ob['probe']['domain']==[a,z] and len(ob['probe']['samples'])==5,'original observed edge stations')
  for i,p in enumerate(ob['probe']['samples']): vec(p,curve(e['curve'],a+(z-a)*i/4),'independent raw curve/observed sample')
 native_bounds={side:[fn(v['point'][i] for v in verts.values()) for i in range(3)] for side,fn in [('min',min),('max',max)]}
 return {'counts':{k:len(b[k]) for k in keys},'genus':genus,'eulerCharacteristic':chi,'carrierRoles':sorted(roles),'originalPlanarTrimAreas':area_errors,'originalBoreRimCoverage':rim_checks,'originalVertexBounds':native_bounds,'maximumEndpointGapMM':max_endpoint,'maximumCarrierGapMM':max_support,'maximumOutwardNormalComponentError':max_normal,'pcurveCount':pcurves,'pcurveStatus':'PASS_ORIGINAL_OPTIONAL_PCURVE_FINITE_WITNESSES' if pcurves else 'NOT_EXERCISED_ORIGINAL_PCURVES_ABSENT','maximumPcurveLiftGapMM':max_lift}
def display_checks(read,doc,stage):
 display=read.get('display')
 if display is None: return 'NOT_SUPPLIED_PRESERVED_CONTROLLED_NATIVE_PACKET'
 need(display.get('authority')=='ORIGINAL_NATIVE_NAMES_TO_PUBLIC_POINTER_INDICES_ONLY' and display['quality']==8,'display mapping labelled as pointer observer')
 if stage=='union':
  top=display['railTop'];need(top['index']>=0 and top['bodyIndex']==0 and top['bodyKey']=='b5' and top['nativeName']=='n4.top' and top['nativeNames']==['n4.top'],'actual current rail-top pointer identity');vec(top['world'],[5,0,6],'actual selected top material point');need(len(top['nativeMembers'])==1,'one original selected rail face');raw=read['outputs'][0];face=next(f for f in raw['faces'] if f['id']==top['nativeMembers'][0]['id']);need(face==top['nativeMembers'][0] and face['name']=='n4.top' and len(face['loops'])==1,'pointer joins original pre-Hole top face')
 if stage=='HoleRow':
  corners=display['corners'];need(len(corners)==4,'four actual original outer-corner pointer maps');names=[]
  for c in corners:
   need(c['index']>=0 and c['bodyIndex']==0 and c['bodyKey']=='b6' and len(c['nativeMembers'])==1,'actual current corner pointer owner');member=c['nativeMembers'][0];need(member in read['outputs'][0]['edges'] and member['name'] in c['nativeNames'],'pointer map binds original native edge');names.append(member['name']);a,b=member['endpoints'];vec(c['world'],[(x+y)/2 for x,y in zip(a,b)],'native-derived current corner midpoint');need(any(all(abs(v-q)<=N for v,q in zip(c['a'],p)) for p in [a,b]) and any(all(abs(v-q)<=N for v,q in zip(c['b'],p)) for p in [a,b]),'display endpoints map original native endpoints');near(math.dist(a,b),10,'actual original corner height')
  need(set(names)==set(CORNERS),'current original stock side identities retained')
 return 'PASS_CURRENT_NATIVE_TO_PUBLIC_POINTER_MAPPING_ONLY'
def run(x):
 need(len(SEED_TEXT.encode())==582 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact original D449582-byte Shell antecedent');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller retained original Shell input');params=x['parameters'];need(set(params)=={'width','wall','copies'} and all(type(params[k]) in [int,float] for k in params),'finite declared parameter keys');width,wall,copies=[params[k] for k in ['width','wall','copies']];doc=x['doc'];read=x['read'];text=x.get('documentJSON',read['documentJSON']);need(doc==x['expectedDoc'],'exact caller-held accepted raw Doc');stage,made,residuals=source(doc,width,wall,copies,seed,x.get('referenceAnchors'));expected=physical(width,wall,copies,stage)
 need(read['ok'] is True and read['inputUnchanged'] is True and read['documentJSON']==text and json.loads(text)==doc==read['reader']['doc'] and read['reader']['notes']==[] and hashlib.sha256(text.encode()).hexdigest()==read['documentSHA256'],'raw Doc/reader/hash identity');need(read['partDocument']==compiled(doc),'actual current raw source compiled geometry/serial Hole copies/reference authority');request=read.get('request',{});need('parameters' not in request or request['parameters']==params,'current request parameter join when present')
 outputs=read['outputs'];need(len(outputs)==len(expected) and {o['outputId'] for o in outputs}==set(expected),'all live original output IDs, including two rail-New bodies');native={}
 for raw in outputs:
  owner=raw['outputId'];e=expected[owner];need(raw['bodyKey']=='b'+owner[1:] and raw['nativeBodyCount']==1,'original per-output body owner/count');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original native BRep bytes/hash');need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit native density1 MMGS units');need(raw['productChecks']['authority']=='PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE','product validity labelled')
  genus=copies if stage in ['HoleRow','finish'] else 0
  for check in ['default','strict','output']:
   observed=raw['productChecks'][check];need(observed['valid'] is True and observed['issues']==[] and len(observed['topology'])==1 and observed['topology'][0]['genus']==genus,'observed product strict/default/output checks')
  errors={}
  for key in ['mass','brepMass']:
   m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact','quadrature'],'native nonmesh mass observation');ve=decimal_close(m['volume'],e['volume'],Decimal('1e-9')*e['volume'],key+' independent declared-source volume');me=decimal_close(m['mass'],e['mass'],Decimal('1e-9'),key+' density1 grams');ce=max(decimal_close(v,w,Decimal('1e-9'),key+' centroid') for v,w in zip(m['centroid'],e['centroid']));errors[key]={'volumeRelative':ve/float(e['volume']),'massAbsoluteG':me,'centroidAbsoluteMM':ce}
  for side in ['min','max']: vec(raw['bounds'][side],e['bounds'][side],'native material bounds '+owner+side)
  graph=native_geometry(raw,width,wall,copies,stage)
  for side in ['min','max']: vec(graph['originalVertexBounds'][side],e['bounds'][side],'independent original boundary extrema '+owner+side)
  native[owner]={'nativeBRepSHA256':raw['nativeBRepSHA256'],'massErrors':errors,'geometry':graph}
 pointer=display_checks(read,doc,stage);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh exact actual Studio Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==len(expected),'fresh current Worker body count');bodies={b['key']:b for b in w['bodies']};need(set(bodies)=={'b'+owner[1:] for owner in expected},'fresh Worker exact live ownership')
  for owner,e in expected.items():
   body=bodies['b'+owner[1:]];decimal_close(body['volume'],e['volume'],Decimal('1e-9')*e['volume'],'fresh Worker declared-source volume')
   for v,q in zip(body['centroid'],e['centroid']): decimal_close(v,q,Decimal('1e-9'),'fresh Worker source centroid')
  worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D539_ENCLOSURE_STATE','stage':stage,'parameters':params,'documentSHA256':read['documentSHA256'],'sourceProvenance':made,'constraintResiduals':residuals,'expected':{owner:{'volumeMM3':str(e['volume']),'massDensity1G':str(e['mass']),'centroidMM':[str(v) for v in e['centroid']],'bounds':e['bounds']} for owner,e in expected.items()},'native':native,'pointerMapping':pointer,'worker':worker,'budgets':{'constraintLinearMM':LINEAR,'constraintAngularRad':ANGULAR,'nativeVolumeRelative':N,'nativeCentroidBoundsCarrierEndpointNormalPcurveMM':N,'density1MassAbsoluteG':N,'nativePlanarTrimAreaAbsoluteMM2':N},'limits':['Only declared D449 Shell-derived W80/90 Wall2/3, fixed rail x0..30/y-3..3/z1..6, Through R1 row at5/15/25 or5/15, four original outer vertical R1 finishes.','Rail New has two original live solids; Union and later states have one. Positive floor overlap, not contact-only.','Actual Box provenance is retained. Historical Fillet signatures anchor A identity; current native boundaries are checked separately.','Independent Decimal targets, original planar trim areas, complete nominal bore-rim intervals and finite raw rational carrier/normal witnesses are not a full-domain trim/general Boolean theorem.','Absent optional pcurves leave the UV lift branch NOT_EXERCISED. Density1 native mass is not visible catalog-material mass. No inertia/manufacturing/mobile/exchange/release claim.']}
if __name__=='__main__':
 try:
  with localcontext() as context: context.prec=60;result=run(json.load(sys.stdin))
  print(json.dumps(result,indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D539_DECLARED_ENCLOSURE_STATE','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
