"""Data-only full retained Source/Native equality, same new identity; no normalization."""
from pathlib import Path
import json,sys,hashlib,traceback
HOME=Path(__file__).resolve().parent;ROOT=HOME.parents[1]
def pin(p):b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def main(source,native,out):
    out.mkdir();result=dict(status='NOT_COMPLETED',WorldCalls=0,candidateCalls=0,normalization='NONE',rows=[],firstFailure=None)
    try:
        for n,v in json.loads((HOME/'AUTHOR-FREEZE-01.json').read_text())['files'].items():
            if pin(ROOT/n)!=v:raise ValueError('Frozen source drift '+n)
        a=json.loads((source/'summary.json').read_text());b=json.loads((native/'summary.json').read_text());expected='EXECUTED_STATIC_PASS_DYNAMIC_REQUIRED_REFUSAL_PRIVATE_COUPLED_LIFECYCLE'
        if a['status']!=expected or b['status']!=expected:raise ValueError('Both static/refusal runs must qualify')
        for key in ['controls','counts','acceptedSteps','firstFailure','constitutiveCampaign']:
            if a[key]!=b[key]:raise ValueError('Summary parity '+key)
        selected=lambda directory:{p.name for p in directory.iterdir() if p.suffix=='.json' and p.name not in ['summary.json','frozen-inputs.json'] and not p.name.endswith('-observer-process.json')}
        names=selected(source)
        if names!=selected(native):raise ValueError('Complete retained packet population')
        for name in sorted(names):
            left=source/name;right=native/name
            if left.read_bytes()!=right.read_bytes():raise ValueError('Full actual bytes mismatch '+name)
            result['rows'].append(dict(name=name,pin=pin(left),status='BITS_EQUAL'))
        result['status']='PASS_FULL_LIFECYCLE_STATIC_SOURCE_NATIVE_BYTES';result['physicalScope']='TWO_STATIC_CASES_ONLY_AFTER_DYNAMIC_NOT_SUPPORTED';result['constitutiveCampaign']='NO_GO_DYNAMIC_PHYSICS_NOT_SUPPORTED'
    except Exception as e:result['status']='FAIL_COUPLED_SOURCE_NATIVE_PARITY';result['firstFailure']=dict(type=type(e).__name__,message=str(e),traceback=traceback.format_exc())
    with (out/'result.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(dict(status=result['status'],firstFailure=result['firstFailure'],rows=len(result['rows']))));return int(result['firstFailure'] is not None)
if __name__=='__main__':sys.exit(main(*(HOME/'evidence'/v for v in sys.argv[1:4])))
