from fractions import Fraction as F
import json, math
# Planning arithmetic only. No production CAD import or runtime execution.
def flat(t,side):
 t=F(t); lo,hi=((-t,F(0)) if side=='reverse' else (-t/2,t/2) if side=='both' else (F(0),t))
 return {'t':str(t),'side':side,'volume':str(F(1200)*t),'centroid':['30','9',str(F(3)+(lo+hi)/2)],'bounds':{'min':['10','-6',str(F(3)+lo)],'max':['50','24',str(F(3)+hi)]}}
quarter=[]
for side,ri,ro in [('normal',8,10),('reverse',10,12),('both',9,11)]:
 quarter.append({'t':2,'side':side,'innerRadius':ri,'outerRadius':ro,'analyticVolume':math.pi*(ro*ro-ri*ri)*10/4,'analyticCentroid':[4*(ro**3-ri**3)/(3*math.pi*(ro*ro-ri*ri)),5,4*(ro**3-ri**3)/(3*math.pi*(ro*ro-ri*ri))],'proof':'PLANNING_CURVED_FACETED_APPROXIMATION_NOT_EXACT_BODY_ACCEPTANCE'})
print(json.dumps({'status':'PLANNING_ONLY','flat':[flat(t,s) for t in [2,3] for s in ['normal','reverse','both']],'quarterCylinder':quarter,'foldRefusals':[{'radius':10,'side':'normal','t':12,'expected':'CAPABILITY with OFFSET_FOLDS'},{'radius':10,'side':'both','t':21,'expected':'CAPABILITY with OFFSET_FOLDS'}],'flatNameOracle':'actual stable feature prefix plus .facet0..5 for this planar profile; verify actual grouping before claim','witness':{'bounds':{'min':[80,-3,1],'max':[92,4,6]},'volume':420,'centroid':[86,.5,3.5]}},indent=2))
