"""Bounded independent consumer of actual original XY-profile IGES126 files."""
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

UTIL = Path(__file__).with_name('read-derivatives-ocp.py')
h = runpy.run_path(str(UTIL))
require = h['require']


def raw_adapter(filename):
    reader = h['IGESControl_Reader']()
    status = reader.ReadFile(str(filename))
    load = h['diagnostics'](reader.WS().ModelCheckList(True))
    require(status == h['IFSelect_RetDone'], 'XY profile load comparison failed: reader status')
    require(not load['failures'] and not load['warnings'], 'XY profile load comparison failed: '+str(load))
    require(reader.NbRootsForTransfer() == 1 and reader.TransferOneRoot(1), 'XY profile load comparison failed: roots')
    transfer = h['diagnostics'](reader.WS().TransferReader().LastCheckList())
    require(not transfer['failures'] and not transfer['warnings'], 'XY profile load comparison failed: transfer diagnostics')
    require(reader.IGESModel().NbEntities() == 1 and reader.IGESModel().Entity(1).TypeNumber() == 126,
            'XY profile load comparison failed: entity count/type')
    explorer = h['TopExp_Explorer'](reader.Shape(1), h['TopAbs_EDGE'])
    require(explorer.More(), 'XY profile load comparison failed: edge absent')
    adapter = h['BRepAdaptor_Curve'](h['TopoDS'].Edge(explorer.Current()))
    explorer.Next()
    require(not explorer.More(), 'XY profile load comparison failed: extra edge')
    return reader, adapter, {'readStatus': str(status), 'roots': 1, 'entities': 1, 'loadDiagnostics': load, 'transferDiagnostics': transfer}


def records(filename):
    lines = filename.read_text().splitlines()
    require(1 <= len(lines) <= 4096 and all(len(line) == 80 for line in lines), 'XY profile load comparison failed: fixed records')
    directory = [line for line in lines if line[72] == 'D']
    parameters = [line for line in lines if line[72] == 'P']
    require(len(directory) == 2 and parameters, 'XY profile load comparison failed: directory/parameters')
    pointer = int(directory[0][8:16])
    valid_pointer = pointer == 1 and all(int(line[64:72]) == 1 for line in parameters)
    body = ''.join(line[:64] for line in parameters)
    values = body.replace(';', ',').split(',')
    flags = [int(value.strip()) for value in values[:7]]
    return valid_pointer, flags


def check_positions(adapter, fixture):
    maximum = 0
    for sample in fixture['positionSamples']:
        span, fraction = sample['span'], sample['fraction']
        a, b = fixture['authoredPoints'][span:span+2]
        expected = [x+(y-x)*fraction for x,y in zip(a,b)]
        require(math.dist(expected, sample['analyticPoint']) <= 1e-9, 'Authored point oracle mismatch')
        actual = h['xyz'](adapter.Value(sample['parameter']))
        deviation = math.dist(actual, expected)
        maximum = max(maximum, deviation)
        require(deviation <= 1e-7, 'XY profile geometry comparison failed: '+str(deviation)+' mm')
    return maximum


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv) > 2 else ''
    require(mode in ('', '--bad-pointer', '--changed-pole'), 'Unknown XY profile mode')
    manifest = json.loads((output/'manifest.json').read_text())
    require(len(manifest['fixtures']) == 4, 'Four authored XY fixture controls required')
    results = []
    for index, fixture in enumerate(manifest['fixtures']):
        require(fixture['sourceVersion'] == 0 and fixture['geometryVersion'] == 0, 'XY source/native version changed')
        for key, relative in fixture['files'].items():
            filename = (output/relative).resolve()
            require(filename.is_relative_to(output), 'XY evidence path escaped')
            require(hashlib.sha256(filename.read_bytes()).hexdigest() == fixture['hashes'][key], 'XY original '+key+' hash mismatch')
        normal = h['read_fixture'](output, fixture, '')
        filename = output/fixture['files']['iges']
        pointer_valid, flags = records(filename)
        require(pointer_valid and flags[:3] == [126,len(fixture['authoredPoints'])-1,1]
                and flags[3:] == [0,0,1,0], 'XY profile original general/open/polynomial/nonperiodic flags changed')
        reader, adapter, structural = raw_adapter(filename)
        maximum_position = check_positions(adapter, fixture)
        spline = adapter.BSpline()
        poles = [h['xyz'](spline.Pole(i)) for i in range(1,spline.NbPoles()+1)]
        weights = [spline.Weight(i) for i in range(1,spline.NbPoles()+1)]
        require(poles == fixture['authoredPoints'] and weights == [1]*len(poles), 'XY original pole/weight order mismatch')
        require(fixture['exportMapping']['id'] == fixture['id'] and fixture['exportMapping']['entity'] == 126
                and fixture['exportMapping']['directoryPointer'] == 1 and fixture['exportMapping']['parameterPointer'] == 1,
                'XY explicit native-ID/export-directory association changed')
        require([sample['parameter'] for sample in fixture['c0Refusals']] == list(range(1,len(poles)-1)), 'XY C0 refusal set changed')
        for sample in fixture['samples']:
            a,b = fixture['authoredPoints'][sample['span']:sample['span']+2]
            expected = [y-x for x,y in zip(a,b)]
            require(h['vector_error'](sample['derivative'],expected)[1] <= 1e-9
                    and h['vector_error'](sample['analyticDerivative'],expected)[1] <= 1e-9,
                    'XY authored segment derivative oracle mismatch')
        if mode and index == 0:
            control = json.loads((output/'negative-files.json').read_text())[mode[2:]]
            changed = (output/control['file']).resolve()
            require(changed.is_relative_to(output) and hashlib.sha256(changed.read_bytes()).hexdigest() == control['sha256'], 'XY changed-file control hash mismatch')
            require(control['originalSHA256'] == fixture['hashes']['iges'], 'XY changed-file original lineage mismatch')
            if mode == '--bad-pointer':
                # Actually load the corrupted bytes before applying the independent
                # pointer guard. OCCT can salvage a bad pointer; preserve that fact.
                changed_reader = h['IGESControl_Reader']()
                status = changed_reader.ReadFile(str(changed))
                diagnostics = h['diagnostics'](changed_reader.WS().ModelCheckList(True))
                valid,_ = records(changed)
                observed = {'status':str(status),'diagnostics':diagnostics,'pointerValid':valid}
                (output/'bad-pointer-observed.json').write_text(json.dumps(observed,indent=2)+'\n')
                require(valid, 'XY profile load comparison failed: actual corrupted directory pointer')
            else:
                valid,changed_flags = records(changed)
                require(valid and changed_flags == flags, 'Changed-pole control must preserve pointers and flags')
                _, altered, observed = raw_adapter(changed)
                (output/'changed-pole-observed.json').write_text(json.dumps(observed,indent=2)+'\n')
                check_positions(altered,fixture)
            raise AssertionError('XY negative control unexpectedly passed')
        normal.update({'originalFlags':{'entity':126,'planar':0,'closed':0,'polynomial':1,'periodic':0},
                       'nativeEndpointClosed':fixture['report']['endpointClosed'],'regionCertified':False,'solid':False,
                       'kernelGeometricClosed':spline.IsClosed(),'kernelPeriodic':spline.IsPeriodic(),
                       'positionSampleCount':len(fixture['positionSamples']),'maxAuthoredPositionDeviationMM':maximum_position,
                       'authoredPoles':poles,'unitWeights':weights,'structuralRead':structural,'exactC0Refusals':fixture['c0Refusals']})
        results.append(normal)
    require(not mode,'XY negative did not reach its comparison')
    report = {'base':manifest['base'],'head':manifest['head'],'fixtures':results,
              'readerDependencies':{'read-derivatives-ocp.py':hashlib.sha256(UTIL.read_bytes()).hexdigest()},
              'limits':manifest['limits'],'regionCertified':False,'solid':False,
              'scope':'Independent original IGES126 geometry readback; endpoint equality is not certified wire/region topology.'}
    (output/'xy-profile-readback.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'fixtures':len(results),'derivativeSamples':sum(row['sampleCount'] for row in results),
                      'positionSamples':sum(row['positionSampleCount'] for row in results)}))


if __name__ == '__main__':
    main()
