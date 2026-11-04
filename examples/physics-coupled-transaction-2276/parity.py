"""Same-workflow Source/Native packet+wire parity: no normalization or field removal."""
from pathlib import Path
import json,sys,hashlib,traceback
HOME=Path(__file__).resolve().parent;ROOT=HOME.parents[1]
def pin(p):b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def main(source,native,out):
    out.mkdir();result=dict(status='NOT_COMPLETED',WorldCalls=0,candidateCalls=0,normalization='NONE',rows=[],firstFailure=None)
    try:
        for n,v in json.loads((HOME/'AUTHOR-FREEZE-01.json').read_text())['files'].items():
            if pin(ROOT/n)!=v:raise ValueError('Frozen source drift '+n)
        a=json.loads((source/'summary.json').read_text());b=json.loads((native/'summary.json').read_text());expected='EXECUTED_PASS_COUPLED_FIRST_INTERVAL_TRANSACTION_ONE_FRAME_WIRE'
        if a['status']!=expected or b['status']!=expected:raise ValueError('Both actual protocol results must PASS')
        for key in ['controls','counts','acceptedSteps','firstFailure','observedDirectStepCalls','hiddenReplayStepCalls','hiddenPublicRawEquality','privateDiagnosticTraceAndCacheFramesVsClean']:
            if a[key]!=b[key]:raise ValueError('Summary parity '+key)
        def selected(directory):return {p.name for p in directory.iterdir() if (p.suffix=='.json' and p.name!='summary.json' and not p.name.endswith('-observer-process.json')) or p.suffix in ['.bcphrec2','.bcphrec1']}
        names=selected(source)
        if names!=selected(native):raise ValueError('Complete retained packet+wire population mismatch')
        for name in sorted(names):
            if (source/name).read_bytes()!=(native/name).read_bytes():raise ValueError('Full actual packet/wire mismatch '+name)
            result['rows'].append(dict(name=name,pin=pin(source/name),status='ALL_BYTES_EQUAL'))
        result['status']='PASS_FULL_COUPLED_TRANSACTION_SOURCE_NATIVE_PACKET_WIRE_BYTES';result['separateDiagnosticReceipts']='Observer process receipts and error stack text retained but not byte parity authority (process paths differ). No selected packet has fields removed.';result['hiddenPublicRawEquality']='NOT_PROVEN_NOT_RETAINED';result['priorControlFullPrivateTrace']='NOT_PROVEN_NO_ID_NORMALIZATION';result['scope']='FIRST_STATIC_INTERVAL_ONLY_DYNAMIC_AND_SECOND_INTERVAL_PHYSICS_NOT_SUPPORTED'
    except Exception as e:result['status']='FAIL_COUPLED_TRANSACTION_PARITY';result['firstFailure']=dict(type=type(e).__name__,message=str(e),traceback=traceback.format_exc())
    with (out/'result.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(status=result['status'],rows=len(result['rows']),firstFailure=result['firstFailure'])));return int(result['firstFailure'] is not None)
if __name__=='__main__':sys.exit(main(*(HOME/'evidence'/v for v in sys.argv[1:4])))
