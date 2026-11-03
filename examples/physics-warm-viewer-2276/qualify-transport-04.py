"""Root-run data qualification only. No World, browser, physics observer or provider imports."""
from pathlib import Path
import json,sys,hashlib,importlib.util,copy,struct,traceback
ROOT=Path(__file__).resolve().parents[2];HOME=Path(__file__).resolve().parent

def pin(path):
    b=path.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def require(x,message):
    if not x:raise ValueError(message)
def canonical(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);sys.modules[name]=m;spec.loader.exec_module(m);return m

def main(out):
    require(out.parent==HOME/'evidence','Fresh qualification output must be directly under evidence');out.mkdir()
    result=dict(status='NOT_COMPLETED',WorldCalls=0,browserCalls=0,physicsObserverCalls=0,candidateCalls=0,controls=[],firstFailure=None)
    try:
        frozen=json.loads((HOME/'AUDIT-PINS-04.json').read_text())
        for n,v in frozen['files'].items():require(pin(ROOT/n)==v,'Frozen04 input drift '+n)
        source=json.loads((HOME/'SOURCE-PINS-03.json').read_text())
        for n,v in source['files'].items():require(pin(ROOT/n)==v,'Frozen03 source drift '+n)
        old=module('qualified_old_transport',ROOT/'examples/physics-contact-wrench-producer-2276/trace_decode.py')
        new=module('bounded_transport04',HOME/'transport_decode_04.py')
        for k in ['MAX_EXPANDED_BYTES','MAX_SHARED_NODES','MAX_REFERENCE_DEPTH','MAX_CANONICAL_FRAGMENTS']:
            require(getattr(old,k)==getattr(new,k),'Unchanged cap '+k)
        def passed(name,**data):result['controls'].append(dict(name=name,status='PASS',**data))
        def refused(name,value):
            try:new.decode_packet(value)
            except ValueError as e:passed(name,refusal=str(e));return
            raise ValueError('Expected strict refusal '+name)
        def plain_packet(raw):
            text=canonical(raw);return dict(format='physics-lossless-trace-dag-v1',objects={},root=raw,expandedCanonicalBytes=len(text),expandedCanonicalSha256=hashlib.sha256(text).hexdigest())
        edge=dict(z=None,a=[True,False,-0.0,0.0,17,-5,1.25],escapes='"\\\b\f\n\r\t\x00\x1f',unicode='한글😀')
        edgepacket=plain_packet(edge);oldedge=old.decode_packet(edgepacket);newedge=new.decode_packet(edgepacket)
        require(canonical(oldedge)==canonical(newedge)==canonical(edge),'Canonical scalar/escape/sorted-key edge equivalence')
        require(old.fingerprint(oldedge)==new.fingerprint(newedge),'Independent edge SHA/byte equality');passed('canonical_scalar_escape_unicode_sorted_edges')
        for target in [4095,4096,4097]:
            shared={'s':'x'*(target-8)};encoded=canonical(shared);require(len(encoded)==target,'Exact frozen cache boundary size')
            key=hashlib.sha256(encoded).hexdigest();rootvalue=[shared,shared];bank=plain_packet(rootvalue);bank['root']=[{'$node':key},{'$node':key}];bank['objects']={key:shared}
            oldvalue=old.decode_packet(bank);newvalue,stats=new.decode_packet_with_receipt(bank)
            require(canonical(oldvalue)==canonical(newvalue)==canonical(rootvalue),'Boundary all decoded words')
            require(old.fingerprint(oldvalue)==new.fingerprint(newvalue),'Boundary SHA/bytes')
            require(stats['cacheEntries']==(1 if target<=4096 else 0),'Only <=4096 original verified nodes cached')
            passed('referenced_cache_boundary_'+str(target),transportReceipt=stats)
        native=ROOT/'examples/physics-warm-native-2276/evidence/native-01'
        for name in ['A-initial-trace.json','A-step1-trace.json','A-retry2-trace.json']:
            require((native/name).stat().st_size<=16777216,'Stored Native packet byte cap');packet=json.loads((native/name).read_text());a=old.decode_packet(packet);b=new.decode_packet(packet)
            require(canonical(a)==canonical(b),'All decoded words old/new '+name);passed('old_new_words_'+name,input=pin(native/name),canonicalBytes=len(canonical(a)))
        proof=HOME/'evidence/browser-desktop-02/proof.json';capture=json.loads((proof.parent/'capture.json').read_text());require(pin(proof)==dict(bytes=capture['storedBytes'],sha256=capture['storedSHA256']),'Actual capture authentication')
        failed=json.loads((HOME/'DATA-FAILURE-03.json').read_text());require(failed['physicsObserverCalls']==0 and 'Expanded canonical trace resource bound' in failed['stderrUTF8'],'Preserved old full-root resource refusal');passed('original_old_resource_failure_preserved',oldBrowserDecoderRerun=False)
        require(proof.stat().st_size<=16777216,'Stored browser proof byte cap before JSON parse');packet=json.loads(proof.read_text());decoded,receipt=new.decode_packet_with_receipt(packet)
        digest=hashlib.sha256();expandedBytes=0;independentStdlibLexicalChunks=0
        for text in json.JSONEncoder(ensure_ascii=False,sort_keys=True,separators=(',',':')).iterencode(decoded):
            span=text.encode();independentStdlibLexicalChunks+=1;expandedBytes+=len(span);require(expandedBytes<=16777216,'Independent expanded-byte bound');digest.update(span)
        require(expandedBytes==packet['expandedCanonicalBytes'] and digest.hexdigest()==packet['expandedCanonicalSha256'],'Independent full expanded root SHA and bytes')
        require(receipt['rootCanonicalSha256']==digest.hexdigest() and receipt['rootCanonicalBytes']==expandedBytes,'Decoder receipt root matches independent full stream')
        require(receipt['verifiedSharedNodes']==len(packet['objects']) and receipt['verifiedNodeHashes']=={k:k for k in packet['objects']},'Every original pool node SHA authenticated')
        require(receipt['emittedFragments']<=1000000 and receipt['cacheBytes']<=4194304 and receipt['maxEmittedSpanBytes']<=4096 and receipt['maximumExpandedDepth']<=64,'Unchanged actual-work/depth caps and bounded small span cache')
        passed('actual_browser_full_root_authenticated',encoded=pin(proof),expandedBytes=expandedBytes,expandedSHA256=digest.hexdigest(),transportReceipt=receipt,independentStdlibLexicalChunks=independentStdlibLexicalChunks,metricMeaning='New actual emitted span work; not a retrospective old fragment PASS')
        missing=dict(format='physics-lossless-trace-dag-v1',objects={},expandedCanonicalBytes=4,expandedCanonicalSha256=hashlib.sha256(b'null').hexdigest());refused('missing_required_root',missing)
        bad=copy.deepcopy(packet);bad['expandedCanonicalSha256']='0'*64;refused('wrong_root_SHA',bad)
        bad=copy.deepcopy(packet);bad['expandedCanonicalBytes']+=1;refused('wrong_root_bytes',bad)
        require(packet['objects'],'Actual shared pool required');key=next(iter(packet['objects']))
        bad=copy.deepcopy(packet);bad['objects'][key]={'tampered':'payload'};refused('wrong_subnode_payload',bad)
        bad=copy.deepcopy(packet);bad['root']={'$node':key};bad['objects'][key]={'$node':key};refused('cycle',bad)
        bad=copy.deepcopy(packet);bad['root']={'$node':'f'*64};refused('missing_reference',bad)
        leaf={'unreferenced_control':'isolated'};leafkey=hashlib.sha256(canonical(leaf)).hexdigest();require(leafkey not in packet['objects'],'Unique unreferenced control')
        bad=copy.deepcopy(packet);bad['objects'][leafkey]=leaf;refused('unreferenced_pool_node',bad)
        # A local decoded mutation must not mutate a packet or poison later decode calls.
        shared={'words':[{'$f64le':struct.pack('<d',float(i)).hex()} for i in range(24)]};sk=hashlib.sha256(canonical(shared)).hexdigest();raw={'left':shared,'right':shared};small=dict(format='physics-lossless-trace-dag-v1',objects={sk:shared},root={'left':{'$node':sk},'right':{'$node':sk}},expandedCanonicalBytes=len(canonical(raw)),expandedCanonicalSha256=hashlib.sha256(canonical(raw)).hexdigest())
        smallbytes=canonical(small);value=new.decode_packet(small);value['left']['words'][0]['$f64le']='ffffffffffffffff';require(canonical(small)==smallbytes,'Decoder must not expose packet mutable nodes');require(canonical(new.decode_packet(small))==canonical(old.decode_packet(small)),'Fresh decode after output mutation');passed('decoded_mutation_no_input_or_cross_call_poison')
        bad=copy.deepcopy(small);bad['expandedCanonicalBytes']=16777217;refused('declared_byte_cap',bad)
        bad=copy.deepcopy(small);bad['objects']={str(i):None for i in range(8193)};refused('shared_node_cap',bad)
        nested=0
        for _ in range(66):nested=[nested]
        bad=dict(format='physics-lossless-trace-dag-v1',objects={},root=nested,expandedCanonicalBytes=len(canonical(nested)),expandedCanonicalSha256=hashlib.sha256(canonical(nested)).hexdigest());refused('reference_depth_cap',bad)
        # This unshared root genuinely requires >1M canonical fragments, below 16MiB.
        unshared=[0]*1000001;bad=dict(format='physics-lossless-trace-dag-v1',objects={},root=unshared,expandedCanonicalBytes=len(canonical(unshared)),expandedCanonicalSha256=hashlib.sha256(canonical(unshared)).hexdigest());refused('actual_fragment_work_cap',bad)
        result['status']='PASS_DATA_ONLY_TRANSPORT04_QUALIFICATION';result['physicsQualification']='NOT_RUN_BY_THIS_HARNESS';result['oldResourceFailure']='PRESERVED_NOT_PHYSICAL_FAIL';result['sameProof']=pin(proof);result['auditFreeze']=pin(HOME/'AUDIT-PINS-04.json')
    except Exception as e:
        result['status']='FAIL_DATA_ONLY_TRANSPORT04_QUALIFICATION';result['firstFailure']=dict(type=type(e).__name__,message=str(e),traceback=traceback.format_exc())
    text=json.dumps(result,indent=2)+'\n';require(len(text.encode())<=1048576,'Qualification receipt cap')
    with (out/'result.json').open('x') as f:f.write(text)
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'],controls=len(result['controls']))));return int(result['firstFailure'] is not None)
if __name__=='__main__':sys.exit(main(Path(sys.argv[1]).resolve()))
