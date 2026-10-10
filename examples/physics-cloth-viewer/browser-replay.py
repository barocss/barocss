"""Independent saved bytes/timing replay; imports no producer, Viewer or GPU code."""
import gzip, hashlib, json, math, struct, sys
from pathlib import Path
root = Path(sys.argv[1]).resolve()
reports = {}
for mode in ('source', 'compiled'):
    node = json.loads(gzip.decompress((root / mode / 'report.json.gz').read_bytes()))
    folder = root / 'browser' / mode
    report = json.loads(gzip.decompress((folder / 'report.json.gz').read_bytes()))
    assert report['passed'] and report['fullNodeBitsExact']
    assert not report['errors'] and not report['warnings']
    assert len(report['rawRecords']) == 241
    for i, frame in enumerate(report['rawRecords']):
        for role, field in (('positionsHex', 'positionsM'), ('velocitiesHex', 'velocitiesMps')):
            raw = bytes.fromhex(frame[role])
            assert raw == bytes.fromhex(node['first'][i][role])
            values = struct.unpack('<867d', raw)
            assert all(math.isfinite(v) for v in values)
        positions = struct.unpack('<867d', bytes.fromhex(frame['positionsHex']))
        assert positions[:3] == (-.5, .55, -.5) and positions[48:51] == (.5, .55, -.5)
    for case in report['cases']:
        raw = gzip.decompress((folder / case['pixelFile']).read_bytes())
        assert len(raw) == 900 * 660 * 4
        assert hashlib.sha256(raw).hexdigest() == case['pixelSHA256']
        assert all(code == 0 for code in case['gl'])
    for trial in report['trials']:
        samples = trial['solverSamplesMs']
        assert len(samples) == 240 and trial['twinSteps'] == 480
        assert sorted(samples)[math.ceil(.95 * len(samples)) - 1] == trial['solverP95Ms'] <= 8.33
        assert trial['acceptedSteps'] == 240 and trial['stopReason'] == 'complete'
        assert math.isclose(trial['simulatedToWallRatio'], 2 / trial['playWallSeconds'], rel_tol=1e-14)
        assert trial['simulatedToWallRatio'] >= .90
    assert all(value == 0 for value in report['disposal']['counts'].values())
    assert report['disposal']['bytes'] == 0 and report['disposal']['canvasRetained']
    assert all(code == 0 for code in report['disposal']['gl'])
    assert report['recovery']['status'].startswith('초기 상태')
    reports[mode] = report
assert [c['pixelSHA256'] for c in reports['source']['cases']] == [c['pixelSHA256'] for c in reports['compiled']['cases']]
print(json.dumps({'passed': True, 'framesPerGraph': 241, 'pixelCasesPerGraph': 16,
                  'sourceCompiledNumericAndPixelsExact': True, 'timingSamplesPerGraph': 720,
                  'resourceZero': True, 'restoredUIHealthy': True, 'importsNoCandidate': True}))
