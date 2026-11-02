"""Independent physical event/geometry observer. Reads saved raw words only."""
from fractions import Fraction as F
from pathlib import Path
import json,math,struct,sys
from decimal import Decimal,localcontext
from trace_decode import decode_packet

def decode(x):
    if isinstance(x,dict) and set(x)=={'$f64le'}:return struct.unpack('<d',bytes.fromhex(x['$f64le']))[0]
    if isinstance(x,dict):return {k:decode(v) for k,v in x.items()}
    if isinstance(x,list):return [decode(v) for v in x]
    return x

def fv(x):return [F.from_float(float(v)) for v in x]
def add(a,b):return [x+y for x,y in zip(a,b)]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def scale(a,k):return [x*k for x in a]
def dot(a,b):return sum((x*y for x,y in zip(a,b)),F(0))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def hamilton(a,b):return add(add(scale(b[:3],a[3]),scale(a[:3],b[3])),cross(a[:3],b[:3]))+[a[3]*b[3]-dot(a[:3],b[:3])]
def native(box):
    q=fv(box['orientationXYZW']);conj=[-q[0],-q[1],-q[2],q[3]];n2=dot(q,q)
    if n2<=0:raise ValueError('zero native quaternion')
    axes=[]
    for i in range(3):axes.append(scale(hamilton(hamilton(q,[F(i==j) for j in range(3)]+[F(0)]),conj)[:3],1/n2))
    return dict(centre=fv(box['positionM']),half=fv(box['halfExtentsM']),axes=axes)
def local(b,p):return [dot(axis,sub(p,b['centre'])) for axis in b['axes']]
def interval(b,p,n):
    lo=hi=None
    for x,v,h in zip(local(b,p),[dot(a,n) for a in b['axes']],b['half']):
        if v==0:
            if abs(x)>h:return None
        else:
            a,z=sorted([(-h-x)/v,(h-x)/v]);lo=a if lo is None else max(lo,a);hi=z if hi is None else min(hi,z)
    return None if lo is None or hi is None or lo>hi else (lo,hi)
def separated(a,b):
    delta=sub(b['centre'],a['centre'])
    for n in a['axes']+b['axes']+[cross(x,y) for x in a['axes'] for y in b['axes']]:
        if dot(n,n)==0:continue
        reach=sum((sum((h*abs(dot(axis,n)) for h,axis in zip(body['half'],body['axes'])),F(0)) for body in [a,b]),F(0))
        if abs(dot(delta,n))>reach:return True
    return False
def active_halfspaces(body,p):
    return [(i,side) for i,(x,h) in enumerate(zip(local(body,p),body['half'])) for side in [-1,1] if x==side*h]
def energy(b):return dot(fv(b['velocityMps']),fv(b['velocityMps']))/2+dot(fv(b['angularVelocityRadps']),fv(b['angularVelocityRadps']))/12 if b['kind']=='dynamic' else F(0)
def position(b):return fv(b['positionM'])
def velocity(b):return fv(b['velocityMps'])
def omega(b):return fv(b['angularVelocityRadps'])
def need(x,message):
    if not x:raise ValueError(message)

def audit(packet):
    maxima={};cursor={};rows=[];failure=None;counts=dict(events=0,geometryQueries=0,points=0,corrections=0,zeroApplications=0,warmApplications=0,actualWarmChangedFrame=0,validatedNonzeroWarmFrictionChangedFrame=0)
    def gate(name,value,limit=F(1,10**10)):
        value=abs(value);maxima[name]=max(maxima.get(name,F(0)),value);need(value<=limit,f'{name}: {float(value)} > {float(limit)}')
    def vector(name,actual,expected,limit=F(1,10**10)):
        for i,(a,b) in enumerate(zip(actual,expected)):gate(name+str(i),a-b,limit)
    try:
        model=packet['model'];need(packet['options']==dict(profile='rigid-persistent-box-v1',fixedStepSeconds=1/120,broadPhase='direct'),'Frozen World options');need(model['gravityMps2']==[0,-9.81,0],'Frozen gravity');bodies={b['id']:b for b in model['bodies']};colliders={c['bodyId']:c for c in model['colliders']};need(bodies['z-cube']['massKg']==1 and bodies['z-cube']['initial']==dict(positionM=[0,.5,0],orientationXYZW=[0,0,0,1],velocityMps=[.5,0,0],angularVelocityRadps=[0,0,.01]),'Frozen physical unit cube input');need(colliders['z-cube']['geometry']==dict(kind='box',halfExtentsM=[.5,.5,.5]),'Physical cube inertia authority');need(colliders['a-floor']['geometry']==dict(kind='box',halfExtentsM=[.2,.1,2]) and bodies['a-floor']['initial']['positionM']==[0,-.1,0],'Frozen floor geometry');need(all(c['material']==dict(restitution=0,friction=dict(static=1,dynamic=.7)) and c['ccd'] is False for c in colliders.values()),'Frozen passive materials/no CCD');
        target=next(w for w in packet['trace']['worlds'] if w['id']==packet['worldId']);attempt=target['creation'] if packet.get('mode')=='creation' else next(a for a in target['history'] if a['attempt']==packet['attemptId']);records=attempt['records']
        before=packet['before'];after=packet['after'];g=fv(packet['model']['gravityMps2']);dt=F(0) if packet.get('mode')=='creation' else F(packet['options']['fixedStepSeconds']);netJA=[F(0)]*3;netMA=[F(0)]*3;nonzeroApplications=0;netJ=[F(0)]*3;netSpin=[F(0)]*3;netMoment=[F(0)]*3;contactWork=F(0);projectionU=F(0);projectionOrbital=[F(0)]*3;queries={}
        for index,e in enumerate(records):
            cursor=dict(record=index,kind=e['kind'],outerPass=e['outerPass'])
            if e['kind']=='geometry-query':
                counts['geometryQueries']+=1;queries[e['queryId']]=e
                for suffix,prefix in [('a','A'),('b','B')]:
                    pairBody=e['pair'][suffix];actualBody=e['body'+prefix];need(pairBody['id']==actualBody['id'] and pairBody['positionM']==actualBody['positionM'] and pairBody['orientationXYZW']==actualBody['orientationXYZW'] and pairBody['halfExtentsM']==actualBody['shape']['halfExtentsM'],'Actual query input/pose ownership')
                    if e['final']:
                        acceptedBody=next(b for b in after['bodies'] if b['id']==actualBody['id']);need(actualBody['positionM']==acceptedBody['positionM'] and actualBody['orientationXYZW']==acceptedBody['orientationXYZW'],'Final query pose is actual accepted pose')
                need(e['result']['status'] in ['HIT','MISS'],'Unresolved geometry is not PASS')
                if e['result']['status']=='MISS':
                    need(separated(native(e['pair']['a']),native(e['pair']['b'])),'MISS needs an exact native separation witness');continue
                a,b=native(e['pair']['a']),native(e['pair']['b']);n=fv(e['result']['normal']);en=[F(x) for x in e['result']['exactNormalDirection']];gate('normalNormSquared',dot(n,n)-1,F(1,10**12));depths=[]
                for p in e['result']['points']:
                    counts['points']+=1;cursor['pointId']=p['id'];pa,pb,mid=([F(x) for x in p['exact'][k]] for k in ['a','b','midpoint']);need(mid==scale(add(pa,pb),F(1,2)),'Exact native midpoint');need(cross(sub(pb,pa),en)==[0,0,0],'Exact native endpoint line')
                    for body,end in [(a,pa),(b,pb)]:
                        offsets=[abs(x)-h for x,h in zip(local(body,end),body['half'])];need(max(offsets)<=0 and min(abs(x) for x in offsets)==0,'Exact native surface/halfspaces')
                    anchor=fv(p['pointM']);ap,bp=fv(p['aPointM']),fv(p['bPointM']);ia,ib=interval(a,anchor,n),interval(b,anchor,n);need(ia is not None and ib is not None,'Represented force line misses native box')
                    for actual,exact in [(ap,pa),(bp,pb)]:
                        gate('endpointPresentationSquared',dot(sub(actual,exact),sub(actual,exact)),F(1,10**24))
                    for body,end in [(a,ap),(b,bp)]:
                        offsets=[abs(x)-h for x,h in zip(local(body,end),body['half'])];gate('surfaceOutside',max(F(0),max(offsets)),F(1,10**9));gate('surfaceBoundary',min(abs(x) for x in offsets),F(1,10**9))
                    for end in [ap,bp]:
                        delta=sub(end,anchor);perp=sub(delta,scale(n,dot(delta,n)/dot(n,n)));gate('pairedLineSquared',dot(perp,perp),F(1,10**24))
                    deltaA=sub(add(anchor,scale(n,ia[1])),ap);deltaB=sub(add(anchor,scale(n,ib[0])),bp);gate('nativeLineExitASquared',dot(deltaA,deltaA),F(1,10**24));gate('nativeLineExitBSquared',dot(deltaB,deltaB),F(1,10**24))
                    depths.append(-dot(sub(pb,pa),n))
                    if e['final']:gate('acceptedPairedGapSquared',(ib[0]-ia[1])**2*dot(n,n),F(1,10**24))
                gate('geometryProjectedDepth',F(e['projectedDepthM'])-max([F(0)]+depths),F(1,10**12))
                need(e['depthMapping']=='SAMPLED_PATCH_DEPTH','Explicit sampled-patch producer depth')
                support=sum((sum((h*abs(dot(axis,n)) for h,axis in zip(body['half'],body['axes'])),F(0)) for body in [a,b]),F(0));centreDistance=abs(dot(sub(b['centre'],a['centre']),n));directionalOverlap=support-centreDistance;n2=dot(n,n);nativeDepths=[]
                for precision in [80,120]:
                    with localcontext() as ctx:
                        ctx.prec=precision
                        dec=lambda x:Decimal(x.numerator)/Decimal(x.denominator)
                        nativeDepths.append(max(Decimal(0),dec(directionalOverlap)/dec(n2).sqrt()))
                need(abs(nativeDepths[0]-nativeDepths[1])<=Decimal('1e-60'),'Independent80/120 depth agreement')
                rows.append(dict(queryId=e['queryId'],depthMapping='SAMPLED_PATCH_DEPTH',sampledDepthM=e['projectedDepthM'],nativeDirectionalDepth80=str(nativeDepths[0]),nativeDirectionalDepth120=str(nativeDepths[1]),nativeSupportExact=str(support),nativeCentreDistanceExact=str(centreDistance),reportedNormalSquaredExact=str(n2),scope='fixed reported normal only; no global minimum translation claim'))
                gate('GEOMETRY_DEPTH_NO_GO',F(e['projectedDepthM'])-F(nativeDepths[1]),F(1,10**12))
            elif e['kind']=='cache-init':
                if packet.get('privateBefore') is not None:
                    prior=dict(packet['privateBefore']['world']['persistentPoints']).get(e['key']);need(e['prior']==prior,'Actual prior cache correspondence');frame=packet['privateBefore']['accepted']['cacheFrames'].get(e['key']);need(e['producingFrame']==frame,'Actual producing-frame sidecar correspondence')
            elif e['kind']=='impulse-application':
                counts['events']+=1;j=fv(e['impulseOnBNs']);ja=fv(e['impulseOnANs']);p=fv(e['pointM']);vector('applicationLinearReciprocity',add(ja,j),[F(0)]*3);vector('applicationMomentReciprocity',add(cross(fv(e['anchorOnAM']),ja),cross(fv(e['anchorOnBM']),j)),[F(0)]*3);need(e['anchorOnAM']==e['pointM'] and e['anchorOnBM']==e['pointM'],'Actual common-anchor path');netJA=add(netJA,ja);netMA=add(netMA,cross(fv(e['anchorOnAM']),ja));nonzeroApplications+=int(ja!=[0,0,0] or j!=[0,0,0]);n=fv(e['normal']);need(e['queryId'] in queries,'Application owns a real geometry query');point=next(p0 for p0 in queries[e['queryId']]['result']['points'] if p0['id']==e['pointId']);need(fv(point['pointM'])==p,'Actual common anchor equals query point');need(e['native']==point['exact'] and e['feature']==queries[e['queryId']]['result']['feature'] and e['normal']==queries[e['queryId']]['result']['normal'],'Actual native feature/frame provenance');need(e['bodyABefore']['id']=='a-floor' and e['bodyBBefore']['id']=='z-cube','Actual lexical pair order');
                for prefix in ['A','B']:
                    queryBody=queries[e['queryId']]['body'+prefix];eventBody=e['body'+prefix+'Before'];need(queryBody['id']==eventBody['id'] and queryBody['positionM']==eventBody['positionM'] and queryBody['orientationXYZW']==eventBody['orientationXYZW'],'Force query pose is actual historical event pose')
                if j==[0,0,0]:counts['zeroApplications']+=1
                if e['eventKind']=='warm':
                    counts['warmApplications']+=1;frame=e['producingFrame'];vector('warmAppliedVector',j,add(scale(n,F(e['cacheBefore']['normalNs'])),fv(e['cacheBefore']['tangentNs'])))
                    if frame and fv(frame['normal'])!=n:
                        counts['actualWarmChangedFrame']+=1
                        correspondence=False
                        if frame.get('pair') and frame['feature']==e['feature'] and frame['pointId']==e['pointId']:
                            correspondence=all(frame['pair'][side]['id']==queries[e['queryId']]['pair'][side]['id'] and active_halfspaces(native(frame['pair'][side]),[F(x) for x in frame['native'][side]])==active_halfspaces(native(queries[e['queryId']]['pair'][side]),[F(x) for x in e['native'][side]]) for side in ['a','b'])
                        if packet.get('privateBefore') is not None and e['cacheOrigin']=='prior-step' and fv(e['cacheBefore']['tangentNs'])!=[0,0,0] and correspondence:counts['validatedNonzeroWarmFrictionChangedFrame']+=1
                gate('currentTangentPlane',dot(fv(e['cacheAfter']['tangentNs']),n),F(1,10**12))
                if e['eventKind']=='tangent':gate('APPLIED_TANGENT_CURRENT_PLANE',dot(j,n),F(1,10**12))
                if e['eventKind']=='warm':gate('warmPriorTangentCurrentPlane',dot(fv(e['cacheBefore']['tangentNs']),n),F(1,10**12))
                measuredK=F(0);work=F(0);relativeMid=[]
                for prefix,sign in [('A',-1),('B',1)]:
                    pre,post=e['body'+prefix+'Before'],e['body'+prefix+'After'];need(position(pre)==position(post) and pre['orientationXYZW']==post['orientationXYZW'],'Impulse must preserve pose');jb=ja if prefix=='A' else j;arm=sub(fv(e['anchorOnAM'] if prefix=='A' else e['anchorOnBM']),position(pre));torque=cross(arm,jb)
                    vmid=scale(add(velocity(pre),velocity(post)),F(1,2));wmid=scale(add(omega(pre),omega(post)),F(1,2));relativeMid.append(add(vmid,cross(wmid,arm)))
                    if pre['kind']=='dynamic':
                        vector('eventMomentum',sub(velocity(post),velocity(pre)),jb);vector('eventSpin',scale(sub(omega(post),omega(pre)),F(1,6)),torque);measuredK+=energy(post)-energy(pre);work+=dot(jb,vmid)+dot(torque,wmid)
                        netSpin=add(netSpin,torque)
                    else:need(velocity(post)==velocity(pre) and omega(post)==omega(pre),'Static reaction changes no static velocity')
                relativeWork=dot(j,sub(relativeMid[1],relativeMid[0]));gate('eventMidpointWork',measuredK-work);gate('eventRelativeWork',relativeWork-work);contactWork+=work;netJ=add(netJ,j);netMoment=add(netMoment,cross(p,j))
            elif e['kind']=='pose-correction':
                counts['corrections']+=1;need(e['queryId'] in queries,'Correction owns an actual query');q=queries[e['queryId']];vector('correctionQueryNormal',fv(e['normal']),fv(q['result']['normal']),F(1,10**12));gate('correctionQueryDepth',F(e['penetration'])-F(q['projectedDepthM']),F(1,10**12));invA=F(0) if e['bodyABefore']['kind']=='static' else F(1);invB=F(0) if e['bodyBBefore']['kind']=='static' else F(1);need(invA+invB>0,'Physical correction inverse mass sum')
                for prefix,sign,inv in [('A',-1,invA),('B',1,invB)]:
                    pre,post=e['body'+prefix+'Before'],e['body'+prefix+'After'];queryBody=q['body'+prefix];need(pre['id']==queryBody['id'] and pre['positionM']==queryBody['positionM'] and pre['orientationXYZW']==queryBody['orientationXYZW'],'Correction prepose/query ownership');vector('CORRECTION_LAW',sub(position(post),position(pre)),scale(fv(e['normal']),sign*F(e['penetration'])*inv/(invA+invB)));need(velocity(pre)==velocity(post) and omega(pre)==omega(post) and pre['orientationXYZW']==post['orientationXYZW'],'Projection changes only position')
                    if pre['kind']=='dynamic':dx=sub(position(post),position(pre));projectionU-=dot(g,dx);projectionOrbital=add(projectionOrbital,cross(dx,velocity(pre)));gate('projectionKinetic',energy(post)-energy(pre))
            elif e['kind']=='gravity-kick':
                pre,post=e['before'],e['after'];vector('gravityKick',sub(velocity(post),velocity(pre)),scale(g,dt));need(position(pre)==position(post),'Gravity kick preserves position')
            elif e['kind']=='drift':
                pre,post=e['before'],e['after'];vector('drift',sub(position(post),position(pre)),scale(velocity(pre),dt));need(velocity(pre)==velocity(post),'Drift preserves velocity')
        cube0=next(b for b in before['bodies'] if b['id']=='z-cube');cube1=next(b for b in after['bodies'] if b['id']=='z-cube');vector('stepMomentum',sub(velocity(cube1),velocity(cube0)),add(netJ,scale(g,dt)));vector('stepSpin',scale(sub(omega(cube1),omega(cube0)),F(1,6)),netSpin)
        totalL0=add(cross(position(cube0),velocity(cube0)),scale(omega(cube0),F(1,6)));totalL1=add(cross(position(cube1),velocity(cube1)),scale(omega(cube1),F(1,6)));vector('stepWorldOriginAngularLedger',sub(totalL1,totalL0),add(add(netMoment,cross(position(cube0),scale(g,dt))),projectionOrbital))
        need(contactWork<=F(1,10**10),f'PASSIVE_NET_CONTACT_WORK: {float(contactWork)}');initialE=energy(cube0)-dot(g,position(cube0));finalE=energy(cube1)-dot(g,position(cube1));defect=-dot(g,g)*dt*dt/2;gate('wholeStepEnergyLedger',finalE-initialE-contactWork-defect-projectionU)
        rows.append(dict(netContactWorkJ=float(contactWork),projectionPotentialJ=float(projectionU),gravityDriftDefectJ=float(defect),projectionOrbitalTransport=[float(v) for v in projectionOrbital],eventVector=[float(v) for v in netJ],eventWorldOriginMoment=[float(v) for v in netMoment]))
        cursor=dict(kind='STATE2-accepted-geometry-and-wrenches')
        need(after.get('schemaVersion')==2 and isinstance(after.get('pairWrenches'),list),'Mandatory STATE2/pairWrenches')
        expectedContactFields={'colliderAId','colliderBId','bodyAId','bodyBId','points'};expectedPointFields={'id','normalAtoB','anchorM','pointOnAM','pointOnBM','signedGapM'}
        finalQueries=[e for e in records if e['kind']=='geometry-query' and e['final']];need(finalQueries,'Accepted geometry requires final native queries');expectedPopulation=[]
        words=lambda values:[struct.pack('>d',float(v)).hex() for v in values]
        for query in finalQueries:
            if query['result']['status']=='HIT':expectedPopulation.append((query['pair']['a']['id'],query['pair']['b']['id'],[(p['id'],words(p['pointM']),words(query['result']['normal'])) for p in sorted(query['result']['points'],key=lambda p:p['id'])]))
        actualPopulation=[(c['bodyAId'],c['bodyBId'],[(p['id'],words(p['anchorM']),words(p['normalAtoB'])) for p in c['points']]) for c in after['contacts']];need(actualPopulation==expectedPopulation,'COMPLETE_ACCEPTED_GEOMETRY_POPULATION_NO_GO IDs/anchors/normals or final MISS mismatch')
        previous=''
        for contactIndex,c in enumerate(after['contacts']):
            need(set(c)==expectedContactFields,'No old contact/report keys');key=c['bodyAId']+'\0'+c['bodyBId'];need(key>previous and c['bodyAId']=='a-floor' and c['bodyBId']=='z-cube','Contact pair uniqueness/order');previous=key;need(c['colliderAId']==colliders[c['bodyAId']]['id'] and c['colliderBId']==colliders[c['bodyBId']]['id'],'Contact collider ownership');need(c['points'],'Nonempty accepted native point list')
            nativeBodies=[]
            for bodyId in [c['bodyAId'],c['bodyBId']]:
                stateBody=next(b for b in after['bodies'] if b['id']==bodyId);nativeBodies.append(native(dict(id=bodyId,positionM=stateBody['positionM'],orientationXYZW=stateBody['orientationXYZW'],halfExtentsM=colliders[bodyId]['geometry']['halfExtentsM'])))
            a,b=nativeBodies;previousPoint=''
            for point in c['points']:
                cursor.update(contactIndex=contactIndex,pointId=point['id']);need(set(point)==expectedPointFields and point['id']>previousPoint,'Canonical unique geometry point fields/order');previousPoint=point['id'];p=fv(point['anchorM']);n=fv(point['normalAtoB']);n2=dot(n,n);gate('acceptedNormalNorm',n2-1,F(1,10**12));ia,ib=interval(a,p,n),interval(b,p,n);need(ia is not None and ib is not None,'Accepted normal line hits both native bodies');pa=add(p,scale(n,ia[1]));pb=add(p,scale(n,ib[0]));mid=scale(add(pa,pb),F(1,2));delta=sub(p,mid);gate('acceptedAnchorMidpointSquared',dot(delta,delta),F(1,10**24));gate('acceptedAbsoluteGapSquared',(ib[0]-ia[1])**2*n2,F(1,10**24))
                for body,end,exact in [(a,fv(point['pointOnAM']),pa),(b,fv(point['pointOnBM']),pb)]:
                    need(words(end)==words([float(v) for v in exact]),'Accepted endpoint words must round actual represented-line exits');error=sub(end,exact);gate('acceptedEndpointSquared',dot(error,error),F(1,10**24));offsets=[abs(x)-h for x,h in zip(local(body,end),body['half'])];gate('acceptedSurfaceOutside',max(F(0),max(offsets)),F(1,10**9));gate('acceptedSurfaceBoundary',min(abs(x) for x in offsets),F(1,10**9))
                gaps=[]
                for precision in [80,120]:
                    with localcontext() as ctx:
                        ctx.prec=precision;dec=lambda x:Decimal(x.numerator)/Decimal(x.denominator);gaps.append(dec(ib[0]-ia[1])*dec(n2).sqrt())
                need(abs(gaps[0]-gaps[1])<=Decimal('1e-60'),'80/120 signed native gap agreement');gate('signedNativeGap',F(point['signedGapM'])-F(gaps[1]),F(1,10**12));deltaT=ib[0]-ia[1];exactGapSquared=deltaT*deltaT*n2
                if exactGapSquared==0:need(point['signedGapM']==0,'Exact native zero gap requires true zero')
                elif exactGapSquared<F(1,1<<2044):raise ValueError('SIGNED_GAP_SUBNORMAL_MAGNITUDE_NOT_QUALIFIED')
                else:
                    gate('SIGNED_GAP_RELATIVE_SQUARED',F(point['signedGapM'])**2/exactGapSquared-1,F(1,10**12))
                    need(point['signedGapM']<0 if deltaT<0 else point['signedGapM']>0,'Representable native signed gap must preserve strict sign')
        cursor=dict(kind='producer-vs-independent-event-wrenches')
        expectedPairs=1 if nonzeroApplications else 0;need(len(after['pairWrenches'])==expectedPairs,'Retain every nonzero application pair; zero-only intervals empty')
        for wrench in after['pairWrenches']:
            need(set(wrench)=={'colliderAId','colliderBId','bodyAId','bodyBId','onA','onB'},'Canonical pair wrench fields');need(wrench['bodyAId']=='a-floor' and wrench['bodyBId']=='z-cube' and wrench['colliderAId']==colliders['a-floor']['id'] and wrench['colliderBId']==colliders['z-cube']['id'],'Wrench lexical/collider ownership')
            for side,linear,moment in [('onA',netJA,netMA),('onB',netJ,netMoment)]:
                need(set(wrench[side])=={'linearImpulseNs','angularImpulseAboutWorldOriginNms'},'Canonical body wrench fields');vector('PRODUCER_'+side+'_J',fv(wrench[side]['linearImpulseNs']),linear);vector('PRODUCER_'+side+'_M0',fv(wrench[side]['angularImpulseAboutWorldOriginNms']),moment)
            vector('producerLinearReciprocity',add(fv(wrench['onA']['linearImpulseNs']),fv(wrench['onB']['linearImpulseNs'])),[F(0)]*3);vector('producerMomentReciprocity',add(fv(wrench['onA']['angularImpulseAboutWorldOriginNms']),fv(wrench['onB']['angularImpulseAboutWorldOriginNms'])),[F(0)]*3)
        if packet.get('mode')=='creation':
            need(after['stepIndex']==0 and not after['events'] and not after['pairWrenches'],'Initial geometry carries zero events/wrenches');need(not packet['privateAfter']['world']['persistentPoints'] and not packet['privateAfter']['accepted']['cacheFrames'],'Initial accepted geometry does not seed solver cache')
        else:
            def membership(state):return {(c['colliderAId'],c['colliderBId']) for c in state['contacts']}
            old,new=membership(before),membership(after);expectedEvents=[dict(colliderAId=a,colliderBId=b,kind='contact',phase='stay' if (a,b) in old and (a,b) in new else 'begin' if (a,b) in new else 'end') for a,b in sorted(old|new)];need(after['events']==expectedEvents,'Accepted geometry membership/events independent of interval wrench')
        status='PASS_PRIVATE_PRODUCER_ONE_INTERVAL'
    except Exception as error:status='NO_GO_PRIVATE_PRODUCER_WRENCH';failure=dict(cursor=cursor,type=type(error).__name__,message=str(error))
    return dict(status=status,firstFailure=failure,counts=counts,maxima={k:float(v) for k,v in maxima.items()},rows=rows,warmChangedFrameCoverage='COVERED' if counts['validatedNonzeroWarmFrictionChangedFrame'] else 'NOT_COVERED',checkedPrefixOnly=bool(failure),unreachedGates='NOT_RUN_AFTER_FIRST_FAILURE' if failure else 'ALL_PLANNED_ONE_STEP_GATES_REACHED',WorldCalls=0,candidateCalls=0,executionStatus='EXECUTED_NO_GO' if failure else 'EXECUTED_PASS',nativePublicDesktop='NOT_RUN')

if __name__=='__main__':
    packet=decode(decode_packet(json.loads(Path(sys.argv[1]).read_text())));result=audit(packet);text=json.dumps(result,indent=2)+'\n';need(len(text.encode())<=65536,'observer terminal reserve');
    with Path(sys.argv[2]).open('x') as f:f.write(text)
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'],counts=result['counts'])))
    if result['firstFailure']:sys.exit(1)
