"""Checkpoint12: source/proof archive IO only; Root executes after explicit desktop PASS."""
import argparse
import gzip
import importlib.util
import json
from pathlib import Path
import re
import stat
import tarfile

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
spec = importlib.util.spec_from_file_location('checkpoint08_io', HOME / 'checkpoint-08.py')
io = importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)
MANIFEST = HOME / 'CHECKPOINT-12.json'
A = ROOT / 'examples/physics-two-cubes-floor-2276'
B = ROOT / 'examples/physics-coupled-cubes-floor-2276'
GUARDS = ROOT / 'examples/physics-world-p5-2276/evidence'
OUTPUT = ROOT / 'output/playwright/coupled-cubes-floor'


def build(desktop_id):
    io.require(re.fullmatch(r'coupled-desktop-[a-zA-Z0-9_-]+', desktop_id), 'explicit desktop ID required')
    io.require(not MANIFEST.exists(), 'immutable manifest exists')
    for role in ('SOURCE', 'PROOF'):
        io.require(not (HOME / ('CHECKPOINT-12-' + role + '.tar.gz')).exists(), 'immutable archive exists')
    prior = io.read_json(HOME / 'CHECKPOINT-11.json')
    io.require(prior['status'] == 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION', 'checkpoint11 dependency status')
    dependencies = {io.relative(HOME / name): io.pin(HOME / name) for name in
                    ('CHECKPOINT-11.json', 'CHECKPOINT-11-SOURCE.tar.gz', 'CHECKPOINT-11-PROOF.tar.gz')}
    expected_dependency = {'CHECKPOINT-11.json': {'bytes': 202938, 'sha256': 'b43cf81d3f964c23299186325a0c3c9f5f1bd137f8b852e52cc78add5fc49e74'}, 'CHECKPOINT-11-SOURCE.tar.gz': {'bytes': 170312, 'sha256': '62151fc73dde2fbafa737446286295be79388e0a1a49cc802c002af7b977e370'}, 'CHECKPOINT-11-PROOF.tar.gz': {'bytes': 987897, 'sha256': '61a66bf6ee97a82360d30bafa8fbef228d7d3e8cb2a7dba73210a6d2711b2635'}}
    io.require({Path(name).name: item for name, item in dependencies.items()} == expected_dependency, 'immutable checkpoint11 triple changed')
    source = {Path(__file__).resolve(), HOME / 'checkpoint-08.py'}
    source.update(io.files(ROOT / 'packages/barocss-physics/src'))
    for name in ('package.json', 'build-root.mjs', 'build-types.mjs', 'tsconfig.json', 'README.md', 'ROADMAP.md'):
        source.add(ROOT / 'packages/barocss-physics' / name)
    for folder in (A, B):
        for path in io.files(folder):
            if not {'evidence', 'baseline', 'output', 'node_modules', '__pycache__'}.intersection(path.relative_to(folder).parts):
                source.add(path)
    source.update(ROOT / name for name in (
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'apps/library-docs/docs/reference/physics-verification.md',
        'apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md',
        'apps/library-docs/samples/physics-island.test.mjs',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    proof = set()
    for folder in (A, B):
        for name in ('baseline', 'evidence'):
            proof.update(io.files(folder / name))
    for name in ('floor-desktop01', 'floor-desktop02'):
        proof.update(io.files(ROOT / 'output/playwright/two-cubes-floor' / name))
    proof.update(io.files(OUTPUT / desktop_id))
    preserved_desktop_failures = {}
    for folder in sorted(OUTPUT.iterdir()):
        receipt = folder / 'browser/result.json'
        if folder.is_dir() and receipt.is_file() and folder.name != desktop_id:
            data = io.read_json(receipt)
            if data.get('status') == 'COUPLED_CUBES_FLOOR_DESKTOP_NO_GO':
                proof.update(io.files(folder))
                preserved_desktop_failures[folder.name] = data
    # Actual emitted bytes are provenance artifacts, not a fresh numerical execution.
    proof.update(io.files(ROOT / 'packages/barocss-physics/dist'))
    receipts = {}
    guard_names = []
    for folder in sorted(GUARDS.iterdir()):
        if folder.is_dir() and folder.name.startswith(('two-cubes-floor-', 'coupled-')):
            io.receipt(folder / 'result.json', receipts, guard=True)
            guard_names.append(folder.name)
            proof.update(io.files(folder))
    required = {
        'stageA': (A / 'evidence/api-01/result.json', 'TWO_CUBES_FLOOR_NUMERICAL_SOURCE_NATIVE_CONFIRMED'),
        'referenceReaudit': (A / 'evidence/reference-reaudit-02/result.json', 'REFERENCE_REAUDIT_SIX_REPLIES_BYTE_EQUAL'),
        'stageADesktop': (ROOT / 'output/playwright/two-cubes-floor/floor-desktop01/browser/result.json', 'TWO_CUBES_FLOOR_DESKTOP_NUMERICAL_WORDS_AND_PIXELS_CONFIRMED'),
        'coupled32': (B / 'evidence/public32-01/result.json', 'COUPLED_PUBLIC32_SOURCE_NATIVE_CONFIRMED'),
        'coupled256': (B / 'evidence/trajectory-01/result.json', 'COUPLED_TRAJECTORY256_SOURCE_NATIVE_RESTORE_AND_REGRESSIONS_CONFIRMED'),
        'publicControls': (B / 'evidence/public-controls-01/result.json', 'PUBLIC_CONTROLS_SOURCE_NATIVE_CONFIRMED'),
        'endpointControls': (B / 'evidence/trajectory-controls-01/result.json', 'TRAJECTORY_ENDPOINT_CONTROLS_CONFIRMED'),
        'coupledDesktop': (OUTPUT / desktop_id / 'browser/result.json', 'COUPLED_CUBES_FLOOR_DESKTOP_NUMERICAL_WORDS_AND_PIXELS_CONFIRMED'),
    }
    actual = {}
    for label, (path, status) in required.items():
        io.receipt(path, receipts)
        data = io.read_json(path)
        io.require(data['status'] == status, 'required actual PASS: ' + label)
        for key in ('failure', 'firstFailure', 'fatal'):
            io.require(data.get(key) is None, 'required PASS failure field: ' + label)
        actual[label] = data
    for graph in ('source', 'native'):
        a = actual['stageA']['counts'][graph]
        io.require(a['worlds'] == 9 and a['acceptedSteps'] == 1022 and a['replayedSteps'] == 4, 'StageA population')
        p = actual['coupled32']['reports'][graph]
        io.require(p['worlds'] == 1 and p['acceptedSteps'] == 32 and p['oracleRequests'] == 32, 'coupled32 population')
        t = actual['coupled256']['reports'][graph]
        io.require(t['worlds'] == 6 and t['acceptedSteps'] == 786 and t['mainSteps'] == 256 and
                   t['restoredReplaySteps'] == 4 and t['restoredContinueSteps'] == 4, 'coupled256 population')
        c = actual['publicControls']['reports'][graph]['count']
        io.require(c['worlds'] == 7 and c['successfulReturnedSteps'] == 13, 'failure controls population')
    for label, contacts in (('stageADesktop', {'left': 27, 'right': 47}), ('coupledDesktop', {'lower': 1, 'upper': 27})):
        data = actual[label]
        a = data['actual']
        io.require(data['sourceIntegrity'] is True and a['worlds'] == 2 and a['acceptedSteps'] == 256 and
                   a['frames'] == 257 and a['firstContacts'] == contacts and a['errors'] == [] and
                   a['capture']['result']['status'] == 'CAPTURE_EQUAL' and
                   a['flightPixels']['changedPixels'] > 10, 'desktop complete state/word/pixel proof: ' + label)
    for label in ('stageA', 'coupled32', 'coupled256'):
        io.require(actual[label]['sourceIntegrity'] == 'PASS', 'source integrity: ' + label)
    reaudit = actual['referenceReaudit']
    io.require(len(reaudit['checks']) == 6 and reaudit['newWorldCalls'] == 0 and
               reaudit['newTrajectoryCalls'] == 0 and reaudit['criteriaChanged'] is False and
               reaudit['productionChanged'] is False, 'reaudit is byte comparison only')
    old_inputs = B / 'baseline/pre-library-fix/loaded-inputs.tar.gz'
    io.require(old_inputs in proof, 'original484 loaded-input source archive retained')
    for path in sorted(proof):
        if path.name not in ('result.json', 'summary.json', 'report.json') or path.stat().st_size > io.LIMIT:
            continue
        data = io.read_json(path)
        if isinstance(data, dict) and isinstance(data.get('status'), str):
            receipts.setdefault(io.relative(path), {'status': data['status'], **io.pin(path),
                                                    'historicalStatusPreserved': True})
    value = dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION', baseCommit='290f8aef0',
        dependencies=dependencies,
        scope='StageA separated floor impacts and StageB coupled two-cube floor island: independent numerical/public failure and actual Native desktop evidence; original failures preserved',
        explicitDesktopId=desktop_id, requiredActualReceipts=actual,
        qualificationBoundaries={
            'stageA': {'worldsPerGraph': 9, 'acceptedStepsPerGraph': 1022, 'primaryDtHz': [60, 120, 240]},
            'coupledFirst32': {'worldsPerGraph': 1, 'acceptedStepsPerGraph': 32, 'oldIndependentPrefixRepliesPerGraph': 32},
            'coupled256AndRegressions': {'worldsPerGraph': 6, 'acceptedStepsPerGraph': 786,
                'main': 256, 'replayed': 4, 'continued': 4, 'separated120Hz': 256, 'gravityFall': 256,
                'positiveRestitutionPair': 8, 'stationary': 2},
            'publicFailureControls': {'worldsPerGraph': 7, 'successfulReturnedStepsPerGraph': 13,
                'ordinaryAndUntrustedDiagnosticCopies': 'DISTINCT_SCOPES'},
            'desktopEachStage': {'worldsIncludingZeroStepReset': 2, 'acceptedSteps': 256, 'fullStateFrames': 257},
            'threePhysicsGates': ['StageA independent separated numerical', 'coupled actual public first32 independent prefix', 'coupled full256 independent trajectory plus restore/regressions'],
            'currentPublicProfile': 'rigid-persistent-box-v1', 'bodyCap': 4,
            'islandSubset': 'direct broadphase, awake unfiltered boxes, zero restitution and static/dynamic friction, noCCD/nojoints',
            'remainingProfilesAndFirstFailures': 'NO_SCOPE_UPGRADE',
            'generalEightDynamicQualified': False, 'mobile': 'NOT_RUN', 'publication': False},
        providerBindings={'unchangedFromCheckpoint11Claim': False,
                          'productionWorldAndPrivateIslandModuleChanged': True,
                          'emittedByteCopiesAreProofArtifactsNotNewPhysicsCalls': True},
        selectedReceipts=receipts, preservedFailedCoupledDesktops=preserved_desktop_failures,
        receiptStatusesArePreservedNotUpgraded=True, newPhysicsCalls=0, newReferenceCalls=0,
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,
        selectionRecord={'guardPrefixes': ['two-cubes-floor-', 'coupled-'],
            'checkpointWrapperPrefixExcluded': 'stack-coupled-',
            'explicitPassedDesktop': desktop_id, 'futureThreeCubesFolderIncluded': False,
            'original484LoadedInputsArchive': io.relative(old_inputs)},
        archiveInputLimitBytesPerFile=io.LIMIT, selectedInputLimitBytes=io.TOTAL_LIMIT,
        externalLocalOriginalsNotInArchives={}, archives={})
    total, count = 0, 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-12-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with archive.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for path in sorted(paths):
                item, name = io.pin(path), io.relative(path)
                if item['bytes'] > io.LIMIT:
                    value['externalLocalOriginalsNotInArchives'][name] = {
                        **item, 'notInGit': True, 'includedInArchives': False}
                    continue
                total += item['bytes']
                count += 1
                io.require(total <= io.TOTAL_LIMIT and count <= io.MEMBER_LIMIT, 'selected byte/member limit')
                mode = stat.S_IMODE(path.stat().st_mode)
                members[name] = {**item, 'mode': mode}
                entry = tarfile.TarInfo(name)
                entry.mode, entry.mtime = mode, 0
                key = item['sha256'], item['bytes'], mode
                if key in first:
                    entry.type, entry.linkname = tarfile.LNKTYPE, first[key]
                    tar.addfile(entry)
                else:
                    first[key], entry.size = name, item['bytes']
                    with path.open('rb') as stream:
                        tar.addfile(entry, stream)
                io.require(io.pin(path) == item, 'input changed while archiving: ' + name)
        value['archives'][role] = dict(file=archive.name, **io.pin(archive),
            members=members, uniqueBlobs=len(first))
    value['selectedInputBytes'], value['selectedMemberCount'] = total, count
    result = io.verify(value)
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--build', action='store_true')
    mode.add_argument('--verify', action='store_true')
    parser.add_argument('--desktop')
    args = parser.parse_args()
    if args.build:
        io.require(args.desktop is not None, '--build requires explicit --desktop')
        result = build(args.desktop)
    else:
        io.require(args.desktop is None, '--verify uses immutable manifest desktop selection')
        result = io.verify(io.read_json(MANIFEST))
    print(json.dumps(result))
