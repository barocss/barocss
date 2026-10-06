"""Independent selected-fixture face/incidence checks on actual five-root IGES."""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import re
import runpy
import sys

from OCP.IGESControl import IGESControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_WIRE, TopAbs_EDGE, TopAbs_VERTEX
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_BSplineCurve, GeomAbs_BSplineSurface
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepTools import BRepTools_WireExplorer
from OCP.BRepGProp import BRepGProp
from OCP.BRep import BRep_Tool
from OCP.GProp import GProp_GProps
from OCP.gp import gp_Pnt, gp_Vec

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


def graph_require(condition, message):
    require(condition, 'Face graph geometry comparison failed: ' + message)


def digest(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def evidence_file(output, relative):
    filename = (output / relative).resolve()
    require(filename.is_relative_to(output.resolve()), 'Evidence path outside output directory')
    return filename


def unique_shapes(shape, kind):
    values = []
    explorer = TopExp_Explorer(shape, kind)
    while explorer.More():
        value = explorer.Current()
        if not any(value.IsSame(previous) for previous in values):
            values.append(value)
        explorer.Next()
    return values


def same_keys(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def graph_layout(bundle):
    graph_require(same_keys(bundle, ['geometry', 'topology']), 'Unsupported bundle fields')
    model, topology = bundle['geometry'], bundle['topology']
    graph_require(same_keys(model, ['name', 'version', 'lengthUnit', 'objects'])
                  and model['version'] == 0 and model['lengthUnit'] == 'mm', 'Unsupported geometry model')
    objects = model['objects']
    graph_require(len(objects) == 5 and objects[0]['kind'] == 'surface'
                  and all(obj['kind'] == 'curve' for obj in objects[1:]), 'Expected one surface then four curves')
    graph_require(same_keys(topology, ['version', 'face', 'vertices', 'edges', 'loop'])
                  and topology['version'] == 0, 'Unsupported topology record')
    face, loop, vertices, edges = topology['face'], topology['loop'], topology['vertices'], topology['edges']
    graph_require(same_keys(face, ['id', 'surfaceId', 'outerLoopId', 'orientation'])
                  and face['orientation'] == 'forward' and face['surfaceId'] == objects[0]['id'], 'Face/surface association')
    graph_require(same_keys(loop, ['id', 'uses']) and face['outerLoopId'] == loop['id'], 'Outer loop association')
    graph_require(len(vertices) == len(edges) == len(loop['uses']) == 4, 'Exactly four vertices/edges/uses required')
    ids = [obj['id'] for obj in objects] + [face['id'], loop['id']]
    ids += [vertex['id'] for vertex in vertices] + [edge['id'] for edge in edges]
    graph_require(len(ids) == 15 and len(set(ids)) == 15
                  and all(isinstance(value, str) and len(value) <= 128
                          and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*', value) for value in ids),
                  'Fifteen distinct supported bounded geometry/topology IDs required')
    for i in range(4):
        vertex, edge, use = vertices[i], edges[i], loop['uses'][i]
        graph_require(same_keys(vertex, ['id', 'point']), 'Unsupported vertex record')
        finite_vector(vertex['point'])
        graph_require(same_keys(edge, ['id', 'curveId', 'vertexIds'])
                      and edge['curveId'] == objects[i + 1]['id']
                      and edge['vertexIds'] == [vertices[i]['id'], vertices[(i + 1) % 4]['id']], 'Cyclic edge/curve/vertex association')
        graph_require(same_keys(use, ['edgeId', 'sense', 'boundary', 'pcurve'])
                      and use['edgeId'] == edge['id'] and use['sense'] == 'forward'
                      and use['boundary'] == ['v-min', 'u-max', 'v-max', 'u-min'][i], 'Ordered loop use association')
        graph_require(same_keys(use['pcurve'], ['domain', 'uv0', 'uv1']), 'Unsupported pcurve fields')
    return objects[0], objects[1:], topology


def expected_pcurve(surface, boundary):
    nu, nv = len(surface['controlPoints']), len(surface['controlPoints'][0])
    u0, u1 = surface['knotsU'][surface['degreeU']], surface['knotsU'][nu]
    v0, v1 = surface['knotsV'][surface['degreeV']], surface['knotsV'][nv]
    return {
        'v-min': {'domain': [u0, u1], 'uv0': [u0, v0], 'uv1': [u1, v0]},
        'u-max': {'domain': [v0, v1], 'uv0': [u1, v0], 'uv1': [u1, v1]},
        'v-max': {'domain': [u0, u1], 'uv0': [u1, v1], 'uv1': [u0, v1]},
        'u-min': {'domain': [v0, v1], 'uv0': [u0, v1], 'uv1': [u0, v0]},
    }[boundary]


def evaluate_surface(adapter, u, v):
    point, du, dv = gp_Pnt(), gp_Vec(), gp_Vec()
    adapter.D1(u, v, point, du, dv)
    return xyz(point), xyz(du), xyz(dv)


def evaluate_curve(adapter, parameter):
    spline = adapter.BSpline()
    direction = spline_direction(spline, False)
    span = selected_span(direction, parameter)
    point, derivative = gp_Pnt(), gp_Vec()
    if direction['c0InteriorKnots']:
        spline.LocalD1(parameter, *span, point, derivative)
        method = 'Geom_BSpline.LocalD1'
    else:
        adapter.D1(parameter, point, derivative)
        method = 'BRepAdaptor.D1'
    return xyz(point), xyz(derivative), span, method


def known_area(surface, name):
    if name in ('quarter-cylinder', 'extruded-cylinder'):
        return 10 * 30 * math.pi / 2
    # Planar representative fixtures are parallelograms. Derive the area from
    # independent corner-vector cross products, not OCCT's area implementation.
    p0 = surface['controlPoints'][0][0]
    pu = surface['controlPoints'][-1][0]
    pv = surface['controlPoints'][0][-1]
    u = [pu[i] - p0[i] for i in range(3)]
    v = [pv[i] - p0[i] for i in range(3)]
    return math.hypot(u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0])


def read_fixture(output, fixture, mode):
    original = fixture['bundle']
    files, hashes = {}, {}
    for key in ('source', 'bundle', 'iges', 'exportReport'):
        files[key] = evidence_file(output, fixture['files'][key])
        hashes[key] = digest(files[key])
        require(hashes[key] == fixture['hashes'][key], key + ' hash mismatch')
    require(json.loads(files['bundle'].read_text()) == original, 'Stored bundle differs from manifest')
    export_report = json.loads(files['exportReport'].read_text())
    require(export_report['objects'] == [fixture['surfaceExport'], *fixture['edgeExports']], 'Stored export mapping differs from manifest')
    require(fixture['validation'] == {'incidenceValid': True, 'geometricValidity': 'not-certified', 'solid': False},
            'Native incidence must not claim certified geometry or solidity')
    bundle = json.loads(json.dumps(original))
    if mode == '--wrong-graph':
        bundle['topology']['edges'][0]['curveId'] = bundle['topology']['edges'][1]['curveId']
    elif mode == '--missing-vertex':
        bundle['topology']['vertices'].pop()
    elif mode == '--reverse-pcurve':
        pcurve = bundle['topology']['loop']['uses'][0]['pcurve']
        pcurve['uv0'], pcurve['uv1'] = pcurve['uv1'], pcurve['uv0']
    surface, curves, topology = graph_layout(bundle)
    for use in topology['loop']['uses']:
        graph_require(use['pcurve'] == expected_pcurve(surface, use['boundary']), 'Original-domain pcurve orientation differs')
    filename = evidence_file(output, 'corrupted.iges') if mode == '--corrupt-pole' else files['iges']
    records = filename.read_text().splitlines()
    require(all(len(row) == 80 for row in records), 'Invalid fixed-width IGES')
    directories = [row for row in records if row[72] == 'D']
    parameters = [row for row in records if row[72] == 'P']
    require(len(directories) == 10, 'Expected five directory entries')
    reader = IGESControl_Reader()
    settings = {'xstep.cascade.unit': 'MM', 'read.iges.bspline.continuity': 0,
                'read.precision.mode': 0, 'read.iges.faulty.entities': 0,
                'read.surfacecurve.mode': 0, 'read.iges.sequence': ''}
    for key, value in settings.items():
        success = Interface_Static.SetCVal_s(key, value) if isinstance(value, str) else Interface_Static.SetIVal_s(key, value)
        actual = Interface_Static.CVal_s(key) if isinstance(value, str) else Interface_Static.IVal_s(key)
        require(success and actual == value, 'Required consumer setting unavailable: ' + key)
    require(reader.ReadFile(str(filename)) == IFSelect_RetDone, 'IGES face bundle load failed')
    load = diagnostics(reader.WS().ModelCheckList(True))
    require(not load['failures'] and not load['warnings'], f'Unexpected face bundle load diagnostics: {load}')
    model = reader.IGESModel()
    require(model.NbEntities() == reader.NbRootsForTransfer() == 5, 'Expected one surface and four curve roots')
    global_section = model.GlobalSection()
    require(global_section.UnitFlag() == 2 and global_section.UnitName().ToCString().strip().upper() == 'MM'
            and global_section.Scale() == 1, 'Units or scale changed')
    adapters, shapes, mappings = [], [], []
    for i, (native, mapping) in enumerate(zip([surface, *curves], export_report['objects'])):
        expected_entity = 128 if i == 0 else 126
        pointer = 2*i + 1
        require(mapping['entity'] == expected_entity and mapping['id'] == native['id']
                and mapping['directoryPointer'] == pointer, 'Explicit export directory association mismatch')
        require(int(directories[2*i][73:]) == pointer and int(directories[2*i][:8]) == expected_entity
                and int(directories[2*i][8:16]) == mapping['parameterPointer']
                and int(directories[2*i+1][24:32]) == mapping['parameterRecords'], 'Export directory/data pointer mismatch')
        owned = [row for row in parameters if int(row[64:72]) == pointer]
        require(len(owned) == mapping['parameterRecords'] and int(owned[0][73:]) == mapping['parameterPointer'],
                'Export parameter ownership mismatch')
        entity = model.Entity(i+1)
        require(entity.TypeNumber() == expected_entity, 'Unexpected exported entity')
        tokens = ''.join(row[:64] for row in owned).strip().rstrip(';').split(',')
        serialized_domain = list(map(float, tokens[-4:] if i == 0 else tokens[-5:-3]))
        require(reader.TransferOneRoot(i+1), 'Face bundle root transfer failed')
        transfer = diagnostics(reader.WS().TransferReader().LastCheckList())
        require(not transfer['failures'] and not transfer['warnings'], f'Unexpected face bundle transfer diagnostics: {transfer}')
        shape = reader.Shape(reader.NbShapes())
        require(shape.Location().IsIdentity(), 'Unexpected transferred placement')
        kind = TopAbs_FACE if i == 0 else TopAbs_EDGE
        explorer = TopExp_Explorer(shape, kind)
        require(explorer.More(), 'Expected face/curve missing')
        adapter = BRepAdaptor_Surface(TopoDS.Face(explorer.Current()), True) if i == 0 else BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
        require(adapter.GetType() == (GeomAbs_BSplineSurface if i == 0 else GeomAbs_BSplineCurve), 'Expected B-spline representation')
        face_or_edge = explorer.Current()
        explorer.Next()
        require(not explorer.More(), 'Unexpected multiple face/curve result')
        spline = adapter.BSpline()
        direction_u = spline_direction(spline, i == 0, 'u')
        require(direction_u['degree'] == native['degreeU' if i == 0 else 'degree']
                and direction_u['expandedKnots'] == native['knotsU' if i == 0 else 'knots'], 'Transferred U degree/knots changed')
        if i == 0:
            direction_v = spline_direction(spline, True, 'v')
            require(direction_v['degree'] == native['degreeV'] and direction_v['expandedKnots'] == native['knotsV'],
                    'Transferred V degree/knots changed')
            domain = [adapter.FirstUParameter(), adapter.LastUParameter(), adapter.FirstVParameter(), adapter.LastVParameter()]
            expected_domain = mapping['domainU'] + mapping['domainV']
        else:
            direction_v = None
            domain = [adapter.FirstParameter(), adapter.LastParameter()]
            expected_domain = mapping['domainU']
        require(domain == expected_domain == serialized_domain, 'Original-domain export/transfer mismatch')
        adapters.append(adapter)
        shapes.append(face_or_edge)
        mappings.append({'nativeId': native['id'], 'entity': expected_entity, 'exportMapping': mapping,
                         'serializedDomain': serialized_domain, 'transferredDomain': domain,
                         'transferredU': direction_u, 'transferredV': direction_v, 'transferDiagnostics': transfer})
    require(reader.NbShapes() == 5, 'Expected five transferred root shapes')
    vertices = topology['vertices']
    retained_edges = []
    for i, (curve, use, samples) in enumerate(zip(curves, topology['loop']['uses'], fixture['samples'])):
        require(17 <= len(samples) <= 4096, 'Face edge sample workload is invalid')
        pcurve = use['pcurve']
        low, high = pcurve['domain']
        graph_require(curve['knots'][curve['degree']] == low
                      and curve['knots'][len(curve['controlPoints'])] == high, 'Native curve/pcurve domain mismatch')
        require(low in [s['parameter'] for s in samples] and high in [s['parameter'] for s in samples], 'Edge endpoints missing')
        slopes = [(pcurve['uv1'][axis] - pcurve['uv0'][axis]) / (high - low) for axis in range(2)]
        max_position = max_derivative = max_analytic = 0.0
        retained = []
        for sample in samples:
            parameter = sample['parameter']
            fraction = (parameter-low)/(high-low)
            uv = [pcurve['uv0'][axis] if pcurve['uv0'][axis] == pcurve['uv1'][axis] or fraction == 0
                  else pcurve['uv1'][axis] if fraction == 1
                  else (1-fraction)*pcurve['uv0'][axis] + fraction*pcurve['uv1'][axis] for axis in range(2)]
            graph_require(len(sample['uv']) == 2 and all(abs(a-b) <= 1e-12 for a,b in zip(uv,sample['uv'])), 'Declared sample pcurve mapping differs')
            curve_point, curve_derivative, span, method = evaluate_curve(adapters[i+1], parameter)
            surface_point, du, dv = evaluate_surface(adapters[0], *uv)
            signed = [slopes[0]*du[axis]+slopes[1]*dv[axis] for axis in range(3)]
            independent = analytic_native(surface, *uv, fixture['name'])
            independent_signed = [slopes[0]*independent[1][axis]+slopes[1]*independent[2][axis] for axis in range(3)]
            point_expected = finite_vector(sample['point'])
            derivative_expected = finite_vector(sample['derivative'])
            analytic_point = finite_vector(sample['analyticPoint'])
            analytic_derivative = finite_vector(sample['analyticDerivative'])
            graph_require(math.dist(point_expected, analytic_point) <= 1e-9
                          and math.dist(analytic_point, independent[0]) <= 1e-9, 'Native/independent analytic point mismatch')
            _, native_analytic = vector_error(derivative_expected, analytic_derivative)
            _, oracle_error = vector_error(analytic_derivative, independent_signed)
            require(native_analytic <= 1e-9 and oracle_error <= 1e-9, 'Face graph derivative comparison failed: native analytic mismatch')
            point_error = max(math.dist(curve_point, point_expected), math.dist(surface_point, point_expected),
                              math.dist(curve_point, surface_point), math.dist(curve_point, independent[0]))
            graph_require(point_error <= 1e-7, f'Actual curve/surface/pcurve position mismatch {point_error} mm')
            derivative_error = max(vector_error(curve_derivative, derivative_expected)[1],
                                   vector_error(curve_derivative, signed)[1], vector_error(curve_derivative, independent_signed)[1])
            require(derivative_error <= 1e-7, f'Face graph derivative comparison failed: scaled={derivative_error}')
            if parameter == low or parameter == high:
                vertex = vertices[i] if parameter == low else vertices[(i+1)%4]
                graph_require(math.dist(vertex['point'], point_expected) <= 1e-9
                              and math.dist(vertex['point'], curve_point) <= 1e-7
                              and math.dist(vertex['point'], surface_point) <= 1e-7, 'Graph corner vertex differs from actual exports')
            max_position = max(max_position, point_error)
            max_derivative = max(max_derivative, derivative_error)
            max_analytic = max(max_analytic, native_analytic, oracle_error)
            retained.append({'parameter': parameter, 'uv': uv, 'curvePoint': curve_point,
                'surfacePoint': surface_point, 'curveDerivative': curve_derivative,
                'surfaceMappedDerivative': signed, 'independentDerivative': independent_signed,
                'method': method, 'distinctKnotInterval': span, 'pointDeviationMM': point_error,
                'derivativeScaledDeviation': derivative_error})
        retained_edges.append({'edge': topology['edges'][i], 'use': use, 'curve': curve,
            'sampleCount': len(samples), 'samples': retained, 'maxPointDeviationMM': max_position,
            'maxDerivativeScaledDeviation': max_derivative, 'maxNativeAnalyticScaledDeviation': max_analytic})
    face = TopoDS.Face(shapes[0])
    valid = BRepCheck_Analyzer(face, True, False, False).IsValid()
    require(valid, 'Independent selected OCCT face is invalid')
    wires, edges, actual_vertices = unique_shapes(face, TopAbs_WIRE), unique_shapes(face, TopAbs_EDGE), unique_shapes(face, TopAbs_VERTEX)
    require((len(wires), len(edges), len(actual_vertices)) == (1, 4, 4), 'Unexpected independent face incidence counts')
    reader_vertex_points = [xyz(BRep_Tool.Pnt_s(TopoDS.Vertex(vertex))) for vertex in actual_vertices]
    corner_matches = []
    for vertex in vertices:
        distances = [math.dist(vertex['point'], actual) for actual in reader_vertex_points]
        nearest = min(range(4), key=lambda index: distances[index])
        graph_require(distances[nearest] <= 1e-7, 'Native graph vertex differs from reader-generated face vertex')
        corner_matches.append({'nativeVertexId': vertex['id'], 'readerVertexIndex': nearest, 'distanceMM': distances[nearest]})
    graph_require(len({match['readerVertexIndex'] for match in corner_matches}) == 4, 'Graph corners do not map to four distinct reader vertices')
    wire = TopoDS.Wire(wires[0])
    wire_explorer = BRepTools_WireExplorer(wire, face)
    wire_orientations = []
    while wire_explorer.More():
        wire_orientations.append({'edgeOrientation': str(wire_explorer.Orientation()),
                                  'edgeShapeOrientation': str(wire_explorer.Current().Orientation()),
                                  'currentVertexOrientation': str(wire_explorer.CurrentVertex().Orientation())})
        wire_explorer.Next()
    require(len(wire_orientations) == 4, 'Independent wire traversal does not contain four edges')
    props = GProp_GProps()
    quadrature_requested = 1e-10
    quadrature_estimated = BRepGProp.SurfaceProperties_s(face, props, quadrature_requested, False)
    area = props.Mass()
    analytic_area = known_area(surface, fixture['name'])
    require(abs(analytic_area - fixture['analyticAreaMM2']) <= 1e-9*max(1,analytic_area), 'Declared analytic area differs from independent control')
    area_scaled_error = abs(area - analytic_area)/max(1,analytic_area)
    require(math.isfinite(area) and area_scaled_error <= 1e-7, 'Independent selected face area comparison failed')
    return {'name': fixture['name'], 'sourceVersion': fixture['sourceVersion'],
        'constructions': fixture.get('constructions', []), 'nativeValidation': fixture['validation'],
        'bundle': bundle, 'files': fixture['files'], 'hashes': hashes, 'actualIGESHash': digest(filename),
        'entities': 5, 'roots': 5, 'units': 'MM', 'modelScale': 1, 'fileResolutionMM': global_section.Resolution(),
        'mappings': mappings, 'edgeChecks': retained_edges, 'loadDiagnostics': load, 'settings': settings,
        'healing': 'Named sequence disabled; no tolerance override, parameter perturbation or topology repair',
        'independentSelectedFace': {'isValid': valid, 'checker': 'BRepCheck_Analyzer', 'geometryControls': True,
            'parallel': False, 'exact': False, 'counts': {'wires': len(wires), 'edges': len(edges), 'vertices': len(actual_vertices)},
            'readerVertexPointsMM': reader_vertex_points, 'nativeCornerMatches': corner_matches,
            'uniqueCountMethod': 'TopExp_Explorer plus pairwise IsSame', 'faceOrientation': str(face.Orientation()),
            'wireOrientation': str(wire.Orientation()), 'wireExplorerEdges': wire_orientations,
            'nativeConvention': 'forward face; ordered v-min,u-max,v-max,u-min forward uses; reflected decreasing curve parameters',
            'occtConventionNote': 'Reader-generated edge/wire orientation is recorded independently; native graph IDs were not serialized as topology.',
            'areaMM2': area, 'analyticAreaMM2': analytic_area, 'areaScaledDeviation': area_scaled_error,
            'quadrature': {'method': 'BRepGProp adaptive 2D Gauss', 'requestedRelativePrecision': quadrature_requested,
                           'estimatedRelativeError': quadrature_estimated, 'geometryComparisonRelativeLimit': 1e-7}}}


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv)>2 else ''
    require(mode in ('', '--wrong-graph', '--reverse-pcurve', '--missing-vertex', '--corrupt-pole'), 'Unknown face negative mode')
    manifest = json.loads((output/'manifest.json').read_text())
    require(1 <= len(manifest['fixtures']) <= 16, 'Fixture workload outside fixed bound')
    fixtures = manifest['fixtures'][:1] if mode else manifest['fixtures']
    results = [read_fixture(output, fixture, mode) for fixture in fixtures]
    require(not mode, 'Face negative control failed to reach graph geometry comparison')
    report = {'base': manifest['base'], 'head': manifest['head'],
        'reader': {'cadquery-ocp': importlib.metadata.version('cadquery-ocp'), 'python': sys.version,
            'interpreter': sys.executable, 'platform': platform.platform()},
        'readerDependencies': {'read-derivatives-ocp.py': digest(utilities_path)},
        'units': {'position': 'mm', 'derivative': 'mm per original dimensionless parameter', 'area': 'mm^2'},
        'limits': {'positionMM': 1e-7, 'derivativeScaled': 1e-7, 'nativeAnalyticMM': 1e-9,
                   'nativeAnalyticDerivativeScaled': 1e-9, 'areaScaled': 1e-7},
        'fixtures': results,
        'limitations': ['Native incidence remains not-certified geometry and not a solid.',
            'Selected reader-generated faces only; IGES did not serialize native incidence IDs.',
            'No universal regularity, trim, sewing, shell, STEP or manufacturing guarantee.']}
    report_file = output/'face-readback.json'
    report_file.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'report': str(report_file), 'reportSHA256': digest(report_file),
                     'fixtures': len(results), 'entities': sum(f['entities'] for f in results),
                     'samples': sum(edge['sampleCount'] for f in results for edge in f['edgeChecks'])}))


if __name__ == '__main__':
    main()
