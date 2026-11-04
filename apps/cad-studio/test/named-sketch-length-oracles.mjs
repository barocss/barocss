// D537 named driving length. The independent native-boundary mathematics below is
// copied unchanged from D536; raw contract and compilation checks are D537-specific.
import {seedText, seedSHA256} from './mixed-line-dimension-preflight.mjs';
export {seedSHA256};
export const seedJSON = seedText;

// TS stdin resolved from apps/cad-studio. CLI: node inspector.mjs ACTUAL_DOC OPTIONS_JSON.
export const inspectorSource = String.raw`
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readStudioDoc} from '../../packages/barocss-cad-model/src/engine/migrate.ts';
import {prefixDoc} from '../../packages/barocss-cad-model/src/engine/doc.ts';
import {resolveDrivenSketch} from '../../packages/barocss-cad-model/src/sketch/driven.ts';
import {toPartDocument,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {evaluateCadPart,massPropertiesOf,brepMassProperties,checkBrep,checkOutput,faceGeometry,curveDomain,curveEvaluator,evaluateSurfaceD1,surfaceDomain} from '../../packages/barocss-cad/src/index.ts';
import {stepValidationBounds} from '../../packages/barocss-cad/src/brep/brep-bounds.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const error=(e:any)=>({name:e?.name??null,code:e?.code??null,feature:e?.feature??null,message:String(e?.message??e)});
const safe=(fn:()=>any)=>{try{return fn();}catch(e){return {observationError:error(e)};}};
const cross=(a:number[],b:number[])=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function observe(actual:any){
 const documentJSON=JSON.stringify(actual),result:any={ok:false,documentJSON,documentSHA256:sha(documentJSON),outputs:[]};
 try{
  result.partDocument=toPartDocument(actual);const snapshot=evaluateCadPart(result.partDocument);
  // ALL original output bytes precede physical checks and profile assertions.
  for(const output of snapshot.outputs){const nativeBRepJSON=JSON.stringify(output.brep);result.outputs.push({outputId:output.id,bodyKey:bodyKeyOf(output.id,actual.nodes),representation:output.representation,nativeBodyCount:output.bodyCount,brep:output.brep,nativeBRepJSON,nativeBRepSHA256:sha(nativeBRepJSON)});}
  for(let i=0;i<result.outputs.length;i++){
   const raw=result.outputs[i],output=snapshot.outputs[i],b=raw.brep,vertices=new Map(b.vertices.map((v:any)=>[v.id,v.point]));
   raw.massUnits={density:1,densityUnit:'g/cm3',volume:'mm3',mass:'g',centroid:'mm',authority:'massPropertiesOf/brepMassProperties MMGS'};
   raw.massProperties=safe(()=>massPropertiesOf(output,1));raw.brepMass=safe(()=>brepMassProperties(b,1));raw.bounds=safe(()=>stepValidationBounds(b));raw.defaultCheck=safe(()=>checkBrep(b));raw.strict=safe(()=>checkBrep(b,{strict:true}));raw.outputCheck=safe(()=>checkOutput(output));
   raw.surfaces=b.faces.map((f:any)=>({id:f.id,name:f.name,geometry:safe(()=>faceGeometry(f)),probe:safe(()=>{const sf=f.surface;if(sf.kind!=='surface')return {unsupportedSurfaceKind:sf.kind};const domain=surfaceDomain(sf);return {domain,probes:[[.25,.37],[.75,.63]].map(([u,v])=>{const U=domain.u[0]+u*(domain.u[1]-domain.u[0]),V=domain.v[0]+v*(domain.v[1]-domain.v[0]),d=evaluateSurfaceD1(sf,U,V),n=cross(d.du,d.dv),norm=Math.hypot(...n),sign=f.sense==='forward'?1:-1;return {u:U,v:V,point:d.point,du:d.du,dv:d.dv,normal:n.map(x=>sign*x/norm),normalNorm:norm};})};})}));
   raw.edgeProbes=b.edges.map((e:any)=>({id:e.id,name:e.name,degree:e.curve.degree,endpoints:e.vertices.map((v:string)=>vertices.get(v)),probe:safe(()=>{const[a,z]=curveDomain(e.curve),at=curveEvaluator(e.curve);return {domain:[a,z],samples:[0,.125,.25,.375,.5,.625,.75,.875,1].map(t=>at(a+(z-a)*t))};})}));
  }
  result.ok=true;
 }catch(e){result.error=error(e);}
 return result;
}
export function inspect(doc:any,request:any={}){
 const documentJSON=JSON.stringify(doc),documentSHA256=sha(documentJSON),reader=safe(()=>readStudioDoc(documentJSON));
 const final=observe(doc);
 const resolvedSketch=safe(()=>doc.nodes[0]?.kind==='driven-sketch'?resolveDrivenSketch(doc.nodes[0],doc.parameters):doc.nodes[0]);
 // This separately labelled prefix is the SAME actual source before its fillet,
 // not a replacement final fixture and not a current value of the historical sig.
 const preFillet=observe(prefixDoc(doc,2));
 preFillet.authority='OBSERVER_DERIVED_SAME_ACTUAL_SOURCE_PREFIX_BEFORE_FILLET';
 const target=final.outputs.length===1?final.outputs[0]:null;
 return {ok:final.ok&&preFillet.ok,status:final.ok&&preFillet.ok?'CAPTURED':'FAIL_CAPTURE_READINESS',request,documentJSON,documentSHA256,resolvedSketch,resolvedSketchAuthority:'DERIVED_NUMERIC_OBSERVATION_ONLY_RAW_DOC_DRIVES_NATIVE',inputUnchanged:JSON.stringify(doc)===documentJSON,reader,final,preFillet,outputs:final.outputs,outputIds:final.outputs.map((o:any)=>o.outputId),target,native:target?{...target,documentSHA256,mass:target.massProperties,check:target.strict}:null,bodyCount:final.outputs.length,bodyKey:target?.bodyKey??null,outputId:target?.outputId??null,mass:target?.massProperties??null};
}
const inputFile=process.argv[2],inputBytes=readFileSync(inputFile,'utf8');
console.log(JSON.stringify({...inspect(JSON.parse(inputBytes),JSON.parse(process.argv[3]??'{}')),inputPath:inputFile,inputBytes,inputSHA256:sha(inputBytes)}));
`;

// Independent actual-coefficient geometry. No product imports or controlled-Doc
// coordinates are used by Python. Constraint and native budgets are distinct.
export const oracleSource = String.raw`
import copy,hashlib,json,math,sys,traceback
N=1e-9
LINEAR=1e-7
ANGULAR=1e-9
SEED_TEXT=${JSON.stringify(seedText)}
SEED_SHA='${seedSHA256}'
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
def cross2(a,b): return a[0]*b[1]-a[1]*b[0]
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(v):
 length=math.sqrt(dot(v,v));need(length>0,'nondegenerate direction');return [a/length for a in v]
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
def bounds(points):
 need(points,'nonempty native boundary');return {s:[fn(p[i] for p in points) for i in range(3)] for s,fn in [('min',min),('max',max)]}
def same_bounds(a,b,label):
 for side in ['min','max']: vec(a[side],b[side],label+side)
def arc(a,b,c,direction):
 r=math.dist(a,c);near(math.dist(b,c),r,'actual emitted endpoints share a circle');start=math.atan2(a[1]-c[1],a[0]-c[0]);sweep=wrap(math.atan2(b[1]-c[1],b[0]-c[0])-start)
 if direction=='ccw' and sweep<=0: sweep+=2*math.pi
 if direction=='cw' and sweep>=0: sweep-=2*math.pi
 return r,start,sweep
def specs(segs,hole=False):
 result=[]
 for i,s in enumerate(segs):
  a=s['start'];b=segs[(i+1)%len(segs)]['start'];item={'role':('hole' if hole else 'outer')+str(i),'a':a,'b':b,'kind':s['kind'],'hole':hole}
  if s['kind']=='arc':
   r,t,w=arc(a,b,s['center'],s['direction']);need(not hole and 0<w<math.pi,'selected convex CCW minor arcs only');item.update(c=s['center'],r=r,start=t,sweep=w)
  else: need(s['kind']=='line','only authored lines and circular arcs');item['length']=math.dist(a,b);need(item['length']>0,'positive source line')
  result.append(item)
 return result
def integrals(segs,positive=True):
 A=X=Y=0.;extrema=[]
 for i,s in enumerate(segs):
  a=s['start'];b=segs[(i+1)%len(segs)]['start'];cr=cross2(a,b);A+=cr/2;X+=(a[0]+b[0])*cr/6;Y+=(a[1]+b[1])*cr/6;extrema.append(a)
  if s['kind']=='arc':
   c=s['center'];r,t,w=arc(a,b,c,s['direction']);area=r*r*(w-math.sin(w))/2;moment=2*r**3*math.sin(w/2)**3/3;A+=area;X+=area*c[0]+moment*math.cos(t+w/2);Y+=area*c[1]+moment*math.sin(t+w/2)
   for angle in [0,math.pi/2,math.pi,3*math.pi/2]:
    travel=(angle-t)%(2*math.pi) if w>0 else (t-angle)%(2*math.pi)
    if travel<=abs(w)+1e-14: extrema.append([c[0]+r*math.cos(angle),c[1]+r*math.sin(angle)])
 if positive: need(A>0,'positive authored CCW loop area')
 return A,X,Y,extrema
def physical(doc):
 segs=doc['nodes'][0]['segments'];hole=doc['nodes'][0]['holes'][0];P=segs[2]['start'];before=segs[1]['start'];after=segs[3]['start'];incoming=unit(sub(P,before));outgoing=unit(sub(after,P));need(cross2(incoming,outgoing)>0,'selected convex downstream line-line corner')
 # Intersection of the two inward-offset lines gives the independent fillet
 # circle. This does not call product finishing code or assume a right angle.
 ni=[-incoming[1],incoming[0]];no=[-outgoing[1],outgoing[0]];den=1+dot(ni,no);need(den>0,'finite convex offset intersection');r=3
 c=[P[i]+r*(ni[i]+no[i])/den for i in range(2)];ta=[c[i]-r*ni[i] for i in range(2)];tb=[c[i]-r*no[i] for i in range(2)]
 need(0<math.dist(P,ta)<math.dist(P,before) and 0<math.dist(P,tb)<math.dist(P,after),'independent fillet tangencies fit both actual lines')
 final=copy.deepcopy(segs);final[2]={'kind':'line','start':tb};final.insert(2,{'kind':'arc','start':ta,'center':c,'direction':'ccw'})
 ha,hx,hy,_=integrals(hole);near(ha,50,'unchanged rectangular hole area');out={}
 for label,loop in [('preFillet',segs),('final',final)]:
  A,X,Y,ext=integrals(loop);A-=ha;X-=hx;Y-=hy;need(A>0,'positive material section');out[label]={'volume':10*A,'massDensity1':A/100,'centroid':[X/A,Y/A,5],'bounds':{'min':[min(p[0] for p in ext),min(p[1] for p in ext),0],'max':[max(p[0] for p in ext),max(p[1] for p in ext),10]},'specs':specs(loop)+specs(hole,True)}
 return out,{'corner':P,'center':c,'radius':3,'start':ta,'end':tb,'source':'Actual returned adjacent line directions, independent offset-line intersection'}
def constraints(doc,length):
 sk=doc['nodes'][0];segs=sk['segments'];o=sk['outline'];pts=o['points'];linear=[];angular=[]
 need(len(pts)==len(segs)==7 and [i for i,s in enumerate(segs) if s['kind']=='arc']==[4],'same seven-segment mixed loop')
 for i,p in enumerate(pts): vec(p,segs[i]['start'],'outline/emitted original coordinates')
 linear+=list(map(abs,pts[0]))
 for key,wanted in o['lengths'].items(): i=int(key);linear.append(abs(math.dist(pts[i],pts[(i+1)%7])-wanted))
 for i in o['hv']['h']: linear.append(abs(pts[(i+1)%7][1]-pts[i][1]))
 for i in o['hv']['v']: linear.append(abs(pts[(i+1)%7][0]-pts[i][0]))
 s=segs[4];need(s['direction']=='ccw','retained authored arc direction');r,t,w=arc(pts[4],pts[5],s['center'],s['direction']);need(0<w<math.pi,'retained minor convex authored arc');linear.append(abs(r-3))
 bul=o['bulges'];need(len(bul)==7 and [i for i,b in enumerate(bul) if b]==[4],'same authored arc index');chord=math.dist(pts[4],pts[5]);need(chord>0 and bul[4]>0,'positive original arc bulge');d=chord*(1-bul[4]**2)/(4*bul[4]);mid=[(a+b)/2 for a,b in zip(pts[4],pts[5])];reconstructed=[mid[0]-(pts[5][1]-pts[4][1])*d/chord,mid[1]+(pts[5][0]-pts[4][0])*d/chord];vec(reconstructed,s['center'],'independent bulge/emitted circle center')
 for tangent,line_direction in [([-math.sin(t),math.cos(t)],sub(pts[4],pts[3])),([-math.sin(t+w),math.cos(t+w)],sub(pts[6],pts[5]))]:
  v=unit(line_direction);angular.append(abs(math.atan2(cross2(v,tangent),dot(v,tangent))))
 need(max(linear)<=LINEAR,'returned linear constraint residual <=1e-7mm');need(max(angular)<=ANGULAR,'returned tangent angular residual <=1e-9rad')
 return {'linearMaximumMM':max(linear),'angularMaximumRad':max(angular),'linearLimitMM':LINEAR,'angularLimitRad':ANGULAR,'requestedLength':length,'actualAuthoredArc':{'center':s['center'],'radius':r,'sweep':w}}
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
 p=c['controlPoints'];w=c['weights'];need(len(p)==len(w) and all(v>0 for v in w),'positive original curve weights');q=deboor([[v*ww for v in pp]+[ww] for pp,ww in zip(p,w)],c['knots'],c['degree'],t);need(q[3]>0,'positive curve denominator');return [v/q[3] for v in q[:3]]
def surface_d1(s,u,v):
 need(s['kind']=='surface','no faceted carrier');p=s['controlPoints'];w=s['weights'];need(len(p)==len(w) and all(len(a)==len(b) for a,b in zip(p,w)) and all(ww>0 for row in w for ww in row),'positive original surface weights');h=[[[q*ww for q in pp]+[ww] for pp,ww in zip(row,weights)] for row,weights in zip(p,w)];rows=[deboor(row,s['knotsV'],s['degreeV'],v) for row in h];rowsv=[derivative(row,s['knotsV'],s['degreeV'],v) for row in h];q=deboor(rows,s['knotsU'],s['degreeU'],u);du=derivative(rows,s['knotsU'],s['degreeU'],u);dv=deboor(rowsv,s['knotsU'],s['degreeU'],u);need(q[3]>0,'positive surface denominator');return [a/q[3] for a in q[:3]],[(a*q[3]-b*du[3])/q[3]**2 for a,b in zip(du[:3],q[:3])],[(a*q[3]-b*dv[3])/q[3]**2 for a,b in zip(dv[:3],q[:3])]
def station(spec,p):
 xy=p[:2]
 if spec['kind']=='line':
  delta=sub(spec['b'],spec['a']);length=spec['length'];along=dot(sub(xy,spec['a']),delta)/length;distance=abs(cross2(delta,sub(xy,spec['a'])))/length
  return along if distance<=N and -N<=along<=length+N else None
 distance=abs(math.dist(xy,spec['c'])-spec['r']);angle=math.atan2(xy[1]-spec['c'][1],xy[0]-spec['c'][0]);travel=(angle-spec['start'])%(2*math.pi)
 if travel>2*math.pi-N/spec['r']: travel=0
 return travel*spec['r'] if distance<=N and travel<=spec['sweep']+N/spec['r'] else None
def native_geometry(raw,expected,label):
 b=raw['brep'];need(finite(b),'finite original '+label+' BRep');keys=['bodies','shells','faces','loops','coedges','edges','vertices'];tab={k:{v['id']:v for v in b[k]} for k in keys};need(all(len(tab[k])==len(b[k]) for k in keys),'unique original IDs');need(len(b['bodies'])==len(b['shells'])==1 and b['bodies'][0]['kind']=='solid' and b['shells'][0]['closed'],'one closed original solid');body,shell=b['bodies'][0],b['shells'][0];faces,loops,co,edges,verts=[tab[k] for k in keys[2:]];need(set(body['shells'])==set(tab['shells']) and shell['body']==body['id'] and set(shell['faces'])==set(faces),'complete original solid ownership');points={};max_endpoint=0.;max_lift=0.;pcurves=0;owned_l=[];owned_c=[];graph={f:set() for f in faces};cap=1e-3*max(1,max(abs(x) for v in verts.values() for x in v['point']))
 for v in verts.values(): need(0<v['tolerance']<=cap,'unchanged strict vertex tolerance cap')
 for e in edges.values():
  need(0<e['tolerance']<=cap and len(e['vertices'])==2 and all(v in verts for v in e['vertices']),'original edge references/tolerance');a,z=domain(e['curve']);points[e['id']]=[curve(e['curve'],a+(z-a)*i/8) for i in range(9)]
  for p,vid in zip([points[e['id']][0],points[e['id']][-1]],e['vertices']): gap=math.dist(p,verts[vid]['point']);max_endpoint=max(max_endpoint,gap);near(gap,0,'independent original edge endpoint',min(N,e['tolerance']))
 for f in faces.values():
  need(f['shell']==shell['id'] and f['loops'],'face/shell reciprocity');owned_l+=f['loops']
  for lid in f['loops']:
   lp=loops[lid];need(lp['face']==f['id'] and lp['coedges'],'face/loop reciprocity');owned_c+=lp['coedges']
   for j,cid in enumerate(lp['coedges']):
    c=co[cid];nxt=co[lp['coedges'][(j+1)%len(lp['coedges'])]];need(c['loop']==lid and c['next']==nxt['id'] and c['prev']==lp['coedges'][j-1],'ordered native loop');need(edges[c['edge']]['vertices'][1 if c['sense']=='forward' else 0]==edges[nxt['edge']]['vertices'][0 if nxt['sense']=='forward' else 1],'directed native loop endpoints')
 for c in co.values():
  twin=co[c['twin']];need(twin['twin']==c['id'] and twin['edge']==c['edge'] and twin['sense']!=c['sense'],'closed original opposed twins');graph[loops[c['loop']]['face']].add(loops[twin['loop']]['face'])
  if c.get('pcurve') is not None:
   pcurves+=1;e=edges[c['edge']];need(domain(c['pcurve'])==domain(e['curve']),'original pcurve domain');a,z=domain(e['curve'])
   for i in range(5):
    tt=a+(z-a)*i/4;uv=curve(c['pcurve'],tt);lift=surface_d1(faces[loops[c['loop']]['face']]['surface'],uv[0],uv[1])[0];gap=math.dist(lift,curve(e['curve'],tt));max_lift=max(max_lift,gap);near(gap,0,'independent original pcurve lift',min(N,e['tolerance']))
 need(len(owned_l)==len(loops) and set(owned_l)==set(loops) and len(owned_c)==len(co) and set(owned_c)==set(co),'all original loops/coedges owned once')
 for eid in edges: need(sum(c['edge']==eid for c in co.values())==2,'two original edge uses')
 need(set(v for e in edges.values() for v in e['vertices'])==set(verts),'no orphan vertices');seen=set();todo=[next(iter(faces))]
 while todo:
  f=todo.pop()
  if f not in seen: seen.add(f);todo+=list(graph[f]-seen)
 need(seen==set(faces),'one connected original shell');chi=len(verts)-len(edges)+2*len(faces)-len(loops);need(chi==0,'independent genus1 rectangular through-hole')
 ss=expected['specs'];coverage={(z,i):[] for z in [0,10] for i in range(len(ss))}
 for eid,ps in points.items():
  need(all(-N<=p[2]<=10+N for p in ps),'actual axial material extent')
  levels=[z for z in [0,10] if all(abs(p[2]-z)<=N for p in ps)]
  if levels:
   matches=[(i,[station(s,p) for p in ps]) for i,s in enumerate(ss) if all(station(s,p) is not None for p in ps)];need(matches,'every original cap edge on an actual declared line/arc boundary')
   for z in levels:
    for i,values in matches: coverage[z,i].append((min(values),max(values)))
  else: need(all(math.dist(p[:2],ps[0][:2])<=N for p in ps) and any(station(s,ps[0]) is not None for s in ss),'only vertical side/seam edges on declared boundary')
 for (z,i),intervals in coverage.items():
  need(intervals,'every declared segment retained at both cap levels');end=0.
  for a,b in sorted(intervals): need(a<=end+N,'complete nominal cap-boundary interval coverage');end=max(end,b)
  near(end,ss[i]['length'] if ss[i]['kind']=='line' else ss[i]['r']*ss[i]['sweep'],'complete native segment extent at cap')
 smap={s['id']:s for s in raw['surfaces']};need(len(smap)==len(raw['surfaces'])==len(faces) and set(smap)==set(faces),'all original carrier observations');roles=set();max_point=0.;max_d1=0.;max_normal=0.;carriers=[]
 for f in faces.values():
  ob=smap[f['id']];g=ob['geometry'];boundary=[p for lid in f['loops'] for cid in loops[lid]['coedges'] for p in points[co[cid]['edge']]];role=None;spec=None
  if g['kind']=='plane' and abs(abs(g['n'][2])-1)<=N:
   z=10 if g['n'][2]>0 else 0;near(g['o'][2],z,'original cap plane');need(all(abs(p[2]-z)<=N for p in boundary),'actual cap trim level');role='top' if z else 'bottom';normal=[0,0,1 if z else -1]
  else:
   matches=[]
   for i,s in enumerate(ss):
    if not all(station(s,p) is not None for p in boundary): continue
    if s['kind']=='line' and g['kind']=='plane':
     v=unit(sub(s['b'],s['a']));nn=[v[1],-v[0],0];nn=[-a for a in nn] if s['hole'] else nn
     if max(abs(a-b) for a,b in zip(g['n'],nn))<=N: matches.append((i,s,nn))
    if s['kind']=='arc' and g['kind']=='cylinder' and abs(g['r']-s['r'])<=N and math.dist(g['c'][:2],s['c'])<=N: matches.append((i,s,None))
   need(len(matches)==1,'unique actual side line/cylinder carrier');i,spec,normal=matches[0];role=spec['role']
   if spec['kind']=='arc': need(g['out']==1,'convex outward cylinder');vec([abs(v) for v in g['a']],[0,0,1],'current cylinder Z axis')
  roles.add(role);carriers.append({'id':f['id'],'name':f.get('name'),'role':role})
  for q in ob['probe']['probes']:
   p,du,dv=surface_d1(f['surface'],q['u'],q['v']);vec(q['point'],p,'independent rational surface point');vec(q['du'],du,'independent rational du');vec(q['dv'],dv,'independent rational dv');nn=unit(cross(du,dv));nn=[v*(1 if f['sense']=='forward' else -1) for v in nn]
   if spec and spec['kind']=='arc': near(math.dist(p[:2],spec['c']),spec['r'],'independent circle carrier');normal=[(p[0]-spec['c'][0])/spec['r'],(p[1]-spec['c'][1])/spec['r'],0]
   else:
    origin=[spec['a'][0],spec['a'][1],0] if spec else [0,0,10 if role=='top' else 0];near(dot(normal,sub(p,origin)),0,'independent plane carrier')
   vec(nn,normal,'independent actual outward normal');vec(q['normal'],nn,'native normal observation');need(q['normalNorm']>0,'nondegenerate original derivative');max_point=max(max_point,max(abs(a-b) for a,b in zip(q['point'],p)));max_d1=max(max_d1,max(abs(a-b) for a,b in zip(q['du']+q['dv'],du+dv)));max_normal=max(max_normal,max(abs(a-b) for a,b in zip(nn,normal)))
 need(roles=={'top','bottom'}|{s['role'] for s in ss},'all declared side/cap carriers present');ep={e['id']:e for e in raw['edgeProbes']};need(set(ep)==set(edges) and len(ep)==len(raw['edgeProbes']),'all original edge observations');max_edge=0.
 for eid,e in edges.items():
  a,z=domain(e['curve']);ob=ep[eid]['probe'];need(ob['domain']==[a,z] and len(ob['samples'])==9,'original edge domain/station observations')
  for i,p in enumerate(ob['samples']): q=curve(e['curve'],a+(z-a)*i/8);vec(p,q,'independent observed native edge');max_edge=max(max_edge,max(abs(v-w) for v,w in zip(p,q)))
 same_bounds(raw['bounds'],expected['bounds'],'native actual material bounds')
 # Integrate the original ordered top-cap coedges independently too. Native
 # endpoint coordinates and coedge orientation are retained. Circle centers
 # come from the original adjacent cylindrical carrier, already checked above.
 A=X=Y=0.;native_loops=0
 for f in faces.values():
  g=smap[f['id']]['geometry']
  if not(g['kind']=='plane' and abs(g['n'][2]-1)<=N): continue
  for lid in f['loops']:
   loop=[];native_loops+=1
   for cid in loops[lid]['coedges']:
    use=co[cid];ps=points[use['edge']];ps=ps if use['sense']=='forward' else list(reversed(ps));matches=[s for s in ss if all(station(s,p) is not None for p in ps)];need(len(matches)==1,'unique original cap coedge line/arc integral');s=matches[0];segment={'kind':s['kind'],'start':ps[0][:2]}
    if s['kind']=='arc':
     twin=co[use['twin']];side=smap[loops[twin['loop']]['face']]['geometry'];need(side['kind']=='cylinder','original cap arc has cylindrical side');center=side['c'][:2];angles=[math.atan2(p[1]-center[1],p[0]-center[0]) for p in ps];turn=sum(wrap(z-a) for a,z in zip(angles,angles[1:]));need(0<abs(turn)<math.pi,'original directed minor cap arc');segment.update(center=center,direction='ccw' if turn>0 else 'cw')
    loop.append(segment)
   a,x,y,_=integrals(loop,False);A+=a;X+=x;Y+=y
 need(native_loops>=2 and A>0,'original positive material cap with hole');native_volume=10*A;native_centroid=[X/A,Y/A,5];near(native_volume,expected['volume'],'independent original oriented cap volume',N*expected['volume']);vec(native_centroid,expected['centroid'],'independent original oriented cap centroid')
 return {'counts':{k:len(raw['brep'][k]) for k in keys},'genus':1,'eulerCharacteristic':chi,'carriers':carriers,'pcurveCount':pcurves,'pcurvePresence':'ORIGINAL_OPTIONAL_FIELDS_ONLY','maximumEndpointGapMM':max_endpoint,'maximumPcurveLiftGapMM':max_lift,'maximumIndependentProbePointGapMM':max_point,'maximumIndependentD1ComponentGapMM':max_d1,'maximumIndependentEdgeProbeGapMM':max_edge,'maximumOutwardNormalComponentError':max_normal,'originalOrientedTopCapIntegrals':{'loopCount':native_loops,'areaMM2':A,'volumeMM3':native_volume,'centroidMM':native_centroid,'volumeRelativeError':abs(native_volume-expected['volume'])/expected['volume'],'centroidAbsoluteErrorMM':max(abs(a-b) for a,b in zip(native_centroid,expected['centroid']))},'capBoundaryCoverage':'Every actual declared line/arc covered at z0/z10; finite rational witnesses, not a full-domain theorem'}
def run(x):
 params=x['parameters'];need(set(params)=={'length'} and type(params['length']) in [int,float] and params['length'] in [60,64,68],'three declared driving-line classes only');length=params['length'];doc=x['doc'];rd=x['read'];text=x.get('documentJSON',rd['documentJSON']);need(len(SEED_TEXT.encode())==3942 and hashlib.sha256(SEED_TEXT.encode()).hexdigest()==SEED_SHA,'exact retained D461 actual saved seed bytes/hash');seed=json.loads(SEED_TEXT);need(x['seedDoc']==seed,'caller exact antecedent');base=seed['nodes'][0]
 need(doc==x['expectedDoc'],'exact caller-captured accepted raw document')
 need({k:v for k,v in doc.items() if k not in ['nodes','parameters']}=={k:v for k,v in seed.items() if k not in ['nodes','parameters']},'root IDs/output/configuration metadata unchanged')
 need(doc['nodes'][1]==seed['nodes'][1] and {k:v for k,v in doc['nodes'][2].items() if k!='sigs'}=={k:v for k,v in seed['nodes'][2].items() if k!='sigs'},'downstream ownership/reference/Fillet retained; refreshed signatures checked in actual compilation')
 raw=doc['nodes'][0]
 if raw['kind']=='driven-sketch':
  need(raw['version']==1 and raw['seed']==x['authoredSeed']=={k:v for k,v in base.items() if k not in ['kind','id']},'literal original numeric60 authored seed unchanged across named edits')
  name=x['parameterName'];need(raw['bindings']==[{'kind':'line-length','entity':'e1','value':{'parameter':name}}] and doc['parameters']=={name:length},'single stable outer line bound to current own named parameter')
 need(rd['resolvedSketchAuthority']=='DERIVED_NUMERIC_OBSERVATION_ONLY_RAW_DOC_DRIVES_NATIVE','numeric resolution is an observation, never the actual producer input')
 sk=rd['resolvedSketch'];need(sk['kind']=='sketch','temporary numeric observer')
 need({k:v for k,v in sk.items() if k not in ['segments','outline']}=={k:v for k,v in base.items() if k not in ['segments','outline']},'exact hole/construction e11/tags/IDs/sketch extras')
 need(set(sk['outline'])==set(base['outline']) and {k:v for k,v in sk['outline'].items() if k not in ['points','bulges','lengths']}=={k:v for k,v in base['outline'].items() if k not in ['points','bulges','lengths']} and sk['outline']['lengths']=={'0':length,'1':20},'same R3/HV/tangent constraints and requested driving length')
 need(len(sk['segments'])==len(base['segments']) and all(set(a)==set(b) and a['kind']==b['kind'] for a,b in zip(sk['segments'],base['segments'])),'same authored line/arc identities')
 geometry=copy.deepcopy(doc);geometry['nodes'][0]=sk
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[] and hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'] and rd['request']['parameters']==params,'original actual whole Doc/native reader/hash/request binding');residuals=constraints(geometry,length);expected,fillet=physical(geometry);prefix=copy.deepcopy(doc);prefix['nodes']=prefix['nodes'][:2];prefix['outputs']={'b1':{'node':1,'side':'solid'}};need(rd['final']['documentJSON']==text and rd['preFillet']['authority']=='OBSERVER_DERIVED_SAME_ACTUAL_SOURCE_PREFIX_BEFORE_FILLET' and json.loads(rd['preFillet']['documentJSON'])==prefix,'separate labelled same-source pre-Fillet prefix, not another final fixture');results={}
 features=[{k:v for k,v in sk.items() if k not in ['outline','on','construction','association']},{'id':'n1','kind':'extrude','sketch':'n0','height':10},{'id':'n2','kind':'fillet','target':'n1','edges':['n1.side[e2]|n1.side[e3]'],'radius':3,'expect':{k:{'kind':v['k'],'at':v['p'],'dir':v['d'],'size':v['s']} for k,v in doc['nodes'][2]['sigs'].items()}}]
 need(rd['outputs']==rd['final']['outputs'] and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0] and rd['outputIds']==['n2'] and rd['bodyCount']==1 and rd['bodyKey']=='b2' and rd['outputId']=='n2','all original final output aliases and sole n2/b2 owner')
 alias=rd['native'];need(alias['nativeBRepJSON']==rd['target']['nativeBRepJSON'] and alias['nativeBRepSHA256']==rd['target']['nativeBRepSHA256'] and alias['documentSHA256']==rd['documentSHA256'] and alias['mass']==rd['target']['massProperties'] and rd['mass']==rd['target']['massProperties'],'raw final alias Doc/BRep/mass bindings')
 for label,owner,key in [('final','n2','b2'),('preFillet','n1','b1')]:
  obs=rd[label];need(obs['ok'] is True and hashlib.sha256(obs['documentJSON'].encode()).hexdigest()==obs['documentSHA256'] and len(obs['outputs'])==1,'original native '+label+' input/output binding');raw=obs['outputs'][0];need(raw['outputId']==owner and raw['bodyKey']==key and raw['nativeBodyCount']==1,'original '+label+' owner');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original '+label+' JS BRep bytes/hash');need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'explicit raw MMGS density1 units')
  need(obs['partDocument']=={'format':'barocss-cad-part','version':1,'units':'mm','parameters':doc['parameters'],'features':features if label=='final' else features[:2]},'actual original solved profile/height/native ref and historical signature compilation '+label)
  for check in ['defaultCheck','strict','outputCheck']: need(raw[check]['valid'] is True and raw[check]['issues']==[] and len(raw[check]['topology'])==1 and raw[check]['topology'][0]['genus']==1,'strict closed genus1 '+label)
  e=expected[label];errors={}
  for method in ['massProperties','brepMass']:
   mass=raw[method];need(finite(mass) and mass['method'] in ['closed-form','planar-exact','quadrature'],'nonmesh physical mass');near(mass['volume'],e['volume'],label+' independent actual-loop volume',N*e['volume']);near(mass['mass'],e['massDensity1'],label+' density1 grams');vec(mass['centroid'],e['centroid'],label+' independent actual-loop centroid');errors[method]={'volumeRelative':abs(mass['volume']-e['volume'])/e['volume'],'centroidAbsoluteMM':max(abs(a-b) for a,b in zip(mass['centroid'],e['centroid']))}
  results[label]={'documentSHA256':obs['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'massErrors':errors,'geometry':native_geometry(raw,e,label)}
 pre=rd['preFillet']['outputs'][0];references=[e for e in pre['edgeProbes'] if e.get('name')=='n1.side[e2]|n1.side[e3]'];need(len(references)==1,'one actual current pre-Fillet named reference');ref=references[0];need(ref['degree']==1,'current selected straight vertical edge');ends=sorted(ref['endpoints'],key=lambda p:p[2]);vec(ends[0],fillet['corner']+[0],'actual source current lower edge pin');vec(ends[1],fillet['corner']+[10],'actual source current upper edge pin')
 for p in ref['probe']['samples']: vec(p[:2],fillet['corner'],'actual source current reference XY')
 worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh exact actual Studio Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b2','fresh current Worker b2');b=w['bodies'][0];near(b['volume'],expected['final']['volume'],'fresh Worker independent volume',N*expected['final']['volume']);vec(b['centroid'],expected['final']['centroid'],'fresh Worker independent centroid');worker='PASS_ORIGINAL_FRESH_STUDIO_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D537_NAMED_SKETCH_LENGTH_STATE','parameters':params,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':rd['final']['outputs'][0]['nativeBRepSHA256'],'constraintResiduals':residuals,'expected':{k:{a:b for a,b in v.items() if a!='specs'} for k,v in expected.items()},'derivedActualCornerFillet':fillet,'native':results,'worker':worker,'budgets':{'constraintLinearMM':LINEAR,'constraintAngularRad':ANGULAR,'nativeVolumeRelative':N,'nativeCentroidBoundsBoundaryD1PcurveMM':N,'nativeUnitNormalComponent':N,'density1MassAbsoluteG':N},'limits':['Only actual mixed L line/arc Length60/64/68, unchanged R3 and existing line-line Fillet3, one rectangular hole and untouched construction.','Actual solver coefficients are integrated; unlocked coordinates may move. Historical signatures are identity anchors, not current measurements.','Complete original topology/trim traversal with finite rational witnesses is not a full-domain geometry theorem. No new Round, general line-arc Round, generic solver, inertia, manufacturing, mobile or release claim.']}
if __name__=='__main__':
 try: print(json.dumps(run(json.load(sys.stdin)),indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D537_DECLARED_NAMED_SKETCH_LENGTH','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
