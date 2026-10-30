"""Small exact arithmetic assessment on recorded public-parent outputs.
No product imports/calls and no repository writes. This is not a shipped guard.
"""
from pathlib import Path
from fractions import Fraction as F
from math import comb
import json

OUT=Path('/tmp/d340-plan/child-probe')
def q(x): return F.from_float(x) if isinstance(x,float) else F(x)
def txt(x): return {'numerator':str(x.numerator),'denominator':str(x.denominator)}
def add(a,b,sign=1):
    out=dict(a)
    for k,v in b.items(): out[k]=out.get(k,F(0))+sign*v
    return {k:v for k,v in out.items() if v}
def mul(a,b):
    out={}
    for (i,j),x in a.items():
        for (k,l),y in b.items(): out[i+k,j+l]=out.get((i+k,j+l),F(0))+x*y
    return {k:v for k,v in out.items() if v}
def deriv(a,axis):
    out={}
    for ij,v in a.items():
        n=ij[axis]
        if n:
            k=list(ij);k[axis]-=1;out[tuple(k)]=n*v
    return out
def bilinear(grid):
    a,b,c,d=grid[0][0],grid[1][0],grid[0][1],grid[1][1]
    return {(0,0):a,(1,0):b-a,(0,1):c-a,(1,1):d-b-c+a}
def bernstein(a):
    assert all(i<=2 and j<=2 for i,j in a)
    return [sum(v*F(comb(k,i),comb(2,i))*F(comb(l,j),comb(2,j))
                for (i,j),v in a.items() if i<=k and j<=l)
            for k in range(3) for l in range(3)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def sub(a,b): return [x-y for x,y in zip(a,b)]
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def assess(original,child):
    P=[[[q(x) for x in p] for p in row] for row in child['controlPoints']]
    weights=[[q(w) for w in row] for row in child['weights']]
    W=bilinear(weights)
    H=[bilinear([[weights[i][j]*P[i][j][axis] for j in range(2)] for i in range(2)]) for axis in range(3)]
    O=list(map(q,original['controlPoints'][0][0]))
    U=sub(list(map(q,original['controlPoints'][1][0])),O)
    V=sub(list(map(q,original['controlPoints'][0][1])),O)
    N=cross(U,V)
    A=[add(mul(W,deriv(h,0)),mul(h,deriv(W,0)),-1) for h in H]
    B=[add(mul(W,deriv(h,1)),mul(h,deriv(W,1)),-1) for h in H]
    C=[add(mul(A[1],B[2]),mul(A[2],B[1]),-1),add(mul(A[2],B[0]),mul(A[0],B[2]),-1),add(mul(A[0],B[1]),mul(A[1],B[0]),-1)]
    J={}
    for n,c in zip(N,C): J=add(J,{k:n*v for k,v in c.items()})
    coefficients=bernstein(J)
    corners=[P[0][0],P[1][0],P[1][1],P[0][1]]
    projected=[[dot(U,sub(p,O)),dot(V,sub(p,O))] for p in corners]
    turns=[]
    for i in range(4):
        a,b,c=projected[i],projected[(i+1)%4],projected[(i+2)%4]
        turns.append((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))
    ou=list(map(q,[original['knotsU'][1],original['knotsU'][2]]));ov=list(map(q,[original['knotsV'][1],original['knotsV'][2]]))
    cu=list(map(q,[child['knotsU'][1],child['knotsU'][2]]));cv=list(map(q,[child['knotsV'][1],child['knotsV'][2]]))
    ideal=[[[O[a]+U[a]*(u-ou[0])/(ou[1]-ou[0])+V[a]*(v-ov[0])/(ov[1]-ov[0]) for a in range(3)] for v in cv] for u in cu]
    residual=[bernstein(add(H[a],mul(W,bilinear([[ideal[i][j][a] for j in range(2)] for i in range(2)])),-1)) for a in range(3)]
    bound=max(sum(abs(residual[a][k]) for a in range(3)) for k in range(9))/min(w for row in weights for w in row)
    defect=[P[1][1][a]-P[1][0][a]-P[0][1][a]+P[0][0][a] for a in range(3)]
    return {'allPositiveWeights':all(w>0 for row in weights for w in row),'jacobianDegree':[2,2],
            'jacobianBernsteinCoefficients':list(map(txt,coefficients)),
            'allJacobianCoefficientsStrictPositive':all(x>0 for x in coefficients),
            'projectedCornerTurns':list(map(txt,turns)),
            'strictConvexProjectedBoundary':all(x>0 for x in turns),
            'wholeChildL1PositionBound':txt(bound),'positionBoundBelow1e-7':bound<=F.from_float(1e-7),
            'exactAffineFourthPoleDefect':list(map(txt,defect)),
            'exactAffineChild':all(x==0 for x in defect)}

result=[]
for case in json.loads((OUT/'results.json').read_text())['reports']:
    if case['status']!='RETURNED': continue
    result.append({'name':case['name'],'assessment':{side:assess(case['fixture']['surface'],case['result'][side]) for side in ['lower','upper']}})
(OUT/'independent-certificate.json').write_text(json.dumps({'scope':'exact arithmetic over captured public-parent outputs; not a product guard or generic embedding proof','results':result},indent=2)+'\n')
for item in result:
    print(json.dumps({'name':item['name'],**{side:{'positiveJacobian':a['allJacobianCoefficientsStrictPositive'],'convexBoundary':a['strictConvexProjectedBoundary'],'positionBoundBelow1e-7':a['positionBoundBelow1e-7'],'exactAffineChild':a['exactAffineChild']} for side,a in item['assessment'].items()}}))
