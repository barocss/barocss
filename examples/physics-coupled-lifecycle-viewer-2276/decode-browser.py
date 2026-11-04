"""Authenticate the complete original DAG before exporting unchanged raw packets."""
import json,sys,struct,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'examples/physics-contact-wrench-producer-2276'))
from trace_decode import decode_packet
source,target,reportPath,reportPinPath=map(Path,sys.argv[1:])
def need(ok,message):
    if not ok:raise ValueError(message)
def number(x):return struct.unpack('<d',bytes.fromhex(x['$f64le']))[0]
def raw(x):
    if isinstance(x,bool) or x is None or isinstance(x,str):return x
    if isinstance(x,(int,float)):return {'$f64le':struct.pack('<d',float(x)).hex()}
    if isinstance(x,list):return [raw(v) for v in x]
    return {k:raw(v) for k,v in x.items()}
def same(a,b):return json.dumps(a,sort_keys=True,separators=(',',':'))==json.dumps(b,sort_keys=True,separators=(',',':'))
need(source.stat().st_size<=16777216,'Stored proof cap')
value=decode_packet(json.loads(source.read_text())) # Existing full hash, pool and 1M fragment gates remain unchanged.
need(value.get('format')=='physics-coupled-viewer-browser-proof','Browser proof format')
need(value['error'] is None and not value.get('driverFailure'),'No failed browser prefix qualification')
need(number(value['stage'])==3 and number(value['accepted'])==2,'Terminal actual three-case two-accepted run')
need(value['controls']=={'before':'EXECUTED_PASS','at':'EXECUTED_PASS','after':'EXPECTED_TYPED_DYNAMIC_REFUSAL'},'All terminal control states')
trace=value['trace'];expected={'worlds':3,'attempts':3,'applications':128,'queries':22,'queryPoints':19,'anchorChecks':513}
for k,n in expected.items():need(number(trace['counts'][k])==n,'Actual complete history census '+k)
need(number(trace['counts']['records'])==169,'Exact original desktop record census')
need(len(trace['worlds'])==3 and len(value['packets'])==6 and len(value['caseOutputs'])==3,'No hidden world or packet')
need(sum(number(w['accepted']['stepIndex']) for w in trace['worlds'])==2,'Actual full history accepted census')
frozen=json.loads((ROOT/'examples/physics-coupled-lifecycle-2276/evidence/build-01/frozen.json').read_text())
options=json.loads((ROOT/frozen['optionsFile']).read_text())
need(same(value['session']['options'],raw(options)),'Exact original session options')
def binding(path):
    full=ROOT/path;b=full.read_bytes();return {'path':str(full),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}

for i,c in enumerate(frozen['cases']):
    model=json.loads((ROOT/c['modelFile']).read_text());session=value['session']['cases'][i];out=value['caseOutputs'][i];w=trace['worlds'][i]
    need(session['id']==c['id'] and same(session['model'],raw(model)),'Exact original case model')
    need(same(session['frozenInput'],raw({'model':binding(c['modelFile']),'options':binding(frozen['optionsFile'])})),'Exact original SHA/byte/path input bindings')
    need(number(w['id'])==i+1 and len(w['history'])==1,'One actual original world interval')
    need(out['caseId']==c['id'] and same(out['modelBefore'],raw(model)) and same(out['modelAfter'],raw(model)),'Actual unchanged world model')
    need(same(out['initial'],value['checkpoints'][c['id']+'0']) and same(out['latest'],value['checkpoints'][c['id']+'1']),'Display checkpoints are actual outputs')
    for j in range(2):
        p=value['packets'][i*2+j];pw=p['trace']['worlds'][0]
        need(p['caseId']==c['id'] and number(p['worldId'])==i+1,'Packet actual world ownership')
        need(same(p['model'],raw(model)) and same(p['options'],raw(options)) and same(p['frozenInput'],session['frozenInput']),'Packet exact frozen inputs')
        need(number(pw['id'])==i+1 and same(pw['creation'],w['creation']),'Full history constructor exact packet correspondence')
        if j==0:
            need(p['mode']=='creation' and pw['history']==[] and number(p['attemptId'])==0,'Creation packet has no attempt')
            need(same(p['before'],out['initial']['state']) and same(p['after'],out['initial']['state']) and same(p['privateAfter'],out['initial']['private']) and same(p['recording'],out['initial']['recording']),'Original initial snapshot correspondence')
        else:
            need(p['mode']=='step' and same(pw['history'],w['history']) and same(pw['accepted'],w['accepted']),'Full actual attempt corresponds to step packet')
            need(same(p['attemptId'],w['history'][0]['attempt']),'Exact actual attempt ID')
            need(same(p['before'],out['before']['state']) and same(p['after'],out['latest']['state']) and same(p['privateBefore'],out['before']['private']) and same(p['privateAfter'],out['latest']['private']) and same(p['recording'],out['latest']['recording']) and same(p['rejected'],out['rejected']),'Actual complete before/after/private/recording/refusal correspondence')
    if c['id']=='after':need(same(out['before'],out['latest']) and out['rejected']['code']=='COUPLED_DYNAMIC_REQUIRED','Raw full refusal rollback')
    else:need(number(out['latest']['state']['stepIndex'])==1 and len(out['latest']['recording']['frames'])==1 and out['rejected'] is None,'One accepted static interval')

# Authenticate lifecycle observations from the actual original browser report.
reportBytes=reportPath.read_bytes();reportPin=json.loads(reportPinPath.read_text())
need(len(reportBytes)<=16777216 and len(reportBytes)==reportPin['bytes'] and hashlib.sha256(reportBytes).hexdigest()==reportPin['sha256'],'Original lifecycle browser report SHA/bytes')
report=json.loads(reportBytes)
need(report['status']=='PASS_DESKTOP_COUPLED_LIFECYCLE_STATIC_VIEWER_ONLY' and len(report['checks'])==7 and all(x['status']=='PASS' for x in report['checks']),'Seven actual desktop checks')
need(not report['pageErrors'] and not report['consoleErrors'] and not report['networkErrors'],'Zero actual browser UI errors')
life=report['lifecycle'];need(life['status']=='PASS_GENUINE_PRE_DISPOSE_RAW_AND_CLONE_ISOLATION','Actual browser lifecycle gate')
first,second=life['firstRaw'],life['secondRaw']
need(same(first['records'],second['records']),'Independent clone mutation isolation')
need(same(life['physicsBefore'],trace['counts']) and same(life['physicsAfter'],trace['counts']),'No extra lifecycle browser physical work')
for j,view in enumerate([first,second]):
    need(view['status']=='CAPTURE_VIEW' and len(view['records'])==3,'Three actual stored pre-dispose captures')
    stats=view['stats'];need(number(stats['readCalls'])==j+1 and number(stats['captureCalls'])==3 and number(stats['duplicateHookCalls'])==0 and stats['globalFailure'] is None,'Exact actual read/capture census')
    need(number(stats['limits']['reads'])==16 and number(stats['limits']['worlds'])==4 and number(stats['limits']['cells'])==8192,'Original lifecycle limits unchanged')
    budget=stats['budget'];need(number(budget['limitBytes'])==16711680 and number(budget['traceBytes'])+number(budget['lifecycleBytes'])<=16711680,'Actual shared lifecycle/phase byte allowance')
    need(number(budget['traceBytes'])==number(trace['counts']['traceBytes']),'Lifecycle budget binds full original phase history')
    for i,capture in enumerate(view['records']):
        out=value['caseOutputs'][i]
        need(capture['status']=='CAPTURED' and number(capture['worldId'])==i+1,'Original case capture owner')
        need(same(capture['publicState'],out['latest']['state']) and same(capture['privateSnapshot'],out['latest']['private']) and same(capture['model'],out['modelAfter']),'Independent complete genuine public/private/model raw vs original proof')
        need(capture['owner']['status']=='NOT_APPLICABLE_NO_ATTACHED_OWNER','Actual UI recorder disposed before World')
        need(number(capture['preflightCells'])<=8192 and number(capture['reservedCopyBytes'])>0,'Original lifecycle preflight cells/reservation')

result={k:value[k] for k in ['packets','error']};result['driverFailure']=value.get('driverFailure')
result['authenticatedFullTraceCensus']=expected
result['lifecycleAudit']={'status':'PASS_INDEPENDENT_GENUINE_BROWSER_PRE_DISPOSE_RAW','captureCount':3,'bulkReads':2,'duplicateHookCalls':0,'budgetScope':'DIAGNOSTIC_CELLS_AND_COPY_ALLOWANCE_NOT_RSS'}
text=json.dumps(result,separators=(',',':'))+'\n'
need(len(text.encode())<=16711680,'Decoded packet cap')
with target.open('x') as f:f.write(text)
