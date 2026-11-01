"""D405 test-only STEP geometry reader/reverse producer. OCP plus Python stdlib; no product imports.
Usage: approved-reader-python -I step-ocp-profile.py fresh-producer-output output
"""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import sys

from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepGProp import BRepGProp
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox
from OCP.GProp import GProp_GProps
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.STEPControl import STEPControl_Reader, STEPControl_Writer, STEPControl_AsIs
from OCP.TopAbs import TopAbs_SOLID
from OCP.TopExp import TopExp_Explorer
from OCP.gp import gp_Pnt

BOUNDS_TOLERANCE = 1e-6
VOLUME_TOLERANCE = 1e-5
CASES = {
    'box': {'solids': [{'volume': 40000, 'bounds': [0, 0, 0, 80, 50, 10]}], 'volume': 40000, 'bounds': [0, 0, 0, 80, 50, 10]},
    'assembly': {'solids': [{'volume': 1000, 'bounds': [80, 0, 0, 100, 10, 5]}, {'volume': 1000, 'bounds': [-20, 50, 0, 0, 60, 5]}, {'volume': 1000, 'bounds': [-10, 70, 0, 0, 90, 5]}], 'volume': 3000, 'bounds': [-20, 0, 0, 100, 90, 5]},
}
REVERSE = {'solids': [{'volume': 252, 'bounds': [5, -4, 2, 17, 3, 5]}], 'volume': 252, 'bounds': [5, -4, 2, 17, 3, 5]}


class NoHealingControlUnavailable(RuntimeError):
    pass


class MeasurementFailure(Exception):
    def __init__(self, stage, detail, result):
        super().__init__(detail)
        self.stage, self.result = stage, result


def need(condition, stage, detail, result):
    if not condition:
        raise MeasurementFailure(stage, detail, result)


def diagnostics(iterator):
    failures, warnings = [], []
    iterator.Start()
    while iterator.More():
        check = iterator.Value()
        failures.extend(str(check.CFail(i)) for i in range(1, check.NbFails() + 1))
        warnings.extend(str(check.CWarning(i)) for i in range(1, check.NbWarnings() + 1))
        iterator.Next()
    return {'failures': failures, 'warnings': warnings}


def configure_no_healing(reader):
    # OCP8's std::bitset binding cannot carry the owning C++ no-processing control.
    # DE fix parameters/resource sequences do not clear the reader's default FixShape flag.
    raise NoHealingControlUnavailable('NO_HEALING_CONTROL_UNAVAILABLE: SetShapeProcessFlags/ GetShapeProcessFlags require an unbound std::bitset<18>')


def shape_metrics(shape):
    valid = BRepCheck_Analyzer(shape, True, False, False).IsValid()
    props = GProp_GProps()
    BRepGProp.VolumeProperties_s(shape, props, True, False, False)
    box = Bnd_Box()
    box.SetGap(0)
    BRepBndLib.AddOptimal_s(shape, box, False, False)
    low, high = box.CornerMin(), box.CornerMax()
    return {'valid': valid, 'volume': props.Mass(), 'bounds': [low.X(), low.Y(), low.Z(), high.X(), high.Y(), high.Z()]}


def read_step(path):
    reader = STEPControl_Reader()
    result = {'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'noHealing': configure_no_healing(reader)}
    status = reader.ReadFile(str(path))
    result['loadStatus'] = str(status)
    need(status == IFSelect_RetDone, 'load', 'ReadFile did not return IFSelect_RetDone', result)
    result['loadDiagnostics'] = diagnostics(reader.WS().ModelCheckList(True))
    need(not result['loadDiagnostics']['failures'] and not result['loadDiagnostics']['warnings'], 'load-diagnostics', 'unexpected load diagnostics', result)
    result['rootsRequested'] = reader.NbRootsForTransfer()
    need(result['rootsRequested'] > 0, 'roots', 'no transferable roots', result)
    result['rootsTransferred'] = reader.TransferRoots()
    result['transferDiagnostics'] = diagnostics(reader.WS().TransferReader().LastCheckList())
    result['shapeCount'] = reader.NbShapes()
    need(result['rootsTransferred'] == result['rootsRequested'], 'transfer', 'incomplete root transfer', result)
    need(not result['transferDiagnostics']['failures'] and not result['transferDiagnostics']['warnings'], 'transfer-diagnostics', 'unexpected transfer diagnostics', result)
    shape = reader.OneShape()
    result['shapeNull'] = shape.IsNull()
    need(not result['shapeNull'], 'shape', 'null transferred shape', result)
    result['systemLengthUnit'] = reader.SystemLengthUnit()
    need(result['systemLengthUnit'] == 1, 'unit', 'reader unit differs from millimetres', result)
    result['whole'] = shape_metrics(shape)
    result['solids'] = []
    explorer = TopExp_Explorer(shape, TopAbs_SOLID)
    while explorer.More():
        result['solids'].append(shape_metrics(explorer.Current()))
        explorer.Next()
    need(result['whole']['valid'] and all(s['valid'] for s in result['solids']), 'validity', 'BRepCheck_Analyzer reports invalid geometry', result)
    need(all(math.isfinite(s['volume']) and s['volume'] > 0 for s in result['solids']), 'signed-volume', 'nonpositive or nonfinite signed solid volume', result)
    return result


def compare(actual, expected):
    errors = []
    if len(actual['solids']) != len(expected['solids']):
        errors.append('solid count mismatch')
    delta = actual['whole']['volume'] - expected['volume']
    if abs(delta) > VOLUME_TOLERANCE:
        errors.append('total volume mismatch: error ' + repr(delta))
    aggregate_error = max(abs(a - b) for a, b in zip(actual['whole']['bounds'], expected['bounds']))
    if aggregate_error > BOUNDS_TOLERANCE:
        errors.append('aggregate bounds mismatch: max error ' + repr(aggregate_error))
    if abs(actual['whole']['volume'] - sum(s['volume'] for s in actual['solids'])) > VOLUME_TOLERANCE:
        errors.append('whole volume differs from signed solid sum')
    remaining, matched = list(actual['solids']), []
    for wanted in expected['solids']:
        index = next((i for i, solid in enumerate(remaining) if max(abs(a - b) for a, b in zip(solid['bounds'], wanted['bounds'])) <= BOUNDS_TOLERANCE), None)
        if index is None:
            errors.append('per-solid bounds mismatch: ' + repr(wanted['bounds']))
            continue
        solid = remaining.pop(index)
        error = solid['volume'] - wanted['volume']
        matched.append({'boundsMaxError': max(abs(a - b) for a, b in zip(solid['bounds'], wanted['bounds'])), 'volumeError': error})
        if abs(error) > VOLUME_TOLERANCE:
            errors.append('per-solid volume mismatch: error ' + repr(error))
    return {'pass': not errors, 'errors': errors, 'totalVolumeError': delta, 'aggregateBoundsMaxError': aggregate_error, 'matchedSolids': matched}


def write_ocp_box(path, origin, dimensions):
    shape = BRepPrimAPI_MakeBox(gp_Pnt(*origin), *dimensions).Shape()
    need(BRepCheck_Analyzer(shape, True, False, False).IsValid(), 'ocp-producer-validity', 'OCP-generated box invalid', {})
    writer = STEPControl_Writer()
    need(Interface_Static.SetCVal_s('write.step.schema', 'AP214IS'), 'ocp-writer-setup', 'schema configuration refused', {})
    need(Interface_Static.SetCVal_s('write.step.unit', 'MM'), 'ocp-writer-setup', 'unit configuration refused', {})
    transfer = writer.Transfer(shape, STEPControl_AsIs)
    need(transfer == IFSelect_RetDone, 'ocp-writer-transfer', 'OCP writer transfer refused', {})
    status = writer.Write(str(path))
    need(status == IFSelect_RetDone, 'ocp-writer-output', 'OCP writer output refused', {})
    return {'file': str(path), 'origin': origin, 'dimensions': dimensions, 'geometryBeforeWrite': shape_metrics(shape), 'shapeValidBeforeWrite': True, 'transfer': str(transfer), 'write': str(status), 'schemaSetting': Interface_Static.CVal_s('write.step.schema'), 'unitSetting': Interface_Static.CVal_s('write.step.unit')}


def main(source, output, reverse_only=False):
    output.mkdir(parents=True, exist_ok=True)
    versions = {name: importlib.metadata.version(name) for name in ('cadquery-ocp', 'cadquery-ocp-proxy')}
    assert all(version == '8.0.1.1.0' for version in versions.values()), versions
    report = {'status': 'RUNNING', 'reader': {'versions': versions, 'interpreter': sys.executable, 'python': sys.version, 'platform': platform.platform()}, 'boundsTolerance': BOUNDS_TOLERANCE, 'volumeTolerance': VOLUME_TOLERANCE, 'forward': {}, 'controls': {}, 'reverse': None, 'productImports': 0}
    try:
        if reverse_only:
            report['phase'] = 'reverse-OCP-box-producer-only'
            reverse = output / 'ocp-box.step'
            producer = write_ocp_box(reverse, [5, -4, 2], [12, 7, 3])
            metric = producer['geometryBeforeWrite']
            comparison = compare({'whole': metric, 'solids': [metric]}, REVERSE)
            need(comparison['pass'], 'ocp-native-box', 'OCP native box differs from literals', metric)
            report['reverse'] = {'producer': producer, 'nativeGeometryComparison': comparison, 'expected': REVERSE, 'OCP_STEP_reimport': 'NOT_RUN_NO_HEALING_CONTROL_UNAVAILABLE'}
            report['forward'] = {'box': 'NOT_RUN_NO_HEALING_CONTROL_UNAVAILABLE', 'assembly': 'NOT_RUN_NO_HEALING_CONTROL_UNAVAILABLE'}
            report['controls'] = {'STEP_reader_negatives': 'NOT_RUN_NO_HEALING_CONTROL_UNAVAILABLE'}
        else:
            for name, expected in CASES.items():
                report['phase'] = 'forward-' + name
                result = read_step(source / (name + '.step'))
                result['comparison'] = compare(result, expected)
                report['forward'][name] = result
                need(result['comparison']['pass'], 'geometry-comparison', 'forward analytic geometry mismatch', result)
            report['phase'] = 'negative-truncated-file'
            truncated = output / 'truncated.step'
            truncated.write_text("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('truncated'),'2;1');\n")
            try:
                read_step(truncated)
            except MeasurementFailure as error:
                report['controls']['truncated'] = {'detected': True, 'stage': error.stage, 'reason': str(error), 'read': error.result}
            else:
                raise AssertionError('truncated STEP survived reader gates')
            report['phase'] = 'negative-valid-wrong-geometry'
            wrong = output / 'valid-wrong-dimensions.step'
            producer = write_ocp_box(wrong, [0, 0, 0], [80, 50, 11])
            result = read_step(wrong)
            result['comparison'] = compare(result, CASES['box'])
            need(not result['comparison']['pass'], 'negative-control', 'wrong geometry survived analytic checks', result)
            report['controls']['validWrongDimensions'] = {'detected': True, 'producer': producer, 'read': result}
            report['phase'] = 'reverse-OCP-box-producer'
            reverse = output / 'ocp-box.step'
            producer = write_ocp_box(reverse, [5, -4, 2], [12, 7, 3])
            result = read_step(reverse)
            result['comparison'] = compare(result, REVERSE)
            need(result['comparison']['pass'], 'ocp-producer-roundtrip', 'OCP own box differs from literals', result)
            report['reverse'] = {'producer': producer, 'read': result, 'expected': REVERSE}
        report['status'] = 'PARTIAL_PASS' if reverse_only else 'PASS'
    except NoHealingControlUnavailable as error:
        report.update(status='SETUP_BLOCKED', failure=str(error))
    except MeasurementFailure as error:
        report.update(status='FAIL', failureStage=error.stage, failure=str(error), failedRead=error.result)
    except Exception as error:
        report.update(status='SETUP_OR_HARNESS_FAIL', failure=repr(error))
    finally:
        (output / 'ocp-readback.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'phase': report.get('phase'), 'report': str(output / 'ocp-readback.json'), 'failure': report.get('failure')}))
    return report['status'] in ('PASS', 'PARTIAL_PASS')


if __name__ == '__main__':
    sys.exit(0 if main(Path(sys.argv[1]), Path(sys.argv[2]), '--reverse-only' in sys.argv[3:]) else 1)
