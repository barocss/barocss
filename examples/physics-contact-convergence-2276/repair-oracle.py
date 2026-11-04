"""Independent exact Hamilton/slab/face/movement test of private captured repair."""
from fractions import Fraction as F
import json
import math
import struct
import sys

LIMIT = 2*1024*1024
TOL = F.from_float(1e-12)


class Invalid(ValueError):
    pass


def need(ok,message):
    if not ok:
        raise Invalid(message)


def number(value):
    need(type(value) in (int,float),'finite number required')
    value = float(value)
    need(math.isfinite(value),'finite number required')
    return value


def vec(value,length=3):
    need(type(value) is list and len(value) == length,'vector shape')
    return [F.from_float(number(x)) for x in value]


def ratio(value):
    return {'n':str(value.numerator),'d':str(value.denominator)}


def restore(value,hexadecimal):
    need(type(hexadecimal) is str and len(hexadecimal)%16 == 0 and len(hexadecimal) <= 65536*16 and
         all(char in '0123456789abcdef' for char in hexadecimal),'bounded numeric words')
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
            return {k:visit(x,depth+1) for k,x in item.items()}
        need(item is None or type(item) in (str,bool),'JSON value')
        return item
    result = visit(value,0)
    need(at == len(raw),'trailing numeric word')
    return result


def product(a,b):
    aw,ax,ay,az = a; bw,bx,by,bz = b
    return [aw*bw-ax*bx-ay*by-az*bz,aw*bx+ax*bw+ay*bz-az*by,
            aw*by-ax*bz+ay*bw+az*bx,aw*bz+ax*by-ay*bx+az*bw]


def local(body,value,mode,direction=False):
    x,y,z,w = vec(body['orientation'],4)
    norm = x*x+y*y+z*z+w*w
    need(norm > 0,'nonzero quaternion')
    v = vec(value)
    if not direction:
        v = [a-b for a,b in zip(v,vec(body['positionM']))]
    result = product(product([w,-x,-y,-z],[F(0)]+v),[w,x,y,z])
    need(result[0] == 0,'pure Hamilton action')
    if mode == 'normalized-physical':
        return [x/norm for x in result[1:]]
    return [x+(1-norm)*y for x,y in zip(result[1:],v)]


def interval(body,point,normal,mode):
    u,d,e = local(body,point,mode),local(body,normal,mode,True),vec(body['shape']['halfExtentsM'])
    lower,upper = [],[]
    for value,slope,extent in zip(u,d,e):
        if slope == 0:
            if abs(value) > extent:
                return None,u,d
        else:
            one,two = (-extent-value)/slope,(extent-value)/slope
            lower.append(min(one,two));upper.append(max(one,two))
    need(lower and upper,'bounded line interval')
    low,high = max(lower),min(upper)
    return ((low,high) if low <= high else None),u,d


def face_parameter(body,u,d,face):
    axis,side = number(face['axis']),number(face['side'])
    need(axis.is_integer() and 0 <= axis < 3 and side in (-1,1),'face selector')
    axis,side = int(axis),F.from_float(side)
    if d[axis] == 0:
        return None,F(0)
    return (side*vec(body['shape']['halfExtentsM'])[axis]-u[axis])/d[axis],side*d[axis]


def line(a,b,point,normal,face_a,face_b,mode):
    first,u_a,d_a = interval(a,point,normal,mode)
    second,u_b,d_b = interval(b,point,normal,mode)
    result = {'model':mode,'eachBoxLineNonempty':first is not None and second is not None,
              'strictLine':False,'selectedFaceBounds':False}
    if first is None or second is None:
        return result
    result['aInterval'] = [ratio(x) for x in first]
    result['bInterval'] = [ratio(x) for x in second]
    result['combinedIntersectionNonempty'] = max(first[0],second[0]) <= min(first[1],second[1])
    delta = (first[1]+second[0])/2
    normal2 = sum((x*x for x in vec(normal)),F(0))
    distance2 = delta*delta*normal2
    parameter_a,outward_a = face_parameter(a,u_a,d_a,face_a)
    parameter_b,outward_b = face_parameter(b,u_b,d_b,face_b)
    result.update({'strictLine':distance2 <= TOL*TOL,'surfaceMidpointDistanceSquared':ratio(distance2),
        'selectedFaceBounds':parameter_a == first[1] and parameter_b == second[0] and outward_a > 0 and outward_b < 0})
    return result


def on_face(body,face,witness,mode):
    coordinates = local(body,witness,mode)
    extents = vec(body['shape']['halfExtentsM'])
    axis,side = int(number(face['axis'])),F.from_float(number(face['side']))
    need(0 <= axis < 3 and side in (-1,1),'face selector')
    return (all(abs(x)-e <= TOL for x,e in zip(coordinates,extents)) and
            abs(coordinates[axis]-side*extents[axis]) <= TOL)


def distance2(a,b):
    return sum(((x-y)**2 for x,y in zip(vec(a),vec(b))),F(0))


def certify(data,point,face_a,face_b,original):
    models = [line(data['a'],data['b'],point['midpointM'],data['normal'],face_a,face_b,mode)
              for mode in ('normalized-physical','represented-basis')]
    face_ok = all(on_face(body,face,witness,mode) for mode in ('normalized-physical','represented-basis')
                  for body,face,witness in ((data['a'],face_a,point['witnessAM']),(data['b'],face_b,point['witnessBM'])))
    distances = [distance2(original[key],point[key]) for key in ('witnessAM','witnessBM','midpointM')]
    normal_gap = sum(((right-left)*normal for left,right,normal in zip(vec(point['witnessAM']),vec(point['witnessBM']),vec(data['normal']))),F(0))
    recorded_gap = F.from_float(number(point['normalGapM']))
    midpoint_error = [value-(a+b)/2 for value,a,b in zip(vec(point['midpointM']),vec(point['witnessAM']),vec(point['witnessBM']))]
    predicates = {'strictLine':all(row['strictLine'] for row in models),
        'selectedFaceBounds':all(row['selectedFaceBounds'] for row in models),'witnessFace':face_ok,
        'movement':all(value <= TOL*TOL for value in distances),
        'normalGap':normal_gap <= TOL and abs(recorded_gap-normal_gap) <= TOL,
        'midpointIdentity':all(abs(value) <= TOL for value in midpoint_error)}
    return {'pointKey':point['key'],'predicates':predicates,'models':models,
            'movementSquaredRatios':[ratio(value) for value in distances],'normalGapRatio':ratio(normal_gap)}


def verify(data):
    need(data['mode'] in ('positive','controls'),'private mode')
    need(data['limits'] == {'rationalOperations':200000,'integerOperations':2000000,'integerBits':16384,'roundingSteps':16},'unchanged limits')
    if data['mode'] == 'controls':
        controls = data['controls']
        need(type(controls) is list and len(controls) == 4,'fixed control count')
        answers = []
        for row in controls:
            certificate = certify(data,row['point'],row['faceA'],row['faceB'],row['original'])
            expected = row['expected']
            need(expected in certificate['predicates'],'named control predicate')
            answers.append({'name':row['name'],'expectedRejectedPredicate':expected,
                            'rejected':certificate['predicates'][expected] is False})
        ok = all(row['rejected'] for row in answers)
        return {'ok':ok,'resolved':True,'executionFailure':False,'status':'REPAIR_CONTROLS_CONFIRMED' if ok else 'CONTROL_NO_GO','controls':answers}
    geometry,originals = data['geometry'],data['originals']
    need(geometry['family'] == 'face' and len(geometry['points']) == len(originals) == 2,'same captured two-row population')
    native = data['checks']
    need(len(native) == 2 and all(all(value is True for key,value in row.items() if key != 'key') for row in native),'actual native certificates')
    certificates = [certify(data,point,data['faceA'],data['faceB'],original) for point,original in zip(geometry['points'],originals)]
    old = certify(data,data['oldPoint'],data['faceA'],data['faceB'],originals[0])
    ok = all(all(row['predicates'].values()) for row in certificates) and not old['predicates']['strictLine']
    return {'ok':ok,'resolved':True,'executionFailure':False,'status':'REPAIR_GEOMETRY_CONFIRMED' if ok else 'PHYSICAL_NO_GO',
        'points':certificates,'originalBadPoint':old,'worldCalls':0,'candidateImports':0,'slabEpsilon':0,
        'combinedIntervalOverlapRequired':False,'productionAdopted':False}


def main():
    try:
        raw = sys.stdin.buffer.readline(LIMIT+1)
        need(0 < len(raw) <= LIMIT and raw.endswith(b'\n') and sys.stdin.buffer.read(1) == b'','one bounded request+EOF')
        packet = json.loads(raw)
        need(packet['format'] == 'repair-479-v1','private wire format')
        response = verify(restore(packet['data'],packet['numericWordsF64leHex']))
    except (Invalid,KeyError,TypeError,ValueError,IndexError,OverflowError,ZeroDivisionError) as error:
        response = {'ok':False,'resolved':False,'executionFailure':True,'status':'INVALID_INPUT','reason':str(error)}
    encoded = json.dumps(response,separators=(',',':'),allow_nan=False)
    need(len(encoded.encode()) <= 65536,'64KiB reply cap')
    print(encoded)


if __name__ == '__main__':
    main()
