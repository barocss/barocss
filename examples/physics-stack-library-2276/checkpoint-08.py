#!/usr/bin/env python3
"""Immutable incremental checkpoint. Pure file I/O; no physics execution.

Run --build only after the owner has finished the selected campaigns.
--verify reads the immutable manifest and archives; it never runs a candidate.
"""
import gzip
import hashlib
import json
from pathlib import Path
import stat
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
HOME = Path(__file__).resolve().parent
MANIFEST = HOME / 'CHECKPOINT-08.json'
LIMIT = 16 * 2**20
TOTAL_LIMIT = 512 * 2**20
MEMBER_LIMIT = 50000
LIBRARY = HOME / 'evidence'
COMPLETE = ROOT / 'examples/physics-stack-complete-2276'
GUARD_HOME = ROOT / 'examples/physics-world-p5-2276/evidence'
AUXILIARY = {
    'physics-stack-stream-native-crc-2276': ('controls-01', 'exact-01', 'identity-01'),
    'physics-stack-evidence-refs-2276': ('raw-strings-01', 'integer-representation-01',
                                       'front-dictionary-01', 'fraction-hex-01'),
}
GUARDS = (
 'stack-failure-evidence-additional-01', 'stack-full04-offline-recovery-01',
 'stack-full04-preserve-01', 'stack-library-arithmetic-opt09-01',
 'stack-library-build-12', 'stack-opt09-canonical-arithmetic-01',
 'stack-native-crc-controls-01', 'stack-native-crc-full04-recovery-01',
 'stack-phase-checkpoint-controls-01',
 'stack-raw-string-measure-01', 'stack-integer-representation-measure-01',
 'stack-front-dictionary-measure-01', 'stack-fraction-hex-measure-01',
) + tuple('stack-opt09-' + kind + '-01' for kind in (
 'boundary', 'physical-parity', 'retained06', 'retained07', 'retained16',
 'retained25', 'retained26', 'retained32'))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def relative(path):
    return path.relative_to(ROOT).as_posix()


def pin(path):
    require(path.is_file() and not path.is_symlink(), 'regular file required: ' + str(path))
    digest, size = hashlib.sha256(), 0
    before = path.stat()
    with path.open('rb') as stream:
        while block := stream.read(65536):
            size += len(block)
            digest.update(block)
    after = path.stat()
    require((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns)
            and size == after.st_size, 'file changed while hashing: ' + str(path))
    return {'bytes': size, 'sha256': digest.hexdigest()}


def files(folder, recursive=True):
    require(folder.is_dir() and not folder.is_symlink(), 'missing folder: ' + str(folder))
    paths = folder.rglob('*') if recursive else folder.iterdir()
    return sorted(p for p in paths if p.is_file() and '__pycache__' not in p.parts)


def read_json(path):
    require(path.stat().st_size <= LIMIT, 'JSON artifact bound: ' + str(path))
    blocks = []
    with path.open('rb') as stream:
        while block := stream.read(65536):
            blocks.append(block)
    return json.loads(b''.join(blocks))


def receipt(path, receipts, guard=False):
    require(path.is_file() and path.stat().st_size <= LIMIT, 'missing/big receipt: ' + str(path))
    value = read_json(path)
    status = value.get('status')
    require(isinstance(status, str) and status and
            not any(token in status.upper() for token in ('RUNNING', 'PENDING', 'PREPARED', 'IN_PROGRESS')),
            'terminal receipt required: ' + str(path))
    if guard:
        require(value.get('processClosed') is True and value.get('finishedAt'),
                'closed guard required: ' + str(path))
    receipts[relative(path)] = {'status': status, **pin(path)}


def select():
    source, proof, receipts = set(), set(), {}
    source.add(ROOT / 'packages/barocss-physics/src/stack/strict-line.ts')
    source.update(ROOT / name for name in (
        'packages/barocss-physics/ROADMAP.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    # Checkpoint07 dependency retains earlier source/proof archives.
    for path in files(HOME, False):
        name = path.name.lower()
        if (any(token in name for token in ('opt09', 'optimization-09'))
                or path.name in ('RESULTS.md', 'bundle.mjs', 'io.mjs', 'io.test.mjs',
                                 'run.mjs', 'campaign.mts', 'boundary-run.mjs',
                                 'boundary.test.mts', 'checkpoint-08.py')):
            source.add(path)
    for name in ('strict-line-opt08.ts',):
        source.add(HOME / 'baseline' / name)
    source.update(files(COMPLETE, False))
    for path in files(COMPLETE / 'baseline'):
        if path.name.startswith(('full-03-', 'full-04-', 'full-05-', 'pre-opt09-', 'pre-native-crc-')):
            source.add(path)
    require((COMPLETE / 'baseline/pre-native-crc-PINS.json').is_file(), 'pre-native-crc preservation required')
    for folder, runs in AUXILIARY.items():
        base = ROOT / 'examples' / folder
        source.update(files(base, False))
        for run in runs:
            folder = base / 'evidence' / run
            proof.update(files(folder))
            for name in ('summary.json', 'measurement.json', 'history-result.json'):
                if (folder / name).is_file():
                    receipt(folder / name, receipts)
    runs = sorted(p for p in LIBRARY.iterdir() if p.is_dir() and (
        p.name in ('run-13', 'boundary-opt09-01', 'canonical-opt09-01')
        or (p.name.startswith('arithmetic-') and 'opt09' in p.name)))
    for required in ('run-13', 'boundary-opt09-01', 'canonical-opt09-01'):
        require(any(p.name == required for p in runs), 'missing library run: ' + required)
    for folder in runs:
        if not folder.name.startswith('canonical-'):
            receipt(folder / 'result.json', receipts)
        else:
            require((folder / 'provenance.json').is_file(), 'canonical provenance required')
        proof.update(files(folder))
    for run in ('prefix-05', 'prefix-06', 'full-04', 'full-05'):
        folder = COMPLETE / 'evidence' / run
        receipt(folder / 'campaign-result.json', receipts)
        proof.update(files(folder))
    optional_guards = ('stack-library-docbuild-07', 'stack-library-docsite-07',
                       'stack-full05-offline-recovery-01', 'stack-full05-preserve-01')
    actual_guards = GUARDS + tuple(name for name in optional_guards
                                  if (GUARD_HOME / name / 'result.json').is_file())
    for name in actual_guards:
        folder = GUARD_HOME / name
        receipt(folder / 'result.json', receipts, guard=True)
        proof.update(files(folder, False))
    selection, external, total = {}, {}, 0
    for role, paths in (('source', source), ('proof', proof)):
        bounded = []
        for path in sorted(paths):
            require(not path.is_symlink(), 'symlink input: ' + str(path))
            item = pin(path)
            if item['bytes'] > LIMIT:
                external[relative(path)] = {**item, 'notInGit': True, 'includedInArchives': False}
            else:
                bounded.append(path)
                total += item['bytes']
        selection[role] = bounded
    require(total <= TOTAL_LIMIT, 'selected input byte bound exceeded')
    require(sum(map(len, selection.values())) <= MEMBER_LIMIT, 'selected member bound exceeded')
    return selection, external, receipts


def verify(value):
    for name, expected in value['dependencies'].items():
        require(pin(ROOT / name) == expected, 'dependency mismatch: ' + name)
    for name, expected in value['externalLocalOriginalsNotInArchives'].items():
        require(pin(ROOT / name) == {k: expected[k] for k in ('bytes', 'sha256')},
                'external original mismatch: ' + name)
    result = {}
    for role, archive in value['archives'].items():
        path = HOME / archive['file']
        require(pin(path) == {k: archive[k] for k in ('bytes', 'sha256')}, 'archive mismatch')
        count, seen = 0, {}
        names = list(archive['members'])
        with tarfile.open(path, 'r:gz') as tar:
            for member in tar:
                require(count < MEMBER_LIMIT, 'archive member bound exceeded')
                require(member.name == names[count], 'member order mismatch')
                require(not member.name.startswith('/') and '..' not in Path(member.name).parts,
                        'unsafe member name')
                expected = archive['members'][member.name]
                require(member.isfile() or member.islnk(), 'unsupported member type')
                require(member.mode == expected['mode'] and member.mtime == 0,
                        'member mode/time mismatch: ' + member.name)
                if member.islnk():
                    require(member.linkname in seen and seen[member.linkname] == expected,
                            'invalid dedup link: ' + member.name)
                require(expected['bytes'] <= LIMIT, 'member byte bound exceeded')
                digest, size = hashlib.sha256(), 0
                with tar.extractfile(member) as stream:
                    while block := stream.read(65536):
                        size += len(block)
                        require(size <= LIMIT, 'member read bound exceeded')
                        digest.update(block)
                require(size == expected['bytes'] and digest.hexdigest() == expected['sha256'],
                        'member content mismatch: ' + member.name)
                seen[member.name] = expected
                count += 1
        require(count == len(archive['members']), 'member count mismatch')
        result[role] = {**pin(path), 'members': count, 'uniqueBlobs': archive['uniqueBlobs']}
    return result


def observed_layers():
    result = {}
    for run in ('full-04', 'full-05'):
        folder = COMPLETE / 'evidence' / run
        def observed(path):
            return {'present': path.is_file(), 'receipt': read_json(path) if path.is_file() else None}
        layers = {key: observed(folder / name) for key, name in (
            ('campaign', 'campaign-result.json'), ('offlineRecovery', 'offline-recovery.json'),
            ('offlineRecoveryFailure', 'recovery-failure.json'))}
        layers['scenes'] = {}
        for scene in ('ALIGNED', 'OFFSET', 'YAW'):
            layers['scenes'][scene] = {key: observed(folder / scene / name) for key, name in (
                ('owner', 'summary.json'), ('host', 'host/result.json'),
                ('closedPhaseProgress', 'host/phase-checkpoint.json'),
                ('closure', 'host/closure.json'))}
        result[run] = layers
    return result


def build():
    require(not MANIFEST.exists(), 'immutable manifest already exists')
    for role in ('SOURCE', 'PROOF'):
        require(not (HOME / ('CHECKPOINT-08-' + role + '.tar.gz')).exists(),
                'immutable archive already exists; no overwrite or cleanup')
    receipt(COMPLETE / 'evidence/full-05/campaign-result.json', {})
    selected, external, receipts = select()
    full05 = read_json(COMPLETE / 'evidence/full-05/campaign-result.json')
    full04 = read_json(COMPLETE / 'evidence/full-04/campaign-result.json')
    dependencies = ['CHECKPOINT-07.json', 'CHECKPOINT-07-SOURCE.tar.gz', 'CHECKPOINT-07-PROOF.tar.gz']
    value = {
        'status': 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
        'baseCommit': '02aabfd622c33d5a51485df91f23f9e9b55bee7d',
        'dependencies': {relative(HOME / n): pin(HOME / n) for n in dependencies},
        'scope': 'Incremental OPT09/native CRC/phase progress/failure11; actual full04/full05 terminal outcomes; no physics execution',
        'API': False, 'originalFullP4Qualification': False,
        'campaignFull04': full04, 'campaignFull05': full05,
        'independentFullPhysicsStepsFull05': full05['independentFullPhysicsSteps'],
        'separateObservedLayers': observed_layers(),
        'artifactSelectionLimitIsNotPhysicsOrMemoryAdmission': True,
        'receiptStatusesArePreservedNotUpgraded': True,
        'selectedReceipts': receipts,
        'archiveInputLimitBytesPerFile': LIMIT,
        'selectedInputLimitBytes': TOTAL_LIMIT,
        'externalLocalOriginalsNotInArchives': external, 'archives': {},
    }
    for role, paths in selected.items():
        path = HOME / ('CHECKPOINT-08-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with path.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for source in paths:
                item = pin(source)
                require(item['bytes'] <= LIMIT, 'input exceeded per-file bound')
                name = relative(source)
                mode = stat.S_IMODE(source.stat().st_mode)
                members[name] = {**item, 'mode': mode}
                entry = tarfile.TarInfo(name)
                entry.mode, entry.mtime = mode, 0
                # Modes must match as well as bytes for a lossless hardlink.
                key = (item['sha256'], item['bytes'], mode)
                if key in first:
                    entry.type, entry.linkname = tarfile.LNKTYPE, first[key]
                    tar.addfile(entry)
                else:
                    first[key], entry.size = name, item['bytes']
                    with source.open('rb') as stream:
                        tar.addfile(entry, stream)
                require(pin(source) == item, 'input changed during archive write: ' + name)
        value['archives'][role] = {'file': path.name, **pin(path),
                                   'members': members, 'uniqueBlobs': len(first)}
    result = verify(value)
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


if __name__ == '__main__':
    require(len(sys.argv) == 2 and sys.argv[1] in ('--build', '--verify'),
            'usage: checkpoint-08.py --build | --verify')
    print(json.dumps(build() if sys.argv[1] == '--build' else verify(read_json(MANIFEST))))
