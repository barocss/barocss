import json,hashlib,struct,collections
from pathlib import Path
p=Path('/tmp/physics-1179-world-continuation-a341f222/source-proof');result=json.loads((p/'result.json').read_bytes())
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(l):
 name=l.get('stream','main.bodies.raw');off=l['offset'];size=l['bytes']
 if name.startswith('reference.') and name.endswith('.raw') and name!='reference.stderr.raw':
  parts=json.loads((p/(name+'.composite.json')).read_bytes())['segments'];base=0
  for s in parts:
   if base<=off and off+size<=base+s['bytes']:name=s['path'];off=off-base+s['offset'];break
   base+=s['bytes']
 with (p/name).open('rb') as f:f.seek(off);b=f.read(size)
 assert len(b)==size;return b

def zero(q):
 for root,paths in q['negativeZeroPaths'].items():
  for path in paths:
   nodes=[x.replace('~1','/').replace('~0','~') for x in path[1:].split('/')];o=q[root]
   for k in nodes[:-1]:o=o[int(k)] if isinstance(o,list) else o[k]
   k=int(nodes[-1]) if isinstance(o,list) else nodes[-1];assert o[k]==0;o[k]=-0.0

def raw(bs):return b''.join(struct.pack('<d',x) for b in bs for k in ('positionM','velocityMps','orientation','angularVelocityRadps') for x in b[k])
fixed=json.loads((p/'completed-initial.stdin.raw').read_bytes())['config'];stats={'steps':0,'raw_frames':1,'bit_chain_links':0,'parent_certificates':0,'pose_law_evaluations':0,'contact_checks':0,'nonzero_v_states':0,'nonzero_omega_states':0,'max_abs_v':0,'max_abs_omega':0,'max_abs_position_change':0,'first_upper_limit_step':None,'min_angle':None,'max_angle':None,'max_motor_work_j':0};mot=[{'blocked':0,'nonzero_j':0,'j_min':None,'j_max':None,'nonzero_motor_work':0} for _ in range(2)];phases=collections.Counter();rows=collections.Counter();projected=set();sample={};parent_max={};previous=None;hashes={}
for name,l in result['streams'].items():
 b=(p/name).read_bytes();assert len(b)==l['bytes'] and sha(b)==l['sha256'];hashes[name]=l['sha256']
records=(p/'main.records.jsonl').open();initial=json.loads(next(records));assert initial['type']=='initial' and initial['stepIndex']==0
with (p/'main.native.jsonl').open() as native:
 for n,(nl,rl) in enumerate(zip(native,records),1):
  obj=json.loads(nl);r=json.loads(rl);q=obj['request'];assert read(r['nativeLocator'])==nl.encode() and sha(nl.encode())==r['nativeLocator']['sha256'];wire=read(r['request']);assert sha(wire)==r['request']['sha256'] and json.loads(wire)==q;reply=json.loads(read(r['reply']))
  assert r['passed'] and r['quality']['failures']==[] and r['error'] is None and r['outcome']=='returned' and r['referenceDisposition']=='RETURN'
  assert reply['ok'] and reply['resolved'] and not reply['executionFailure'] and reply['referenceStatus']=='RETURN' and reply['violations']==[]
  assert q['config']==fixed and q['commands']==[] and q['commandsRawHex']=='' and q['dt']==fixed['fixedStepSeconds']
  assert q['sourceState']['stepIndex']==n-1 and q['output']['state']['stepIndex']==n and q['output']['state']['timeSeconds']==n*fixed['fixedStepSeconds']
  a=q['attempt'];assert a['stage']=='report-ready' and a['calls']=={'angularUpdates':4,'freeIntegrations':4,'motorCalls':2,'projectionCalls':2,'reportCalls':2};assert a['contactPasses']==8 and len(a['contactChecks'])==32 and all(x['hit'] is None for x in a['contactChecks']);stats['contact_checks']+=32
  state=q['output']['state'];assert state['contacts']==state['events']==state['ccdHits']==[] and state['pairStats']=={'eligiblePairs':32,'candidatePairs':32,'aabbTests':0}
  zero(q);src=bytes.fromhex(q['rawFrames']['source']);assert raw(q['sourceState']['bodies'])==src
  if previous is None:assert read(initial['raw'])==src
  else:assert previous==src;stats['bit_chain_links']+=1
  for loc in r['raw']:
   b=read(loc);assert len(b)==416 and sha(b)==loc['sha256'] and b==bytes.fromhex(q['rawFrames'][loc['phase']]) and raw(a['frames'][loc['phase']+'Bodies'])==b;stats['raw_frames']+=1;phases[loc['phase']]+=1
  previous=bytes.fromhex(q['rawFrames']['projected']);assert raw(state['bodies'])==previous;projected.add(sha(previous));assert q['rawFrames']['free']==q['rawFrames']['postContact']
  for store,bs in [('acceptedStoreBefore',q['sourceState']['bodies']),('acceptedStoreAfter',state['bodies'])]:
   assert obj[store]['stepIndex']==(n-1 if store.endswith('Before') else n)
   assert all(all(x==y for x,y in zip(b[k],t[k])) for b,t in zip(obj[store]['bodies'],bs) for k in ('positionM','velocityMps','orientation','angularVelocityRadps'))
  for i,pair in enumerate(q['output']['diagnostics']['pairs']):
   m=pair['motor'];assert m['targetSpeedRadps']==.5 and m['maxImpulseNms']==.0001 and m['limitRad']==[-.8,.8] and abs(m['impulseNms'])<=.0001;assert pair['reportCap']['maxReactionNms']==.01 and not pair['reportCap']['exceedsCap'] and pair['reportCap']['angularReactionNormNms']<=.01
   angle=pair['jointReport']['angleRad'];assert angle==pair['projection']['poseReport']['targetAngleRad']==state['joints'][i]['angleRad'];stats['pose_law_evaluations']+=pair['projection']['diagnostics']['poseLawEvaluations']
   par=reply['reference']['pairReplies'][i];assert par['ok'] and par['resolved'] and not par['executionFailure'] and par['violations']==[];assert par['metrics']['actualFrameCertificatePassed'] and par['metrics']['actualNativeCertificatePassed'] and par['metrics']['inertiaBitsAgree'] and par['metrics']['branchAgreement'];cert=par['certificate']['expected'];assert cert['primalZero'] and cert['stationarityZero'] and cert['stopKktPassed'];stats['parent_certificates']+=1;rows[cert['rowCount']]+=1
   for k,v in par['metrics'].items():
    if type(v) in (int,float):parent_max[k]=max(parent_max.get(k,0),abs(v))
   s=mot[i];j=m['impulseNms'];s['blocked']+=int(m['blocked']);s['nonzero_j']+=int(j!=0);s['nonzero_motor_work']+=int(pair['work']['motorMidpointJ']!=0);s['j_min']=j if s['j_min'] is None else min(s['j_min'],j);s['j_max']=j if s['j_max'] is None else max(s['j_max'],j);stats['max_motor_work_j']=max(stats['max_motor_work_j'],abs(pair['work']['motorMidpointJ']));stats['min_angle']=angle if stats['min_angle'] is None else min(stats['min_angle'],angle);stats['max_angle']=angle if stats['max_angle'] is None else max(stats['max_angle'],angle)
   if angle==.8 and stats['first_upper_limit_step'] is None:stats['first_upper_limit_step']=n
  stats['steps']+=1;stats['nonzero_v_states']+=int(any(x!=0 for b in state['bodies'] for x in b['velocityMps']));stats['nonzero_omega_states']+=int(any(x!=0 for b in state['bodies'] for x in b['angularVelocityRadps']));stats['max_abs_v']=max(stats['max_abs_v'],*(abs(x) for b in state['bodies'] for x in b['velocityMps']));stats['max_abs_omega']=max(stats['max_abs_omega'],*(abs(x) for b in state['bodies'] for x in b['angularVelocityRadps']));stats['max_abs_position_change']=max(stats['max_abs_position_change'],*(abs(x-y) for a,b in zip(state['bodies'],fixed['bodies']) for x,y in zip(a['positionM'],b['positionM'])))
  if n in [1,100,197,198,200,1200]:sample[n]={'time':state['timeSeconds'],'angles':[j['angleRad'] for j in state['joints']],'position0':state['bodies'][0]['positionM'],'orientation0':state['bodies'][0]['orientation'],'velocity0':state['bodies'][0]['velocityMps'],'omega0':state['bodies'][0]['angularVelocityRadps'],'motors':[p['motor'] for p in q['output']['diagnostics']['pairs']]}
 assert native.readline()=='' and records.readline()==''
assert stats['steps']==1200 and stats['raw_frames']==7201
stats.update(unique_projected_hashes=len(projected),phase_counts=dict(phases),rowcounts=dict(rows));summary={'stats':stats,'motors':mot,'samples':sample,'parent_metric_maxima':parent_max,'verified_stream_hashes':hashes}
text='# #1179 SOURCE numerical evidence audit\n\nRead-only saved-data/source audit. No physics, reference, optimization, World or parent case was executed. SOURCE only; repeat/compiled still running at audit request.\n\n## Verified result\n\nSOURCE HINGE2_WORLD_GO:1200 accepted/qualified steps,10s; commands always empty; exact original fixed config matches completed-I0 request. The four zero extrema are measured every qualified step and are not a static/unreached pass. Motion, nonzero motor work, active/inactive constraints and raw changes are recorded below.\n\nAll1200 native records/request/reply locators,7201 raw416B frames, source-to-prior-projected1199 bit links, output/attempt bits, native store numeric correspondence and all declared stream hashes verified. Logical IPC offsets resolve through the explicit completed-I0 + current-process composite table; they are not offsets into the current-process raw file alone.\n\nThe acceptedStore JSON loses zero signs; raw body signs and request negativeZeroPaths were used for exact body-bit checks. This does not claim unsupported bit-complete hidden-store metadata beyond existing proof.\n\n## Source assertion coverage\n\nconsumer.mjs records native result before reference comparison; requires callback1, qualifies every1200 reply and calls worldQuality each successful step. reference-reply.mjs gates selected SI errors/full parent replies. world-quality.mjs actively computes COM/plane/anchor/axis, global P/L including orbital terms, and reads raw+normalized parent AFTER budgets against initialzero; rejects contacts/events/CCD and wrong32/32/0 stats. Original motor metadata .5/.0001/.01 and ±.8 limits were checked on every actual pair. No all-graph/Viewer/public/release claim. Initial admission-context failure and repaired initial proof remain historical.\n\n## Saved-data extraction\n\n```json\n'+json.dumps(summary,indent=2)+'\n```\n'
Path('/tmp/physics-1179-world-final-numeric-audit.md').write_text(text)
print(json.dumps({'stats':stats,'motors':mot,'samples':sample,'parent_metric_maxima':parent_max},separators=(',',':')))
