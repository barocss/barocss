"""Root-only hash seal; no candidate, checker or numerical imports."""
import argparse
import hashlib
import json
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
def pin(p):
    d=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(65536),b''):d.update(b)
    return dict(bytes=p.stat().st_size,sha256=d.hexdigest())
def need(ok,why):
    if not ok:raise ValueError(why)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--reviewed-protocol-sha',required=True);args=parser.parse_args()
    p=HERE/'PROTOCOL-01.json';need(pin(p)['sha256']==args.reviewed_protocol_sha,'EXACT_ROOT_REVIEWED_PROTOCOL')
    protocol=json.loads(p.read_bytes());need(protocol['status']=='AUTHORED_FOR_ROOT_REVIEW','FINAL_PROTOCOL_REQUIRED');s=ROOT/protocol['sourcePinsFile']
    need(pin(s)==protocol['sourcePinsPin'],'SOURCE_SNAPSHOT_IDENTITY');snapshot=json.loads(s.read_bytes())
    files,tools={},{}
    for group,out in [('files',files),('externalToolFiles',tools)]:
        for name,expected in snapshot[group].items():
            path=Path(name) if group=='externalToolFiles' else ROOT/name
            need(path.is_absolute() and (group=='externalToolFiles' or path.resolve().is_relative_to(ROOT)),'AUTHORITY_PATH')
            need(not path.is_symlink() and pin(path)==expected,'SOURCE_OR_TOOL_DRIFT:'+name);out[name]=expected
    for path in HERE.iterdir():
        if path.is_file() and path.name not in ('PROTOCOL-01.json','SOURCE-PINS-01.json','AUTHOR-FREEZE-01.json'):
            need(str(path.relative_to(ROOT)) in files,'COMPLETE_OWN_SOURCE_SNAPSHOT:'+path.name)
    files[str(p.relative_to(ROOT))]=pin(p);files[str(s.relative_to(ROOT))]=pin(s)
    need(protocol['savedBaselineCoreCpuNs']==773147000 and protocol['fixedGateNs']==695832300,'FIXED_COST_GATE')
    need(protocol['stages']['B']==dict(freshFullWrapperCommands=1,frames=6,compactCalls=432,coldQpCalls=0,engineWorldCalls=0,duplicateSixFrameRuns=0),'EXACT_NEW_SIX_BANK')
    need(protocol['costDecisions']==1 and protocol['reruns']==dict(G0=0,U0=0,A10=0,R0=0,R1=0),'NO_COMPONENT_REPEATS')
    output=dict(protocol='p4-full-gram-six-author-freeze-v1',status='AUTHORED_NOT_EXECUTED',files=files,externalToolFiles=tools,runProtocol=str(p.relative_to(ROOT)),rootReviewedProtocolSHA256=args.reviewed_protocol_sha,authorNumericalCalls=0,authorCandidateCalls=0,authorReferenceCalls=0,authorWorldCalls=0,archivePolicy='WORKSPACE_FILES_ONLY_EXTERNAL_TOOLS_EXCLUDED')
    with (HERE/'AUTHOR-FREEZE-01.json').open('x') as f:json.dump(output,f,indent=2);f.write('\n')
if __name__=='__main__':main()
