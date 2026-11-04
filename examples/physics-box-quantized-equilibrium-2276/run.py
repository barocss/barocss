"""Files-only free-body equilibrium, independent of the contact solver."""
from fractions import Fraction as F
from pathlib import Path
import json,hashlib,struct,sys
HOME=Path(__file__).resolve().parent
ROOT=HOME.parent.parent
LIMIT=16384
def check(v):
    assert v.numerator.bit_length()<=LIMIT and v.denominator.bit_length()<=LIMIT
    return v
def vec(values):return list(map(F,values))
def add(a,b):return [check(x+y) for x,y in zip(a,b)]
def sub(a,b):return [check(x-y) for x,y in zip(a,b)]
def scale(a,s):return [check(x*s) for x in a]
def cross(a,b):return [check(a[1]*b[2]-a[2]*b[1]),check(a[2]*b[0]-a[0]*b[2]),check(a[0]*b[1]-a[1]*b[0])]
def word(v):return tuple(struct.pack('>d',x).hex() for x in v)
def read(path):return json.loads((ROOT/path).read_text())
freeze=read('examples/physics-box-quantized-equilibrium-2276/FREEZE-01.json')
for path,pin in freeze['files'].items():
    b=(ROOT/path).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256'],path
request=read(freeze['request']);bank=read(freeze['bank']);proof=read(freeze['proof'])
assert proof['status']=='PASS_INDEPENDENT_FINITE_CELL_GEOMETRY_ONLY'
model=request['config'];gravity=vec(model['gravityMps2']);assert gravity[0]==gravity[2]==0 and gravity[1]<0
dynamic=sorted((b for b in model['bodies'] if b['kind']=='dynamic'),key=lambda b:b['positionM'][1]);assert len(dynamic)==8
indices={b['id']:i for i,b in enumerate(dynamic)};body_map={b['id']:b for b in request['preBodies']}
cases=[(i,c) for i,c in enumerate(bank['cases']) if c.get('populationGroup')=='original-P4-32'];assert len(cases)==8
out=HOME/'evidence'/sys.argv[1];out.mkdir(parents=True,exist_ok=False)
results={};failure=None
try:
 for graph in ['source','strict-nodenext']:
    force={b['id']:scale(gravity,F(b['massKg'])) for b in dynamic};moment={b['id']:[F(0)]*3 for b in dynamic};rows=[];seen=set()
    for i,c in cases:
        packet=read(f"examples/physics-box-quantized-witness-2276/evidence/run-01/{graph}-{i:02d}-{c['id']}-output.json");hit=packet['result'];assert hit['status']=='HIT' and len(hit['points'])==4
        a,b=c['a']['id'],c['b']['id'];ia,ib=indices.get(a,-1),indices.get(b,-1)
        if min(ia,ib)<0:assert max(ia,ib)==0 and ('floor' in [a,b]);upper=0
        else:assert abs(ia-ib)==1;upper=max(ia,ib)
        assert upper not in seen;seen.add(upper)
        load=check(-gravity[1]*sum(F(x['massKg']) for x in dynamic[upper:])/4)
        assert load>0;normal=vec(hit['normal']);assert normal==([F(0),F(1),F(0)] if ib>ia else [F(0),F(-1),F(0)])
        assert sorted(word(p['pointM']) for p in hit['points'])==sorted(word(p['pointM']) for p in c['expectedOriginalPoints'])
        for box in [c['a'],c['b']]:assert box['positionM']==body_map[box['id']]['positionM'] and box['orientationXYZW']==body_map[box['id']]['orientation']
        for point in hit['points']:
            p=vec(point['pointM']);on_b=scale(normal,load)
            for id,j in [(a,scale(on_b,F(-1))),(b,on_b)]:
                if id not in indices:continue
                force[id]=add(force[id],j);moment[id]=add(moment[id],cross(sub(p,vec(body_map[id]['positionM'])),j))
            rows.append({'pair':[a,b],'pointM':point['pointM'],'normal':hit['normal'],'loadNExact':str(load),'forceOnBExact':list(map(str,on_b))})
    assert len(rows)==32 and len(seen)==8
    for id in force:assert force[id]==moment[id]==[0,0,0],(id,force[id],moment[id])
    results[graph]={'points':32,'interfaces':8,'dynamicBodies':8,'forceAndMomentScalarEquations':48,'sameRawOriginalRows':32,'maximumResidualExact':'0','rows':rows,'balances':{id:{'forceN':list(map(str,force[id])),'momentNm':list(map(str,moment[id]))} for id in force}}
except Exception as e:failure={'type':type(e).__name__,'message':str(e)}
result={'status':'NO_GO_STATIC_FORCE_BALANCE' if failure else 'PASS_SAME_32_STATIC_FORCE_MOMENT_ONLY','graphs':results,'firstFailure':failure,'WorldCalls':0,'candidateCalls':0,'QpCalls':0,'dynamicSettling':'NOT_QUALIFIED','gapComplementarity':'NOT_QUALIFIED','publicPersistent':'UNCHANGED_NO_GO','originalP4':'UNCHANGED_NO_GO'}
text=json.dumps(result,indent=2)+'\n';assert len(text.encode())<=8*1024**2
with (out/'result.json').open('x') as f:f.write(text)
print(json.dumps({k:v for k,v in result.items() if k!='graphs'}));sys.exit(1 if failure else 0)
