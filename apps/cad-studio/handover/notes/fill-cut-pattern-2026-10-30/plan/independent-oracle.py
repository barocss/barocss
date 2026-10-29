from fractions import Fraction as F
import json
# Independent arithmetic oracle. Does not import production CAD code.
# This L is the union of two authored rectangles; no production winding helper is used.
def oracle(spacing_y=10, notch_x=28, columns=4, rows=3, region_far=False):
    anchor=(F(17,2),F(17,2)); dx=F(12); dy=F(spacing_y)
    cells=[]
    for j in range(rows):
        for i in range(columns):
            x,y=anchor[0]+i*dx,anchor[1]+j*dy
            admitted=(F(4)<=x<=F(52) and F(4)<=y<=F(20)) or (F(4)<=x<=F(notch_x) and F(20)<=y<=F(36))
            if region_far: admitted=False
            # The original CUT is already in the seed and is retained unconditionally.
            if (i,j)==(0,0) or admitted: cells.append((i,j,x,y))
    volume=F(60*40*10)-len(cells)*F(3*5*10)
    moments=[F(60*40*10)*F(30),F(60*40*10)*F(20),F(60*40*10)*F(5)]
    for i,j,x,y in cells:
        for k,c in enumerate((x,y,F(5))): moments[k]-=F(150)*c
    def num(x): return {'exact':str(x),'number':float(x)}
    return {'candidates':columns*rows,'retainedCuts':len(cells),'additionalCuts':len(cells)-1,
      'volumeMM3':num(volume),'centroidMM':[num(m/volume) for m in moments],
      'cells':[{'i':i,'j':j,'reference':[str(x),str(y)],'suffix':'' if (i,j)==(0,0) else '@%s,%s'%(i,j),
               'toolMin':[str(x-F(3,2)),str(y-F(5,2)),0], 'toolMax':[str(x+F(3,2)),str(y+F(5,2)),10]} for i,j,x,y in cells]}
print(json.dumps({'base':oracle(),'spacingY12':oracle(12),'notchX16':oracle(notch_x=16),'noAdditionalPlacement':oracle(region_far=True),'oneCandidate':oracle(columns=1,rows=1)},indent=2))
