"""Convert authenticated saved directed intervals to outward binary64 display enclosures. No ODE execution."""
import hashlib,json,math,struct
from fractions import Fraction as F
from pathlib import Path
HERE=Path(__file__).resolve().parent
BANK=HERE.parent/'physics-general-rotation-2276/bank.jsonl'
STUDY=HERE.parent/'physics-general-rotation-2276/study.json'
def q(v):return F(int(v['numerator']),int(v['denominator']))
def outward(v,lower):
 x=float(v)
 if (F.from_float(x)>v if lower else F.from_float(x)<v):x=math.nextafter(x,-math.inf if lower else math.inf)
 assert F.from_float(x)<=v if lower else F.from_float(x)>=v
 return x
rows=[json.loads(r) for r in BANK.read_text().splitlines()]
assert rows[-1]['status']=='PASS_REFERENCE_BANK'
header=rows[0];targets={}
for row in rows[1:-1]:
 if row['precision']==120:
  other=next(r for r in rows[1:-1] if r['precision']==80 and r['ordinal']==row['ordinal'])
  def cells(a,b):
   if isinstance(a,list):return [cells(x,y) for x,y in zip(a,b)]
   lo=max(q(a['lo']),q(b['lo']));hi=min(q(a['hi']),q(b['hi']))
   assert lo<=hi and hi-lo<=F(1,10**24)
   return [outward(lo,True),outward(hi,False)]
  targets[row['ordinal']]={'ordinal':row['ordinal'],'timeSeconds':float(q(row['time'])),**{k:cells(v,other['values'][k]) for k,v in row['values'].items()}}
def decode(v):
 if isinstance(v,dict) and '$f64le' in v:return struct.unpack('<d',bytes.fromhex(v['$f64le']))[0]
 if isinstance(v,dict):return {k:decode(x) for k,x in v.items()}
 if isinstance(v,list):return [decode(x) for x in v]
 return v
study=json.loads(STUDY.read_text());pair=decode(study['pairRaw']);commands=decode(study['commandsRaw']);body=pair['model']['bodies'][0]
result={'format':'physics-lab-directed-reference','version':1,'bankSHA256':hashlib.sha256(BANK.read_bytes()).hexdigest(),'studySHA256':hashlib.sha256(STUDY.read_bytes()).hexdigest(),'method':'Saved independent body-momentum/R/work directed80/120 Taylor32 intervals; outward binary64 enclosures for browser comparison','config':{'shape':'box','massKg':body['massKg'],'halfExtentsM':pair['model']['colliders'][0]['geometry']['halfExtentsM'],'angularVelocityRadps':body['initial']['angularVelocityRadps'],'orientationXYZW':body['initial']['orientationXYZW'],'hz':120,'torqueNm':commands[1]['torqueNm']},'impulseNms':commands[0]['angularImpulseNms'],'initialL':[float(q(v)) for v in header['L0']],'energyPostImpulseJ':[outward(q(header['Eplus']),True),outward(q(header['Eplus']),False)],'targets':[targets[i] for i in range(1,7)]}
(HERE/'reference.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':'PASS_REFERENCE_CONVERSION','targets':len(targets),'bankSHA256':result['bankSHA256']}))
