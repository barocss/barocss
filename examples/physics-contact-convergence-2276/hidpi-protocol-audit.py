"""Read-only qualification of already executed blank-page DPR protocol."""
import hashlib,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HOME=Path(__file__).resolve().parent
p=ROOT/'output/playwright/contact-convergence/hidpi-probe-01/result.json'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='7df74a06fa961d125d15a592d55dd6bcac88fbaf4124bbcdc5bcf5261ca8fab0'
r=json.loads(p.read_text());a=r['actual']
assert r['status']=='FIRST_FAILURE' and r['firstFailure']['name']=='AssertionError'
assert 'REAL_DESKTOP_DPR_CONTEXT_PROBE_CONFIRMED' in r['firstFailure']['message']
assert r['sourceIntegrity'] is True and all(x['exit']==0 and x['error'] is None for x in r['commands'])
assert [x['label'] for x in r['commands']]==['open','snapshot','probe','close']
assert a['status']=='HIDPI_BLANK_DPR2_CONTEXT_PROTOCOL_CONFIRMED' and a['firstFailure'] is None
assert a['ownedContextClosed'] is True and a['errors']==[] and a['mobile'] is False
assert a['worldCalls']==a['candidateCalls']==a['applicationNavigations']==a['physicsImports']==0
assert len(a['observations'])==4
pngs={}
for i,o in enumerate(a['observations']):
    path=p.parent/(o['label']+'.png');raw=path.read_bytes()
    assert raw[:8]==b'\x89PNG\r\n\x1a\n'
    dims=struct.unpack('>II',raw[16:24]);assert dims==(o['png']['width'],o['png']['height'])
    assert len(raw)==o['png']['bytes']
    assert o['before']['url']==o['after']['url']=='about:blank'
    assert o['before']['hasPhysicsApp'] is False and o['after']['hasPhysicsApp'] is False
    if i:
        assert o['before']['dpr']==o['after']['dpr']==2
        assert dims==(o['viewport']['width']*2,o['viewport']['height']*2)
    else:
        assert o['before']['dpr']==2 and o['after']['dpr']==1 and o['diagnosticOnly']
    pngs[str(path.relative_to(ROOT))]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
out=HOME/'evidence/hidpi-protocol-audit-01';out.mkdir()
result={'status':'HIDPI_SAVED_PROTOCOL_AUDIT_CONFIRMED','firstFailure':None,'sourceIntegrity':'PASS',
        'paidProbeOuterStatus':r['status'],'paidInnerProtocolStatus':a['status'],'paidProbeSHA256':'7df74a06fa961d125d15a592d55dd6bcac88fbaf4124bbcdc5bcf5261ca8fab0',
        'pngs':pngs,'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'worldCalls':0,'candidateCalls':0,'newBrowserCalls':0,'paidPngsAudited':4,
        'originalWrapperFailurePreserved':True,'nativeDprContextConfirmed':True}
(out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
