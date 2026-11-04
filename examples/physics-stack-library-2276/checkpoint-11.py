"""Incremental dynamic finite-bank + desktop checkpoint; pure Root-owned archive IO."""
import gzip
import importlib.util
import json
from pathlib import Path
import stat
import sys
import tarfile

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
spec = importlib.util.spec_from_file_location('checkpoint08_io', HOME / 'checkpoint-08.py')
io = importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)
MANIFEST = HOME / 'CHECKPOINT-11.json'
BASE = ROOT / 'examples/physics-stack-dynamic-next-2276'
OUTPUT = ROOT / 'output/playwright/dynamic-next'
GUARDS = ROOT / 'examples/physics-world-p5-2276/evidence'


def provider_bindings(prior, live):
    prefixes = (
        ('source', 'packages/barocss-physics/src/'),
        ('proof', 'packages/barocss-physics/dist/'),
        ('proof', 'examples/physics-stack-stationary-world-2276/evidence/public-source-01/source-modules/'),
    )
    bindings = {}
    for role, prefix in prefixes:
        members = {name: {k: item[k] for k in ('bytes', 'sha256')}
                   for name, item in prior['archives'][role]['members'].items()
                   if name.startswith(prefix)}
        io.require(members, 'checkpoint10 provider graph missing: ' + prefix)
        if live:
            current = {io.relative(path): io.pin(path) for path in io.files(ROOT / prefix)}
            io.require(current == members, 'current provider differs from checkpoint10: ' + prefix)
        bindings[prefix] = dict(checkpoint10ArchiveRole=role, files=members,
                                liveBytesComparedAtBuild=live, physicsCalls=0)
    return bindings


def verify(value):
    result = io.verify(value)
    prior = io.read_json(HOME / 'CHECKPOINT-10.json')
    expected = provider_bindings(prior, False)
    for prefix, group in value['unchangedProviderBindings'].items():
        io.require(group['files'] == expected[prefix]['files'] and
                   group['checkpoint10ArchiveRole'] == expected[prefix]['checkpoint10ArchiveRole'] and
                   group['liveBytesComparedAtBuild'] is True,
                   'provider metadata binding mismatch: ' + prefix)
    return result


def build():
    io.require(not MANIFEST.exists(), 'immutable manifest exists')
    for role in ('SOURCE', 'PROOF'):
        io.require(not (HOME / ('CHECKPOINT-11-' + role + '.tar.gz')).exists(),
                   'immutable archive exists; no overwrite or deletion')
    prior = io.read_json(HOME / 'CHECKPOINT-10.json')
    bindings = provider_bindings(prior, True)
    source = {Path(__file__).resolve(), HOME / 'checkpoint-08.py'}
    for path in io.files(BASE):
        if not {'evidence', 'output', 'node_modules', '__pycache__'}.intersection(path.relative_to(BASE).parts):
            source.add(path)
    source.update(ROOT / p for p in (
        'packages/barocss-physics/ROADMAP.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'apps/library-docs/docs/reference/physics-verification.md',
        'apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    readme = ROOT / 'packages/barocss-physics/README.md'
    old_readme = prior['archives']['source']['members'].get(io.relative(readme))
    if old_readme is None or io.pin(readme) != {k: old_readme[k] for k in ('bytes', 'sha256')}:
        source.add(readme)
    proof = set(io.files(BASE / 'evidence/api-01'))
    for name in ('dynamic-desktop-01', 'dynamic-desktop-02', 'dynamic-desktop-03', 'diagnostic-01'):
        proof.update(io.files(OUTPUT / name))
    receipts = {}
    names = sorted(p.name for p in GUARDS.iterdir() if p.is_dir() and
                   p.name.startswith(('dynamic-next-', 'dynamic-render-diagnostic')))
    for name in names:
        folder = GUARDS / name
        io.receipt(folder / 'result.json', receipts, guard=True)
        proof.update(io.files(folder))
    io.require('dynamic-next-api-01' in names and 'dynamic-next-desktop-03' in names,
               'required terminal bank/desktop guards')
    api_path, desktop_path = BASE / 'evidence/api-01/result.json', OUTPUT / 'dynamic-desktop-03/browser/result.json'
    io.receipt(api_path, receipts)
    io.receipt(desktop_path, receipts)
    api, desktop = io.read_json(api_path), io.read_json(desktop_path)
    io.require(api['status'] == 'DYNAMIC_NEXT_NUMERICAL_SOURCE_NATIVE_CONFIRMED' and
               api['sourceIntegrity'] == 'PASS', 'actual numerical PASS required')
    for graph in ('source', 'native'):
        io.require(api['counts'][graph]['worlds'] == 11 and
                   api['counts'][graph]['acceptedSteps'] == 1018 and
                   api['counts'][graph]['replayedSteps'] == 4,
                   'actual numerical population ' + graph)
    io.require(desktop['status'] == 'DYNAMIC_NEXT_DESKTOP_NUMERICAL_WORDS_AND_PIXELS_CONFIRMED' and
               desktop['sourceIntegrity'] is True and desktop['firstFailure'] is None,
               'actual desktop03 PASS required before archive')
    io.require(desktop['actual']['worlds'] == 3 and desktop['actual']['acceptedSteps'] == 512,
               'actual desktop3Worlds512steps')
    for item in desktop['actual']['results']:
        io.require(item['calls'] == 256 and item['frames'] == 257 and
                   item['capture']['result']['status'] == 'CAPTURE_EQUAL',
                   'actual complete case words required')
    io.require({item['caseId'] for item in desktop['actual']['results']} == {'gravity-fall', 'delayed-pair'},
               'exact two desktop inputs')
    failures = {}
    for name in ('dynamic-desktop-01', 'dynamic-desktop-02'):
        path = OUTPUT / name / 'browser/result.json'
        io.receipt(path, receipts)
        failures[name] = io.read_json(path)
        io.require(failures[name]['status'] == 'DYNAMIC_NEXT_DESKTOP_NO_GO', 'preserved first UI failure')
    for path in sorted(proof):
        if path.name not in ('result.json', 'summary.json', 'report.json') or path.stat().st_size > io.LIMIT:
            continue
        data = io.read_json(path)
        if isinstance(data, dict) and isinstance(data.get('status'), str):
            receipts.setdefault(io.relative(path), {'status': data['status'], **io.pin(path),
                                                    'historicalStatusPreserved': True})
    value = dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
        baseCommit='db3e7dc98',
        dependencies={io.relative(HOME / name): io.pin(HOME / name) for name in (
            'CHECKPOINT-10.json', 'CHECKPOINT-10-SOURCE.tar.gz', 'CHECKPOINT-10-PROOF.tar.gz')},
        scope='Incremental existing persistent public1/2body dynamic finite bank + same-stage actual Native desktop; first UI observer/transition failures unchanged',
        unchangedProviderBindings=bindings,
        providerComparisonIsHashIOOnlyNotNewNumericalProof=True,
        numericalReceipt=api, desktopReceipt=desktop,
        preservedFirstUiFailures=failures,
        qualificationBoundaries={
            'profile': 'rigid-persistent-box-v1', 'dynamicBodies': 'one cube with static floor or isolated equal-mass pair',
            'sourceAndNativeWorldsEach': 11, 'sourceAndNativeAcceptedStepsEach': 1018,
            'restoredReplayStepsEach': 4, 'primaryCaseTransitionsEach': 932,
            'desktopWorldsIncludingZeroStepReset': 3, 'desktopAcceptedSteps': 512,
            'desktopFullFramesEachCase': 257,
            'sameNativeProvider': api['reports']['native']['providerDigest'],
            'newSolver': False, 'newProfile': False, 'generalEightDynamicQualified': False,
            'broaderWholeEngineAndOldFirstFailures': 'NO_SCOPE_UPGRADE',
            'mobile': 'NOT_RUN', 'publication': False},
        selectedReceipts=receipts, receiptStatusesArePreservedNotUpgraded=True,
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,
        selectionRecord={'guardPrefixes': ['dynamic-next-', 'dynamic-render-diagnostic'],
                         'checkpointWrapperPrefixExcluded': 'stack-dynamic-',
                         'currentProviderBytesRearchived': False,
                         'providerBytesRetainedByCheckpoint10Dependency': True},
        archiveInputLimitBytesPerFile=io.LIMIT, selectedInputLimitBytes=io.TOTAL_LIMIT,
        externalLocalOriginalsNotInArchives={}, archives={})
    total, count = 0, 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-11-' + role.upper() + '.tar.gz')
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
    io.require(sys.argv[1:] in (['--build'], ['--verify']), '--build or --verify required')
    print(json.dumps(build() if sys.argv[1] == '--build' else verify(io.read_json(MANIFEST))))
