from fractions import Fraction as F
import json
# Arithmetic only; imports no CAD, projection, display, trim, or IGES implementation.
def num(v): return {'exact':str(v),'number':float(v)}
outerArea=F(40*30); holeArea=F(10*10)
outerCenter=(F(30),F(9),F(3)); holeCenter=(F(20),F(4),F(3))
keptArea=outerArea-holeArea
keptCenter=tuple((outerArea*a-holeArea*b)/keptArea for a,b in zip(outerCenter,holeCenter))
uv=[(F(-1),F(2)),(F(1),F(2)),(F(1),F(4)),(F(-1),F(4))]
def S(u,v): return (F(20)+5*u,F(-11)+5*v,F(3))
output={'sourceSupport':{'domainU':[-2,6],'domainV':[1,7],'areaMM2':num(outerArea),'centroidMM':[num(v) for v in outerCenter]},
 'outsideHole':{'areaMM2':num(keptArea),'centroidMM':[num(v) for v in keptCenter],'volume':'NOT_APPLICABLE_OPEN_SURFACE'},
 'insideIsland':{'areaMM2':num(holeArea),'centroidMM':[num(v) for v in holeCenter],'volume':'NOT_APPLICABLE_OPEN_SURFACE'},
 'trimLossCounterexample':{'lostAreaMM2':num(holeArea),'wrongFullSupportAreaMM2':num(outerArea),
   'wrongFullSupportThickenT2VolumeMM3':num(outerArea*2),
   'hypotheticalTrimmedExtrusionT2VolumeMM3':num(keptArea*2),
   'expectedProductBehavior':'REFUSE_TRIMMED_THICKEN_NOT_CREATE_EITHER_SOLID'},
 'independentWitnessBox':{'min':[80,-3,1],'max':[92,4,6],'volumeMM3':num(F(420)),'centroidMM':[num(F(86)),num(F(1,2)),num(F(7,2))]},
 'parameterMappingForPossibleLaterReversal':{'u':[],'v':[]}}
for u,v in uv:
 output['parameterMappingForPossibleLaterReversal']['u'].append({'sourceUV':[str(u),str(v)],'mappedUV':[str(4-u),str(v)],'world':[str(x) for x in S(u,v)]})
 output['parameterMappingForPossibleLaterReversal']['v'].append({'sourceUV':[str(u),str(v)],'mappedUV':[str(u),str(8-v)],'world':[str(x) for x in S(u,v)]})
print(json.dumps(output,indent=2))
