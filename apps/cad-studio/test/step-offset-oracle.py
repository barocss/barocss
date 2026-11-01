"""D419 stdlib-only sampled support-surface oracle; no product imports or solid certificate."""
import copy
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

# A frozen browser run must never create __pycache__ beside this source.
sys.dont_write_bytecode = True

# Reuse the independent D404 lexer/record reader, not the product STEP importer.
spec = importlib.util.spec_from_file_location('part21_graph', Path(__file__).with_name('part21-prism-check.py'))
graph = importlib.util.module_from_spec(spec)
spec.loader.exec_module(graph)
# D419 uses the valid alphanumeric STEP enum .CURVE_3D.; the bounded D404 lexer did not need it.
_enum = r'(?P<enum>\.[A-Z_]+\.)'
assert graph.TOKEN.pattern.count(_enum) == 1, 'independent enum lexer anchor must occur exactly once'
graph.TOKEN = re.compile(graph.TOKEN.pattern.replace(_enum, r'(?P<enum>\.[A-Z_][A-Z_0-9]*\.)'), graph.TOKEN.flags)
assert graph.tokens('.CURVE_3D.') == [('enum', '.CURVE_3D.')], 'digit-bearing enum lexical control'
TOLERANCE = 1e-7  # Physical support residual mm; no geometry-tolerance change.
VOLUME_ABSOLUTE = 1e-5  # Existing D406 scalar contract; strict author attempts are retained.
VOLUME_RELATIVE = 1e-9  # Both scalar comparisons must pass; not a solid certificate.


def basis(degree, knots, count, value):
    """Cox-de Boor basis, including the final closed domain endpoint."""
    if value == knots[count]:
        return [0.0] * (count - 1) + [1.0]
    row = [1.0 if knots[i] <= value < knots[i + 1] else 0.0 for i in range(len(knots) - 1)]
    for order in range(1, degree + 1):
        next_row = []
        for i in range(len(row) - 1):
            left = knots[i + order] - knots[i]
            right = knots[i + order + 1] - knots[i + 1]
            next_row.append((0 if not left else (value - knots[i]) * row[i] / left) +
                            (0 if not right else (knots[i + order + 1] - value) * row[i + 1] / right))
        row = next_row
    return row[:count]


def parameters(knots, degree, count):
    values = set()
    for low, high in zip(knots[degree:count], knots[degree + 1:count + 1]):
        if high > low:
            values.update(low + (high - low) * fraction for fraction in (0, .125, .25, .5, .75, .875, 1))
    return sorted(values)


def points(surface):
    cp, weights = surface['controlPoints'], surface['weights']
    nu, nv = len(cp), len(cp[0])
    assert all(len(row) == nv for row in cp), 'ragged control net'
    assert len(weights) == nu and all(len(row) == nv for row in weights), 'weight shape'
    for u in parameters(surface['knotsU'], surface['degreeU'], nu):
        bu = basis(surface['degreeU'], surface['knotsU'], nu, u)
        for v in parameters(surface['knotsV'], surface['degreeV'], nv):
            bv = basis(surface['degreeV'], surface['knotsV'], nv, v)
            total, xyz = 0.0, [0.0, 0.0, 0.0]
            for i in range(nu):
                for j in range(nv):
                    weight = bu[i] * bv[j] * weights[i][j]
                    total += weight
                    for axis in range(3):
                        xyz[axis] += weight * cp[i][j][axis]
            assert total > 0 and math.isfinite(total), 'rational denominator'
            yield [value / total for value in xyz]


def check(case):
    entities, schema = graph.records(case['step'])
    assert schema, 'missing schema'
    for ident, body in entities.items():
        for ref in graph.refs(body):
            assert ref in entities, f'dangling reference #{ref} from #{ident}'
    offsets = [body for body in entities.values() if graph.name(body) == 'OFFSET_SURFACE']
    assert len(offsets) == 1, 'exactly one selected OFFSET source entity'
    flags = [value for kind, value in offsets[0] if kind == 'enum']
    assert flags == ['.' + case['selfIntersect'] + '.'], 'source advisory flag does not match case'
    kind = case['kind']
    expected_volume = 24 if kind == 'plane' else 1440 * math.pi
    expected_bounds = [0, 0, 0, 4, 3, 2] if kind == 'plane' else [-12, -12, 0, 12, 12, 10]
    volume_error = abs(case['volume'] - expected_volume)
    assert volume_error <= VOLUME_ABSOLUTE and volume_error / abs(expected_volume) <= VOLUME_RELATIVE, 'physical analytic volume comparison'
    assert len(case['bounds']) == 6, 'physical bounds shape'
    assert all(abs(a - b) <= TOLERANCE for a, b in zip(case['bounds'], expected_bounds)), 'physical literal bounds'
    assert len(case['surfaces']) == (1 if kind == 'plane' else 2), 'selected support count'
    samples, maximum = 0, 0.0
    support_extents = []
    for surface in case['surfaces']:
        z_values = []
        for point in points(surface):
            residual = abs(point[2] - 2) if kind == 'plane' else abs(math.hypot(point[0], point[1]) - 12)
            assert residual <= TOLERANCE, f'{kind} support residual {residual}mm'
            if kind == 'cylinder':
                z_values.append(point[2])
            samples += 1
            maximum = max(maximum, residual)
        if kind == 'cylinder':
            extent = [min(z_values), max(z_values)]
            assert extent[0] <= TOLERANCE and extent[1] >= 10 - TOLERANCE, 'support must cover both literal trim heights'
            support_extents.append(extent)
    assert samples > 0, 'no support samples'
    return {'name': case['name'], 'kind': kind, 'samples': samples, 'maximumResidual': maximum,
            'sampledSupportZExtents': support_extents,
            'supportIsNotTrimmedFace': True, 'expectedVolume': expected_volume, 'observedVolume': case['volume'],
            'volumeAbsoluteError': volume_error, 'volumeRelativeError': volume_error / abs(expected_volume), 'scope': 'sampled selected complete support nets; analytic volume comparison only'}


def selftest(cases):
    plane = next(case for case in cases if case['kind'] == 'plane')
    cylinder = next(case for case in cases if case['kind'] == 'cylinder')
    controls = {}
    for name, original, factor, axis in [
        ('plane-coordinate', plane, None, 2),
        ('cylinder-radius', cylinder, 1.1, None),
        ('unit-double-scale', cylinder, 10, None),
        ('offset-sign-or-advisory-T-misread', cylinder, 8 / 12, None),
    ]:
        changed = copy.deepcopy(original)
        for surface in changed['surfaces']:
            for row in surface['controlPoints']:
                for point in row:
                    if axis is not None:
                        point[axis] += .25
                    else:
                        point[0] *= factor
                        point[1] *= factor
        try:
            check(changed)
        except AssertionError as error:
            controls[name] = str(error)
        else:
            raise AssertionError('negative control survived: ' + name)
    changed = copy.deepcopy(cylinder)
    # Append a graph-valid statement shape with a deliberately dangling reference.
    end = changed['step'].rfind('ENDSEC;')
    assert end >= 0, 'DATA end marker'
    changed['step'] = changed['step'][:end] + "#999999=SHAPE_REPRESENTATION('',(#999998),#999998);\n" + changed['step'][end:]
    assert changed['step'] != cylinder['step'], 'broken graph control anchor'
    try:
        check(changed)
    except AssertionError as error:
        controls['broken-source-graph'] = str(error)
    else:
        raise AssertionError('negative control survived: broken-source-graph')
    return controls


if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        cases = payload['cases']
        results = [check(case) for case in cases]
        flags = {case['selfIntersect'] for case in cases if case['kind'] == 'cylinder'}
        assert flags == {'T', 'F', 'U'}, 'advisory T/F/U coverage must use actual generated nets'
        print(json.dumps({'status': 'PASS', 'results': results, 'negativeControls': selftest(cases),
                          'advisoryFlags': sorted(flags), 'digitEnumLexicalControl': 'PASS', 'tolerance': TOLERANCE,
                          'volumeAbsoluteTolerance': VOLUME_ABSOLUTE, 'volumeRelativeTolerance': VOLUME_RELATIVE, 'productImports': 0,
                          'lengthUnit': 'mm', 'volumeUnit': 'mm^3',
                          'thirdPartyReader': False, 'globalSurfaceOrSolidCertificate': False}, indent=2))
    except (AssertionError, ValueError, KeyError) as error:
        print(json.dumps({'status': 'FAIL', 'error': str(error)}))
        sys.exit(1)
