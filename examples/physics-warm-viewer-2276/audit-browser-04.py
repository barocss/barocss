"""Root-only independent audit of saved actual browser word packets; no World.
Uses immutable qualified physical audit unchanged; screenshots are never input.
"""
from pathlib import Path
import sys,json,hashlib,importlib.util,struct
ROOT=Path(__file__).resolve().parents[2];HOME=Path(__file__).resolve().parent
# Authenticate the complete frozen observer/provider/input graph before imports.
for frozenName,frozenPin in json.loads((Path(__file__).resolve().parent/'SOURCE-PINS-03.json').read_text())['files'].items():
    frozenBytes=(ROOT/frozenName).read_bytes()
    if len(frozenBytes)!=frozenPin['bytes'] or hashlib.sha256(frozenBytes).hexdigest()!=frozenPin['sha256']:raise ValueError('Frozen audit source drift '+frozenName)
sys.path.insert(0,str(ROOT/'examples/physics-contact-wrench-producer-2276'))
# Separate audit-only amendment; the server keeps its frozen03 selector.
for auditName,auditPin in json.loads((Path(__file__).resolve().parent/'AUDIT-PINS-04.json').read_text())['files'].items():
    auditBytes=(ROOT/auditName).read_bytes()
    if len(auditBytes)!=auditPin['bytes'] or hashlib.sha256(auditBytes).hexdigest()!=auditPin['sha256']:raise ValueError('Frozen04 audit drift '+auditName)
from transport_decode_04 import decode_packet
spec=importlib.util.spec_from_file_location('qualified_warm_observer',ROOT/'examples/physics-warm-transport-2276/observer.py');physics=importlib.util.module_from_spec(spec);spec.loader.exec_module(physics)
def need(x,m):
    if not x:raise ValueError(m)
def main(path,out):
    need(out.parent==path.parent,'Keep all proof/audit artifacts in the same bounded proof directory');out.mkdir()
    def save(target,value,terminal=False):
        text=json.dumps(value,indent=2)+'\n';existing=sum(p.stat().st_size for p in path.parent.rglob('*') if p.is_file());need(existing+len(text.encode())<=(16777216 if terminal else 16711680),'Combined browser proof/audit resource cap')
        with target.open('x') as f:f.write(text)
    qualification=json.loads((Path(__file__).resolve().parent/'evidence/transport-qualification-04/result.json').read_text())
    if qualification.get('status')!='PASS_DATA_ONLY_TRANSPORT04_QUALIFICATION':raise ValueError('Data qualification04 must PASS before audit/parity')
    checkedPath=path
    checkedBytes=checkedPath.read_bytes()
    if qualification.get('sameProof')!=dict(bytes=len(checkedBytes),sha256=hashlib.sha256(checkedBytes).hexdigest()):raise ValueError('Qualification must use SAME captured proof')
    freezeBytes=(Path(__file__).resolve().parent/'AUDIT-PINS-04.json').read_bytes()
    if qualification.get('auditFreeze')!=dict(bytes=len(freezeBytes),sha256=hashlib.sha256(freezeBytes).hexdigest()):raise ValueError('Qualification freeze identity must match')
    encoded=json.loads(path.read_text());raw=decode_packet(encoded);proof=physics.decode(raw);results=[];failure=None;controls={k:'NOT_RUN' for k in ['actual_public_wire_raw_roundtrip','A_initial','A1','A2','D_continuation2','D_raw_state_recording','hidden_and_D_actual_trace_parity']};parities=[]
    def audit(label,worldid,first,last,mode='step'):
        controls[label]='EXECUTED_NO_GO';w=next(w for w in proof['trace']['worlds'] if w['id']==worldid);a=w['creation'] if mode=='creation' else next(a for a in w['history'] if a['stepIndex']==proof['checkpoints'][last]['state']['stepIndex']);packet=dict(mode=mode,frozenInput=proof['frozenInput'],model=proof['model'],options=proof['options'],worldId=worldid,attemptId=a['attempt'],before=proof['checkpoints'][first]['state'],after=proof['checkpoints'][last]['state'],privateBefore=None if mode=='creation' else proof['checkpoints'][first]['private'],privateAfter=proof['checkpoints'][last]['private'],trace=proof['trace']);r=physics.audit(packet);results.append(dict(label=label,**r));save(out/(label+'-observer.json'),r);need(r['status']=='PASS_PRIVATE_PRODUCER_ONE_INTERVAL',str(r['firstFailure']));
        if label in ['A2','D_continuation2']:need(r['counts']['validatedNonzeroWarmFrictionChangedFrame']>0 and r['warmChangedFrameCoverage']=='COVERED','Independent real changed-frame nonzero-prior warm coverage required')
        controls[label]='EXECUTED_PASS'
    def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'))
    def normalized(n,value):
        world=next(w for w in proof['trace']['worlds'] if w['id']==n);qs={};pairs={};used=set()
        for attempt in [world['creation']]+world['history']:
            ordinal=0
            for e in attempt['records']:
                if e['kind']=='geometry-query':
                    name='step'+str(attempt['stepIndex'])+':query'+str(ordinal);ordinal+=1;qs[e['queryId']]=name;pairs[e['pair']['id']]=(e['queryId'],name)
        def collect(v,k=''):
            if k=='queryId':need(v in qs,'Actual owned query');used.add(v)
            if k=='id' and isinstance(v,str) and v in pairs:used.add(pairs[v][0])
            if isinstance(v,list):
                for x in v:collect(x)
            elif isinstance(v,dict):
                for key,x in v.items():collect(x,key)
        collect(value);need(len({qs[x] for x in used})==len(used),'Bijective query map')
        def visit(v,k=''):
            if k=='world' and isinstance(v,(int,float)):return 'WORLD'
            if k=='attempt' and isinstance(v,(int,float)):return 'ATTEMPT'
            if k=='queryId':return qs[v]
            if k=='id' and isinstance(v,str) and v in pairs:return 'PAIR:'+pairs[v][1]
            if isinstance(v,list):return [visit(x) for x in v]
            if isinstance(v,dict):return {key:visit(x,key) for key,x in v.items()}
            if isinstance(v,float):return {'$f64le':struct.pack('<d',v).hex()}
            return v
        return visit(value),list((x,qs[x]) for x in used)
    def parity(label,n,actual,reference):
        a,am=normalized(n,actual);b,bm=normalized(1,reference);need(canonical(a)==canonical(b),label+' exact actual words');parities.append(dict(label=label,status='EXECUTED_PASS',actualQueryMap=am,referenceQueryMap=bm,excludedPhysicalFields=[]))
    try:
        need(proof['format']=='physics-warm-viewer-browser-proof','Actual proof format');need(proof['error'] is None and proof['stage']==6,'Complete success UI protocol required');counts=proof['trace']['counts'];need(counts['worlds']==4 and counts['attempts']==6,'Actual4World6attempt');need(sum(w['accepted']['stepIndex'] for w in proof['trace']['worlds'])==6,'Actual6accepted')
        controls['actual_public_wire_raw_roundtrip']='EXECUTED_NO_GO';need(bytes(int(x) for x in proof['wireBytes'][:8])==b'BCPHREC2','Actual genuine wire magic');need(canonical(raw['decoded'])==canonical(raw['checkpoints']['A1']['recording']),'Actual decoded prefix raw words');controls['actual_public_wire_raw_roundtrip']='EXECUTED_PASS';audit('A_initial',1,'A0','A0','creation');audit('A1',1,'A0','A1');audit('A2',1,'A1','A2');audit('D_continuation2',4,'D1','D2');controls['D_raw_state_recording']='EXECUTED_NO_GO'
        for a,b in [('D1','A1'),('D2','A2')]:
            for key in ['state','recording']:need(canonical(raw['checkpoints'][a][key])==canonical(raw['checkpoints'][b][key]),a+' actual '+key+' raw equality')
        controls['D_raw_state_recording']='EXECUTED_PASS';controls['hidden_and_D_actual_trace_parity']='EXECUTED_NO_GO';wa=proof['trace']['worlds'][0]
        for n in [2,3,4]:
            w=proof['trace']['worlds'][n-1];parity(str(n)+' actual constructor',n,w['creation']['records'],wa['creation']['records']);parity(str(n)+' actual step1',n,w['history'][0]['records'],wa['history'][0]['records'])
        parity('D actual step2',4,proof['trace']['worlds'][3]['history'][1]['records'],wa['history'][1]['records']);parity('D1 live private',4,proof['checkpoints']['D1']['private'],proof['checkpoints']['A1']['private']);parity('D2 live private',4,proof['checkpoints']['D2']['private'],proof['checkpoints']['A2']['private']);controls['hidden_and_D_actual_trace_parity']='EXECUTED_PASS'
    except Exception as e:failure=dict(type=type(e).__name__,message=str(e))
    result=dict(status='EXECUTED_NO_GO_BROWSER_PHYSICS' if failure else 'EXECUTED_PASS_BROWSER_PHYSICS_FINITE_WINDOW',firstFailure=failure,independentAuditControls=controls,controlMeaning='Audit reachability only; actual browser Worlds/actions are separately preserved',actualBrowserActions=proof['controls'],observers=[dict(label=r['label'],status=r['status'],counts=r['counts'],maxima=r['maxima'],firstFailure=r['firstFailure']) for r in results],parities=parities,inputFile=str(path),inputSHA256=hashlib.sha256(path.read_bytes()).hexdigest(),counts=proof.get('trace',{}).get('counts'),WorldCalls=0,hiddenAcceptedPublicOutput='NOT_RETAINED_AFTER_DISPOSE',hiddenRawAcceptedOutputEquality='NOT_PROVEN',browserNodeBitParity='SEPARATE_NOT_ASSUMED',production='NOT_RUN',promotion='BLOCKED');save(out/'summary.json',result,True);print(json.dumps(dict(status=result['status'],firstFailure=failure)));return int(failure is not None)
if __name__=='__main__':sys.exit(main(Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve()))
