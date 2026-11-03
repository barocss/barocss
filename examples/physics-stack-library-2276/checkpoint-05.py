#!/usr/bin/env python3
"""Lossless completed-component checkpoint. Filesystem work only."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
HOME = Path(__file__).resolve().parent
MANIFEST = HOME / 'CHECKPOINT-05.json'
FOLDERS = [
    'physics-stack-pipeline-2276', 'physics-stack-owned-data-2276',
    'physics-stack-cpu-2276', 'physics-stack-pipeline-cpu-2276',
    'physics-stack-stream-2276',
]
GUARDS = [
    'stack-owned-data-selftest-01', 'stack-token-live-01',
    'stack-pipeline-controls-01', 'stack-stream-controls-01',
    'stack-buffered-fingerprint-01',
]


def pin(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        while chunk := source.read(65536):
            h.update(chunk)
    return {'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def selection():
    source, proof = [], []
    for folder in FOLDERS:
        home = ROOT / 'examples' / folder
        for path in home.rglob('*'):
            if not path.is_file() or '__pycache__' in path.parts:
                continue
            (proof if 'evidence' in path.parts or 'baseline' in path.parts else source).append(path)
    for name in ['fingerprint.mjs', 'fingerprint.test.mjs', 'FINGERPRINT-CONTRACT.md',
                 'CONTRACT.md', 'API-ADOPTION-PLAN.md']:
        source.append(ROOT / 'examples/physics-stack-complete-2276' / name)
    for guard in GUARDS:
        home = ROOT / 'examples/physics-world-p5-2276/evidence' / guard
        assert (home / 'result.json').is_file(), guard
        proof.extend(p for p in home.iterdir() if p.is_file())
    source.extend(ROOT / p for p in [
        'packages/barocss-physics/ROADMAP.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'examples/physics-world-p5-2276/WORK-STATUS.json',
        'examples/physics-stack-library-2276/checkpoint-05.py',
    ])
    proof.append(HOME / 'evidence/runtime-opt05-01/all-prior-runtime-frame-parity.json')
    return {'source': sorted(set(source)), 'proof': sorted(set(proof))}


def verify(value):
    for name, expected in value['dependencies'].items():
        assert pin(ROOT / name) == expected, name
    result = {}
    for role, entry in value['archives'].items():
        archive = HOME / entry['file']
        assert pin(archive) == {k: entry[k] for k in ('bytes', 'sha256')}
        with tarfile.open(archive, 'r:gz') as tar:
            assert tar.getnames() == list(entry['members'])
            for member in tar.getmembers():
                assert member.isfile() or member.islnk()
                assert not member.name.startswith('/') and '..' not in Path(member.name).parts
                with tar.extractfile(member) as stream:
                    h, size = hashlib.sha256(), 0
                    while chunk := stream.read(65536):
                        h.update(chunk)
                        size += len(chunk)
                assert {'bytes': size, 'sha256': h.hexdigest()} == entry['members'][member.name]
        result[role] = {k: entry[k] for k in ('bytes', 'sha256', 'uniqueBlobs')}
        result[role]['members'] = len(entry['members'])
    return result


def build():
    assert not MANIFEST.exists(), 'immutable fresh checkpoint only'
    dependencies = ['examples/physics-stack-library-2276/CHECKPOINT-04.json',
                    'examples/physics-stack-library-2276/CHECKPOINT-04-SOURCE.tar.gz',
                    'examples/physics-stack-library-2276/CHECKPOINT-04-PROOF.tar.gz']
    value = {'status': 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
             'baseCommit': '1a29806422f4d82b49885dd35f9cbdab84138cec',
             'dependencies': {n: pin(ROOT / n) for n in dependencies},
             'archives': {}, 'API': False, 'originalFullP4Qualification': False,
             'activeCompleteRunnerWipExcluded': True}
    for role, paths in selection().items():
        archive = HOME / ('CHECKPOINT-05-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with archive.open('xb') as file, gzip.GzipFile(filename='', fileobj=file, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for path in paths:
                assert path.is_file() and not path.is_symlink(), path
                name, data = path.relative_to(ROOT).as_posix(), path.read_bytes()
                digest = hashlib.sha256(data).hexdigest()
                members[name] = {'bytes': len(data), 'sha256': digest}
                entry = tarfile.TarInfo(name)
                entry.mode, entry.mtime = 0o644, 0
                if digest in first:
                    entry.type, entry.linkname = tarfile.LNKTYPE, first[digest]
                    tar.addfile(entry)
                else:
                    first[digest], entry.size = name, len(data)
                    tar.addfile(entry, io.BytesIO(data))
        value['archives'][role] = {'file': archive.name, **pin(archive),
                                   'members': members, 'uniqueBlobs': len(first)}
    result = verify(value)
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


assert len(sys.argv) == 2 and sys.argv[1] in ('--build', '--verify')
print(json.dumps(build() if sys.argv[1] == '--build' else verify(json.loads(MANIFEST.read_text()))))
