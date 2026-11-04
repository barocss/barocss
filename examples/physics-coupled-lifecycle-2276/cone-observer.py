"""Independent geometry admission and physical cone residual observer.
Consumes saved words; imports no candidate or engine solver. K derives from m=1,I=1/6.
"""
from pathlib import Path
from fractions import Fraction as F
from decimal import Decimal,localcontext
import sys,json,struct,hashlib
from importlib.util import spec_from_file_location,module_from_spec
# Reuse only independent Hamilton/slab primitives and lossless word decoding.
spec=spec_from_file_location('cone_physical',Path(__file__).with_name('physical-observer.py'));physical=module_from_spec(spec);spec.loader.exec_module(physical)
vec=physical.fv;dot=physical.dot;add=physical.add;sub=physical.sub;scale=physical.scale;cross=physical.cross;native=physical.native
P=[F(-1,4),F(0),F(1,16)];C=[F(0),F(1,2),F(3,8)];N=[F(-16,129),F(127,129),F(16,129)];T=[F(128,129),F(16,129),F(1,129)];S=[F(1,129),F(-16,129),F(128,129)]
GEOM=F(1,10**12);MOTION=F(1,10**10)
def need(ok,message):
    if not ok:raise ValueError(message)
def bounded(x):
    if isinstance(x,F):need(x.numerator.bit_length()<=16384 and x.denominator.bit_length()<=16384,'Exact integer bit cap')
    elif isinstance(x,(list,tuple)):
        for v in x:bounded(v)
    return x
def words(xs):return [struct.pack('>d',float(x)).hex() for x in xs]
def solve3(matrix,rhs):
    # Bounded exact linear elimination; not the finite sequential candidate law.
    a=[row[:]+[v] for row,v in zip(matrix,rhs)]
    for col in range(3):
        pivot=next((i for i in range(col,3) if a[i][col]),None);need(pivot is not None,'Physical K invertible');a[col],a[pivot]=a[pivot],a[col];a[col]=bounded([v/a[col][col] for v in a[col]])
        for i in range(3):
            if i!=col:a[i]=bounded([v-a[i][col]*u for v,u in zip(a[i],a[col])])
    return bounded([a[i][3] for i in range(3)])
def actual(packet):
    w=next(w for w in packet['trace']['worlds'] if w['id']==packet['worldId']);a=w['creation'] if packet['mode']=='creation' else next(a for a in w['history'] if a['attempt']==packet['attemptId']);return a['records']
def qgate(q):
    q=vec(q);need(q[0]!=0 and q[1]==0 and q[2]==q[0] and q[3]==16*q[0],'Actual admitted quaternion ratios');return q
def geometry(packet,gate):
    records=actual(packet);cube=next(b for b in packet['after']['bodies'] if b['id']=='z-cube');qgate(cube['orientationXYZW']);need(packet['model']['gravityMps2']==[0,0,0],'Actual gravity zero');queries=[e for e in records if e['kind']=='geometry-query'];need(queries,'Actual geometry query required')
    if packet['mode']=='creation':
        need(all(e['result']['status']=='MISS' for e in queries),'Constructor is separated/cold');need(not packet['after']['contacts'] and not packet['after']['events'] and not packet['after']['pairWrenches'],'Initial geometry has no contact/event/wrench');need(not packet['privateAfter']['world']['persistentPoints'] and not packet['privateAfter']['accepted']['cacheFrames'],'No initial cache seed');return dict(mode='creation',queries=len(queries),KModel='NOT_APPLICABLE_BEFORE_FORCE_QUERY')
    force=[e for e in queries if not e['final']];need(force,'Actual force query required');first=force[0];firstQ=first['pair']['b']['orientationXYZW'];need(not any(e['kind']=='pose-correction' for e in records),'Unexpected pose correction blocks fixed K model');need(words(first['pair']['b']['positionM'])==words(C),'First force center exact target words')
    for e in queries:
        need(e['pair']['a']['id']=='a-floor' and e['pair']['b']['id']=='z-cube','Actual lexical pair');a,b=e['pair']['a'],e['pair']['b'];need(vec(a['positionM'])==[0,F(-1,8),0] and vec(a['halfExtentsM'])==[F(1,4),F(1,8),F(1,16)] and vec(a['orientationXYZW'])==[0,0,0,1],'Fixed actual floor');need(words(b['positionM'])==words(C) and vec(b['halfExtentsM'])==[F(1,2)]*3,'Fixed actual cube pose/shape');qgate(b['orientationXYZW']);need(words(b['orientationXYZW'])==words(firstQ),'Fixed actual orientation');need(native(b)['axes']==[T,N,S],'Actual Hamilton axes equal independently intended frame')
        for side,prefix in [('a','A'),('b','B')]:
            body=e['body'+prefix];need(e['pair'][side]['id']==body['id'] and words(e['pair'][side]['positionM'])==words(body['positionM']) and words(e['pair'][side]['orientationXYZW'])==words(body['orientationXYZW']),'Query owns actual body pose')
        result=e['result'];need(result['status']=='HIT' and len(result['points'])==1,'Every actual query is single-point HIT');en=[F(v) for v in result['exactNormalDirection']];need(cross(en,N)==[0,0,0] and dot(en,N)>0,'Native exact normal direction');n=vec(result['normal'])
        for i in range(3):gate('representedNativeNormal'+str(i),n[i]-N[i],GEOM)
        need(words(result['normal'])==words(first['result']['normal']),'Fixed represented normal frame');point=result['points'][0]
        for key in ['a','b','midpoint']:need([F(v) for v in point['exact'][key]]==P,'Native unique endpoint/midpoint is intended corner')
        for key in ['pointM','aPointM','bPointM']:need(vec(point[key])==P,'Actual represented force point/endpoints at p')
        need(e['projectedDepthM']==0,'No positive producer depth in exact touching K model')
    events=[e for e in records if e['kind']=='impulse-application'];need(events,'Actual applications required')
    for e in events:
        for key in ['pointM','anchorOnAM','anchorOnBM']:need(vec(e[key])==P,'Every actual anchor at intended p')
        need(words(e['normal'])==words(first['result']['normal']),'Application normal fixed')
        for suffix in ['Before','After']:
            body=e['bodyB'+suffix];need(vec(body['positionM'])==C and words(body['orientationXYZW'])==words(firstQ),'Impulse COM/orientation fixed')
    need(vec(cube['positionM'])==C and words(cube['orientationXYZW'])==words(firstQ),'Accepted pose remains fixed K pose');return dict(mode='step',queries=len(queries),applications=len(events),firstQueryId=first['queryId'],KModel='GEOMETRY_ADMITTED_ONLY',pointExact=[str(x) for x in P],normalExact=[str(x) for x in N])
def audit(packet,mode):
    maxima={};rows=[];failure=None;cursor='actual-query-geometry'
    def gate(name,value,limit):
        value=abs(value);maxima[name]=max(maxima.get(name,F(0)),value);need(value<=limit,name+': '+str(float(value))+' > '+str(float(limit)))
    try:
        geometryReport=geometry(packet,gate);rows.append(geometryReport)
        if mode=='cone':
            need(packet['mode']=='step','Cone needs actual accepted step');cursor='independent-physical-K-and-exact-static-branch';r=sub(C,P);r2=dot(r,r);K=bounded([[F(i==j)+6*(r2*F(i==j)-r[i]*r[j]) for j in range(3)] for i in range(3)]);need(K==[[F(395,128),F(-96,128),F(-60,128)],[F(-96,128),F(251,128),F(-120,128)],[F(-60,128),F(-120,128),F(368,128)]],'Physical mass/inertia K derivation')
            before=next(b for b in packet['before']['bodies'] if b['id']=='z-cube');after=next(b for b in packet['after']['bodies'] if b['id']=='z-cube');need(vec(before['angularVelocityRadps'])==[0,0,0],'Frozen initial spin zero');v0=vec(before['velocityMps']);stick=solve3(K,scale(v0,-1));ns=dot(stick,N);ts=sub(stick,scale(N,ns));margin=bounded(dot(ts,ts)-ns*ns);case=packet['caseId'];sign=-1 if margin<0 else 1 if margin>0 else 0;need(sign=={'before':-1,'at':0,'after':1}[case],'Exact stored-input static branch certificate');need(ns>0,'Independent active stick normal load');expected='STATIC_STICK' if margin<=0 else 'DYNAMIC_SLIP';records=actual(packet);events=[e for e in records if e['kind']=='impulse-application'];j=[sum((vec(e['impulseOnBNs'])[i] for e in events),F(0)) for i in range(3)];wrench=packet['after']['pairWrenches'];need(len(wrench)==1,'Actual accumulated pair wrench');reported=vec(wrench[0]['onB']['linearImpulseNs']);rows.append(dict(independentK=[[str(v) for v in row] for row in K],independentStickImpulseNs=[str(v) for v in stick],staticConeSquaredMargin=str(margin),expectedConstitutiveBranch=expected,actualEventImpulseNs=[str(v) for v in j],actualProducerImpulseNs=[str(v) for v in reported],actualBranchDecisions=[dict(record=i,kind=e.get('eventKind'),branch=e.get('branch'),cacheBefore=e.get('cacheBefore'),cacheAfter=e.get('cacheAfter')) for i,e in enumerate(records) if e['kind']=='impulse-application']))
            cursor='actual-independent-cone-residuals'
            # Check both exact application sum and actual producer accumulation.
            for owner,J in [('events',j),('producer',reported)]:
                normal=dot(J,N);tangent=sub(J,scale(N,normal));uK=add(v0,[dot(row,J) for row in K]);uBody=add(vec(after['velocityMps']),cross(vec(after['angularVelocityRadps']),sub(P,vec(after['positionM']))));un=dot(uK,N);ut=sub(uK,scale(N,un));norms=[]
                for precision in [80,120]:
                    with localcontext() as ctx:
                        ctx.prec=precision;d=lambda x:Decimal(x.numerator)/Decimal(x.denominator);tnorm=d(dot(tangent,tangent)).sqrt();slip=d(dot(ut,ut)).sqrt();mu=F.from_float(packet['model']['colliders'][0]['material']['friction']['dynamic']);dynamicMagnitude=tnorm-d(mu*normal);direction=[d(tangent[i])+d(mu*normal)*d(ut[i])/slip for i in range(3)] if slip!=0 else None;norms.append(dict(tnorm=tnorm,slip=slip,dynamicMagnitude=dynamicMagnitude,direction=direction))
                for k in ['tnorm','slip','dynamicMagnitude']:need(abs(norms[0][k]-norms[1][k])<=Decimal('1e-60'),'Independent80/120 norm agreement '+k)
                if norms[0]['direction'] is not None and norms[1]['direction'] is not None:
                    for a,b in zip(norms[0]['direction'],norms[1]['direction']):need(abs(a-b)<=Decimal('1e-60'),'Independent80/120 dynamic direction agreement')
                rows.append(dict(impulseAuthority=owner,normalImpulseExactNs=str(normal),tangentExactNs=[str(x) for x in tangent],contactVelocityFromK=[str(x) for x in uK],contactVelocityFromActualBody=[str(x) for x in uBody],normalSpeedExactMps=str(un),norms=[{k:([str(x) for x in v] if isinstance(v,list) else str(v)) for k,v in result.items()} for result in norms]))
                for i in range(3):gate(owner+'PhysicalKActualBodyContactVelocity'+str(i),uK[i]-uBody[i],MOTION)
                if expected=='STATIC_STICK':
                    need(normal>=0,'Static normal impulse nonnegative')
                    for i in range(3):gate(owner+'StaticZeroContactVelocity'+str(i),uK[i],MOTION)
                    gate(owner+'StaticConeExcessNs',max(F(0),F(norms[1]['tnorm'])-normal),GEOM)
                else:
                    need(normal>0,'Dynamic normal impulse positive');gate(owner+'DynamicZeroNormalSpeed',un,MOTION);need(F(norms[1]['slip'])>MOTION,'Dynamic final tangent slip must be positive');gate(owner+'DynamicConeMagnitudeNs',F(norms[1]['dynamicMagnitude']),GEOM);need(norms[1]['direction'] is not None,'Dynamic direction defined')
                    for i in range(3):gate(owner+'DynamicMaximumDissipation'+str(i),F(norms[1]['direction'][i]),GEOM)
    except Exception as error:failure=dict(cursor=cursor,type=type(error).__name__,message=str(error))
    return dict(status=('EXECUTED_NO_GO_' if failure else 'EXECUTED_PASS_')+('CONE_GEOMETRY' if mode=='geometry' else 'INDEPENDENT_PERSISTENT_CONE'),firstFailure=failure,maxima={k:float(v) for k,v in maxima.items()},rows=rows,WorldCalls=0,candidateCalls=0,scope='FINITE_ONE_CONTACT_PHYSICAL_CONSTITUTIVE_LAW_ONLY',nativePublicDesktopPerformance='NOT_RUN')
if __name__=='__main__':
    packet=physical.decode(physical.decode_packet(json.loads(Path(sys.argv[2]).read_text())));result=audit(packet,sys.argv[1])
    with Path(sys.argv[3]).open('x') as f:json.dump(result,f,separators=(',',':'));f.write('\n')
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'])))
    if result['firstFailure']:sys.exit(1)
