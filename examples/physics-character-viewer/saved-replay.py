"""Independent stdlib-only saved bytes/state/pixel/cost verifier. No producer imports."""
import sys,json,gzip,hashlib,struct,math
from pathlib import Path
root=Path(sys.argv[1]);reference=json.loads((Path(__file__).parent/'selected-states.json').read_text())
def numbers(x):
 if type(x) in (int,float):return [x]
 if isinstance(x,list):return [n for y in x for n in numbers(y)]
 if isinstance(x,dict):return [n for k in sorted(x) for n in numbers(x[k])]
 return []
def raw(x):return b''.join(struct.pack('<d',n) for n in numbers(x)).hex()
rows=[];pixel_graphs=[]
for mode in ['source','compiled']:
 numeric=json.loads(gzip.decompress((root/'numeric'/(mode+'-report.json.gz')).read_bytes()))
 for item in numeric:
  ref=next(r for r in reference if r['name']==item['name']);assert item['runs'][0]==item['runs'][1];assert item['runs'][0]['rawHex']==raw(item['runs'][0]['states'])==raw(ref['states']);assert item['geometry']['passed']
 browser=json.loads(gzip.decompress((root/'browser'/mode/'report.json.gz').read_bytes()));assert browser['passed'];assert not browser['dirty'];assert not browser['errors'] and not browser['warnings'];assert len(browser['scenes'])==8
 pixels=[]
 for scene in browser['scenes']:
  assert scene['passed'];ref=next(r for r in reference if r['name']==scene['name'])
  if scene['name']!='SPAWN_OVERLAP':
   assert len(scene['states'])==241;assert scene['rawHex']==raw(scene['states'])==raw(ref['states']);assert all(f['passed'] for f in scene['allStateFrustum'])
  else:assert scene['refusal']['error']['code']=='INITIAL_OVERLAP' and not scene['refusal']['controller']
  for case in scene['cases']:
   if case['step'] is not None:
    assert case['uploads']['passed'] and case['frustum']['passed'];assert case['actorWitness']>=16 and case['terrainWitness']>=16
    for r in case['actorExcluded']['results'][1:]:assert r['outside']==r['vertices']
    r=case['terrainExcluded']['results'][0];assert r['outside']==r['vertices']
    for group in ['combined','actor','terrain']:
     buf=gzip.decompress((root/'browser'/mode/case[group]['file']).read_bytes());assert len(buf)==1200*800*4;assert hashlib.sha256(buf).hexdigest()==case[group]['sha'];pixels.append(case[group]['sha'])
   else:
    buf=gzip.decompress((root/'browser'/mode/case['file']).read_bytes());assert hashlib.sha256(buf).hexdigest()==case['sha'];pixels.append(case['sha'])
 assert len(browser['controls'])==9 and all(c['passed'] for c in browser['controls'])
 assert len(browser['cost'])==21
 for c in browser['cost']:
  s=c['stats'];samples=sorted(s['hostSamplesMs']);p95=samples[math.ceil(len(samples)*.95)-1];assert len(samples)==240 and p95==c['p95Ms']<=8.33;assert s['acceptedSteps']==s['submissions']==240 and s['twinSteps']==0;assert s['simulatedSeconds']==2 and s['simulatedToWallRatio']>=.90;assert sum(r['steps'] for r in s['rafRecords'])==240 and all(r['steps']<=12 for r in s['rafRecords']);assert s['debtSeconds']==0 and s['stopReason']=='complete'
 f=browser['final'];assert f['canvas'] and f['bytes']==0 and all(n==0 for n in f['counts'].values()) and all(n==0 for n in f['gl']);pixel_graphs.append(pixels);rows.append({'mode':mode,'scenes':8,'states':1687,'pixelFiles':len(pixels),'costTrials':len(browser['cost'])})
assert pixel_graphs[0]==pixel_graphs[1]
cleanup=json.loads((root/'browser'/'cleanup.json').read_text());assert cleanup['ownedBrowserClosed'] and cleanup['ownedServersClosed']
print(json.dumps({'passed':True,'independentStdlib':True,'rows':rows,'exactCrossGraphPixels':True},indent=2))
