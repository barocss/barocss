"""Test-only OCCT D1 read-back of actual exported bytes, in original knot units."""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import sys

from OCP.IGESControl import IGESControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_BSplineCurve, GeomAbs_BSplineSurface
from OCP.gp import gp_Pnt, gp_Vec


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def diagnostics(iterator):
    failures, warnings = [], []
    iterator.Start()
    while iterator.More():
        check = iterator.Value()
        failures.extend(check.CFail(i) for i in range(1, check.NbFails() + 1))
        warnings.extend(check.CWarning(i) for i in range(1, check.NbWarnings() + 1))
        iterator.Next()
    return {'failures': failures, 'warnings': warnings}


def xyz(value):
    return [value.X(), value.Y(), value.Z()]


def finite_vector(value):
    require(isinstance(value, list) and len(value) == 3
            and all(isinstance(x, (int, float)) and math.isfinite(x) for x in value),
            'Expected finite XYZ vector')
    return value


def vector_error(actual, expected):
    finite_vector(actual)
    finite_vector(expected)
    absolute = math.dist(actual, expected)
    scaled = absolute / max(1, math.hypot(*expected))
    return absolute, scaled


def compare(actual, expected, tolerance, label):
    absolute, scaled = vector_error(actual, expected)
    require(scaled <= tolerance, f'{label}: absolute={absolute}, scaled={scaled}, tolerance={tolerance}')
    return absolute, scaled


def path_and_hash(output, fixture, key):
    filename = (output / fixture['files'][key]).resolve()
    require(filename.is_relative_to(output.resolve()), 'Evidence file outside output directory')
    digest = hashlib.sha256(filename.read_bytes()).hexdigest()
    require(digest == fixture['hashes'][key], f'{key} evidence hash mismatch')
    return filename, digest


def expanded(knots, multiplicities):
    return [knot for knot, count in zip(knots, multiplicities) for _ in range(count)]


def spline_direction(spline, surface, direction=None):
    if not surface:
        degree = spline.Degree()
        knots = [spline.Knot(i) for i in range(1, spline.NbKnots() + 1)]
        multiplicities = [spline.Multiplicity(i) for i in range(1, spline.NbKnots() + 1)]
    else:
        count = spline.NbUKnots() if direction == 'u' else spline.NbVKnots()
        degree = spline.UDegree() if direction == 'u' else spline.VDegree()
        knots = [spline.UKnot(i) if direction == 'u' else spline.VKnot(i) for i in range(1, count + 1)]
        multiplicities = [spline.UMultiplicity(i) if direction == 'u' else spline.VMultiplicity(i)
                          for i in range(1, count + 1)]
    return {'degree': degree, 'knots': knots, 'multiplicities': multiplicities,
            'expandedKnots': expanded(knots, multiplicities),
            'c0InteriorKnots': [knot for knot, count in zip(knots[1:-1], multiplicities[1:-1])
                                if degree - count < 1]}


def selected_span(direction, parameter):
    """One-based adjacent DISTINCT-knot indices; no nudging or continuity repair."""
    knots = direction['knots']
    require(math.isfinite(parameter) and knots[0] <= parameter <= knots[-1], 'Parameter outside transferred domain')
    require(parameter not in direction['c0InteriorKnots'], 'Exact C0 knot derivative is intentionally unsupported')
    if parameter == knots[-1]:
        return [len(knots) - 1, len(knots)]
    for index in range(len(knots) - 1):
        if knots[index] <= parameter < knots[index + 1]:
            return [index + 1, index + 2]
    raise AssertionError('No containing transferred knot interval')


def closed_form_basis(knots, degree, count, parameter):
    """Independent fixture oracle: Bernstein Bezier or rational piecewise line.

    This deliberately does not implement the product's general basis algorithm.
    All current exchange fixtures are single-span Bezier forms or degree-one spans.
    """
    if count == degree + 1 and len(set(knots)) == 2:
        low, high = knots[degree], knots[count]
        t = (parameter - low) / (high - low)
        basis = [math.comb(degree, i) * t**i * (1 - t)**(degree - i) for i in range(count)]
        lower = [math.comb(degree - 1, i) * t**i * (1 - t)**(degree - 1 - i)
                 for i in range(degree)]
        derivatives = [degree * ((lower[i - 1] if i else 0)
                                - (lower[i] if i < degree else 0)) / (high - low)
                       for i in range(count)]
        return basis, derivatives
    require(degree == 1, 'Independent closed-form oracle supports only declared Bezier/linear fixtures')
    unique = list(dict.fromkeys(knots))
    require(count == len(unique), 'Piecewise line has unexpected knot topology')
    require(parameter not in unique[1:-1], 'Exact interior degree-one knot has no unique derivative')
    span = len(unique) - 2 if parameter == unique[-1] else next(
        i for i in range(len(unique) - 1) if unique[i] <= parameter < unique[i + 1])
    width = unique[span + 1] - unique[span]
    t = (parameter - unique[span]) / width
    basis, derivatives = [0.0] * count, [0.0] * count
    basis[span], basis[span + 1] = 1 - t, t
    derivatives[span], derivatives[span + 1] = -1 / width, 1 / width
    return basis, derivatives


def analytic_native(native, u, v=None, name=None):
    """Independent closed-form rational/polynomial fixture first derivatives."""
    if name in ('c1-repeated-curve', 'c1-repeated-surface'):
        surface = name == 'c1-repeated-surface'
        require(native['kind'] == ('surface' if surface else 'curve')
                and native['degreeU' if surface else 'degree'] == 3
                and native['knotsU' if surface else 'knots'] == [-2, -2, -2, -2, 0.5, 0.5, 3, 3, 3, 3],
                'C1 polynomial fixture requires degree three and multiplicity two at 0.5')
        weights = [value for row in native['weights'] for value in row] if surface else native['weights']
        require(all(value == 1 for value in weights), 'C1 polynomial fixture must retain unit weights')
        # The committed poles are blossom coefficients of [u,u^2,u^3].
        # Differentiate that polynomial directly, including at the exact C1 knot.
        point = [u, u*u, u*u*u]
        derivative = [1, 2*u, 3*u*u]
        if surface:
            require(native['degreeV'] == 1 and native['knotsV'] == [0, 0, 1, 1],
                    'C1 extrusion V direction changed')
            point[2] += 7*v
            return point, derivative, [0, 0, 7]
        return point, derivative
    if native['kind'] == 'curve':
        basis, derivative = closed_form_basis(native['knots'], native['degree'], len(native['controlPoints']), u)
        terms = [(basis[i], derivative[i], native['weights'][i], pole)
                 for i, pole in enumerate(native['controlPoints'])]
        w = sum(b * weight for b, _, weight, _ in terms)
        dw = sum(d * weight for _, d, weight, _ in terms)
        p = [sum(b * weight * pole[k] for b, _, weight, pole in terms) / w for k in range(3)]
        dp = [sum(d * weight * (pole[k] - p[k]) for _, d, weight, pole in terms) / w for k in range(3)]
        return p, dp
    count_u, count_v = len(native['controlPoints']), len(native['controlPoints'][0])
    bu, du = closed_form_basis(native['knotsU'], native['degreeU'], count_u, u)
    bv, dv = closed_form_basis(native['knotsV'], native['degreeV'], count_v, v)
    terms = [(bu[i] * bv[j], du[i] * bv[j], bu[i] * dv[j], native['weights'][i][j], pole)
             for i, row in enumerate(native['controlPoints']) for j, pole in enumerate(row)]
    w = sum(b * weight for b, _, _, weight, _ in terms)
    p = [sum(b * weight * pole[k] for b, _, _, weight, pole in terms) / w for k in range(3)]
    partial_u = [sum(d * weight * (pole[k] - p[k]) for _, d, _, weight, pole in terms) / w for k in range(3)]
    partial_v = [sum(d * weight * (pole[k] - p[k]) for _, _, d, weight, pole in terms) / w for k in range(3)]
    return p, partial_u, partial_v


def read_fixture(output, fixture, mode):
    native = fixture['native']
    is_surface = native['kind'] == 'surface'
    require(fixture['entity'] == (128 if is_surface else 126), 'Native/export entity mismatch')
    require(fixture['id'] == native['id'], 'Native/export ID mismatch')
    require(fixture.get('geometryVersion', 0) == 0, 'Canonical geometry version must remain zero')
    filenames, hashes = {}, {}
    for key in ('source', 'native', 'iges'):
        filenames[key], hashes[key] = path_and_hash(output, fixture, key)
    require(json.loads(filenames['native'].read_text()) == native, 'Stored native geometry differs from manifest')
    samples = fixture['samples']
    require(1 <= len(samples) <= 4096, 'Sample count outside bounded evidence workload')
    reader = IGESControl_Reader()
    settings = {'xstep.cascade.unit': 'MM', 'read.iges.bspline.continuity': 0,
                'read.precision.mode': 0, 'read.iges.faulty.entities': 0,
                'read.surfacecurve.mode': 0, 'read.iges.sequence': ''}
    for key, value in settings.items():
        success = Interface_Static.SetCVal_s(key, value) if isinstance(value, str) else Interface_Static.SetIVal_s(key, value)
        actual = Interface_Static.CVal_s(key) if isinstance(value, str) else Interface_Static.IVal_s(key)
        require(success and actual == value, f'Required consumer setting unavailable: {key}')
    require(reader.ReadFile(str(filenames['iges'])) == IFSelect_RetDone, 'IGES load failed')
    load = diagnostics(reader.WS().ModelCheckList(True))
    require(not load['failures'] and not load['warnings'], f'Unexpected load diagnostics: {load}')
    model = reader.IGESModel()
    require(model.NbEntities() == 1 and model.Entity(1).TypeNumber() == fixture['entity'], 'Unexpected entities')
    global_section = model.GlobalSection()
    require(global_section.UnitFlag() == 2 and global_section.UnitName().ToCString().strip().upper() == 'MM'
            and global_section.Scale() == 1, 'Units or model scale changed')
    require(reader.NbRootsForTransfer() == 1 and reader.TransferOneRoot(1), 'Expected one transferable root')
    transfer = diagnostics(reader.WS().TransferReader().LastCheckList())
    require(not transfer['failures'], f'Transfer failures: {transfer}')
    require(reader.NbShapes() == 1, 'Expected one transferred shape')
    shape = reader.Shape(1)
    require(shape.Location().IsIdentity(), 'Unexpected placement requires a transformed derivative consumer')
    explorer = TopExp_Explorer(shape, TopAbs_FACE if is_surface else TopAbs_EDGE)
    require(explorer.More(), 'Expected transferred curve/surface missing')
    adapter = BRepAdaptor_Surface(TopoDS.Face(explorer.Current()), True) if is_surface else BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
    require(adapter.GetType() == (GeomAbs_BSplineSurface if is_surface else GeomAbs_BSplineCurve), 'Unexpected B-spline kind')
    spline = adapter.BSpline()
    explorer.Next()
    require(not explorer.More(), 'Unexpected extra transferred geometry')
    u_direction = spline_direction(spline, is_surface, 'u')
    require(u_direction['degree'] == native['degreeU' if is_surface else 'degree']
            and u_direction['expandedKnots'] == native['knotsU' if is_surface else 'knots'], 'Transferred U degree/knots changed')
    if is_surface:
        v_direction = spline_direction(spline, True, 'v')
        require(v_direction['degree'] == native['degreeV'] and v_direction['expandedKnots'] == native['knotsV'],
                'Transferred V degree/knots changed')
        expected_domain = fixture['domain']['u'] + fixture['domain']['v']
        transferred_domain = [adapter.FirstUParameter(), adapter.LastUParameter(), adapter.FirstVParameter(), adapter.LastVParameter()]
    else:
        v_direction = None
        expected_domain = fixture['domain']
        transferred_domain = [adapter.FirstParameter(), adapter.LastParameter()]
    require(len(expected_domain) == len(transferred_domain)
            and all(abs(a - b) <= 1e-12 for a, b in zip(expected_domain, transferred_domain)), 'Transferred domain mismatch')
    expected_warnings = []
    if fixture['name'] == 'extruded-asymmetric':
        require(is_surface and native['id'] == 'oblique_wall' and u_direction['degree'] == 1
                and u_direction['expandedKnots'] == [2, 2, 3, 7, 7]
                and u_direction['c0InteriorKnots'] == [3] and not v_direction['c0InteriorKnots'],
                'Known C0 warning must have exact fixture degree/multiplicity evidence')
        expected_warnings = ['Resulting Geom_Surface is C0-continuous.']
    require(transfer['warnings'] == expected_warnings, f'Unexpected transfer warnings: {transfer}')
    local = bool(u_direction['c0InteriorKnots'] or (v_direction and v_direction['c0InteriorKnots']))
    recorded_samples = []
    maximum_point = maximum_analytic_point = maximum_derivative = maximum_analytic = maximum_oracle = 0.0
    negative_applied = False
    for sample in samples:
        u = sample['u'] if is_surface else sample['parameter']
        v = sample['v'] if is_surface else None
        u_span = selected_span(u_direction, u)
        v_span = selected_span(v_direction, v) if is_surface else None
        point = gp_Pnt()
        first, second = gp_Vec(), gp_Vec()
        if is_surface:
            if local:
                spline.LocalD1(u, v, *u_span, *v_span, point, first, second)
            else:
                adapter.D1(u, v, point, first, second)
            source_vectors = [finite_vector(sample['du']), finite_vector(sample['dv'])]
            analytic_vectors = [finite_vector(sample['analyticDu']), finite_vector(sample['analyticDv'])]
        else:
            if local:
                spline.LocalD1(u, *u_span, point, first)
            else:
                adapter.D1(u, point, first)
            source_vectors = [finite_vector(sample['derivative'])]
            analytic_vectors = [finite_vector(sample['analyticDerivative'])]
        independent = analytic_native(native, u, v, fixture['name'])
        actual_point = xyz(point)
        maximum_point = max(maximum_point, math.dist(actual_point, finite_vector(sample['point'])))
        maximum_analytic_point = max(maximum_analytic_point, math.dist(actual_point, independent[0]))
        require(maximum_point <= 1e-7 and maximum_analytic_point <= 1e-7, 'Position comparison failed')
        actual_vectors = [xyz(first), xyz(second)] if is_surface else [xyz(first)]
        for source_vector, analytic_vector, oracle in zip(source_vectors, analytic_vectors, independent[1:]):
            _, source_error = compare(source_vector, analytic_vector, 1e-9, 'Native/analytic derivative comparison failed')
            _, oracle_error = compare(analytic_vector, oracle, 1e-9, 'Analytic/independent fixture derivative comparison failed')
            maximum_analytic = max(maximum_analytic, source_error)
            maximum_oracle = max(maximum_oracle, oracle_error)
        expected = [list(vector) for vector in source_vectors]
        if mode == '--wrong-scale' and fixture['name'] == 'reparameterized-circle':
            factor = expected_domain[1] - expected_domain[0]
            require(factor != 1, 'Wrong-scale control requires a non-unit interval')
            expected = [[factor * x for x in vector] for vector in expected]
            negative_applied = True
        elif mode == '--swap-partials' and is_surface:
            expected = expected[::-1]
            negative_applied = True
        elif mode == '--negate-curve' and not is_surface:
            expected = [[-x for x in vector] for vector in expected]
            negative_applied = True
        deviations = []
        for actual_vector, expected_vector in zip(actual_vectors, expected):
            absolute, scaled = compare(actual_vector, expected_vector, 1e-7, 'Derivative comparison failed')
            maximum_derivative = max(maximum_derivative, scaled)
            deviations.append({'absoluteMMPerParameter': absolute, 'scaled': scaled})
        recorded_samples.append({'parameter': u, **({'v': v} if is_surface else {}),
            'method': 'Geom_BSpline.LocalD1' if local else 'BRepAdaptor.D1',
            'distinctKnotIntervalU': u_span, 'distinctKnotIntervalV': v_span,
            'point': actual_point, 'derivatives': actual_vectors, 'sourceDerivatives': source_vectors,
            'analyticDerivatives': analytic_vectors, 'independentFixtureDerivatives': independent[1:], 'deviations': deviations})
    return {'name': fixture['name'], 'id': native['id'], 'entity': fixture['entity'],
        'sourceVersion': fixture.get('sourceVersion', 0), 'geometryVersion': 0,
        'constructions': fixture.get('constructions', []), 'hashes': hashes, 'files': fixture['files'],
        'sourceDomain': fixture['domain'], 'transferredDomain': transferred_domain,
        'nativeDegreeU': native['degreeU' if is_surface else 'degree'],
        'nativeKnotsU': native['knotsU' if is_surface else 'knots'],
        'nativeDegreeV': native.get('degreeV'), 'nativeKnotsV': native.get('knotsV'),
        'transferredU': u_direction, 'transferredV': v_direction, 'samples': recorded_samples,
        'sampleCount': len(recorded_samples), 'maxPointDeviationMM': maximum_point,
        'maxIndependentPointDeviationMM': maximum_analytic_point,
        'maxDerivativeScaledDeviation': maximum_derivative,
        'maxNativeAnalyticScaledDeviation': maximum_analytic,
        'maxIndependentAnalyticScaledDeviation': maximum_oracle,
        'loadDiagnostics': load, 'transferDiagnostics': transfer, 'settings': settings,
        'fileResolutionMM': global_section.Resolution(), 'units': 'MM', 'modelScale': 1,
        'roots': 1, 'healing': 'Named sequence disabled; no tolerance override or parameter perturbation',
        'negativeApplied': negative_applied}


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv) > 2 else ''
    require(mode in ('', '--wrong-scale', '--swap-partials', '--negate-curve'), 'Unsupported derivative negative mode')
    manifest = json.loads((output / 'manifest.json').read_text())
    require(1 <= len(manifest['fixtures']) <= 16, 'Fixture count outside bounded evidence workload')
    results = [read_fixture(output, fixture, mode) for fixture in manifest['fixtures']]
    # Negative controls must fail inside vector comparison, never pass silently.
    require(not mode, 'Negative derivative control did not fail vector comparison')
    report = {'base': manifest['base'], 'head': manifest['head'],
        'reader': {'cadquery-ocp': importlib.metadata.version('cadquery-ocp'), 'python': sys.version,
            'interpreter': sys.executable, 'platform': platform.platform()},
        'units': 'mm per original dimensionless knot parameter',
        'limits': {'pointMM': 1e-7, 'derivativeScaled': 1e-7, 'analyticScaled': 1e-9,
                   'scaleDefinition': 'absolute vector error / max(1, expected vector norm)'},
        'fixtureOracle': 'Independent Bernstein/piecewise-linear rational and explicit cubic-polynomial differentiation, no finite differences',
        'fixtures': results,
        'limitations': ['Selected fixtures only; no universal accuracy or regularity guarantee.',
            'LocalD1 uses exact containing distinct-knot intervals for globally C0 geometry.',
            'Exact interior C0 derivative queries are excluded, not repaired or nudged.']}
    (output / 'derivatives-readback.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
