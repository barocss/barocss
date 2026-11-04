"""Incremental stationary/API/desktop checkpoint. Root runs IO only; no physics calls."""
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
MANIFEST = HOME / 'CHECKPOINT-10.json'
FOLDERS = tuple('physics-stack-stationary-' + name + '-2276' for name in
                ('witness', 'library', 'complete', 'derived', 'gap', 'world')) + (
    'physics-stationary-stack-viewer-2276', 'physics-motion-desktop-2276')
EXCLUDED_SOURCE_PARTS = {'evidence', 'output', 'node_modules', '__pycache__'}


def terminal(path, receipts, guard=False):
    io.receipt(path, receipts, guard=guard)
    return io.read_json(path)


def select():
    source = {Path(__file__).resolve(), HOME / 'checkpoint-08.py', HOME / 'checkpoint-09.py'}
    source.update(io.files(ROOT / 'packages/barocss-physics/src'))
    source.update(ROOT / p for p in (
        'packages/barocss-physics/package.json', 'packages/barocss-physics/build-root.mjs',
        'packages/barocss-physics/build-types.mjs', 'packages/barocss-physics/tsconfig.json',
        'packages/barocss-physics/ROADMAP.md', 'packages/barocss-physics/README.md',
        'apps/library-docs/docs/reference/physics-verification.md',
        'apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    proof, receipts = set(io.files(ROOT / 'packages/barocss-physics/dist')), {}
    for folder in FOLDERS:
        base = ROOT / 'examples' / folder
        io.require(base.is_dir(), 'required stationary/motion folder: ' + folder)
        for path in io.files(base):
            parts = path.relative_to(base).parts
            if not EXCLUDED_SOURCE_PARTS.intersection(parts):
                source.add(path)
        if (base / 'evidence').is_dir():
            proof.update(io.files(base / 'evidence'))
    plan = ROOT / 'examples/physics-stack-dynamic-next-2276/PLAN.md'
    if plan.is_file():
        source.add(plan)
    # Reused, unchanged scene inputs are distinct from the new adapter.
    original = ROOT / 'examples/physics-persistent-impact-2276'
    source.update(io.files(original / 'scene'))
    source.add(original / 'browser-checks.js')
    for name in ('desktop-01', 'desktop-formal-01'):
        proof.update(io.files(ROOT / 'output/playwright/stationary-stack' / name))
    for name in ('physics-motion', 'persistent-impact'):
        proof.update(io.files(ROOT / 'output/playwright' / name / 'motion-native-01'))
    guards = ROOT / 'examples/physics-world-p5-2276/evidence'
    names = {p.name for p in guards.iterdir() if p.is_dir() and p.name.startswith('stationary-')}
    names.update(('stack-library-build-14', 'stack-library-build-15',
                  'motion-native-desktop-01', 'motion-native-desktop-build-01',
                  'stack-library-docbuild-09', 'stack-library-docsite-09'))
    names.update(p.name for p in guards.iterdir() if p.is_dir() and
                 p.name.endswith('-09') and ('docbuild' in p.name or 'docsite' in p.name))
    for name in sorted(names):
        folder = guards / name
        terminal(folder / 'result.json', receipts, guard=True)
        proof.update(io.files(folder))
    # Preserve first FAIL/UNKNOWN and intermediate historical statuses verbatim.
    # These are records, not admission predicates or upgrades to the latest result.
    for path in sorted(proof):
        if path.name not in ('result.json', 'summary.json', 'campaign-result.json',
                             'report.json', 'ROOT-RESULT.json') or path.stat().st_size > io.LIMIT:
            continue
        value = io.read_json(path)
        if isinstance(value, dict) and isinstance(value.get('status'), str):
            receipts.setdefault(io.relative(path), {'status': value['status'], **io.pin(path),
                'historicalStatusPreserved': True})
    return source, proof, receipts, plan


def build():
    io.require(not MANIFEST.exists(), 'fresh checkpoint manifest required')
    for role in ('SOURCE', 'PROOF'):
        io.require(not (HOME / ('CHECKPOINT-10-' + role + '.tar.gz')).exists(),
                   'immutable archive exists; no overwrite or deletion')
    source, proof, receipts, plan = select()
    complete = ROOT / 'examples/physics-stack-stationary-complete-2276/evidence/full-01/campaign-result.json'
    full = terminal(complete, receipts)
    io.require(full['status'] == 'ORIGINAL_INDEPENDENT_PHYSICS_3600_CONFIRMED', 'actual original full stationary result')
    io.require(full['independentFullPhysicsSteps'] == 3600 and full['contiguousPhysicalAccepted'] == 3600,
               'actual stationary full counts')
    public = {}
    for graph, run in (('source', 'public-source-01'), ('native', 'public-native-02')):
        path = ROOT / 'examples/physics-stack-stationary-world-2276/evidence' / run / 'result.json'
        public[graph] = terminal(path, receipts)
        io.require(public[graph]['status'] == 'PUBLIC_WORLD_CONTROLS_AND_ORIGINAL_3600_WORDS_CONFIRMED',
                   'actual public source/native full output result')
    desktop = {}
    for scene in ('ALIGNED', 'OFFSET', 'YAW'):
        path = ROOT / 'output/playwright/stationary-stack/desktop-formal-01' / (scene + '-browser') / 'result.json'
        desktop[scene] = terminal(path, receipts)
        io.require(desktop[scene]['status'] == 'DESKTOP_SCENE_OBSERVED_AND_WORD_EQUAL', 'actual desktop scene result')
    motion_path = ROOT / 'output/playwright/persistent-impact/motion-native-01/report.json'
    motion = terminal(motion_path, receipts)
    io.require(motion['status'] == 'CURRENT_NATIVE_MOTION_DESKTOP_CONFIRMED', 'actual dynamic desktop result')
    value = dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
        baseCommit='cac3b204c035a9d1586324875cd846176368f63c',
        scope='Stationary exact normal private original3600, public same-profile Source/Native3600 each, actual desktop word proof; separate existing1/2body Native motion desktop',
        dependencies={io.relative(HOME / n): io.pin(HOME / n) for n in (
            'CHECKPOINT-09.json', 'CHECKPOINT-09-SOURCE.tar.gz', 'CHECKPOINT-09-PROOF.tar.gz')},
        originalStationaryCampaign=full,
        qualificationBoundaries={
            'stationary': {'publicProfile': 'rigid-stationary-cube-stack-v1',
                'dynamicBodies': 8, 'staticBodies': 1, 'stepsPerOriginalScene': 1200,
                'sceneNames': ['ALIGNED', 'OFFSET', 'YAW'], 'independentPrivateSteps': 3600,
                'publicSourceReceipt': io.relative(ROOT / 'examples/physics-stack-stationary-world-2276/evidence/public-source-01/result.json'),
                'publicNativeReceipt': io.relative(ROOT / 'examples/physics-stack-stationary-world-2276/evidence/public-native-02/result.json'),
                'publicOutputWordsReusePaidPrivateOracle': True,
                'desktopSameWorldFramesEachScene': 1201, 'desktopWorldsIncludingZeroStepReset': 4,
                'generalEightBodyDynamicsQualified': False},
            'motionDesktop': {'profile': 'rigid-persistent-box-v1', 'population': 'existing1/2body finite impact presets',
                'receipt': io.relative(motion_path), 'status': motion['status'],
                'physicsBoundary': 'actual build15 dist root/replay',
                'displayBoundary': 'existing Viewer/GPU Source dependencies',
                'eightBodyDynamicsQualified': False},
            'broaderOldWholeP4AndFirstFailures': 'PRESERVED_NO_SCOPE_UPGRADE',
            'optionalStrict64MiBProfile': 'UNKNOWN_NOT_PROMOTED',
            'mobile': 'NOT_RUN', 'publication': False,
            'dynamicNextPlan': {'present': plan.is_file(), 'executedByCheckpoint': False}},
        desktopSceneReceipts={name: {'status': item['status'], 'observed': item.get('observed')}
                              for name, item in desktop.items()},
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,
        receiptStatusesArePreservedNotUpgraded=True, selectedReceipts=receipts,
        archiveInputLimitBytesPerFile=io.LIMIT, selectedInputLimitBytes=io.TOTAL_LIMIT,
        externalLocalOriginalsNotInArchives={}, archives={})
    total, member_count = 0, 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-10-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with archive.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for path in sorted(paths):
                item, name = io.pin(path), io.relative(path)
                if item['bytes'] > io.LIMIT:
                    value['externalLocalOriginalsNotInArchives'][name] = {
                        **item, 'notInGit': True, 'includedInArchives': False}
                    continue
                total += item['bytes']
                member_count += 1
                io.require(total <= io.TOTAL_LIMIT and member_count <= io.MEMBER_LIMIT,
                           'selected input byte/member limit')
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
                io.require(io.pin(path) == item, 'input changed during archive write: ' + name)
        value['archives'][role] = dict(file=archive.name, **io.pin(archive),
            members=members, uniqueBlobs=len(first))
    result = io.verify(value)
    value['selectedInputBytes'], value['selectedMemberCount'] = total, member_count
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


if __name__ == '__main__':
    io.require(sys.argv[1:] in (['--build'], ['--verify']), '--build or --verify required')
    print(json.dumps(build() if sys.argv[1] == '--build' else io.verify(io.read_json(MANIFEST))))
