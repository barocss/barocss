"""Separate data-only browser/Node bit observation; never assumes global identity."""
from pathlib import Path
import json,sys,struct,hashlib
ROOT=Path(__file__).resolve().parents[2]
# Authenticate the complete frozen observer/provider/input graph before imports.
for frozenName,frozenPin in json.loads((Path(__file__).resolve().parent/'SOURCE-PINS-03.json').read_text())['files'].items():
    frozenBytes=(ROOT/frozenName).read_bytes()
    if len(frozenBytes)!=frozenPin['bytes'] or hashlib.sha256(frozenBytes).hexdigest()!=frozenPin['sha256']:raise ValueError('Frozen audit source drift '+frozenName)
sys.path.insert(0,str(ROOT/'examples/physics-contact-wrench-producer-2276'))
from trace_decode import decode_packet

def load(p):
    d=json.loads(p.read_text());return decode_packet(d) if d.get('format')=='physics-lossless-trace-dag-v1' else d

def number(x):
    return struct.unpack('<d',bytes.fromhex(x['$f64le']))[0] if isinstance(x,dict) and set(x)=={'$f64le'} else None

def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'))
def normalize(world,value):
    qs={};pairs={};used=set()
    for a in [world['creation']]+world['history']:
        ordinal=0
        for e in a['records']:
            if e['kind']=='geometry-query':
                key=number(e['queryId']);name='step'+str(number(a['stepIndex']))+':q'+str(ordinal);ordinal+=1;qs[key]=name;pairs[e['pair']['id']]=(key,name)
    def visit(x,key=''):
        if key in ['world','attempt'] and number(x) is not None:return key.upper()
        if key=='queryId':
            n=number(x)
            if n not in qs:raise ValueError('Unowned actual query reference')
            used.add(n);return qs[n]
        if key=='id' and isinstance(x,str) and x in pairs:used.add(pairs[x][0]);return 'PAIR:'+pairs[x][1]
        if isinstance(x,list):return [visit(v) for v in x]
        if isinstance(x,dict):return {k:visit(v,k) for k,v in x.items()}
        return x
    result=visit(value)
    if len({qs[n] for n in used})!=len(used):raise ValueError('Nonbijective query map')
    return result,[(n,qs[n]) for n in used]

def main(proofPath,nodeDir,out):
    proof=load(proofPath);a0=load(nodeDir/'A-initial-trace.json');a1=load(nodeDir/'A-step1-trace.json');a2=load(nodeDir/'A-retry2-trace.json');s1=load(nodeDir/'A-step1-full-snapshot.json');s2=load(nodeDir/'A-retry2-full-snapshot.json');browser=proof['trace']['worlds'][0];node=dict(creation=a0['trace']['worlds'][0]['creation'],history=a1['trace']['worlds'][0]['history']+a2['trace']['worlds'][0]['history']);rows=[]
    def compare(name,a,b,kind='RAW_NO_NORMALIZATION',maps=None):rows.append(dict(name=name,status='BITS_EQUAL' if canonical(a)==canonical(b) else 'BITS_DIFFERENT',comparison=kind,diagnosticMaps=maps))
    compare('A0 accepted state',proof['checkpoints']['A0']['state'],a0['after']);compare('A1 accepted state',proof['checkpoints']['A1']['state'],s1['state']);compare('A1 recording',proof['checkpoints']['A1']['recording'],s1['recording']);compare('A2 accepted state',proof['checkpoints']['A2']['state'],s2['state']);compare('A2 recording',proof['checkpoints']['A2']['recording'],s2['recording'])
    for name,ba,na in [('constructor',browser['creation']['records'],node['creation']['records']),('step1',browser['history'][0]['records'],node['history'][0]['records']),('step2',browser['history'][1]['records'],node['history'][1]['records'])]:
        b,bm=normalize(browser,ba);n,nm=normalize(node,na);compare(name+' full actual phase trace',b,n,'WORLD_ATTEMPT_QUERY_PAIR_ALPHA_RENAME_ONLY',dict(browser=bm,node=nm))
    result=dict(status='OBSERVED_BROWSER_NODE_BITS_EQUAL' if all(r['status']=='BITS_EQUAL' for r in rows) else 'OBSERVED_BROWSER_NODE_BITS_DIFFERENT',rows=rows,browserProof=dict(path=str(proofPath),sha256=hashlib.sha256(proofPath.read_bytes()).hexdigest()),nodeEvidence=str(nodeDir),physicalQualification='SEPARATE_INDEPENDENT_BROWSER_OBSERVER_REQUIRED',WorldCalls=0,candidateCalls=0,globalBitIdentity='NOT_ASSUMED_OR_CLAIMED');needText=json.dumps(result,indent=2)+'\n';
    if out.parent!=proofPath.parent or sum(p.stat().st_size for p in proofPath.parent.rglob('*') if p.is_file())+len(needText.encode())>16777216:raise ValueError('Combined browser proof/audit/parity cap or output partition')
    with out.open('x') as f:f.write(needText)
    print(json.dumps(dict(status=result['status'],rows=[dict(name=r['name'],status=r['status']) for r in rows])))
if __name__=='__main__':main(Path(sys.argv[1]).resolve(),Path(sys.argv[2]).resolve(),Path(sys.argv[3]).resolve())
