#!/usr/bin/env python3
"""Lossless completed Physics checkpoint; no numerical imports or calls."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
CASE_HOME = Path(__file__).resolve().parent
MANIFEST = CASE_HOME / 'CHECKPOINT-06.json'
FOLDERS = ['physics-stack-complete-2276', 'physics-stack-stream-sized-2276',
           'physics-stack-stream-brotli-2276']
RUNS = ['arithmetic-opt06-01', 'arithmetic-opt05-opt06-01',
        'arithmetic-opt04-opt06-01', 'arithmetic-opt03-opt06-01',
        'arithmetic-retained16-opt06-01', 'boundary-opt06-01', 'run-10',
        'canonical-opt06-01', 'runtime-opt06-01']
GUARDS = ['stack-complete-controls-01', 'stack-sized-controls-01',
          'stack-full01-offline-recovery-01', 'stack-library-arithmetic-opt06-01',
          'stack-opt06-retained32-01', 'stack-opt06-retained26-01',
          'stack-opt06-retained25-01', 'stack-opt06-retained16-01',
          'stack-opt06-boundary-01', 'stack-opt06-physical-parity-01',
          'stack-library-build-09', 'stack-library-docbuild-04',
          'stack-library-docsite-04', 'stack-brotli-controls-01']


def pin(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(65536):
            digest.update(block)
    return {'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def select():
    source, proof = [], []
    for folder in FOLDERS:
        for path in (ROOT / 'examples' / folder).rglob('*'):
            if not path.is_file() or '__pycache__' in path.parts:
                continue
            (proof if 'evidence' in path.parts or 'baseline' in path.parts else source).append(path)
    for name in ['arithmetic-opt06.test.mts', 'arithmetic-opt06-run.mjs',
                 'OPTIMIZATION-06.json', 'OPTIMIZATION-06-CONTRACT.md',
                 'runtime-opt06.mjs', 'RUNTIME-OPT06-PINS.json',
                 'RUNTIME-OPT06-CONTRACT.md', 'RESULTS.md', 'checkpoint-06.py',
                 'baseline/strict-line-opt05.ts']:
        source.append(CASE_HOME / name)
    for name in ['packages/barocss-physics/src/stack/strict-line.ts',
                 'packages/barocss-physics/ROADMAP.md',
                 'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
                 'examples/physics-world-p5-2276/WORK-STATUS.json']:
        source.append(ROOT / name)
    for name in RUNS:
        folder = CASE_HOME / 'evidence' / name
        assert folder.is_dir(), name
        if name == 'runtime-opt06-01':
            result = json.loads((folder / 'result.json').read_bytes())
            assert result['status'] == 'RUNTIME_DIAGNOSTIC_COMPLETED', 'completed runtime only'
        proof.extend(p for p in folder.rglob('*') if p.is_file())
    for name in GUARDS:
        folder = ROOT / 'examples/physics-world-p5-2276/evidence' / name
        assert (folder / 'result.json').is_file(), name
        proof.extend(p for p in folder.iterdir() if p.is_file())
    # Large first-failure originals remain local and unchanged. Never claim
    # that a hash-only member was included in the committed proof archive.
    external, bounded = {}, []
    for path in sorted(set(proof)):
        if path.stat().st_size > 20 * 2**20:
            external[path.relative_to(ROOT).as_posix()] = pin(path)
        else:
            bounded.append(path)
    return {'source': sorted(set(source)), 'proof': bounded}, external


def verify(value):
    for name, expected in value['dependencies'].items():
        assert pin(ROOT / name) == expected, name
    for name, expected in value['externalLocalOriginalsNotInArchives'].items():
        assert pin(ROOT / name) == expected, name
    result = {}
    for role, entry in value['archives'].items():
        path = CASE_HOME / entry['file']
        assert pin(path) == {k: entry[k] for k in ('bytes', 'sha256')}
        with tarfile.open(path, 'r:gz') as tar:
            assert tar.getnames() == list(entry['members'])
            for member in tar.getmembers():
                assert member.isfile() or member.islnk()
                assert not member.name.startswith('/') and '..' not in Path(member.name).parts
                with tar.extractfile(member) as stream:
                    digest, size = hashlib.sha256(), 0
                    while block := stream.read(65536):
                        digest.update(block)
                        size += len(block)
                assert {'bytes': size, 'sha256': digest.hexdigest()} == entry['members'][member.name]
        result[role] = {k: entry[k] for k in ('bytes', 'sha256', 'uniqueBlobs')}
        result[role]['members'] = len(entry['members'])
    return result


def build():
    assert not MANIFEST.exists(), 'new immutable checkpoint required'
    selection, external = select()
    names = ['examples/physics-stack-library-2276/CHECKPOINT-05.json',
             'examples/physics-stack-library-2276/CHECKPOINT-05-SOURCE.tar.gz',
             'examples/physics-stack-library-2276/CHECKPOINT-05-PROOF.tar.gz']
    value = {'status': 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
             'baseCommit': '66ffa8a62a8148db704a82cbd55a46cb46028d55', 'dependencies': {n: pin(ROOT / n) for n in names},
             'externalLocalOriginalsNotInArchives': external, 'archives': {},
             'API': False, 'originalFullP4Qualification': False,
             'statefulCodecPendingCandidateExcluded': True}
    for role, paths in selection.items():
        path = CASE_HOME / ('CHECKPOINT-06-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with path.open('xb') as file, gzip.GzipFile(filename='', fileobj=file, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for source in paths:
                assert source.is_file() and not source.is_symlink()
                name, data = source.relative_to(ROOT).as_posix(), source.read_bytes()
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
        value['archives'][role] = {'file': path.name, **pin(path),
                                   'members': members, 'uniqueBlobs': len(first)}
    result = verify(value)
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


assert len(sys.argv) == 2 and sys.argv[1] in ('--build', '--verify')
print(json.dumps(build() if sys.argv[1] == '--build' else verify(json.loads(MANIFEST.read_text()))))
