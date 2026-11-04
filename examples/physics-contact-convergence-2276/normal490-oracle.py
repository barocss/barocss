"""Independent exact Hamilton point derivative and diagnostic-only saved support suffix."""
from fractions import Fraction as F
import json
import math
import struct
import sys

LINE = 2*1024*1024
SI,GEOMETRY = F.from_float(1e-10),F.from_float(1e-12)


class Invalid(ValueError):
    pass


def need(ok,message):
    if not ok:
        raise Invalid(message)


def number(value):
    need(type(value) in (int,float),'finite JS Number')
    value = float(value)
    need(math.isfinite(value),'finite JS Number')
    return value


def vec(value,length=3):
    need(type(value) is list and len(value) == length,'vector shape')
    return [F.from_float(number(entry)) for entry in value]


def ratio(value):
    return {'n':str(value.numerator),'d':str(value.denominator)}


def restore(value,hexadecimal):
    need(type(hexadecimal) is str and len(hexadecimal)%16 == 0 and len(hexadecimal) <= 65536*16 and
         all(char in '0123456789abcdef' for char in hexadecimal),'bounded numeric word hex')
    raw = bytes.fromhex(hexadecimal)
    at,nodes = 0,0
    def visit(item,depth):
        nonlocal at,nodes
        nodes += 1
        need(depth <= 32 and nodes <= 262144,'numeric tree bound')
        if type(item) in (int,float):
            need(at+8 <= len(raw),'missing numeric word')
            actual = struct.unpack_from('<d',raw,at)[0]; at += 8
            need(math.isfinite(actual) and actual == number(item),'finite numeric word mismatch')
            return actual
        if type(item) is list:
            return [visit(x,depth+1) for x in item]
        if type(item) is dict:
            return {key:visit(x,depth+1) for key,x in item.items()}
        need(item is None or type(item) in (bool,str),'JSON value')
        return item
    result = visit(value,0)
    need(at == len(raw),'trailing numeric word')
    return result


def product(a,b):
    aw,ax,ay,az = a; bw,bx,by,bz = b
    return [aw*bw-ax*bx-ay*by-az*bz,aw*bx+ax*bw+ay*bz-az*by,
            aw*by-ax*bz+ay*bw+az*bx,aw*bz+ax*by-ay*bx+az*bw]


def point_derivative(body,point):
    omega = [F(0)]+vec(body['angularVelocityRadps'])
    offset = [F(0)]+[p-c for p,c in zip(vec(point),vec(body['positionM']))]
    left,right = product(omega,offset),product(offset,omega)
    commutator = [(a-b)/2 for a,b in zip(left,right)]
    need(commutator[0] == 0,'pure rigid point derivative')
    return [linear+angular for linear,angular in zip(vec(body['velocityMps']),commutator[1:])]


def local_point(body,point):
    x,y,z,w = vec(body['orientationXYZW'],4)
    norm = x*x+y*y+z*z+w*w
    need(norm > 0,'nonzero physical quaternion')
    offset = [F(0)]+[p-c for p,c in zip(point,vec(body['positionM']))]
    result = product(product([w,-x,-y,-z],offset),[w,x,y,z])
    need(result[0] == 0,'pure inverse physical action')
    return [value/norm for value in result[1:]]


def suffix_audit(data):
    suffix,model = data['observedSuffix'],data['model']
    need(suffix['startStep'] == 384 and suffix['endStep'] == 489 and suffix['qualifiesWindow'] is False,'fixed diagnostic suffix')
    states = suffix['states']
    need(type(states) is list and len(states) == 106,'complete observed384–489 suffix')
    definitions = model['bodies']
    dynamic = sorted([b for b in definitions if b['kind'] == 'dynamic'],key=lambda body:number(body['initial']['positionM'][1]))
    fixed = [b for b in definitions if b['kind'] == 'static']
    need(len(dynamic) == 3 and len(fixed) == 1,'fixed three cube/floor model')
    moving,floor = [body['id'] for body in dynamic],fixed[0]['id']
    colliders = {c['bodyId']:c for c in model['colliders']}
    halves = {bid:vec(c['geometry']['halfExtentsM']) for bid,c in colliders.items()}
    top = vec(fixed[0]['initial']['positionM'])[1]+halves[floor][1]
    targets = {}
    for bid in moving:
        targets[bid] = top+halves[bid][1]
        top = targets[bid]+halves[bid][1]
    chain = [floor]+moving
    edges = {frozenset((chain[i],chain[i+1])):i for i in range(3)}
    maxima,violations = {},[]
    step,bid = None,None
    def gate(name,residual,limit=SI):
        residual = abs(residual)
        maxima[name] = max(maxima.get(name,F(0)),residual)
        if residual > limit and len(violations) < 32:
            violations.append({'stepIndex':step,'bodyId':bid,'gate':name,'residual':float(residual),'limit':float(limit)})
    for index,state in enumerate(states):
        cursor = number(state['stepIndex'])
        need(cursor.is_integer() and cursor == 384+index,'contiguous saved suffix cursor')
        step = int(cursor)
        bodies = {body['id']:body for body in state['bodies']}
        need(set(bodies) == set(chain),'all diagnostic bodies')
        for bid,body in bodies.items():
            position = vec(body['positionM'])
            target = targets[bid] if bid in moving else vec(fixed[0]['initial']['positionM'])[1]
            gate('supportedPositionM',position[1]-target)
            for axis in (0,2):
                gate('lateralPositionM',position[axis])
            for value in vec(body['velocityMps']):
                gate('supportedVelocityMps',value)
            for value in vec(body['angularVelocityRadps']):
                gate('supportedOmegaRadps',value)
            orientation = vec(body['orientationXYZW'],4)
            positive = max(abs(a-b) for a,b in zip(orientation,[0,0,0,1]))
            negative = max(abs(a+b) for a,b in zip(orientation,[0,0,0,1]))
            gate('authoredIdentityPhysicalComponent',min(positive,negative))
            gate('orientationSquaredNorm',sum((q*q for q in orientation),F(0))-1,GEOMETRY)
        for contact in state['contacts']:
            a,b = contact['bodyAId'],contact['bodyBId']
            need(a in bodies and b in bodies and a != b,'diagnostic contact schema')
            edge = edges.get(frozenset((a,b)))
            if edge is None:
                violations.append({'stepIndex':step,'gate':'unexpectedObservedContactEdge','bodyId':None})
                continue
            low,high = chain[edge],chain[edge+1]
            normal,point = vec(contact['normalAtoB']),vec(contact['pointM'])
            bid = None
            for value,target in zip(normal,[0,1 if a == low else -1,0]):
                gate('geometryNormalDirection',value-target,GEOMETRY)
            gate('geometryNormalSquared',sum((value*value for value in normal),F(0))-1,GEOMETRY)
            for bid,side in ((low,1),(high,-1)):
                local = local_point(bodies[bid],point)
                gate('geometryRepresentativeFacePlaneM',local[1]-side*halves[bid][1],GEOMETRY)
                for coordinate,extent in zip(local,halves[bid]):
                    gate('geometryRepresentativeBoundsM',max(F(0),abs(coordinate)-extent),GEOMETRY)
    violations.sort(key=lambda item:item['stepIndex'])
    return {'scope':'DIAGNOSTIC_ONLY_SAVED_OBSERVED_SUFFIX','startStep':384,'endStep':489,
            'observedStates':106,'qualifiesWindow':False,'independentFullTrajectoryAccepted':0,
            'earliestObservedInSavedSuffix':violations[0] if violations else None,'violations':violations[:32],
            'maxima':{key:float(value) for key,value in maxima.items()},
            'noObservedGateViolationInThisAudit':not violations,'production490Accepted':False}


def verify(data):
    need(data['caseId'] == 'long-three-post-normal-490','fixed captured case')
    observer = data['observer']
    need(observer['capture']['acceptedStep'] == 489 and observer['capture']['nextStep'] == 490,'actual post-G1 phase')
    need(observer['caught']['code'] == 'NUMERIC_LIMIT' and observer['caught']['message'] ==
         'frictionless island: fresh post contact normal feasibility','original error')
    actual = observer['failedPostNormal']
    need(actual['phase'] == 'WORKING_AFTER_POSITION_BEFORE_RETURN' and actual['predicate'] is False,'actual post false predicate')
    index = number(actual['pointIndex'])
    need(index.is_integer() and 0 <= index < len(actual['geometry']['points']),'actual post point index')
    need(actual['point'] == actual['geometry']['points'][int(index)],'actual post point link')
    point,normal = actual['point']['midpointM'],vec(actual['normal'])
    velocity_a,velocity_b = point_derivative(actual['a'],point),point_derivative(actual['b'],point)
    relative = [b-a for a,b in zip(velocity_a,velocity_b)]
    exact_speed = sum((a*b for a,b in zip(relative,normal)),F(0))
    recorded = F.from_float(number(actual['speed']))
    limit = F.from_float(number(actual['SI']))
    need(limit == SI,'original SI gate')
    need(recorded < -limit,'recorded false guard reproduced')
    actual_a,actual_b,actual_relative = vec(actual['pointVelocityA']),vec(actual['pointVelocityB']),vec(actual['relative'])
    float_operand_speed = sum((a*b for a,b in zip(actual_relative,normal)),F(0))
    audit = suffix_audit(data)
    return {'resolved':True,'executionFailure':False,'status':'NORMAL_490_EXACT_DIAGNOSTIC_CONFIRMED',
        'recordedFloatGuardRejects':True,'pair':[actual['a']['id'],actual['b']['id']],'pointIndex':int(index),
        'pointKey':actual['point'].get('key'),'pointM':point,'normal':actual['normal'],
        'exactPointVelocityARatios':[ratio(x) for x in velocity_a],'exactPointVelocityBRatios':[ratio(x) for x in velocity_b],
        'exactRelativeRatios':[ratio(x) for x in relative],'exactNormalSpeedRatio':ratio(exact_speed),
        'recordedNormalSpeedRatio':ratio(recorded),'recordedNormalSpeedMps':float(recorded),
        'exactNormalSpeedMps':float(exact_speed),'originalClosingLimitMps':float(limit),
        'exactClosingExcessRatio':ratio(max(F(0),-exact_speed-limit)),
        'exactClosingExceedsOriginalGate':exact_speed < -limit,
        'pointVelocityARoundoffRatios':[ratio(a-b) for a,b in zip(actual_a,velocity_a)],
        'pointVelocityBRoundoffRatios':[ratio(a-b) for a,b in zip(actual_b,velocity_b)],
        'relativeSubtractRoundoffRatios':[ratio(actual_relative[i]-(actual_b[i]-actual_a[i])) for i in range(3)],
        'floatDotRoundoffRatio':ratio(recorded-float_operand_speed),'totalFloatSpeedRoundoffRatio':ratio(recorded-exact_speed),
        'firstDetectedEngineRefusalStep':490,'suffixAudit':audit,'qualifiesWindow':False,
        'independentFullTrajectoryAccepted':0,'worldCalls':0,'candidateImports':0,'extraSolverCalls':0,'native490':'NOT_RUN'}


def main():
    try:
        raw = sys.stdin.buffer.readline(LINE+1)
        need(0 < len(raw) <= LINE and raw.endswith(b'\n') and sys.stdin.buffer.read(1) == b'','one bounded request+EOF')
        packet = json.loads(raw)
        need(packet['format'] == 'post-normal-490-v1','diagnostic wire format')
        reply = verify(restore(packet['data'],packet['numericWordsF64leHex']))
    except (Invalid,KeyError,TypeError,ValueError,IndexError,OverflowError,ZeroDivisionError) as error:
        reply = {'resolved':False,'executionFailure':True,'status':'INVALID_DIAGNOSTIC','reason':str(error),'qualifiesWindow':False}
    encoded = json.dumps(reply,separators=(',',':'),allow_nan=False)
    need(len(encoded.encode()) <= 65536,'64KiB reply cap')
    print(encoded)


if __name__ == '__main__':
    main()
