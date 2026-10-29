from fractions import Fraction as F
import json
# Independent arithmetic only: polygon Green moments, authored piecewise line source, and UV reflection.
def nm(x): return {'exact':str(x),'number':float(x)}
def props(points):
 twice=F(0);mx=F(0);my=F(0)
 for a,b in zip(points,points[1:]+points[:1]):
  cross=a[0]*b[1]-b[0]*a[1];twice+=cross;mx+=(a[0]+b[0])*cross;my+=(a[1]+b[1])*cross
 area=twice/2
 return area,(mx/(3*twice),my/(3*twice))
def sample160(points):
 out=[];n=len(points)
 for k in range(160):
  t=F(k*n,160);i=int(t);f=t-i;a=points[i];b=points[(i+1)%n];out.append((a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])))
 return out
def payload(points):
 area,center=props(points);remain=F(1200)-area
 return {'holeArea':nm(area),'holeCentroid':[nm(q) for q in center], 'outsideArea':nm(remain),
 'outsideCentroid':[nm((F(1200)*c-area*h)/remain) for c,h in zip((F(30),F(9)),center)]}
rect=[(F(15),F(-1)),(F(25),F(-1)),(F(25),F(9)),(F(15),F(9))]
concave=[(F(15),F(-1)),(F(30),F(-1)),(F(30),F(4)),(F(22),F(4)),(F(22),F(12)),(F(15),F(12))]
result={'support':{'area':1200,'centroid':[30,9,3],'domainU':[-2,6],'domainV':[1,7]}, 'rectangle':payload(rect), 'concaveAuthoredDesign':payload(concave),'concavePublicProducerIdeal160Polyline':payload(sample160(concave)),
 'witness':{'volume':420,'centroid':[86,.5,3.5]},'surfaceSolidMass':'NOT_APPLICABLE','publicProjectionRuntime':'NOT_RUN','roundingExamples':[]}
for x,y in concave:
 u=F.from_float(float((x-20)/5));v=F.from_float(float((y+11)/5))
 ru=F.from_float(float(F(4)-u));rv=F.from_float(float(F(8)-v))
 # Reversed support maps back to original UV by4-u or8-v.
 result['roundingExamples'].append({'storedUV':[str(u),str(v)],'reversedU':[str(ru),str(v)],'reversedV':[str(u),str(rv)],
 'uLiftErrorMM':nm(abs(5*(F(4)-ru-u))),'vLiftErrorMM':nm(abs(5*(F(8)-rv-v)))})
print(json.dumps(result,indent=2))
