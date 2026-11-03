"""Full retained P2 packet/wire data parity; no runtime or candidate imports."""
from pathlib import Path
import hashlib,json,re,sys,struct
from trace_decode import decode_packet,fingerprint
HOME=Path(__file__).resolve().parent
OLD=HOME.parent/'physics-warm-replay-2276'/'evidence'/'replay-01'
args=sys.argv[1:]
if len(args)!=3 or not all(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}',v) for v in args):raise ValueError('source-run native-run fresh-parity IDs')
SOURCE,NATIVE,OUT=(HOME/'evidence'/v for v in args);OUT.mkdir()

def pin(data):return dict(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
def read(folder,name):
    data=(folder/name).read_bytes();value=json.loads(data)
    if isinstance(value,dict) and value.get('format')=='physics-lossless-trace-dag-v1':value=decode_packet(value)
    return value,pin(data)
def normalize(value,expected_digest,memo=None):
    if memo is None:memo={}
    if not isinstance(value,(dict,list)):return value
    if id(value) in memo:return memo[id(value)]
    if isinstance(value,list):
        result=[];memo[id(value)]=result;result.extend(normalize(v,expected_digest,memo) for v in value);return result
    result={};memo[id(value)]=result
    for k,v in value.items():
        if k=='providerDigest':
            if not isinstance(v,str) or v!=expected_digest:raise ValueError('Unexpected providerDigest outside validated graph identity')
            result[k]='VALIDATED_PROVIDER_IDENTITY'
        else:result[k]=normalize(v,expected_digest,memo)
    return result

def wire_payload(data):
    # Inspect canonical typed data only, retaining every numeric word as bytes.
    # This is NOT a runtime recording reader or a legacy format route.
    if data[:8]!=b'BCPHREC2' or len(data)>1048576:raise ValueError('Expected saved version2 wire')
    offset=8;nodes=0
    def take(n):
        nonlocal offset
        if n<0 or offset+n>len(data):raise ValueError('Truncated saved wire')
        result=data[offset:offset+n];offset+=n;return result
    def u32():return int.from_bytes(take(4),'little')
    def value(depth=0):
        nonlocal nodes
        nodes+=1
        if nodes>50000 or depth>32:raise ValueError('Saved wire bound')
        tag=take(1)[0]
        if tag==0:return None
        if tag in (1,2):return tag==2
        if tag==3:return take(u32()).decode('utf-8')
        if tag==4:
            word=take(8)
            if ((int.from_bytes(word,'little')>>52)&2047)==2047:raise ValueError('Nonfinite wire number')
            return {'$f64le':word.hex()}
        if tag==5:
            n=u32()
            if n>4096:raise ValueError('Wire array bound')
            return [value(depth+1) for _ in range(n)]
        if tag==6:
            n=u32()
            if n>64:raise ValueError('Wire object bound')
            result={};previous=None
            for _ in range(n):
                key=value(depth+1)
                if not isinstance(key,str) or not re.fullmatch(r'[\x20-\x7e]+',key) or previous is not None and key<=previous:raise ValueError('Canonical wire key')
                result[key]=value(depth+1);previous=key
            return result
        raise ValueError('Saved wire tag')
    result=value()
    if offset!=len(data):raise ValueError('Trailing wire data')
    return result

def names(folder):
    return sorted(p.name for p in folder.iterdir() if p.is_file() and p.suffix=='.json' and p.name not in ('summary.json','frozen-inputs.json') and not p.name.endswith('-observer-process.json') and not p.name.endswith('-pin.json'))

receipt=dict(status='NOT_COMPLETED',WorldCalls=0,candidateCalls=0,geometryCalls=0,packets=[],wire=[],firstFailure=None)
phase='summaries'
try:
    ss,_=read(SOURCE,'summary.json');ns,_=read(NATIVE,'summary.json');old,_=read(OLD,'summary.json')
    if ss['status']!='EXECUTED_PASS_PRIVATE_TYPED_WARM_SOURCE_REPLAY_PROTOCOL' or ns['status']!='EXECUTED_PASS_PRIVATE_TYPED_WARM_NATIVE_REPLAY_PROTOCOL':raise ValueError('Both new graphs must execute PASS first')
    for k in ('controls','counts','acceptedSteps','firstFailure','hiddenAcceptedPublicOutput','hiddenRawAcceptedOutputEquality','hiddenInternalComparison','hiddenActualTraceParity'):
        if ss[k]!=ns[k] or ss[k]!=old[k]:raise ValueError('P2 protocol semantics differ: '+k)
    a,_=read(SOURCE,'A-initial-trace.json');b,_=read(NATIVE,'A-initial-trace.json');q,_=read(OLD,'A-initial-trace.json')
    sd=a['after']['identity']['providerDigest'];nd=b['after']['identity']['providerDigest'];od=q['after']['identity']['providerDigest']
    if sd!=nd or sd==od:raise ValueError('New shared actual identity required')
    receipt['identities']=dict(source=sd,native=nd,qualifiedOldWarm=od)
    population=names(SOURCE)
    if population!=names(NATIVE) or population!=names(OLD):raise ValueError('Retained P2 packet population changed')
    for name in population:
        phase=name;s,sp=read(SOURCE,name);n,np=read(NATIVE,name);q,qp=read(OLD,name)
        sf=fingerprint(s);nf=fingerprint(n)
        if sf!=nf:raise ValueError('New Source/Native packet differs: '+name)
        if fingerprint(normalize(s,sd))!=fingerprint(normalize(q,od)):raise ValueError('Only old providerDigest may differ: '+name)
        receipt['packets'].append(dict(name=name,source=sp,native=np,oldWarm=qp,fullCanonicalFingerprint=sf,matched=True))
    phase='complete genuine wires'
    wires={}
    for label,folder in [('source',SOURCE),('native',NATIVE),('oldWarm',OLD)]:
        data=(folder/'prefix.bcphrec2').read_bytes();bad=(folder/'prefix-old-magic.bcphrec1').read_bytes()
        if bad!=data[:7]+b'1'+data[8:]:raise ValueError('Invalid-magic fixture must differ ONLY at magic byte')
        parsed=wire_payload(data);decoded,_=read(folder,'decoded-prefix.json')
        if fingerprint(parsed)!=fingerprint(decoded):raise ValueError('Saved wire typed words differ from actual decoded recording')
        for filename,content in [('prefix.bcphrec2',data),('prefix-old-magic.bcphrec1',bad)]:
            saved,_=read(folder,filename+'-pin.json')
            if pin(content)!=saved:raise ValueError('Wire derived hash metadata mismatch')
        wires[label]=dict(data=data,invalid=bad,parsed=parsed)
        receipt['wire'].append(dict(graph=label,valid=pin(data),invalidMagicFixture=pin(bad),allTypedWordsCompared=True))
    if wires['source']['data']!=wires['native']['data'] or wires['source']['invalid']!=wires['native']['invalid']:raise ValueError('New full wire bytes differ')
    if fingerprint(normalize(wires['source']['parsed'],sd))!=fingerprint(normalize(wires['oldWarm']['parsed'],od)):raise ValueError('Old wire differs beyond providerDigest fields')
    receipt.update(status='PASS_FULL_RETAINED_WARM_SOURCE_NATIVE_AND_OLD_WARM_PARITY',matchedPackets=len(population),normalization='NONE between new graphs; ONLY providerDigest fields versus old qualified warm Source; wire pins independently authenticated as derived data',hiddenRawAcceptedOutputEquality='NOT_PROVEN_NOT_RETAINED_AFTER_DISPOSE',production='NOT_RUN',desktop='NOT_RUN',performance='NOT_RUN')
except Exception as exc:
    receipt.update(status='FAIL_PRIVATE_WARM_NATIVE_PARITY',firstFailure=dict(phase=phase,type=type(exc).__name__,message=str(exc)))
out=(json.dumps(receipt,indent=2)+'\n').encode()
if len(out)>1048576:raise ValueError('Parity receipt1MiB cap')
with (OUT/'result.json').open('xb') as f:f.write(out)
print(json.dumps(receipt))
raise SystemExit(1 if receipt['firstFailure'] else 0)
