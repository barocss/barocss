"""Read-only independent diagnosis of one preserved binary64 line failure.

No candidate imports, SAT, polygon clipping, edge solver or new physics calls.
"""
import hashlib
import json
import struct
import sys
from fractions import Fraction as F
from pathlib import Path


PINNED = {
    'candidate.ts': '15a1931ed4fc5cc91bbae4fde700258a039aa3e081c128bc61030474de38200d',
    'build.mjs': '224cc40840207e8c5620fc809132a8b952ef58c5531fb7cbbd639e92c10c8557',
    'run.mjs': '908a1a10cf369e52397f53d252aaeb7c58dde9107b0fb234062a3dc4b5e3e500',
    'evidence/run-03/source-00-failure-pre-1-input.json': '5ff1fa80ef895e7b80d380b9686fb6a84411877072b15c943111a6acd09ad934',
    'evidence/run-03/source-00-failure-pre-1-output.json': 'd142ab17da92628e9b98a05e2e7f08f71e4b162f009cd9900ca7d9404d91e58a',
}


def need(condition, message):
    if not condition:
        raise ValueError(message)


def fv(values):
    return [F.from_float(float(x)) for x in values]


def add(a, b):
    return [x+y for x, y in zip(a, b)]


def sub(a, b):
    return [x-y for x, y in zip(a, b)]


def scale(a, value):
    return [x*value for x in a]


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), F(0))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def hamilton(a, b):
    return add(add(scale(b[:3], a[3]), scale(a[:3], b[3])), cross(a[:3], b[:3])) + [a[3]*b[3]-dot(a[:3], b[:3])]


def rotate(box, vector, inverse=False):
    q = fv(box['orientationXYZW'])
    conjugate = [-q[0], -q[1], -q[2], q[3]]
    norm_squared = dot(q, q)
    need(norm_squared > 0, 'ZERO_SAVED_QUATERNION')
    left, right = (conjugate, q) if inverse else (q, conjugate)
    return [x/norm_squared for x in hamilton(hamilton(left, vector+[F(0)]), right)[:3]]


def local(box, point):
    return rotate(box, sub(point, fv(box['positionM'])), True)


def word(value):
    return struct.pack('>d', float(value)).hex()


def authenticate_words(packet, payload, counts):
    for path, expected in packet['words'].items():
        current = payload
        for key in path.split('/')[1:]:
            current = current[int(key)] if isinstance(current, list) else current[key]
        need(word(current) == expected, 'SAVED_WORD_MAP_MISMATCH:'+path)
        counts['authenticatedSavedWords'] += 1


def slab_interval(box, point, direction):
    origin = local(box, point)
    velocity = rotate(box, direction, True)
    lower = upper = None
    lower_axis = upper_axis = None
    slabs = []
    zero_failures = []
    half = fv(box['halfExtentsM'])
    for axis, (x, v, h) in enumerate(zip(origin, velocity, half)):
        row = {'axis': axis, 'originExact': str(x), 'directionExact': str(v),
               'halfExtentExact': str(h), 'originSlackExact': str(h-abs(x))}
        if v == 0:
            row['zeroDirection'] = True
            row['insideUnshiftedSlab'] = abs(x) <= h
            if abs(x) > h:
                zero_failures.append({'axis': axis, 'outsideExact': str(abs(x)-h),
                                      'outsideApproxM': float(abs(x)-h)})
        else:
            lo, hi = sorted([(-h-x)/v, (h-x)/v])
            row.update(lowerExact=str(lo), upperExact=str(hi), zeroDirection=False)
            if lower is None or lo > lower:
                lower, lower_axis = lo, axis
            if upper is None or hi < upper:
                upper, upper_axis = hi, axis
        slabs.append(row)
    exists = not zero_failures and lower is not None and upper is not None and lower <= upper
    diagnostic = {'boxId': box['id'], 'exists': exists, 'slabs': slabs,
                  'lowerAxis': lower_axis, 'upperAxis': upper_axis,
                  'lowerExact': None if lower is None else str(lower),
                  'upperExact': None if upper is None else str(upper)}
    if zero_failures:
        diagnostic.update(failure='ZERO_DIRECTION_OUTSIDE_NATIVE_SLAB', zeroFailures=zero_failures)
    elif lower is None or upper is None:
        diagnostic['failure'] = 'NO_FINITE_NATIVE_INTERVAL'
    elif lower > upper:
        at_upper = [x+v*upper for x, v in zip(origin, velocity)]
        at_lower = [x+v*lower for x, v in zip(origin, velocity)]
        diagnostic.update(failure='INCOMPATIBLE_NATIVE_SLAB_BOUNDS',
                          parameterGapExact=str(lower-upper),
                          parameterGapApprox=float(lower-upper),
                          violationsAtUpper=[{'axis': i, 'outsideExact': str(max(F(0), abs(x)-h)),
                                              'outsideApproxM': float(max(F(0), abs(x)-h))}
                                             for i, (x, h) in enumerate(zip(at_upper, half))],
                          violationsAtLower=[{'axis': i, 'outsideExact': str(max(F(0), abs(x)-h)),
                                              'outsideApproxM': float(max(F(0), abs(x)-h))}
                                             for i, (x, h) in enumerate(zip(at_lower, half))])
    return (lower, upper) if exists else None, diagnostic


def rounded_coordinates(point, counts):
    rows = []
    for field, key in [('aPointM', 'a'), ('bPointM', 'b'), ('pointM', 'midpoint')]:
        for axis, (actual, exact) in enumerate(zip(point[field], point['exact'][key])):
            rational = F(exact)
            expected = float(rational)
            same = word(actual) == word(expected)
            counts['roundingCoordinates'] += 1
            counts['correctlyRoundedCoordinates'] += int(same)
            rows.append({'field': field, 'axis': axis, 'exact': str(rational),
                         'actualWord': word(actual), 'expectedNearestEvenWord': word(expected),
                         'correctlyRounded': same,
                         'presentationErrorExact': str(F.from_float(float(actual))-rational)})
    return rows


def audit(directory):
    home = Path(__file__).resolve().parent
    counts = {'savedCases': 0, 'authenticatedSavedWords': 0, 'retainedPoints': 0, 'exactCertificatesVerified': 0,
              'roundingCoordinates': 0, 'correctlyRoundedCoordinates': 0,
              'normalCoordinates': 0, 'correctlyRoundedNormalCoordinates': 0,
              'representedLinesChecked': 0, 'representedLinesHitBoth': 0,
              'representedLinesMissNativeBox': 0, 'originalP4RowsAnalyzed': 0}
    rows = []
    pins = {}
    try:
        need(directory.resolve() == (home/'evidence/run-03').resolve(), 'ONLY_FROZEN_RUN03_IS_ALLOWED')
        for relative, expected in PINNED.items():
            data = (home/relative).read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            pins[relative] = {'bytes': len(data), 'sha256': actual}
            need(actual == expected, 'FROZEN_INPUT_DRIFT:'+relative)
        input_packet = json.loads((directory/'source-00-failure-pre-1-input.json').read_text())
        output_packet = json.loads((directory/'source-00-failure-pre-1-output.json').read_text())
        pair = input_packet['input']
        result = output_packet['result']
        authenticate_words(input_packet, pair, counts)
        authenticate_words(output_packet, result, counts)
        need(pair['id'] == 'failure-pre-1', 'WRONG_SAVED_CASE')
        need(result['status'] == 'UNRESOLVED' and result['stage'] == 'FLOAT_PRESENTATION', 'WRONG_SAVED_FAILURE_STAGE')
        need(result['reason'] == 'FLOAT_PRESENTATION_LINE_MISSES_NATIVE_BOX', 'WRONG_SAVED_FAILURE_REASON')
        need(result['presentationPointId'] == 'FACE:4:2', 'WRONG_SAVED_FAILURE_POINT')
        construction = result['construction']
        exact_n = [F(x) for x in construction['exactNormalDirection']]
        normal = fv(construction['normal'])
        need(dot(exact_n, exact_n) == 1, 'SAVED_FACE_DIRECTION_IS_NOT_EXACTLY_UNIT')
        normal_rounding = []
        for axis, (actual, exact) in enumerate(zip(construction['normal'], exact_n)):
            same = word(actual) == word(float(exact))
            counts['normalCoordinates'] += 1
            counts['correctlyRoundedNormalCoordinates'] += int(same)
            normal_rounding.append({'axis': axis, 'actualWord': word(actual),
                                    'expectedNearestEvenWord': word(float(exact)), 'correctlyRounded': same})
        counts['savedCases'] = 1
        need(len(construction['points']) <= 4, 'SAVED_POINT_BOUND')
        for index, point in enumerate(construction['points']):
            counts['retainedPoints'] += 1
            pa, pb, mid = ([F(x) for x in point['exact'][key]] for key in ['a', 'b', 'midpoint'])
            checks = {'exactMidpoint': mid == scale(add(pa, pb), F(1, 2)),
                      'exactNormalParallelism': cross(sub(pb, pa), exact_n) == [0, 0, 0]}
            surface_rows = []
            for box, endpoint in [(pair['a'], pa), (pair['b'], pb)]:
                slacks = [h-abs(x) for h, x in zip(fv(box['halfExtentsM']), local(box, endpoint))]
                on_surface = all(x >= 0 for x in slacks) and min(slacks) == 0
                surface_rows.append({'boxId': box['id'], 'slacksExact': [str(x) for x in slacks],
                                     'insideAllSixAndOnSurface': on_surface})
            checks['nativeTwelveHalfspacesAndSurfaces'] = all(r['insideAllSixAndOnSurface'] for r in surface_rows)
            ia, exact_a = slab_interval(pair['a'], mid, exact_n)
            ib, exact_b = slab_interval(pair['b'], mid, exact_n)
            checks['exactNativeLineExits'] = ia is not None and ib is not None and add(mid, scale(exact_n, ia[1])) == pa and add(mid, scale(exact_n, ib[0])) == pb
            exact_verified = all(checks.values())
            counts['exactCertificatesVerified'] += int(exact_verified)
            rounding = rounded_coordinates(point, counts)
            represented_midpoint = fv(point['pointM'])
            fa, float_a = slab_interval(pair['a'], represented_midpoint, normal)
            fb, float_b = slab_interval(pair['b'], represented_midpoint, normal)
            line_hits = fa is not None and fb is not None
            counts['representedLinesChecked'] += 1
            counts['representedLinesHitBoth'] += int(line_hits)
            counts['representedLinesMissNativeBox'] += int(not line_hits)
            rows.append({'pointIndex': index, 'pointId': point['id'], 'exactChecks': checks,
                         'exactVerified': exact_verified, 'nativeEndpointSlacks': surface_rows,
                         'coordinateRounding': rounding,
                         'allCoordinatesCorrectlyRounded': all(r['correctlyRounded'] for r in rounding),
                         'exactIntervals': [exact_a, exact_b],
                         'representedLineHitsBoth': line_hits,
                         'representedIntervals': [float_a, float_b]})
        failed = next(r for r in rows if r['pointId'] == result['presentationPointId'])
        need(failed['exactVerified'], 'FAILED_POINT_EXACT_CERTIFICATE_NOT_VERIFIED')
        need(failed['allCoordinatesCorrectlyRounded'], 'FAILED_POINT_COORDINATES_NOT_CORRECTLY_ROUNDED')
        need(all(r['correctlyRounded'] for r in normal_rounding), 'NORMAL_NORMALIZATION_CHANGED_NEAREST_EVEN_WORD')
        need(not failed['representedLineHitsBoth'], 'SAVED_REPRESENTED_LINE_FAILURE_NOT_REPRODUCED')
        status = 'CONFIRMED_PRESENTATION_NO_GO'
        error = None
    except Exception as exception:
        status = 'PRESENTATION_DIAGNOSIS_INCONCLUSIVE'
        error = {'type': type(exception).__name__, 'message': str(exception)}
        normal_rounding = locals().get('normal_rounding', [])
    return {'status': status, 'counts': counts, 'pins': pins, 'normalRounding': normal_rounding,
            'rows': rows, 'diagnosisError': error, 'WorldCalls': 0, 'candidateCalls': 0,
            'productionGeometryCalls': 0, 'globalBinary64LineUnrepresentability': 'NOT_PROVED',
            'sourceRun03': 'ONE_ATTEMPT_TYPED_REFUSAL', 'strictNodeNextRun03': 'NOT_RUN',
            'original32Run03': 'NOT_REACHED', 'physicalDynamics': 'NOT_QUALIFIED',
            'publicBaseline': 'UNCHANGED_NO_GO', 'originalP4': 'UNCHANGED_NO_GO'}


if __name__ == '__main__':
    directory = Path(sys.argv[1])
    result = audit(directory)
    text = json.dumps(result, indent=2)+'\n'
    need(len(text.encode()) <= 1024*1024, 'AUDIT_OUTPUT_BOUND')
    with (directory/'presentation-audit.json').open('x') as output:
        output.write(text)
    print(json.dumps({'status': result['status'], 'counts': result['counts'], 'diagnosisError': result['diagnosisError']}))
    sys.exit(0 if result['status'] == 'CONFIRMED_PRESENTATION_NO_GO' else 1)
