// ROOT DATA-ONLY extraction: existing trace decoder, zero candidate/World calls.
import assert from 'node:assert/strict';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {resolve,dirname,isAbsolute} from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];assert(/^[a-z0-9-]{1,48}$/.test(id??''));const pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};const seal=JSON.parse(readFileSync(resolve(home,'AUTHOR-FREEZE-01.json')));for(const[p,v]of Object.entries(seal.files))assert.deepEqual(pin(isAbsolute(p)?p:resolve(root,p)),v,'Frozen input '+p);const reference=JSON.parse(readFileSync(resolve(root,seal.referencePath)));assert.equal(reference.status,'REFERENCE_READY');assert.equal(reference.candidateCalls,0);assert.equal(reference.WorldCalls,0);assert.equal(pin(resolve(root,'examples/physics-coupled-dynamic-reference-2276/reference.py')).sha256,reference.sourceSha256);mkdirSync(resolve(home,'evidence'),{recursive:true});const out=resolve(home,'evidence',id);mkdirSync(out);
const script=String.raw`
import sys,json,importlib.util,struct,hashlib
from pathlib import Path
root=Path(sys.argv[1]);out=Path(sys.argv[2]);decoder=root/'examples/physics-contact-wrench-producer-2276/trace_decode.py'
spec=importlib.util.spec_from_file_location('qualified_decode',decoder);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def word(x):return {'$f64le':struct.pack('<d',x).hex()}
def collect(x,kind):
 rows=[]
 if isinstance(x,dict):
  if x.get('kind')==kind:rows.append(x)
  for v in x.values():rows+=collect(v,kind)
 elif isinstance(x,list):
  for v in x:rows+=collect(v,kind)
 return rows
rows=[];pins={}
for name in ['before','at','after']:
 p=root/'examples/physics-coupled-contact-2276/evidence/source-01'/ (name+('-refused-trace.json' if name=='after' else '-step-trace.json'))
 modelPath=root/'examples/physics-persistent-cone-design-2276/evidence/model-01'/(name+'-model.json');model=json.loads(modelPath.read_text());data=module.decode_packet(json.loads(p.read_text()))
 plans=collect(data['trace'],'coupled-plan');assert len(plans)==1
 queries=[q for q in collect(data['trace'],'geometry-query') if q['owner']=='step' and q['result']['status']=='HIT'];assert queries
 plan=plans[0];normal=queries[0]['result']['normal'];assert normal==plan['geometry']['normal']
 inp=dict(plan['input']);materials={c['bodyId']:c['material']['friction']['dynamic'] for c in model['colliders']};inp.update(muDynamicA=word(materials['a-floor']),muDynamicB=word(materials['z-cube']),reportedNormal=normal)
 assert not any(k in inp for k in ['result','certificate','physicalK','worldImpulseNs'])
 rows.append(dict(id=name,input=inp,expectedStatus='DYNAMIC_TARGET' if name=='after' else 'STATIC_TARGET',sourcePacket=str(p.relative_to(root)),sourceModel=str(modelPath.relative_to(root))))
 pins[str(p.relative_to(root))]=pin(p);pins[str(modelPath.relative_to(root))]=pin(modelPath)
optionsPath=root/'examples/physics-persistent-cone-design-2276/evidence/model-01/options.json';pins[str(optionsPath.relative_to(root))]=pin(optionsPath)
bank=dict(format='pure-coupled-actual-prewarm-words-v1',status='READY_ACTUAL_INPUT_WORDS_ONLY',WorldCalls=0,candidateCalls=0,cases=rows,sourcePins=pins,decoderPin=pin(decoder),expectations='SEPARATE_REFERENCE_NOT_PASSED_TO_KERNEL')
raw=(json.dumps(bank,sort_keys=True,separators=(',',':'))+'\n').encode();assert len(raw)<16777216-65536
with (out/'bank.json').open('xb') as f:f.write(raw)
print(json.dumps(dict(status=bank['status'],cases=len(rows),WorldCalls=0,candidateCalls=0,bankPin=pin(out/'bank.json'))))
`;
const p=spawnSync(seal.tools.python,['-B','-c',script,root,out],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});writeFileSync(resolve(out,'stdout.txt'),p.stdout??'',{flag:'wx'});writeFileSync(resolve(out,'stderr.txt'),p.stderr??'',{flag:'wx'});const result={status:p.status===0?'READY_ACTUAL_INPUT_WORDS_ONLY':'NO_GO_INPUT_EXTRACTION',exit:p.status,error:p.error?.message??null,WorldCalls:0,candidateCalls:0,authorPin:pin(resolve(home,'AUTHOR-FREEZE-01.json')),bankPin:p.status===0?pin(resolve(out,'bank.json')):null};writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));if(p.status!==0)process.exitCode=1;
