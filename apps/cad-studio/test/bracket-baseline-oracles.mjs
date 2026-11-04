// D538: the retained D448 support only. Root owns execution and visual review.
export const seedSHA256 = '2727e7d3d726a58030657720ebc7a8d09a4dab574887dd7d2001cc42305ed16f';
export const seedText = JSON.stringify({format:'barocss-cad-model',schema:3,units:'mm',parameters:{},nodes:[
  {kind:'sketch',profile:'rectangle',min:[-20,-20],max:[40,20],outline:{points:[[-20,-20],[40,-20],[40,20],[-20,20]],lengths:{0:60,1:40},hv:{h:[0,2],v:[1,3]}},sideTags:{outer:['e1','e2','e3','e4']},id:'n0'},
  {kind:'extrude',sketch:0,height:10,id:'n1'},
  {kind:'sketch',profile:'rectangle',min:[0,9],max:[10,25],sideTags:{outer:['e1','e2','e3','e4']},plane:{origin:[0,0,0],normal:[0,-1,0],xAxis:[1,0,0]},id:'n2'},
  {kind:'revolve',sketch:2,axis:'y',angle:360,id:'n3'},
  {kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'},id:'n4'},
  {kind:'hole',parent:{node:4,side:'solid'},radius:3,center:[0,0],face:'n3.side[e3]',id:'n5'},
  {kind:'fillet',parent:{node:5,side:'solid'},edges:['n1.side[e1]|n1.side[e2]','n1.side[e1]|n1.side[e4]','n1.side[e2]|n1.side[e3]','n1.side[e3]|n1.side[e4]'],radius:2,id:'n6',sigs:{
    'n1.side[e1]|n1.side[e2]':{k:'line',p:[60,-20,5],d:[0,0,1],s:10},
    'n1.side[e1]|n1.side[e4]':{k:'line',p:[-20,-20,5],d:[0,0,1],s:10},
    'n1.side[e2]|n1.side[e3]':{k:'line',p:[60,20,5],d:[0,0,1],s:10},
    'n1.side[e3]|n1.side[e4]':{k:'line',p:[-20,20,5],d:[0,0,1],s:10},
  }},
],outputs:{b6:{node:6,side:'solid'}},nextId:7}, null, 2);

// TS stdin resolved from apps/cad-studio. CLI: inspector.mjs ACTUAL_DOC OPTIONS_JSON.
export const inspectorSource = String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {bodyMesh} from '../../packages/barocss-cad-model/src/engine/mesh.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,curveDomain,curveEvaluator,evaluateSurfaceD1,surfaceDomain} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),result:any={ok:false,status:'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,outputs:[]};
 try{
  result.partDocument=toPartDocument(doc);const snapshot=evaluateCadPart(result.partDocument);
  // Preserve ALL original outputs before profile, topology or physical assertions.
  for(const output of snapshot.outputs){const nativeBRepJSON=JSON.stringify(output.brep);result.outputs.push({outputId:output.id,bodyKey:bodyKeyOf(output.id,doc.nodes),representation:output.representation,nativeBodyCount:output.bodyCount,brep:output.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  result.reader=safe(()=>readStudioDoc(documentJSON));
  for(let i=0;i<result.outputs.length;i++){
   const raw=result.outputs[i],output=snapshot.outputs[i],b=raw.brep,vertices=new Map(b.vertices.map((v:any)=>[v.id,v.point]));
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
   raw.massProperties=safe(()=>massPropertiesOf(output,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));
   raw.productChecks={authority:'PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE',default:safe(()=>checkBrep(b)),strict:safe(()=>checkBrep(b,{strict:true})),output:safe(()=>checkOutput(output))};
   raw.surfaces=b.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f)),probe:safe(()=>{const sf=f.surface;if(sf.kind!=='surface')return {unsupportedSurfaceKind:sf.kind};const domain=surfaceDomain(sf);return {domain,probes:[[.21,.37],[.71,.63]].map(([u,v])=>{const U=domain.u[0]+u*(domain.u[1]-domain.u[0]),V=domain.v[0]+v*(domain.v[1]-domain.v[0]),d=evaluateSurfaceD1(sf,U,V),n=cross(d.du,d.dv),norm=Math.hypot(...n),sign=f.sense==='forward'?1:-1;return {u:U,v:V,point:d.point,du:d.du,dv:d.dv,normal:n.map(x=>sign*x/norm),normalNorm:norm};})};})}));
   raw.edgeProbes=b.edges.map((e:any)=>({id:e.id,name:e.name,degree:e.curve.degree,endpoints:e.vertices.map((v:string)=>vertices.get(v)),probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t))};})}));
  }
  const selected=snapshot.outputs.findIndex((o:any)=>o.id==='n6');
  result.display=safe(()=>{
   if(selected<0)throw Error('n6 output absent');const output=snapshot.outputs[selected],raw=result.outputs[selected],mesh=bodyMesh(output.brep,0,8),name='n1.bottom|n1.side[e1]';
   const members=raw.edgeProbes.filter((e:any)=>e.name===name&&e.degree===1);if(members.length!==1)throw Error('expected one actual named front-bottom line');
   const member=members[0],matches=mesh.edges.filter((e:any)=>e.straight&&e.names.includes(name));if(matches.length!==1)throw Error('expected one actual displayed front-bottom line');
   const e=matches[0],a=member.endpoints[0],b=member.endpoints[1],length=Math.hypot(...a.map((v:number,j:number)=>v-b[j]));
   return {bodyIndex:selected,bodyKey:raw.bodyKey,quality:8,sourceRole:'bodyMesh maps original native names to public pointer indices only; no display geometry is physical authority',measurement:{index:e.index,nativeNames:[...e.names],nativeMembers:[member],world:[0,-20,0],a:e.a,b:e.b,length,nativeName:name,nativeEndpoints:member.endpoints,nativeCurve:output.brep.edges.find((x:any)=>x.id===member.id)?.curve}};
  });
  result.outputIds=result.outputs.map((o:any)=>o.outputId);result.bodyCount=result.outputs.length;result.target=result.outputs.length===1?result.outputs[0]:null;
  result.bodyKey=result.target?.bodyKey??null;result.outputId=result.target?.outputId??null;
  result.ok=true;result.status='CAPTURED';
 }catch(cause){result.error=error(cause);}
 result.inputUnchanged=JSON.stringify(doc)===documentJSON;return result;
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

// Independent standard-library mathematics. No product imports. The formula is
// admitted only after this exact authored support profile and its references pass.
export const oracleSource = String.raw`
import hashlib,json,math,re,sys,traceback
from decimal import Decimal,localcontext
N=1e-9
LINEAR=1e-7
ANGULAR=1e-9
SEED_TEXT=${JSON.stringify(seedText)}
SEED_SHA='${seedSHA256}'
PI=Decimal('3.14159265358979323846264338327950288419716939937510')
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
 length=math.sqrt(dot(v,v));need(length>0,'nondegenerate direction');return [x/length for x in v]
def decimal_close(actual,wanted,t,label):
 need(isinstance(actual,(int,float)) and not isinstance(actual,bool) and math.isfinite(actual),label+' finite')
 value=Decimal(actual) if isinstance(actual,int) else Decimal.from_float(actual);gap=abs(value-wanted);need(gap<=t,f'{label}: {value} != {wanted}; budget {t}')
 return float(gap)
def source(doc,width,seed):
 need(doc['format']=='barocss-cad-model' and doc['schema']==3 and doc['units']=='mm' and doc['parameters']=={},'exact schema3/mm ordinary support')
 need({k:v for k,v in doc.items() if k!='nodes'}=={k:v for k,v in seed.items() if k!='nodes'},'root metadata/output ownership retained')
 ns=doc['nodes'];need(len(ns)==7 and ns[1:]==seed['nodes'][1:],'exact primary Extrude/boss meridian/plane/Revolve/Union/Hole/Fillet DAG and historical signatures')
 n=ns[0];expected=json.loads(json.dumps(seed['nodes'][0]));expected['max'][0]=width-20;expected['outline']['points'][1][0]=width-20;expected['outline']['points'][2][0]=width-20;expected['outline']['lengths']['0']=width
 need(n==expected,'actual compact rectangle, locked outline, side tags and feature identity agree with selected width')
 pts=n['outline']['points'];linear=[];angular=[]
 for i in range(4):
  a=pts[i];b=pts[(i+1)%4];edge=sub(b,a)
  if i in [0,2]: linear.append(abs(edge[1]));angular.append(abs(math.atan2(abs(edge[1]),abs(edge[0]))))
  else: linear.append(abs(edge[0]));angular.append(abs(math.atan2(abs(edge[0]),abs(edge[1]))))
 for i,w in n['outline']['lengths'].items(): linear.append(abs(math.dist(pts[int(i)],pts[(int(i)+1)%4])-w))
 need(max(linear)<=LINEAR and max(angular)<=ANGULAR,'existing source linear/angular residual budgets')
 return {'linearMaximumMM':max(linear),'angularMaximumRad':max(angular),'linearLimitMM':LINEAR,'angularLimitRad':ANGULAR}
def physical(width):
 w=Decimal(width);P=400*w-160+40*PI;V=P+1275*PI;C=[P*(w/2-20)/V,Decimal(0),(5*P+Decimal('23437.5')*PI)/V]
 return {'volume':V,'mass':V/1000,'centroid':C,'bounds':{'min':[-20,-20,0],'max':[width-20,20,25]},'measurementLength':width-4}
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
 need(s['kind']=='surface','native surface carrier');p=s['controlPoints'];w=s['weights'];need(len(p)==len(w) and all(len(a)==len(b) for a,b in zip(p,w)) and all(ww>0 for row in w for ww in row),'positive original surface weights');h=[[[q*ww for q in pp]+[ww] for pp,ww in zip(row,weights)] for row,weights in zip(p,w)];rows=[deboor(row,s['knotsV'],s['degreeV'],v) for row in h];rowsv=[derivative(row,s['knotsV'],s['degreeV'],v) for row in h];q=deboor(rows,s['knotsU'],s['degreeU'],u);du=derivative(rows,s['knotsU'],s['degreeU'],u);dv=deboor(rowsv,s['knotsU'],s['degreeU'],u);need(q[3]>0,'positive surface denominator');return [a/q[3] for a in q[:3]],[(a*q[3]-b*du[3])/q[3]**2 for a,b in zip(du[:3],q[:3])],[(a*q[3]-b*dv[3])/q[3]**2 for a,b in zip(dv[:3],q[:3])]
def carriers(width):
 planes=[('left',[-20,0,0],[-1,0,0]),('right',[width-20,0,0],[1,0,0]),('front',[0,-20,0],[0,-1,0]),('back',[0,20,0],[0,1,0]),('bottom',[0,0,0],[0,0,-1]),('plateTop',[0,0,10],[0,0,1]),('bossTop',[0,0,25],[0,0,1])]
 cylinders=[('boss',[0,0],10,1),('bore',[0,0],3,-1)]+[('fillet'+str(i),c,2,1) for i,c in enumerate([[-18,-18],[width-22,-18],[width-22,18],[-18,18]])]
 return planes,cylinders
def native_geometry(raw,width):
 b=raw['brep'];need(finite(b),'finite original BRep');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{v['id']:v for v in b[k]} for k in keys};need(all(len(tab[k])==len(b[k]) for k in keys),'unique original IDs');need(len(b['bodies'])==len(b['shells'])==1 and b['bodies'][0]['kind']=='solid' and b['shells'][0]['closed'],'one original closed solid');body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]];need(set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'original solid ownership');cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']));points={};max_endpoint=0.;max_lift=0.;owned_l=[];owned_c=[];graph={f:set() for f in faces};pcurves=0
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge refs/tolerance');a,z=domain(e['curve']);points[e['id']]=[curve(e['curve'],a+(z-a)*i/8) for i in range(9)]
  for p,vid in zip([points[e['id']][0],points[e['id']][-1]],e['vertices']): gap=math.dist(p,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent original edge endpoint',min(N,e['tolerance']))
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell reciprocity');owned_l+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'face/loop reciprocity');owned_c+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%len(lp['coedges'])]];need(c['loop']==lid and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'ordered original loop');need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'directed loop endpoints')
 for c in co.values():
  twin=co[c['twin']];need(twin['twin']==c['id'] and twin['edge']==c['edge'] and twin['sense']!=c['sense'],'original opposed twins');graph[loops[c['loop']]['face']].add(loops[twin['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurves+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    tt=a+(z-a)*i/4;uv=curve(c['pcurve'],tt);lift=surface_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,curve(e['curve'],tt));max_lift=max(max_lift,gap);near(gap,0,'independent original pcurve lift',min(N,e['tolerance']))
 need(len(owned_l)==len(loops) and set(owned_l)==set(loops) and len(owned_c)==len(co) and set(owned_c)==set(co),'all loops/coedges owned once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original edge uses')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan vertices');seen=set();todo=[next(iter(faces))]
 while todo:
  f=todo.pop()
  if f not in seen: seen.add(f);todo+=list(graph[f]-seen)
 need(seen==set(faces),'one connected original shell');chi=len(verts)-len(edges)+2*len(faces)-len(loops);need(chi==0,'independent through-bore genus1')
 smap={s['id']:s for s in raw['surfaces']};need(len(smap)==len(raw['surfaces'])==len(faces) and set(smap)==set(faces),'all original carrier observations');planes,cylinders=carriers(width);roles=set();max_point=0.;max_d1=0.;max_normal=0.
 for f in faces.values():
  ob=smap[f['id']];g=ob['geometry'];matches=[]
  if g['kind']=='plane': matches=[('plane',role,o,n) for role,o,n in planes if math.dist(g['n'],n)<=N and abs(dot(n,sub(g['o'],o)))<=N]
  elif g['kind']=='cylinder': matches=[('cylinder',role,c,sign) for role,c,r,sign in cylinders if abs(g['r']-r)<=N and math.dist(g['c'][:2],c)<=N]
  need(len(matches)==1,'unique actual declared source plane/cylinder');kind,role,origin,direction=matches[0];roles.add(role)
  def support(p):
   if kind=='plane': near(dot(direction,sub(p,origin)),0,'independent original plane boundary');return direction
   r=next(r for rr,c,r,sign in cylinders if rr==role);near(math.dist(p[:2],origin),r,'independent original cylindrical boundary');return [direction*(p[0]-origin[0])/r,direction*(p[1]-origin[1])/r,0]
  for lid in f['loops']:
   for cid in loops[lid]['coedges']:
    for p in points[co[cid]['edge']]: support(p)
  for q in ob['probe']['probes']:
   p,du,dv=surface_d1(f['surface'],q['u'],q['v']);vec(q['point'],p,'independent raw rational surface point');vec(q['du'],du,'independent raw du');vec(q['dv'],dv,'independent raw dv');nn=[v*(1 if f['sense']=='forward' else -1) for v in unit(cross(du,dv))];expected=support(p);vec(nn,expected,'actual source outward normal');vec(q['normal'],nn,'product normal observation');need(q['normalNorm']>0,'nondegenerate observed derivatives');max_point=max(max_point,max(abs(a-b) for a,b in zip(q['point'],p)));max_d1=max(max_d1,max(abs(a-b) for a,b in zip(q['du']+q['dv'],du+dv)));max_normal=max(max_normal,max(abs(a-b) for a,b in zip(nn,expected)))
 need(roles=={p[0] for p in planes}|{c[0] for c in cylinders},'all declared physical carriers observed');ep={e['id']:e for e in raw['edgeProbes']};need(len(ep)==len(raw['edgeProbes']) and set(ep)==set(edges),'all original edge observations');max_edge=0.
 for eid,e in edges.items():
  a,z=domain(e['curve']);ob=ep[eid]['probe'];need(ob['domain']==[a,z] and len(ob['samples'])==9,'original edge domains/stations')
  for i,p in enumerate(ob['samples']): q=curve(e['curve'],a+(z-a)*i/8);vec(p,q,'independent observed native edge');max_edge=max(max_edge,max(abs(v-w) for v,w in zip(p,q)))
 return {'counts':{k:len(b[k]) for k in keys},'genus':1,'eulerCharacteristic':chi,'carrierRoles':sorted(roles),'pcurveCount':pcurves,'pcurvePresence':'ORIGINAL_OPTIONAL_FIELDS_ONLY','maximumEndpointGapMM':max_endpoint,'maximumPcurveLiftGapMM':max_lift,'maximumIndependentProbePointGapMM':max_point,'maximumIndependentD1ComponentGapMM':max_d1,'maximumIndependentEdgeProbeGapMM':max_edge,'maximumOutwardNormalComponentError':max_normal}
def measurement(raw,display,width):
 name='n1.bottom|n1.side[e1]';edges=[e for e in raw['brep']['edges'] if e.get('name')==name];need(len(edges)==1,'one current original named measurement edge');edge=edges[0];need(edge['curve']['degree']==1 and len(edge['curve']['controlPoints'])==2,'actual measured original straight curve');a,z=domain(edge['curve']);ends=[curve(edge['curve'],a),curve(edge['curve'],z)];ends=sorted(ends,key=lambda p:p[0]);expected=[[-18,-20,0],[width-22,-20,0]]
 for p,q in zip(ends,expected): vec(p,q,'current measured edge endpoint')
 size=math.dist(*ends);near(size,width-4,'independent current measured curve length');m=display['measurement'];need(display['bodyKey']=='b6' and display['bodyIndex']==0 and display['quality']==8 and m['index']>=0 and name in m['nativeNames'],'public pointer mapping belongs to original current native name');need(len(m['nativeMembers'])==1 and m['nativeMembers'][0]['id']==edge['id'] and m['nativeCurve']==edge['curve'],'pointer observer retains original native curve');near(m['length'],size,'observer native length');vec(m['world'],[0,-20,0],'real interior pointer point')
 return {'name':name,'endpoints':ends,'lengthMM':size,'displayIndex':m['index'],'authority':'ORIGINAL_CURRENT_NATIVE_CURVE_NOT_HISTORICAL_FILLET_SIGNATURE'}
def run(x):
 need(len(SEED_TEXT.encode())==3431 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained3431-byte D448 actual OPFS seed');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller exact retained antecedent');params=x['parameters'];need(set(params)=={'width'} and type(params['width']) in [int,float] and params['width'] in [60,80],'two fixed support-width classes only');width=params['width'];doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(doc==x['expectedDoc'],'exact caller-captured accepted raw Doc');residuals=source(doc,width,seed);expected=physical(width)
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[] and hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'original raw Doc/reader/hash identity');need(rd['request'].get('parameters')==params or rd['request'].get('width')==width,'current inspector request width')
 need(rd['outputIds']==['n6'] and rd['bodyCount']==1 and rd['bodyKey']=='b6' and rd['outputId']=='n6' and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0],'sole original n6/b6 ownership');raw=rd['outputs'][0];bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original BRep bytes/hash');need(raw['nativeBodyCount']==1,'one original native body')
 features=[]
 for n in doc['nodes']:
  if n['kind']=='sketch': features.append({k:v for k,v in n.items() if k not in ['outline','on','construction','association']})
  elif n['kind']=='extrude': features.append({'id':n['id'],'kind':'extrude','sketch':'n0','height':10})
  elif n['kind']=='revolve': features.append({'id':'n3','kind':'revolve','sketch':'n2','axis':{'origin':[0,0],'direction':'y'},'angle':360})
  elif n['kind']=='union': features.append({'id':'n4','kind':'union','target':'n1','tool':'n3'})
  elif n['kind']=='hole': features.append({'id':'n5','kind':'hole','target':'n4','radius':3,'center':[0,0],'face':'n3.side[e3]'})
  elif n['kind']=='fillet': features.append({'id':'n6','kind':'fillet','target':'n5','edges':n['edges'],'radius':2,'expect':{k:{'kind':v['k'],'at':v['p'],'dir':v['d'],'size':v['s']} for k,v in n['sigs'].items()}})
 need(rd['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':features},'actual current raw source compiled feature/DAG/reference authority')
 need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit density1 native MMGS units');need(raw['productChecks']['authority']=='PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE','product checks labelled')
 for label in ['default','strict','output']:
  check=raw['productChecks'][label];need(check['valid'] is True and check['issues']==[] and len(check['topology'])==1 and check['topology'][0]['genus']==1,'observed product validity '+label)
 errors={}
 for method in ['massProperties','brepMass']:
  mass=raw[method];need(finite(mass) and mass['method'] in ['closed-form','planar-exact','quadrature'],'nonmesh native mass observation');ve=decimal_close(mass['volume'],expected['volume'],Decimal('1e-9')*expected['volume'],method+' independent fixed support volume');me=decimal_close(mass['mass'],expected['mass'],Decimal('1e-9'),method+' density1 grams');ce=max(decimal_close(v,w,Decimal('1e-9'),method+' centroid') for v,w in zip(mass['centroid'],expected['centroid']));errors[method]={'volumeRelative':ve/float(expected['volume']),'massAbsoluteG':me,'centroidAbsoluteMM':ce}
 for side in ['min','max']: vec(raw['bounds'][side],expected['bounds'][side],'native fixed-support material bounds')
 graph=native_geometry(raw,width);measure=measurement(raw,rd['display'],width);worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh exact actual Studio Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b6','fresh current Worker b6');b=w['bodies'][0];decimal_close(b['volume'],expected['volume'],Decimal('1e-9')*expected['volume'],'fresh Worker support volume')
  for v,q in zip(b['centroid'],expected['centroid']): decimal_close(v,q,Decimal('1e-9'),'fresh Worker support centroid')
  worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
  # A reused native packet retains its original inspector request label. Only
  # this fresh consumer snapshot identifies an actual open Measurement panel.
  measure_labels={'07-real-Measure76':80,'12-postOpen-real-Measure56':60}
  if c.get('label') in measure_labels:
   need(width==measure_labels[c['label']],'Measurement consumer label/current source width join');panel=c.get('measurementPanel');need(isinstance(panel,str),'actual open Measurement panel text');visible=' '.join(panel.split())
   need(re.search(r'\bLine\b',visible) and re.search(r'\bLength\s+'+str(width-4)+r'(?:\.0+)?\s*mm\b',visible),'actual Line and expected Length text in current Measurement panel')
   measure['consumer']={'status':'PASS_ACTUAL_MEASUREMENT_PANEL_CURRENT_DOC_WORKER_JOIN','label':c['label'],'panelText':panel,'width':width,'lengthMM':width-4}
 return {'status':'PASS_ONE_DECLARED_D538_BRACKET_STATE','parameters':params,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'constraintResiduals':residuals,'expected':{'volumeMM3':str(expected['volume']),'massDensity1G':str(expected['mass']),'centroidMM':[str(v) for v in expected['centroid']],'bounds':expected['bounds'],'measurementLengthMM':width-4},'native':{'massErrors':errors,'geometry':graph},'measurement':measure,'worker':worker,'budgets':{'constraintLinearMM':LINEAR,'constraintAngularRad':ANGULAR,'nativeVolumeRelative':N,'nativeCentroidBoundsBoundaryD1PcurveMM':N,'nativeUnitNormalComponent':N,'density1MassAbsoluteG':N},'limits':['Only exact retained D448 W60/80 support: Extrude10, R10 boss z9..25 with1mm overlap, Union, R3 through bore, fourR2 outer vertical fillets.','Historical stored Fillet signatures remain identity anchors; the current original measured edge is checked separately.','Independent fixed-profile Decimal mass plus original graph/carrier/rational finite witnesses is not a full-domain trim or general Boolean theorem.','Density1 native mass is not the visible catalog-material mass. No inertia/manufacturing/mobile/exchange/release claim.']}
if __name__=='__main__':
 try:
  with localcontext() as context: context.prec=60;result=run(json.load(sys.stdin))
  print(json.dumps(result,indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D538_DECLARED_BRACKET_STATE','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
