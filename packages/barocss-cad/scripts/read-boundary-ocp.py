"""Independent installed OCCT consumer for four mapped native boundary curves."""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import runpy
import sys

from OCP.IGESControl import IGESControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_EDGE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.GeomAbs import GeomAbs_BSplineCurve
from OCP.gp import gp_Pnt, gp_Vec

# Reuse only the committed independent fixture oracle/consumer utilities. The
# native engine is never imported. The fixed sibling filename is not source data.
utilities_path = Path(__file__).with_name('read-derivatives-ocp.py')
utilities = runpy.run_path(str(utilities_path))
require = utilities['require']
diagnostics = utilities['diagnostics']
xyz = utilities['xyz']
finite_vector = utilities['finite_vector']
vector_error = utilities['vector_error']
spline_direction = utilities['spline_direction']
selected_span = utilities['selected_span']
analytic_native = utilities['analytic_native']


def evidence_path(output, relative):
    filename = (output / relative).resolve()
    require(filename.is_relative_to(output.resolve()), 'Evidence file outside output directory')
    return filename


def hash_file(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def curve_from_reader(reader, root):
    require(reader.TransferOneRoot(root), 'Boundary root transfer failed')
    transfer = diagnostics(reader.WS().TransferReader().LastCheckList())
    require(not transfer['failures'] and not transfer['warnings'], f'Unexpected boundary transfer diagnostics: {transfer}')
    shape = reader.Shape(reader.NbShapes())
    require(shape.Location().IsIdentity(), 'Boundary placement unexpectedly changed')
    explorer = TopExp_Explorer(shape, TopAbs_EDGE)
    require(explorer.More(), 'Boundary edge missing')
    adapter = BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
    require(adapter.GetType() == GeomAbs_BSplineCurve, 'Expected boundary B-spline curve')
    explorer.Next()
    require(not explorer.More(), 'Unexpected extra edge in boundary root')
    return adapter, transfer


def mapped_surface_sample(surface, edge, parameter):
    count_u, count_v = len(surface['controlPoints']), len(surface['controlPoints'][0])
    u0, u1 = surface['knotsU'][surface['degreeU']], surface['knotsU'][count_u]
    v0, v1 = surface['knotsV'][surface['degreeV']], surface['knotsV'][count_v]
    selector = edge['boundary']
    if selector == 'v-min':
        return parameter, v0, [u0, u1], 'increasing', 1, 1
    if selector == 'u-max':
        return u1, parameter, [v0, v1], 'increasing', 2, 1
    if selector == 'v-max':
        return u0 + (u1 - parameter), v1, [u0, u1], 'decreasing', 1, -1
    require(selector == 'u-min', 'Unsupported boundary selector')
    return u0, v0 + (v1 - parameter), [v0, v1], 'decreasing', 2, -1


def read_fixture(output, fixture, mode):
    files, hashes = {}, {}
    for key in ('source', 'surface', 'iges', 'mapping'):
        files[key] = evidence_path(output, fixture['files'][key])
        hashes[key] = hash_file(files[key])
        require(hashes[key] == fixture['hashes'][key], f'{key} evidence hash mismatch')
    surface = fixture['surface']
    require(json.loads(files['surface'].read_text()) == surface, 'Stored surface differs from manifest')
    mapping_document = json.loads(files['mapping'].read_text())
    edges = fixture['boundaries']
    require(len(edges) == 4 and [edge['boundary'] for edge in edges] == ['v-min', 'u-max', 'v-max', 'u-min'],
            'Expected all four boundaries in declared parameter traversal order')
    expected_mapping = {'surfaceId': surface['id'], 'boundaries': [
        {key: edge[key] for key in ('boundary', 'curveId', 'surfaceId', 'parameterDirection',
                                    'originalDomain', 'native', 'exportMapping')} for edge in edges]}
    require(mapping_document == expected_mapping, 'Retained boundary mapping differs from manifest')
    filename = files['iges']
    corrupted = mode == '--corrupt-pole'
    if corrupted:
        filename = evidence_path(output, 'corrupted-pole.iges')
    records = filename.read_text().splitlines()
    require(all(len(row) == 80 for row in records), 'Invalid fixed-width IGES record')
    directory = [row for row in records if row[72] == 'D']
    parameters = [row for row in records if row[72] == 'P']
    require(len(directory) == 8, 'Expected four complete directory entries')
    reader = IGESControl_Reader()
    settings = {'xstep.cascade.unit': 'MM', 'read.iges.bspline.continuity': 0,
                'read.precision.mode': 0, 'read.iges.faulty.entities': 0,
                'read.surfacecurve.mode': 0, 'read.iges.sequence': ''}
    for key, value in settings.items():
        success = Interface_Static.SetCVal_s(key, value) if isinstance(value, str) else Interface_Static.SetIVal_s(key, value)
        actual = Interface_Static.CVal_s(key) if isinstance(value, str) else Interface_Static.IVal_s(key)
        require(success and actual == value, f'Consumer setting unavailable: {key}')
    require(reader.ReadFile(str(filename)) == IFSelect_RetDone, 'Boundary IGES load failed')
    load = diagnostics(reader.WS().ModelCheckList(True))
    require(not load['failures'] and not load['warnings'], f'Unexpected boundary load diagnostics: {load}')
    model = reader.IGESModel()
    require(model.NbEntities() == 4 and reader.NbRootsForTransfer() == 4, 'Expected four entity126 roots')
    global_section = model.GlobalSection()
    require(global_section.UnitFlag() == 2 and global_section.UnitName().ToCString().strip().upper() == 'MM'
            and global_section.Scale() == 1, 'Boundary units or scale changed')
    adapters, originals, transfers = [], [], []
    for index, edge in enumerate(edges):
        native = edge['native']
        mapping = edge['exportMapping']
        pointer = mapping['directoryPointer']
        require(pointer == index * 2 + 1 and mapping['entity'] == 126
                and mapping['id'] == edge['curveId'] == native['id']
                and edge['surfaceId'] == surface['id'], 'Explicit curve/export mapping mismatch')
        require(int(directory[index * 2][73:]) == pointer
                and int(directory[index * 2][0:8]) == 126
                and int(directory[index * 2][8:16]) == mapping['parameterPointer']
                and int(directory[index * 2 + 1][24:32]) == mapping['parameterRecords'],
                'Directory/Parameter Data mapping mismatch')
        owned = [row for row in parameters if int(row[64:72]) == pointer]
        require(len(owned) == mapping['parameterRecords']
                and int(owned[0][73:]) == mapping['parameterPointer'], 'Boundary data ownership mismatch')
        entity = model.Entity((pointer + 1) // 2)
        require(entity.TypeNumber() == 126 and not entity.IsClosed() and not entity.IsPeriodic(), 'Unexpected boundary entity flags')
        raw_knots = [entity.Knot(i) for i in range(-entity.Degree(), entity.UpperIndex() + 2)]
        raw_weights = [entity.Weight(i) for i in range(entity.UpperIndex() + 1)]
        raw_poles = [xyz(entity.Pole(i)) for i in range(entity.UpperIndex() + 1)]
        raw_domain = [entity.UMin(), entity.UMax()]
        serialized_tokens = ''.join(row[:64] for row in owned).strip().rstrip(';').split(',')
        serialized_domain = list(map(float, serialized_tokens[-5:-3]))
        require(entity.Degree() == native['degree'] and raw_knots == native['knots']
                and raw_weights == native['weights'], 'Original boundary degree/knots/weights changed')
        # A corrupt-pole control must reach actual OCCT geometry comparison, not
        # fail merely because the intentionally changed poles differ from native.
        if not corrupted:
            require(raw_poles == native['controlPoints'], 'Original boundary poles changed')
        require(raw_domain == serialized_domain == edge['originalDomain'] == mapping['domainU'],
                'Boundary original domain mapping mismatch')
        adapter, transfer = curve_from_reader(reader, (pointer + 1) // 2)
        direction = spline_direction(adapter.BSpline(), False)
        transferred_domain = [adapter.FirstParameter(), adapter.LastParameter()]
        require(direction['degree'] == native['degree'] and direction['expandedKnots'] == native['knots']
                and transferred_domain == edge['originalDomain'], 'Transferred boundary knots/domain changed')
        adapters.append(adapter)
        transfers.append(transfer)
        originals.append({'rawKnots': raw_knots, 'rawWeights': raw_weights, 'rawPoles': raw_poles,
                          'rawDomain': raw_domain, 'serializedDomain': serialized_domain,
                          'transferredDomain': transferred_domain, 'transferredKnots': direction})
    require(reader.NbShapes() == 4, 'Expected four transferred boundary shapes')
    boundary_results = []
    for index, edge in enumerate(edges):
        adapter = adapters[(index + 2) % 4] if mode == '--wrong-edge' else adapters[index]
        spline = adapter.BSpline()
        direction = spline_direction(spline, False)
        local = bool(direction['c0InteriorKnots'])
        require(19 <= len(edge['samples']) <= 4096, 'Expected endpoints and at least17 interior bounded samples')
        parameters = [sample['parameter'] for sample in edge['samples']]
        low, high = edge['originalDomain']
        require(low in parameters and high in parameters
                and len(set(p for p in parameters if low < p < high)) >= 17,
                'Boundary evidence must retain endpoints and17 distinct interior parameters')
        maximum_position = maximum_derivative = maximum_native_analytic = maximum_oracle = maximum_reader_oracle = 0.0
        retained_samples = []
        for sample in edge['samples']:
            parameter = sample['parameter']
            u, v, domain, traversal, partial, sign = mapped_surface_sample(surface, edge, parameter)
            require(domain == edge['originalDomain'] and traversal == edge['parameterDirection'], 'Boundary orientation/domain mismatch')
            require(abs(u - sample['surfaceU']) <= 1e-12 and abs(v - sample['surfaceV']) <= 1e-12,
                    'Surface parameter correspondence mismatch')
            # Wrong-root association is deliberately a geometry control. Clamp
            # nothing: evaluate the wrong root only at valid declared parameters.
            # Associate the opposite edge with the same original parameter axis.
            u_span = selected_span(direction, parameter)
            point, derivative = gp_Pnt(), gp_Vec()
            if local:
                spline.LocalD1(parameter, *u_span, point, derivative)
            else:
                adapter.D1(parameter, point, derivative)
            surface_oracle = analytic_native(surface, u, v,
                'c1-repeated-surface' if fixture['name'] == 'derivative-c1' else fixture['name'])
            oriented = [sign * component for component in surface_oracle[partial]]
            source_point = finite_vector(sample['point'])
            source_derivative = finite_vector(sample['derivative'])
            analytic_point = finite_vector(sample['analyticPoint'])
            analytic_derivative = finite_vector(sample['analyticDerivative'])
            require(math.dist(source_point, analytic_point) <= 1e-9
                    and math.dist(analytic_point, surface_oracle[0]) <= 1e-9,
                    'Native/analytic boundary point comparison failed')
            _, native_error = vector_error(source_derivative, analytic_derivative)
            _, oracle_error = vector_error(analytic_derivative, oriented)
            require(native_error <= 1e-9 and oracle_error <= 1e-9, 'Native/analytic oriented boundary derivative comparison failed')
            maximum_native_analytic = max(maximum_native_analytic, native_error)
            maximum_oracle = max(maximum_oracle, oracle_error)
            actual_point, actual_derivative = xyz(point), xyz(derivative)
            position_error = max(math.dist(actual_point, source_point), math.dist(actual_point, surface_oracle[0]))
            maximum_position = max(maximum_position, position_error)
            require(position_error <= 1e-7, f'Boundary geometry comparison failed: {position_error} mm')
            expected = list(source_derivative)
            if mode == '--wrong-sign':
                expected = [-value for value in expected]
            elif mode == '--wrong-scale' and domain[1] - domain[0] != 1:
                expected = [(domain[1] - domain[0]) * value for value in expected]
            absolute, scaled = vector_error(actual_derivative, expected)
            maximum_derivative = max(maximum_derivative, scaled)
            _, reader_oracle_error = vector_error(actual_derivative, oriented)
            maximum_reader_oracle = max(maximum_reader_oracle, reader_oracle_error)
            require(reader_oracle_error <= 1e-7, f'Boundary derivative comparison failed: independent scaled={reader_oracle_error}')
            require(scaled <= 1e-7, f'Boundary derivative comparison failed: absolute={absolute}, scaled={scaled}')
            retained_samples.append({'parameter': parameter, 'surfaceU': u, 'surfaceV': v,
                'method': 'Geom_BSpline.LocalD1' if local else 'BRepAdaptor.D1', 'distinctKnotInterval': u_span,
                'point': actual_point, 'derivative': actual_derivative, 'sourcePoint': source_point,
                'sourceDerivative': source_derivative, 'analyticPoint': analytic_point,
                'analyticDerivative': analytic_derivative, 'independentSurfaceDerivative': oriented,
                'pointDeviationMM': position_error, 'derivativeAbsoluteMMPerParameter': absolute,
                'derivativeScaledDeviation': scaled})
        boundary_results.append({'boundary': edge['boundary'], 'curveId': edge['curveId'],
            'surfaceId': edge['surfaceId'], 'parameterDirection': edge['parameterDirection'],
            'originalDomain': edge['originalDomain'], 'native': edge['native'], 'exportMapping': edge['exportMapping'],
            **originals[index], 'samples': retained_samples, 'sampleCount': len(retained_samples),
            'transferDiagnostics': transfers[index], 'maxPointDeviationMM': maximum_position,
            'maxDerivativeScaledDeviation': maximum_derivative,
            'maxNativeAnalyticDerivativeScaledDeviation': maximum_native_analytic,
            'maxIndependentOrientedDerivativeScaledDeviation': maximum_oracle,
            'maxReaderIndependentOrientedDerivativeScaledDeviation': maximum_reader_oracle})
    return {'name': fixture['name'], 'surfaceId': surface['id'], 'surface': surface,
        'sourceVersion': fixture['sourceVersion'], 'geometryVersion': 0,
        'constructions': fixture.get('constructions', []), 'mappingDocument': mapping_document,
        'files': fixture['files'], 'hashes': hashes, 'actualIGESHash': hash_file(filename),
        'entities': 4, 'roots': 4, 'units': 'MM', 'modelScale': 1,
        'fileResolutionMM': global_section.Resolution(), 'loadDiagnostics': load,
        'settings': settings, 'healing': 'Named sequence disabled; no tolerance override or parameter perturbation',
        'boundaries': boundary_results}


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv) > 2 else ''
    require(mode in ('', '--wrong-edge', '--wrong-sign', '--wrong-scale', '--corrupt-pole'), 'Unknown boundary negative mode')
    manifest = json.loads((output / 'manifest.json').read_text())
    require(1 <= len(manifest['fixtures']) <= 16, 'Fixture count outside bounded workload')
    fixtures = manifest['fixtures'][:1] if mode in ('--wrong-edge', '--wrong-sign', '--corrupt-pole') else manifest['fixtures']
    results = [read_fixture(output, fixture, mode) for fixture in fixtures]
    require(not mode, 'Negative boundary control failed to reach geometry/vector mismatch')
    report = {'base': manifest['base'], 'head': manifest['head'],
        'reader': {'cadquery-ocp': importlib.metadata.version('cadquery-ocp'), 'python': sys.version,
            'interpreter': sys.executable, 'platform': platform.platform()},
        'readerDependencies': {'read-derivatives-ocp.py': hash_file(utilities_path)},
        'units': 'mm per original dimensionless knot parameter',
        'limits': {'positionMM': 1e-7, 'nativeAnalyticMM': 1e-9,
            'derivativeScaled': 1e-7, 'nativeAnalyticDerivativeScaled': 1e-9,
            'scaleDefinition': 'absolute vector error / max(1, expected vector norm)'},
        'fixtures': results,
        'limitations': ['Geometrical boundaries only; no topological wire, trimming, sewing or closed-solid claim.',
            'Original parameter traversal; LocalD1 never nudges exact C0 queries.',
            'Independent fixture formulas; selected finite-sample accuracy only.']}
    report_file = output / 'boundary-readback.json'
    report_file.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(report_file), 'reportSHA256': hash_file(report_file),
        'fixtures': len(results), 'curves': sum(len(f['boundaries']) for f in results),
        'samples': sum(edge['sampleCount'] for f in results for edge in f['boundaries'])}))


if __name__ == '__main__':
    main()
