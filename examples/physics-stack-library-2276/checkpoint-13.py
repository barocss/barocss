"""Checkpoint13: immutable three-cube finite-bank/desktop evidence; pure archive IO."""
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
MANIFEST = HOME / 'CHECKPOINT-13.json'
BASE = ROOT / 'examples/physics-three-cubes-floor-2276'
OUTPUT = ROOT / 'output/playwright/three-cubes-floor'
GUARDS = ROOT / 'examples/physics-world-p5-2276/evidence'
EXPECTED_DEPENDENCIES = {'CHECKPOINT-12.json': {'bytes': 860873, 'sha256': 'b96dea4c0cc3e3c5999a0643b01a6f5fdc13a91f7e69f4acbe504610f11702cc'}, 'CHECKPOINT-12-SOURCE.tar.gz': {'bytes': 443636, 'sha256': 'f9ef62bef3ee8bc3f9a5b221527c3c9cb4ab7de396d22c712ebd4caf86b6b895'}, 'CHECKPOINT-12-PROOF.tar.gz': {'bytes': 3979228, 'sha256': 'c854fc1ae7e9e66a49c58a6702222d3077ab4b1533651f40274c44bf82edc953'}}


def provider_bindings(prior, live):
    prefixes = (
        ('source', 'packages/barocss-physics/src/'),
        ('proof', 'examples/physics-coupled-cubes-floor-2276/evidence/public-build-01/source-modules/'),
        ('proof', 'examples/physics-coupled-cubes-floor-2276/evidence/public-build-01/canonical-provider/dist/'),
    )
    bindings = {}
    for role, prefix in prefixes:
        members = {name: {k: item[k] for k in ('bytes', 'sha256')}
                   for name, item in prior['archives'][role]['members'].items() if name.startswith(prefix)}
        io.require(members, 'checkpoint12 provider graph missing: ' + prefix)
        if live:
            current = {io.relative(p): io.pin(p) for p in io.files(ROOT / prefix)}
            io.require(current == members, 'provider differs from checkpoint12: ' + prefix)
        bindings[prefix] = dict(checkpoint12ArchiveRole=role, files=members,
                                liveBytesComparedAtBuild=live, physicsCalls=0)
    names = [('source', 'packages/barocss-physics/' + name) for name in
             ('package.json', 'build-root.mjs', 'build-types.mjs', 'tsconfig.json')]
    names.append(('proof', 'examples/physics-coupled-cubes-floor-2276/evidence/public-build-01/canonical-provider/package.json'))
    for role, name in names:
        item = prior['archives'][role]['members'][name]
        expected = {k: item[k] for k in ('bytes', 'sha256')}
        if live:
            io.require(io.pin(ROOT / name) == expected, 'provider metadata changed: ' + name)
        bindings[name] = dict(checkpoint12ArchiveRole=role, files={name: expected},
                              liveBytesComparedAtBuild=live, physicsCalls=0)
    return bindings


def verify(value):
    result = io.verify(value)
    prior = io.read_json(HOME / 'CHECKPOINT-12.json')
    expected = provider_bindings(prior, False)
    io.require(set(value['unchangedProviderBindings']) == set(expected), 'provider binding population')
    for name, group in value['unchangedProviderBindings'].items():
        io.require(group['files'] == expected[name]['files'] and
                   group['checkpoint12ArchiveRole'] == expected[name]['checkpoint12ArchiveRole'] and
                   group['liveBytesComparedAtBuild'] is True and group['physicsCalls'] == 0,
                   'provider IO binding metadata: ' + name)
    return result


def build(desktop_id):
    io.require(re.fullmatch(r'three-desktop-[a-zA-Z0-9_-]+', desktop_id), 'explicit desktop ID required')
    io.require(not MANIFEST.exists(), 'immutable manifest exists')
    for role in ('SOURCE', 'PROOF'):
        io.require(not (HOME / ('CHECKPOINT-13-' + role + '.tar.gz')).exists(), 'immutable archive exists')
    dependencies = {io.relative(HOME / name): io.pin(HOME / name) for name in EXPECTED_DEPENDENCIES}
    io.require({Path(name).name: item for name, item in dependencies.items()} == EXPECTED_DEPENDENCIES,
               'immutable checkpoint12 triple changed')
    prior = io.read_json(HOME / 'CHECKPOINT-12.json')
    io.require(prior['status'] == 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION', 'checkpoint12 status')
    bindings = provider_bindings(prior, True)
    source = {Path(__file__).resolve(), HOME / 'checkpoint-08.py'}
    for p in io.files(BASE):
        if not {'evidence', 'baseline', 'output', 'node_modules', '__pycache__'}.intersection(p.relative_to(BASE).parts):
            source.add(p)
    source.update(ROOT / name for name in (
        'packages/barocss-physics/README.md', 'packages/barocss-physics/ROADMAP.md',
        'examples/physics-coupled-cubes-floor-2276/RESULTS.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'apps/library-docs/docs/reference/physics-verification.md',
        'apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md',
        'apps/library-docs/samples/physics-island.test.mjs',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    proof = set(io.files(BASE / 'evidence'))
    if (BASE / 'baseline').is_dir():
        proof.update(io.files(BASE / 'baseline'))
    proof.update(io.files(OUTPUT / desktop_id))
    failures = {}
    for folder in sorted(OUTPUT.iterdir()):
        p = folder / 'browser/result.json'
        if folder.is_dir() and folder.name != desktop_id and p.is_file():
            data = io.read_json(p)
            if data.get('status') == 'THREE_CUBES_FLOOR_DESKTOP_NO_GO':
                proof.update(io.files(folder))
                failures[folder.name] = data
    receipts, guards = {}, []
    for folder in sorted(GUARDS.iterdir()):
        if folder.is_dir() and folder.name.startswith('three-'):
            io.receipt(folder / 'result.json', receipts, guard=True)
            guards.append(folder.name)
            proof.update(io.files(folder))
    paths = {
        'api': BASE / 'evidence/api-01/result.json',
        'checkpoint32': BASE / 'evidence/api-01/checkpoint32-parity.json',
        'controls': BASE / 'evidence/controls-01/result.json',
        'desktop': OUTPUT / desktop_id / 'browser/result.json',
    }
    expected_status = {
        'api': 'THREE_CUBES_FLOOR_SOURCE_NATIVE_256_CONFIRMED',
        'checkpoint32': 'BOTH_GRAPHS_32_INDEPENDENT_AND_ALLWORD_CONFIRMED',
        'controls': 'THREE_CUBES_FLOOR_REFERENCE_CONTROLS_CONFIRMED',
        'desktop': 'THREE_CUBES_FLOOR_DESKTOP_NUMERICAL_WORDS_AND_PIXELS_CONFIRMED',
    }
    actual = {}
    for label, p in paths.items():
        io.receipt(p, receipts)
        data = io.read_json(p)
        io.require(data['status'] == expected_status[label], 'required actual PASS: ' + label)
        for key in ('failure', 'firstFailure'):
            io.require(data.get(key) is None, 'required PASS failure field: ' + label)
        actual[label] = data
    api, controls, desktop = actual['api'], actual['controls'], actual['desktop']
    io.require(api['sourceIntegrity'] == 'PASS' and api['restores'] == 0, 'actual API integrity/no restore')
    io.require(actual['checkpoint32']['frames'] == 33 and
               actual['checkpoint32']['onlyProviderDigestStringNormalized'] is True, 'both actual32 checkpoint parity')
    for graph in ('source', 'native'):
        a = api['reports'][graph]
        io.require(a['worlds'] == 1 and a['stepAttempts'] == 256 and a['acceptedSteps'] == 256 and
                   a['referenceAttempts'] == 2 and a['referenceReplies'] == 2 and
                   a['passedIndependentTransitions'] == 256, 'exact API population: ' + graph)
    io.require(controls['worldCalls'] == 0 and controls['candidateCalls'] == 0 and
               controls['sourceIntegrity'] == 'PASS', 'data-only independent controls')
    a = desktop['actual']
    io.require(desktop['sourceIntegrity'] is True and a['worlds'] == 2 and a['acceptedSteps'] == 256 and
               a['frames'] == 257 and a['firstContacts'] == {'lower': 1, 'middle': 1, 'upper': 27} and
               a['capture']['result']['status'] == 'CAPTURE_EQUAL' and a['errors'] == [] and
               a['initialPixels']['coloredPixels'] > 100 and a['flightPixels']['changedPixels'] > 10,
               'actual full-state/word/GPU desktop population')
    io.require(a['capture']['result']['providerDigest'] == api['reports']['native']['providerDigest'],
               'same actual Native desktop provider')
    for p in sorted(proof):
        if p.name not in ('result.json', 'summary.json', 'report.json') or p.stat().st_size > io.LIMIT:
            continue
        data = io.read_json(p)
        if isinstance(data, dict) and isinstance(data.get('status'), str):
            receipts.setdefault(io.relative(p), {'status': data['status'], **io.pin(p),
                                                'historicalStatusPreserved': True})
    value = dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION', baseCommit='CHECKPOINT12_DEPENDENCY',
        dependencies=dependencies, explicitDesktopId=desktop_id,
        scope='New three dynamic cubes plus static floor, existing direct frictionless public island; independent3DOF chain and same-stage Native GPU/full-word evidence',
        requiredActualReceipts=actual, selectedReceipts=receipts, preservedDesktopFailures=failures,
        unchangedProviderBindings=bindings, providerComparisonIsHashIOOnlyNotNewNumericalProof=True,
        qualificationBoundaries={
            'publicProfile': 'rigid-persistent-box-v1', 'bodyCap': 4, 'dynamicCubes': 3, 'staticFloors': 1,
            'graphWorldsEach': 1, 'graphAcceptedStepsEach': 256, 'graphReferenceCallsEach': 2,
            'checkpoint32RequiredBeforeEitherGraph33': True, 'framesPerGraph': 257,
            'newThreeCubeRestores': 0, 'priorCoupledRestoreIsNotThreeCubeRestore': True,
            'desktopWorldsIncludingZeroStepReset': 2, 'desktopAcceptedSteps': 256, 'desktopFrames': 257,
            'independentReferenceVerticalDof': 3, 'productionDofIsNotReferenceDof': True,
            'firstContacts': {'lower': 1, 'middle': 1, 'upper': 27},
            'generalEightDynamicQualified': False, 'remainingProfilesAndFirstFailures': 'NO_SCOPE_UPGRADE',
            'mobile': 'NOT_RUN', 'publication': False},
        newPhysicsCalls=0, newReferenceCalls=0, receiptStatusesArePreservedNotUpgraded=True,
        selectionRecord={'guardPrefixes': ['three-'], 'checkpointWrapperPrefixExcluded': 'stack-three-',
            'explicitPassedDesktop': desktop_id, 'compiledProviderBytesRearchived': False,
            'providerByteArchivesRetainedByCheckpoint12Dependency': True},
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,
        archiveInputLimitBytesPerFile=io.LIMIT, selectedInputLimitBytes=io.TOTAL_LIMIT,
        externalLocalOriginalsNotInArchives={}, archives={})
    total, count = 0, 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-13-' + role.upper() + '.tar.gz')
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
    result = verify(value)
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
        io.require(args.desktop is None, '--verify uses immutable manifest selection')
        result = verify(io.read_json(MANIFEST))
    print(json.dumps(result))
