"""Files-only full raw-word packet parity; no World/geometry/producer imports."""
from pathlib import Path
import hashlib,json,re,sys
from trace_decode import decode_packet
HOME=Path(__file__).resolve().parent
PRODUCER=HOME.parent/'physics-contact-wrench-producer-2276'/'evidence'/'producer-01'
ids=sys.argv[1:]
if len(ids)!=3 or not all(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}',x) for x in ids):raise ValueError('source-run native-run fresh-parity IDs required')
source,native,out=(HOME/'evidence'/x for x in ids);out.mkdir()

def read(folder,name):
    raw=(folder/name).read_bytes()
    value=json.loads(raw)
    if value.get('format')=='physics-lossless-trace-dag-v1':value=decode_packet(value)
    return value,dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())

def normalized(value):
    if isinstance(value,list):return [normalized(x) for x in value]
    if isinstance(value,dict):return {k:'VALIDATED_OWN_PROVIDER' if k=='providerDigest' else normalized(v) for k,v in value.items()}
    return value

def selected(name):
    return name.endswith('-trace.json') or name.endswith('-observer.json') or name.endswith('-before.json') or name.endswith('-after.json') or name in ('one-frame-prefix.json','recording2-rejections.json')

result=dict(status='NOT_COMPLETED',WorldCalls=0,geometryCalls=0,packets=[],firstFailure=None)
phase='summaries'
try:
    ss,_=read(source,'summary.json');ns,_=read(native,'summary.json');old,_=read(PRODUCER,'summary.json')
    if ss['status']!='EXECUTED_PASS_PRIVATE_TYPED_SOURCE_PRODUCER' or ns['status']!='EXECUTED_PASS_PRIVATE_TYPED_EMITTED_PRODUCER':raise ValueError('Both amended graphs must execute PASS before parity')
    for field in ('controls','counts','acceptedSteps','firstFailure'):
        if ss[field]!=ns[field] or ss[field]!=old[field]:raise ValueError('Summary semantics differ: '+field)
    initial,_=read(source,'A-initial-trace.json');ninitial,_=read(native,'A-initial-trace.json');oinitial,_=read(PRODUCER,'A-initial-trace.json')
    source_digest=initial['after']['identity']['providerDigest'];native_digest=ninitial['after']['identity']['providerDigest'];old_digest=oinitial['after']['identity']['providerDigest']
    if source_digest!=native_digest or source_digest==old_digest:raise ValueError('Amended Source/Native must share a distinct new provider identity')
    result['providerIdentities']=dict(amendedSource=source_digest,amendedNative=native_digest,qualifiedOriginal=old_digest)
    names=sorted(x.name for x in source.iterdir() if x.is_file() and selected(x.name))
    if set(names)!=set(x.name for x in native.iterdir() if x.is_file() and selected(x.name)):raise ValueError('Packet populations differ')
    for name in names:
        phase=name;s,sp=read(source,name);n,np=read(native,name);q,qp=read(PRODUCER,name)
        # New graphs have identical provider identities: compare every saved field.
        if s!=n:raise ValueError('Amended Source/Native full packet differs: '+name)
        # Only the original qualified provider identity is mapped; no event/state words are omitted.
        if normalized(s)!=normalized(q):raise ValueError('Amended vs qualified Source full packet differs: '+name)
        result['packets'].append(dict(name=name,source=sp,native=np,qualifiedSource=qp,fullPacketMatch=True))
    result.update(status='PASS_FULL_PRIVATE_SOURCE_NATIVE_AND_SAVED_SOURCE_PARITY',matchedPackets=len(names),normalization='providerDigest ONLY for qualified-original comparison; NONE between amended Source/Native',nativePublicDesktop='PRIVATE_EMITTED_ONLY; public/desktop NOT_RUN',warm='NOT_COVERED',successfulPublicSerde='NOT_RUN',performance='NOT_RUN')
except Exception as exc:
    result.update(status='FAIL_PRIVATE_TYPED_PARITY',firstFailure=dict(phase=phase,type=type(exc).__name__,message=str(exc)))
data=(json.dumps(result,indent=2)+'\n').encode()
if len(data)>1024*1024:raise ValueError('Parity receipt1MiB cap')
with (out/'result.json').open('xb') as stream:stream.write(data)
print(json.dumps(result))
raise SystemExit(0 if result['firstFailure'] is None else 1)
