"""Compare whole retained packets. No normalization, field projection, or Physics import."""
import json,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'examples/physics-contact-wrench-producer-2276'))
from trace_decode import decode_packet
browser,node_dir,target=map(Path,sys.argv[1:])
def need(ok,message):
    if not ok:raise ValueError(message)
def canonical(x):return json.dumps(x,sort_keys=True,separators=(',',':'))
value=json.loads(browser.read_text());need(len(value['packets'])==6,'Six actual retained packets')
results=[]
for i,packet in enumerate(value['packets']):
    case=['before','at','after'][i//2];kind='step' if i%2 else 'initial';source=node_dir/(case+'-'+kind+'-trace.json')
    raw=source.read_bytes();need(len(raw)<=16777216,'Node packet input cap')
    original=decode_packet(json.loads(raw))
    need(canonical(packet)==canonical(original),'Whole raw packet differs: '+case+'-'+kind)
    results.append({'caseId':case,'kind':kind,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
with target.open('x') as f:json.dump({'status':'PASS_BROWSER_NATIVE_NODE_WHOLE_RETAINED_PACKETS','packets':results,'normalization':False},f)
