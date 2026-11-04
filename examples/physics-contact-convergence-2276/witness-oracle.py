"""Root-only exact diagnostic of actual captured witnesses; no geometry/solver imports."""
from fractions import Fraction as F
import json
import math
import struct
import sys

LINE = 2*1024*1024


class Invalid(ValueError):
    pass


def need(ok,message):
    if not ok:
        raise Invalid(message)


def number(value):
    need(type(value) in (int,float),'finite number required')
    result = float(value)
    need(math.isfinite(result),'finite number required')
    return result


def q(value):
    return F.from_float(number(value))


def vector(value,length=3):
    need(type(value) is list and len(value) == length,'vector shape')
    return [q(entry) for entry in value]


def ratio(value):
    return {'n':str(value.numerator),'d':str(value.denominator)}


def restore(value,hexadecimal):
    need(type(hexadecimal) is str and len(hexadecimal)%16 == 0 and len(hexadecimal) <= 65536*16 and
         all(char in '0123456789abcdef' for char in hexadecimal),'bounded word hex')
    raw = bytes.fromhex(hexadecimal)
    at,nodes = 0,0
    def visit(item,depth):
        nonlocal at,nodes
        nodes += 1
        need(depth <= 32 and nodes <= 262144,'numeric tree bound')
        if type(item) in (int,float):
            need(at+8 <= len(raw),'missing word')
            actual = struct.unpack_from('<d',raw,at)[0]
            at += 8
            need(math.isfinite(actual) and actual == number(item),'finite numeric word mismatch')
            return actual
        if type(item) is list:
            return [visit(child,depth+1) for child in item]
        if type(item) is dict:
            return {key:visit(child,depth+1) for key,child in item.items()}
        need(item is None or type(item) in (str,bool),'JSON value')
        return item
    result = visit(value,0)
    need(at == len(raw),'trailing word')
    return result


def product(a,b):
    # Hamilton scalar/vector product: independent of candidate basis/dot rotation.
    aw,ax,ay,az = a
    bw,bx,by,bz = b
    return [aw*bw-ax*bx-ay*by-az*bz,aw*bx+ax*bw+ay*bz-az*by,
            aw*by-ax*bz+ay*bw+az*bx,aw*bz+ax*by-ay*bx+az*bw]


def exact_witness(body,witness,observed_local=None):
    x,y,z,w = vector(body['orientation'],4)
    quaternion,conjugate = [w,x,y,z],[w,-x,-y,-z]
    norm2 = sum((entry*entry for entry in quaternion),F(0))
    need(norm2 > 0,'nonzero physical quaternion')
    delta = [a-b for a,b in zip(vector(witness),vector(body['positionM']))]
    sandwich = product(product(conjugate,[F(0)]+delta),quaternion)
    need(sandwich[0] == 0,'pure Hamilton action')
    physical = [entry/norm2 for entry in sandwich[1:]]
    represented = [entry+(1-norm2)*offset for entry,offset in zip(sandwich[1:],delta)]
    extents,tolerance = vector(body['shape']['halfExtentsM']),F.from_float(1e-12)
    excess = [abs(value)-extent for value,extent in zip(physical,extents)]
    represented_excess = [abs(value)-extent for value,extent in zip(represented,extents)]
    report = {'bodyId':body['id'],'quaternionNormSquared':ratio(norm2),
        'physicalLocalRatios':[ratio(value) for value in physical],
        'representedLocalRatios':[ratio(value) for value in represented],
        'physicalExcessBeyondExtentM':[float(value) for value in excess],
        'physicalExcessBeyondToleranceRatios':[ratio(value-tolerance) for value in excess],
        'representedExcessBeyondExtentM':[float(value) for value in represented_excess],
        'physicalInsideOriginalTolerance':all(value <= tolerance for value in excess)}
    if observed_local is not None:
        observed = vector(observed_local)
        thresholds = [F.from_float(float(extent+tolerance)) for extent in extents]
        report.update({'observedFloatLocalRatios':[ratio(value) for value in observed],
            'floatLocalRoundoffRatios':[ratio(actual-exact) for actual,exact in zip(observed,represented)],
            'roundedThresholdRatios':[ratio(value) for value in thresholds],
            'thresholdRoundingRatios':[ratio(actual-(extent+tolerance)) for actual,extent in zip(thresholds,extents)],
            'floatPredicateRejects':any(abs(value) > threshold for value,threshold in zip(observed,thresholds))})
    return report


def verify(data):
    need(data['caseId'] == 'long-three-479','diagnostic case')
    observer = data['observer']
    need(observer['capture']['acceptedStep'] == 478 and observer['capture']['nextStep'] == 479,'actual captured phase')
    need(observer['caught']['code'] == 'NUMERIC_LIMIT' and
         observer['caught']['message'] == 'private feature contact requires valid box witnesses','original refusal')
    pair = observer.get('featureFailure') or observer.get('faceContext') or observer.get('currentPair')
    need(type(pair) is dict and type(pair.get('a')) is dict and type(pair.get('b')) is dict,'actual failed pair')
    a,b = pair['a'],pair['b']
    points,reports,gaps = [],[],[]
    failed = observer.get('failedWitness')
    if failed:
        report = exact_witness(failed['body'],failed['witness'],failed['local'])
        report['source'] = 'ACTUAL_REACHED_WITNESS_INSIDE_FALSE'
        reports.append(report)
        need(report['floatPredicateRejects'],'captured false witness predicate reproduced')
    feature = observer.get('featureFailure') or {}
    geometry = feature.get('geometry') or {}
    for point in geometry.get('points',[]):
        points.append(('RETURNED_GEOMETRY_POINT',point,geometry.get('planeNormalAtoB')))
    last = observer.get('lastPoint')
    if last:
        points.append(('LAST_ACTUAL_POINT_CONSTRUCTOR',last['result'],last['normal']))
    face_point = observer.get('facePoint') or {}
    for key in ('original','lastCandidate'):
        if face_point.get(key):
            points.append(('FACE_'+key.upper(),face_point[key],None))
    need(len(points) <= 16,'bounded captured points')
    for source,point,normal in points:
        for body,witness in ((a,point['witnessAM']),(b,point['witnessBM'])):
            report = exact_witness(body,witness)
            report.update({'source':source,'pointKey':point.get('key')})
            reports.append(report)
        if normal is not None:
            delta = [right-left for left,right in zip(vector(point['witnessAM']),vector(point['witnessBM']))]
            exact_gap = sum((value*axis for value,axis in zip(delta,vector(normal))),F(0))
            gaps.append({'source':source,'pointKey':point.get('key'),'exactNormalGapRatio':ratio(exact_gap),
                'observedGapRatio':ratio(q(point['normalGapM'])),'gapRoundoffRatio':ratio(q(point['normalGapM'])-exact_gap),
                'exactGapWithinOriginalTolerance':exact_gap <= F.from_float(1e-12)})
    available = bool(reports)
    return {'resolved':True,'executionFailure':False,
        'status':'WITNESS_479_EXACT_DIAGNOSTIC_CONFIRMED' if available else 'POINT_UNAVAILABLE',
        'pointAvailable':available,'failedPair':[a['id'],b['id']],
        'reachedSite':(observer.get('faceFailure') or observer.get('pointFailure') or feature).get('site'),
        'failedWitnessInsideReached':failed is not None,'faceRoundingStep':face_point.get('roundingStep'),
        'faceCertification':observer.get('faceCertification'),'witnesses':reports,'normalGaps':gaps,
        'allReportedPhysicalWitnessesInsideTolerance':all(report['physicalInsideOriginalTolerance'] for report in reports) if available else None,
        'physicalWorldAcceptance479':False,'candidateImports':0,'solverCalls':0,'worldCalls':0}


def main():
    try:
        raw = sys.stdin.buffer.readline(LINE+1)
        need(0 < len(raw) <= LINE and raw.endswith(b'\n') and sys.stdin.buffer.read(1) == b'','one bounded request+EOF')
        packet = json.loads(raw)
        need(packet['format'] == 'contact-witness-479-v1','diagnostic format')
        reply = verify(restore(packet['data'],packet['numericWordsF64leHex']))
    except (Invalid,KeyError,TypeError,ValueError,IndexError,OverflowError,ZeroDivisionError) as error:
        reply = {'resolved':False,'executionFailure':True,'status':'INVALID_DIAGNOSTIC','pointAvailable':False,'reason':str(error)}
    encoded = json.dumps(reply,separators=(',',':'),allow_nan=False)
    need(len(encoded.encode()) <= 65536,'64KiB reply cap')
    print(encoded)


if __name__ == '__main__':
    main()
