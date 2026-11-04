#!/usr/bin/env python3
"""Archive IO only: build/verify a deterministic delta over the committed checkpoint."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / 'examples/physics-stack-library-2276'
BASE = 'bfa78f768213ad29deb0c02b200e9ec7a2a5f1f9'
INDEX = 'examples/physics-stack-library-2276/ARCHIVE-02.json'
MANIFEST = HOME / 'DELTA-03.json'
BASE_ALIAS = '.DELTA-03-BASE/'
NEW_BLOB = '.DELTA-03-BLOBS/'
CHUNK = 65536


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as stream:
        for data in iter(lambda: stream.read(CHUNK), b''):
            value.update(data)
    return value.hexdigest()


def base_index():
    raw = subprocess.check_output(['git', 'show', f'{BASE}:{INDEX}'], cwd=ROOT)
    value = json.loads(raw)
    assert (ROOT / INDEX).read_bytes() == raw, 'committed base index changed'
    for role in ('source', 'proof'):
        item = value[role]
        path = HOME / item['archive']
        assert path.stat().st_size == item['bytes'] and digest(path) == item['sha256']
    return value, hashlib.sha256(raw).hexdigest()


def inputs(index):
    previous = {}
    old_content = {}
    for role in ('source', 'proof'):
        archive = index[role]
        for name, info in archive['inputs'].items():
            previous[name] = info
            old_content.setdefault(info['sha256'], {'archive': archive['archive'], 'member': name, **info})
    old_source = index['source']['inputs']
    source = [ROOT / name for name in old_source if name.startswith('packages/barocss-physics/src/stack/')]
    source.extend(ROOT / f'packages/barocss-physics/src/stack/OPTIMIZATION-0{n}.json' for n in (2, 3, 4))
    names = {PurePosixPath(name).name for name in old_source if PurePosixPath(name).parent.as_posix() == HOME.relative_to(ROOT).as_posix()}
    names.update(['OPTIMIZATION-03-CONTRACT.md', 'OPTIMIZATION-04-CONTRACT.md', 'checkpoint-delta03.py', 'arithmetic-run.mjs', 'arithmetic.test.mts'])
    for n in (2, 3, 4):
        names.update([f'runtime-opt0{n}.mjs', f'RUNTIME-OPT0{n}-CONTRACT.md'])
    for n in (3, 4):
        names.update([f'arithmetic-opt0{n}-run.mjs', f'arithmetic-opt0{n}.test.mts'])
    source.extend(HOME / name for name in names)
    source.extend(HOME / 'baseline' / name for name in ['strict-line.ts'] + [f'strict-line-opt0{n}.ts' for n in (1, 2, 3, 4)])
    whole = ROOT / 'examples/physics-stack-wholepath-2276'
    source.extend(whole / name for name in ['census.mjs', 'reference-timing.py', 'profile-world.py', 'CONTRACT.md', 'PROFILE-CONTRACT.md'])
    runs = ['arithmetic-01', 'arithmetic-02', 'arithmetic-03', 'arithmetic-opt03-01', 'arithmetic-opt03-02', 'arithmetic-opt04-01', 'profile-01', 'runtime-01']
    runs += [f'boundary-0{n}' for n in range(1, 5)] + [f'run-0{n}' for n in range(1, 9)] + [f'runtime-opt0{n}-01' for n in range(1, 5)]
    proof = [p for run in runs for p in (HOME / 'evidence' / run).rglob('*')]
    proof.extend(p for run in ['census-01', 'profile-01'] for p in (whole / 'evidence' / run).rglob('*'))
    # Only completed stack-library/census guard receipts are admitted here.
    guards = ROOT / 'examples/physics-world-p5-2276/evidence'
    guard_names = {f'stack-library-{name}' for name in runs if not name.startswith(('run-', 'runtime-'))}
    guard_names.update(f'stack-library-build-0{n}' for n in range(1, 8))
    guard_names.update(['stack-library-docbuild-01', 'stack-library-docsite-01', 'stack-wholepath-profile-01'])
    for name in sorted(guard_names):
        proof.extend((guards / name).rglob('*'))
    selected, skipped = {}, []
    for role, paths in (('source', source), ('proof', proof)):
        for path in sorted(set(paths)):
            if not path.is_file() or path.is_symlink():
                continue
            name = path.relative_to(ROOT).as_posix()
            if '__pycache__' in path.parts or path.suffix == '.pyc':
                continue
            if role == 'source' and (path.name.startswith(('DELTA-03', 'ARCHIVE-', 'EVIDENCE-', 'SOURCE-', 'PROOF-')) or path.name == 'RESULTS.md'):
                continue
            source_path = path
            if name == 'packages/barocss-physics/src/stack/strict-line.ts':
                source_path = HOME / 'baseline/strict-line-opt04.ts'
                assert digest(source_path) == '0e4faf8299621c0dd92a69731ee21b4fa47104aade51b81a762c3d8ed98d284b'
            info = {'bytes': source_path.stat().st_size, 'sha256': digest(source_path)}
            if previous.get(name) == info:
                skipped.append({'path': name, **info})
                continue
            old = old_content.get(info['sha256'])
            selected[name] = {'role': role, **info, 'sourceMode': stat.S_IMODE(source_path.stat().st_mode),
                              'archiveMode': 0o644, 'mtime': 0, 'uid': 0, 'gid': 0,
                              'storage': 'BASE_CONTENT_HARDLINK' if old else 'DELTA_CONTENT_HARDLINK',
                              'target': (BASE_ALIAS if old else NEW_BLOB) + info['sha256']}
            if old:
                assert old['bytes'] == info['bytes']
                selected[name]['baseContent'] = old
            if source_path != path:
                selected[name]['sourcePath'] = source_path.relative_to(ROOT).as_posix()
                selected[name]['binding'] = 'LOGICAL_OPT04_PRODUCTION_PATH_FROM_AUTHENTICATED_FROZEN_BASELINE; LIVE_OPT05_EXCLUDED'
    for forbidden in ('RESULTS.md', 'WORK-STATUS.json', 'roadmap.mdx'):
        assert not any(PurePosixPath(name).name == forbidden for name in selected)
    new = json.loads((ROOT / 'packages/barocss-physics/src/stack/OPTIMIZATION-04.json').read_text())['files']['newSource']
    assert selected[new['path']]['sha256'] == new['sha256'], 'OPT04 frozen source binding differs from manifest'
    return dict(sorted(selected.items())), skipped, old_content


def metadata(name, size=0, link=None):
    member = tarfile.TarInfo(name)
    member.mode, member.mtime, member.uid, member.gid = 0o644, 0, 0, 0
    member.uname = member.gname = ''
    member.size = size
    if link:
        member.type, member.linkname, member.size = tarfile.LNKTYPE, link, 0
    return member


class CheckedReader:
    def __init__(self, stream):
        self.stream, self.hash, self.bytes = stream, hashlib.sha256(), 0

    def read(self, size):
        data = self.stream.read(size)
        self.hash.update(data)
        self.bytes += len(data)
        return data


def write_archive(role, selected, emitted):
    path = HOME / f'DELTA-03-{role.upper()}.tar.gz'
    members = {name: info for name, info in selected.items() if info['role'] == role}
    representatives = {}
    for name, info in members.items():
        if info['storage'] == 'DELTA_CONTENT_HARDLINK' and info['sha256'] not in emitted:
            representatives.setdefault(info['sha256'], name)
    with open(path, 'xb') as output, gzip.GzipFile(fileobj=output, mode='wb', filename='', mtime=0, compresslevel=9) as zipped:
        with tarfile.open(fileobj=zipped, mode='w|', format=tarfile.GNU_FORMAT) as archive:
            for sha, name in sorted(representatives.items()):
                info = members[name]
                with open(ROOT / info.get('sourcePath', name), 'rb') as source:
                    reader = CheckedReader(source)
                    archive.addfile(metadata(NEW_BLOB + sha, info['bytes']), reader)
                    assert reader.bytes == info['bytes'] and reader.hash.hexdigest() == sha
                emitted.add(sha)
            for name, info in members.items():
                archive.addfile(metadata(name, link=info['target']))
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
            'sha256': digest(path), 'logicalFiles': len(members),
            'storedBlobs': {sha: {'bytes': members[name]['bytes'], 'source': name} for sha, name in sorted(representatives.items())},
            'tarMembers': len(members) + len(representatives), 'hardlinks': len(members)}


def safe_path(directory, name):
    p = PurePosixPath(name)
    assert not p.is_absolute() and '..' not in p.parts
    return directory.joinpath(*p.parts)


def hydrate_base(index, selected, directory):
    needed = {info['sha256'] for info in selected.values() if info['storage'] == 'BASE_CONTENT_HARDLINK'}
    hydrated = set()
    for role in ('source', 'proof'):
        old = index[role]
        seen = set()
        with tarfile.open(HOME / old['archive'], mode='r|gz') as archive:
            for member in archive:
                assert member.name in old['inputs'] and member.name not in seen
                seen.add(member.name)
                expected = old['inputs'][member.name]
                if member.islnk():
                    assert old['inputs'][member.linkname] == expected
                    continue
                assert member.isfile() and member.size == expected['bytes']
                sha, count = hashlib.sha256(), 0
                target = safe_path(directory, BASE_ALIAS + expected['sha256'])
                write = expected['sha256'] in needed and expected['sha256'] not in hydrated
                if write:
                    target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as stream:
                    output = open(target, 'xb') if write else None
                    try:
                        for data in iter(lambda: stream.read(CHUNK), b''):
                            sha.update(data)
                            count += len(data)
                            if output:
                                output.write(data)
                    finally:
                        if output:
                            output.close()
                assert count == expected['bytes'] and sha.hexdigest() == expected['sha256']
                if write:
                    os.chmod(target, 0o644)
                    os.utime(target, (0, 0))
                    hydrated.add(expected['sha256'])
        assert len(seen) == old['members']
    assert hydrated == needed


def verify(value, index):
    selected = value['inputs']
    old_hashes = {info['sha256'] for role in ('source', 'proof') for info in index[role]['inputs'].values()}
    stored = set()
    with tempfile.TemporaryDirectory(prefix='delta03-verify-') as temporary:
        directory = Path(temporary)
        hydrate_base(index, selected, directory)
        logical = set()
        for role in ('source', 'proof'):
            spec = value['archives'][role]
            path = ROOT / spec['path']
            assert path.stat().st_size == spec['bytes'] and digest(path) == spec['sha256']
            assert not (set(spec['storedBlobs']) & old_hashes), 'old payload duplicated'
            count = 0
            with tarfile.open(path, 'r|gz') as archive:
                for member in archive:
                    count += 1
                    assert (member.mode, member.mtime, member.uid, member.gid, member.uname, member.gname) == (0o644, 0, 0, 0, '', '')
                    target = safe_path(directory, member.name)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    assert not target.exists()
                    if member.isfile():
                        sha = member.name.removeprefix(NEW_BLOB)
                        assert member.name == NEW_BLOB + sha and sha in spec['storedBlobs'] and sha not in stored
                        assert member.size == spec['storedBlobs'][sha]['bytes']
                        with archive.extractfile(member) as stream, open(target, 'xb') as output:
                            for data in iter(lambda: stream.read(CHUNK), b''):
                                output.write(data)
                        assert digest(target) == sha
                        os.chmod(target, 0o644)
                        os.utime(target, (0, 0))
                        stored.add(sha)
                    else:
                        assert member.islnk() and member.name in selected and member.name not in logical
                        info = selected[member.name]
                        assert info['role'] == role and member.linkname == info['target']
                        link = safe_path(directory, member.linkname)
                        assert link.is_file()
                        os.link(link, target)
                        assert target.stat().st_size == info['bytes'] and digest(target) == info['sha256']
                        assert stat.S_IMODE(target.stat().st_mode) == info['archiveMode'] and target.stat().st_mtime == 0
                        logical.add(member.name)
            assert count == spec['tarMembers']
        assert logical == set(selected)
    for name, info in selected.items():
        path = ROOT / info.get('sourcePath', name)
        assert path.stat().st_size == info['bytes'] and digest(path) == info['sha256'], 'input changed during archive IO'
    return {'status': 'ARCHIVE_EXTRACTION_BYTES_HASH_AND_METADATA_VERIFIED', 'logicalFiles': len(logical),
            'uniqueNewBlobs': len(stored), 'oldPayloadBlobsDuplicated': 0, 'rawDeleted': False}


def build():
    index, index_sha = base_index()
    selected, skipped, old = inputs(index)
    assert not MANIFEST.exists()
    emitted = set()
    archives = {role: write_archive(role, selected, emitted) for role in ('source', 'proof')}
    counters = []
    for scene in ('ALIGNED', 'OFFSET', 'YAW'):
        name = f'examples/physics-stack-library-2276/evidence/runtime-opt04-01/{scene}-result.json'
        data = json.loads((ROOT / name).read_text())
        counters.append({'path': name, 'pointers': {key: '/' + key for key in ('engineReturned', 'diagnosticAccepted', 'normalKktAccepted', 'independentlyFullAccepted', 'frames', 'rawBytes', 'rawSha256')},
                         'observedReceiptValues': {key: data[key] for key in ('engineReturned', 'diagnosticAccepted', 'normalKktAccepted', 'independentlyFullAccepted', 'frames', 'rawBytes', 'rawSha256')}})
    value = {'format': 'barocss-stack-checkpoint-delta-v1', 'baseCommit': BASE,
             'baseIndex': {'path': INDEX, 'sha256': index_sha},
             'baseArchives': {role: {key: index[role][key] for key in ('archive', 'bytes', 'sha256', 'members')} for role in ('source', 'proof')},
             'scope': 'OPT02/03/04 frozen source/contracts/tests/runtimes and completed evidence; wholepath census/profile. Results/Work/roadmap and separate reference candidates excluded.',
             'storageProtocol': 'Authenticate SOURCE-01 + PROOF-02 and hydrate content-addressed .DELTA-03-BASE aliases; extract DELTA source then proof. New blobs occur once under .DELTA-03-BLOBS; every logical file is a hardlink. Use this script --verify for safe temporary extraction.',
             'metadata': {'mode': 0o644, 'mtime': 0, 'uid': 0, 'gid': 0, 'gzipMtime': 0, 'gzipFilename': '', 'ordering': 'roles source/proof; blob SHA order then logical path order'},
             'scriptSha256': digest(Path(__file__)), 'inputs': selected, 'unchangedBasePathsOmitted': sorted(skipped, key=lambda x: x['path']),
             'archives': archives, 'counterEvidence': counters,
             'physicsBoundary': {'newPhysicsExecution': False, 'fullIndependentAccepted': 0, 'publicApiPromotion': False, 'resourceQualification': False}}
    value['verification'] = verify(value, index)
    with open(MANIFEST, 'x', encoding='utf8') as output:
        output.write(json.dumps(value, indent=2, sort_keys=True) + '\n')
    return value


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true')
    arguments = parser.parse_args()
    if arguments.verify:
        manifest = json.loads(MANIFEST.read_text())
        index, index_sha = base_index()
        assert index_sha == manifest['baseIndex']['sha256'] and digest(Path(__file__)) == manifest['scriptSha256']
        result = verify(manifest, index)
        print(json.dumps(result, sort_keys=True))
    else:
        manifest = build()
        summary = {role: {key: info[key] for key in ('path', 'bytes', 'sha256', 'logicalFiles', 'tarMembers', 'hardlinks')} for role, info in manifest['archives'].items()}
        print(json.dumps({'manifest': MANIFEST.relative_to(ROOT).as_posix(), 'manifestSha256': digest(MANIFEST), 'archives': summary, 'verification': manifest['verification']}, sort_keys=True))
