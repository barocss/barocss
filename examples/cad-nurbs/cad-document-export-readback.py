"""Independent, test-only readback of this demo's one new multi-entity IGES file."""
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


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def xyz(point):
    return [point.X(), point.Y(), point.Z()]


def diagnostics(iterator):
    failures, warnings = [], []
    iterator.Start()
    while iterator.More():
        check = iterator.Value()
        failures.extend(check.CFail(index) for index in range(1, check.NbFails() + 1))
        warnings.extend(check.CWarning(index) for index in range(1, check.NbWarnings() + 1))
        iterator.Next()
    return {'failures': failures, 'warnings': warnings}


def direction(spline, surface, axis='u'):
    if not surface:
        degree = spline.Degree()
        knots = [spline.Knot(index) for index in range(1, spline.NbKnots() + 1)]
        multiplicities = [spline.Multiplicity(index) for index in range(1, spline.NbKnots() + 1)]
    else:
        count = spline.NbUKnots() if axis == 'u' else spline.NbVKnots()
        degree = spline.UDegree() if axis == 'u' else spline.VDegree()
        knots = [spline.UKnot(index) if axis == 'u' else spline.VKnot(index)
                 for index in range(1, count + 1)]
        multiplicities = [spline.UMultiplicity(index) if axis == 'u' else spline.VMultiplicity(index)
                          for index in range(1, count + 1)]
    return {'degree': degree, 'knots': knots, 'multiplicities': multiplicities,
            'expandedKnots': [value for value, count in zip(knots, multiplicities) for _ in range(count)]}


def normalized(value):
    return 0.0 if value == 0 else value


def expected_parameters(native):
    """Only the fixed 126/128 record layout; no geometry evaluator or product kernel."""
    if native['kind'] == 'curve':
        poles, weights, knots = native['controlPoints'], native['weights'], native['knots']
        polynomial = int(all(weight == weights[0] for weight in weights))
        fields = [126, len(poles) - 1, native['degree'], 0, 0, polynomial, 0]
        domain = [knots[native['degree']], knots[len(poles)]]
        data = knots + weights + [value for pole in poles for value in pole] + domain + [0, 0, 0]
        return fields + data, domain
    poles, weights = native['controlPoints'], native['weights']
    nu, nv = len(poles), len(poles[0])
    flat_weights = [weights[u][v] for v in range(nv) for u in range(nu)]
    flat_poles = [value for v in range(nv) for u in range(nu) for value in poles[u][v]]
    polynomial = int(all(weight == flat_weights[0] for weight in flat_weights))
    fields = [128, nu - 1, nv - 1, native['degreeU'], native['degreeV'], 0, 0, polynomial, 0, 0]
    domain = [native['knotsU'][native['degreeU']], native['knotsU'][nu],
              native['knotsV'][native['degreeV']], native['knotsV'][nv]]
    return fields + native['knotsU'] + native['knotsV'] + flat_weights + flat_poles + domain, domain


def raw_records(data, entities):
    text = data.decode('ascii')
    require(text.endswith('\n'), 'IGES must end with LF')
    lines = text.splitlines()
    require(all(len(line) == 80 for line in lines), 'IGES fixed-width record changed')
    sections = {section: [line for line in lines if line[72] == section] for section in 'SGDPT'}
    require(sum(len(rows) for rows in sections.values()) == len(lines), 'Unknown IGES section')
    require(len(sections['D']) == 2 * len(entities) and len(sections['T']) == 1, 'Directory count changed')
    for section, rows in sections.items():
        require([int(row[73:80]) for row in rows] == list(range(1, len(rows) + 1)),
                f'{section} record sequence changed')
    terminate = sections['T'][0]
    for index, section in enumerate('SGDP'):
        field = terminate[index * 8:(index + 1) * 8]
        require(field[0] == section and int(field[1:]) == len(sections[section]), 'Terminate count changed')
    rows = []
    for index, entry in enumerate(entities):
        mapping, native = entry['mapping'], entry['native']
        first, second = sections['D'][2 * index:2 * index + 2]
        directory_pointer = int(first[73:80])
        parameter_pointer, parameter_count = int(first[8:16]), int(second[24:32])
        require(directory_pointer == mapping['directoryPointer'] == 2 * index + 1, 'Directory pointer changed')
        require(parameter_pointer == mapping['parameterPointer'] and parameter_count == mapping['parameterRecords'],
                'Parameter pointer/count changed')
        require(int(first[:8]) == int(second[:8]) == mapping['entity'], '126/128 directory type changed')
        label = second[56:64].rstrip()
        require(label == mapping['directoryLabel'] == mapping['outputId'][:8], 'Truncated output label changed')
        parameters = sections['P'][parameter_pointer - 1:parameter_pointer - 1 + parameter_count]
        require(len(parameters) == parameter_count and all(int(row[64:72]) == directory_pointer for row in parameters),
                'Parameter rows reference a different entity')
        payload = ''.join(row[:64] for row in parameters).strip()
        require(payload.endswith(';'), 'Parameter terminator missing')
        tokens = [token.strip() for token in payload[:-1].split(',')]
        values = [float(token.replace('D', 'E')) for token in tokens]
        require(all(math.isfinite(value) for value in values), 'Nonfinite IGES numeric field')
        expected, domain = expected_parameters(native)
        require(values == [normalized(value) for value in expected], 'Raw flags/knots/weights/poles/U-fastest/domain changed')
        require(all(value != 0 or math.copysign(1, value) > 0 for value in values), 'Signed zero was not normalized')
        signed_zero_parameters = sum(value == 0 and math.copysign(1, value) < 0 for value in expected)
        require(signed_zero_parameters == mapping['signedZeroParameterOccurrences'], 'Parameter signed-zero loss count changed')
        rows.append({'selectionIndex': index, 'entity': mapping['entity'], 'directoryPointer': directory_pointer,
                     'parameterPointer': parameter_pointer, 'parameterRecords': parameter_count, 'directoryLabel': label,
                     'serializedDomain': [normalized(value) for value in domain],
                     'rawNumericFields': len(values), 'normalizedSignedZeroParameterOccurrences': signed_zero_parameters,
                     'surfaceOrder': 'IGES-U-fastest' if native['kind'] == 'surface' else None})
    return rows, {section: len(rows) for section, rows in sections.items()}


def read_entity(reader, index, entry, raw):
    native, mapping = entry['native'], entry['mapping']
    surface = native['kind'] == 'surface'
    entity = reader.IGESModel().Entity(index + 1)
    require(entity.TypeNumber() == mapping['entity'], 'OCCT raw entity order/type changed')
    raw_domain = [entity.UMin(), entity.UMax()]
    if surface:
        raw_domain += [entity.VMin(), entity.VMax()]
        domain = raw['serializedDomain']
        require(raw_domain == [domain[0], domain[2], domain[1], domain[3]], 'Known OCCT raw128 U1/V0 accessor discrepancy changed')
    else:
        require(raw_domain == raw['serializedDomain'], 'Raw126 domain changed')
    previous_shapes = reader.NbShapes()
    require(reader.TransferOneRoot(index + 1), 'Selected primitive root transfer failed')
    transfer = diagnostics(reader.WS().TransferReader().LastCheckList())
    require(not transfer['failures'], f'OCCT transfer failures: {transfer}')
    require(reader.NbShapes() == previous_shapes + 1, 'Expected one shape per selected root')
    shape = reader.Shape(reader.NbShapes())
    require(shape.Location().IsIdentity(), 'Unexpected output placement')
    explorer = TopExp_Explorer(shape, TopAbs_FACE if surface else TopAbs_EDGE)
    require(explorer.More(), 'Transferred native primitive missing')
    adapter = BRepAdaptor_Surface(TopoDS.Face(explorer.Current()), True) if surface else BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
    require(adapter.GetType() == (GeomAbs_BSplineSurface if surface else GeomAbs_BSplineCurve), 'Transferred B-spline kind changed')
    spline = adapter.BSpline()
    explorer.Next()
    require(not explorer.More(), 'Unexpected extra transferred primitive')
    u = direction(spline, surface, 'u')
    require(u['degree'] == native['degreeU' if surface else 'degree']
            and u['expandedKnots'] == native['knotsU' if surface else 'knots'], 'Transferred degree/U knots changed')
    if surface:
        v = direction(spline, True, 'v')
        require(v['degree'] == native['degreeV'] and v['expandedKnots'] == native['knotsV'], 'Transferred V knots changed')
        transferred_domain = [adapter.FirstUParameter(), adapter.LastUParameter(), adapter.FirstVParameter(), adapter.LastVParameter()]
    else:
        v = None
        transferred_domain = [adapter.FirstParameter(), adapter.LastParameter()]
    require(transferred_domain == raw['serializedDomain'], 'Transferred original knot domains changed')
    require(1 <= len(entry['samples']) <= 8, 'Narrow reader sample budget exceeded')
    samples = []
    for sample in entry['samples']:
        point = xyz(adapter.Value(sample['u'], sample['v']) if surface else adapter.Value(sample['parameter']))
        error = math.dist(point, sample['pointMM'])
        require(error <= 1e-7, f'Local native point deviation exceeds1e-7mm: {error}')
        samples.append({**sample, 'readerPointMM': point, 'deviationMM': error, 'method': 'BRepAdaptor.Value-D0'})
    return {**raw, 'outputId': mapping['outputId'], 'qualifiedReference': mapping['reference'],
            'rawOCCTEntityDomain': raw_domain, 'transferredDomain': transferred_domain,
            'consumerDomainNote': 'OCCT raw128 U1/V0 accessor swap retained separately from actual transferred knot domains'
            if surface else 'No raw126 domain discrepancy',
            'transferredU': u, 'transferredV': v, 'samples': samples,
            'maximumLocalPointDeviationMM': max(sample['deviationMM'] for sample in samples), 'transferDiagnostics': transfer}


def main():
    require(len(sys.argv) == 3, 'Usage: cad-document-export-readback.py manifest.json report.json')
    manifest_file, report_file = [Path(value).resolve() for value in sys.argv[1:]]
    require(report_file.parent == manifest_file.parent, 'Reader output must stay in this evidence directory')
    # JS raw JSON uses the integer token -0. Preserve its sign before loss counting.
    manifest = json.loads(manifest_file.read_text(),
                          parse_int=lambda token: -0.0 if token == '-0' else int(token))
    filename = (manifest_file.parent / manifest['igesFile']).resolve()
    require(filename.is_relative_to(manifest_file.parent), 'IGES file outside this evidence directory')
    data = filename.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    require(digest == manifest['igesSha256'], 'New IGES file hash mismatch')
    entities = manifest['entities']
    require(1 <= len(entities) <= 16, 'Selected entity count outside current export profile')
    raw, counts = raw_records(data, entities)
    reader = IGESControl_Reader()
    settings = {'xstep.cascade.unit': 'MM', 'read.iges.bspline.continuity': 0, 'read.precision.mode': 0,
                'read.iges.faulty.entities': 0, 'read.surfacecurve.mode': 0, 'read.iges.sequence': ''}
    for key, value in settings.items():
        success = Interface_Static.SetCVal_s(key, value) if isinstance(value, str) else Interface_Static.SetIVal_s(key, value)
        actual = Interface_Static.CVal_s(key) if isinstance(value, str) else Interface_Static.IVal_s(key)
        require(success and actual == value, f'Required reader setting unavailable: {key}')
    require(reader.ReadFile(str(filename)) == IFSelect_RetDone, 'New saved IGES load failed')
    load = diagnostics(reader.WS().ModelCheckList(True))
    require(not load['failures'], f'OCCT load failures: {load}')
    model = reader.IGESModel()
    require(model.NbEntities() == reader.NbRootsForTransfer() == len(entities), 'Primitive entity/root count changed')
    global_section = model.GlobalSection()
    require(global_section.UnitFlag() == 2 and global_section.UnitName().ToCString().strip().upper() == 'MM'
            and global_section.Scale() == 1, 'IGES millimetres/modelScale1 changed')
    readback = [read_entity(reader, index, entry, raw[index]) for index, entry in enumerate(entities)]
    report = {'reader': {'cadquery-ocp': importlib.metadata.version('cadquery-ocp'), 'python': sys.version,
                        'interpreter': sys.executable, 'platform': platform.platform()},
              'igesFile': str(filename), 'igesSha256': digest, 'manifestSha256': hashlib.sha256(manifest_file.read_bytes()).hexdigest(),
              'settings': settings, 'loadDiagnostics': load, 'units': 'MM', 'modelScale': global_section.Scale(),
              'fileResolutionMM': global_section.Resolution(), 'records': counts, 'entities': readback,
              'maximumLocalPointDeviationMM': max(row['maximumLocalPointDeviationMM'] for row in readback),
              'scope': 'This new saved file only; raw numeric layout and bounded D0 positions. No D1 at C0 knots, healing sequence, tolerance override, reader parity, topology or manufacturing certificate.'}
    report_file.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'igesSha256': digest, 'entities': len(readback),
                      'maximumLocalPointDeviationMM': report['maximumLocalPointDeviationMM']}))


if __name__ == '__main__':
    main()
