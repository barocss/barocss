"""Independent exact saved GPU LE decoder for the frozen identity-pose host."""
import sys,json,gzip,struct,math
from pathlib import Path
root=Path(sys.argv[1]);graphs=[]
def f32(v):return b''.join(struct.pack('<f',x) for x in v).hex()
def u16(v):return b''.join(struct.pack('<H',x) for x in v).hex()
for mode in ['source','compiled']:
 d=json.loads(gzip.decompress((root/(mode+'-report.json.gz')).read_bytes()));assert d['passed'] and not d['dirty'] and not d['errors'] and not d['warnings'];assert len(d['rows'])==35
 for r in d['rows']:
  assert r['step']==r['state']['stepIndex'];assert r['frame']['timeSeconds']==r['state']['timeSeconds'];assert len(r['packets'])==len(r['frame']['poses'])==len(r['bindings']);assert all(x==0 for x in r['gl'])
  for p,pose,binding in zip(r['packets'],r['frame']['poses'],r['bindings']):
   assert pose['targetId']==binding['targetId'];assert p['modelId']==binding['ref']['modelId'] and p['packet']['surfaceId']==binding['ref']['surfaceId'];assert pose['rotation']==[0,0,0,1] and pose['scale']==[1,1,1]
   isactor=pose['targetId']=='capsule';assert pose['translation']==([x*1000 for x in r['state']['positionM']] if isactor else [0,0,0])
   q=p['packet'];positions=[(x+pose['translation'][i%3])*.001 for i,x in enumerate(q['positions'])];normals=[]
   for i in range(0,len(q['normals']),3):
    ns=q['normals'][i:i+3];length=math.hypot(*ns);normals.extend(x/length+0. for x in ns)
   expected=[('Float32Array',f32(positions)),('Float32Array',f32(normals)),('Uint16Array',u16(q['indices']))]
   for kind,bits in expected:assert any(u['type']==kind and u['rawHex']==bits for u in r['uploads']), (mode,r['name'],r['step'],p['modelId'],kind)
  for u in r['uploads']:assert len(bytes.fromhex(u['rawHex']))==u['bytes']
 assert d['final']['bytes']==0 and all(x==0 for x in d['final']['counts'].values()) and all(x==0 for x in d['final']['gl']);graphs.append(d['rows'])
assert graphs[0]==graphs[1]
print(json.dumps({'passed':True,'sourceCompiledExact':True,'checkpointsPerGraph':35,'identityPoseOnly':True,'independentPythonLE':True},indent=2))
