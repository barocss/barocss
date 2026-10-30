"""Independent Fraction reference-point mask and stock-minus-disjoint-prism moments. Product imports: zero."""
import json,math,sys
from fractions import Fraction as F
def q(v): return F.from_float(v) if isinstance(v,float) else F(v)
def classify(r,p):
 winding=0
 for i,a in enumerate(r):
  b=r[(i+1)%len(r)]; ax,ay=map(q,a);bx,by=map(q,b);x,y=map(q,p);s=(bx-ax)*(y-ay)-(by-ay)*(x-ax)
  if s==0 and min(ax,bx)<=x<=max(ax,bx) and min(ay,by)<=y<=max(ay,by):return 'boundary'
  if ay<=y<by and s>0:winding+=1
  if by<=y<ay and s<0:winding-=1
 return 'inside' if winding else 'outside'
d=json.load(sys.stdin);node=d['feature'];region=node['region'];sx=q(node['spacing']);sy=q(node['spacing2']);a=node['anchor'];cells=[]
for j in range(node['count2']):
 for i in range(node['count']):
  p=[q(a[0])+i*sx,q(a[1])+j*sy]
  if (i or j) and (classify(region['points'],p)=='outside' or any(classify(h,p)!='outside' for h in region.get('holes',[]))):continue
  cells.append([i,j])
assert cells and cells[0]==[0,0]
v=F(24000)-150*len(cells);c=[(F(720000)-150*sum(F(17,2)+i*sx for i,j in cells))/v,(F(480000)-150*sum(F(17,2)+j*sy for i,j in cells))/v,F(5)]
t=d['target'];b=t['brep'];assert t['check']['valid'];assert len(b['bodies'])==1 and b['bodies'][0]['kind']=='solid';assert all(s['closed'] for s in b['shells'])
for label,m in [('public',t['mass']),('Model',t['model']),('actualStudio',d['studio'])]:
 assert math.isfinite(m['volume']) and abs(q(m['volume'])-v)<=q(1e-7),(label,'volume')
 assert all(abs(q(x)-y)<=q(1e-7) for x,y in zip(m['centroid'],c)),(label,'centroid')
names=t['names'];assert len(set(names))==len(names)
for j in range(node['count2']):
 for i in range(node['count']):
  if i or j:assert any(n.endswith('.side0@%d,%d'%(i,j)) for n in names)==([i,j] in cells),('stable suffix',i,j)
for i,j in cells:
 for dx in [0,3]:
  for dy in [0,5]:
   for z in [0,10]:
    p=[F(7)+i*sx+dx,F(6)+j*sy+dy,F(z)]
    assert any(all(abs(q(x)-y)<=q(1e-7) for x,y in zip(vt['point'],p)) for vt in b['vertices']),('missing cutter corner',p)
print(json.dumps({'status':'PASS','cells':cells,'volume':float(v),'centroid':[float(x) for x in c],'exactCentroid':[{'n':str(x.numerator),'d':str(x.denominator)} for x in c],'source':'Independent Fraction winding and exact integer prism moments','scope':'Reference point mask only; original seed retained; no clipping claim'},indent=2))
