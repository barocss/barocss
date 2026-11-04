#!/usr/bin/env python3
"""Deterministic checkpoint IO only. No physics/helper import or execution."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / 'examples/physics-stack-library-2276'
MANIFEST = HOME / 'CHECKPOINT-04.json'
FOLDERS = ['physics-stack-library-2276', 'physics-stack-reference-prepared-2276', 'physics-stack-make-census-2276', 'physics-stack-packet-2276', 'physics-stack-wholepath-2276']
RUNS = ['arithmetic-opt05-01', 'arithmetic-opt04-02', 'arithmetic-opt03-03', 'arithmetic-04', 'boundary-05', 'run-09', 'runtime-opt05-01']
GUARDS = ['stack-library-arithmetic-opt05-01', 'stack-library-arithmetic-opt04-02', 'stack-library-arithmetic-opt03-03', 'stack-library-arithmetic-04', 'stack-library-boundary-05', 'stack-library-build-08', 'stack-library-delta03-verify-01', 'stack-library-docbuild-02', 'stack-library-docsite-02', 'stack-library-docbuild-03', 'stack-library-docsite-03', 'stack-reference-prepared-probe-01', 'stack-reference-prepared-tests-01', 'stack-packet-tests-01']


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(65536):
            h.update(chunk)
    return h.hexdigest()


def pin(path):
    return {'bytes': path.stat().st_size, 'sha256': sha(path)}


def selected():
    sources = [ROOT / '.changeset/physics-exact-stack-arithmetic.md', ROOT / 'packages/barocss-physics/ROADMAP.md', ROOT / 'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt', ROOT / 'examples/physics-world-p5-2276/WORK-STATUS.json']
    sources += [p for p in (ROOT / 'packages/barocss-physics/src/stack').iterdir() if p.is_file()]
    for folder in FOLDERS:
        for p in (ROOT / 'examples' / folder).iterdir():
            if p.is_file() and (p.suffix in ('.mjs', '.mts', '.py', '.md') or p.name in ('PINS.json', 'BANK.json', 'ROOT-CENSUS-SEAL.json', 'RUNTIME-OPT05-PINS.json')):
                sources.append(p)
    sources += list((HOME / 'baseline').glob('*.ts'))
    proofs = [p for run in RUNS for p in (HOME / 'evidence' / run).rglob('*') if p.is_file()]
    for folder in ('physics-stack-reference-prepared-2276', 'physics-stack-make-census-2276', 'physics-stack-packet-2276'):
        proofs += [p for p in (ROOT / 'examples' / folder / 'evidence').rglob('*') if p.is_file()]
    for guard in GUARDS:
        base = ROOT / 'examples/physics-world-p5-2276/evidence' / guard
        assert (base / 'result.json').is_file(), 'completed receipt required: ' + guard
        proofs += [p for p in base.iterdir() if p.is_file()]
    return {'source': sorted(set(sources)), 'proof': sorted(set(proofs))}


def verify(value):
    for name, expected in value['dependencies'].items():
        assert pin(ROOT / name) == expected, name
    for role, archive in value['archives'].items():
        path = HOME / archive['file']
        assert pin(path) == {k: archive[k] for k in ('bytes', 'sha256')}
        with tarfile.open(path, 'r:gz') as tar:
            assert tar.getnames() == list(archive['members'])
            for member in tar.getmembers():
                assert member.isfile() or member.islnk()
                assert not member.name.startswith('/') and '..' not in Path(member.name).parts
                expected = archive['members'][member.name]
                with tar.extractfile(member) as stream:
                    h, size = hashlib.sha256(), 0
                    while chunk := stream.read(65536):
                        h.update(chunk)
                        size += len(chunk)
                assert {'bytes': size, 'sha256': h.hexdigest()} == expected
    return {role: {'members': len(a['members']), 'bytes': a['bytes'], 'sha256': a['sha256']} for role, a in value['archives'].items()}


def build():
    assert not MANIFEST.exists(), 'fresh immutable checkpoint required'
    dependencies = ['examples/physics-stack-library-2276/SOURCE-01.tar.gz', 'examples/physics-stack-library-2276/PROOF-02.tar.gz', 'examples/physics-stack-library-2276/ARCHIVE-02.json', 'examples/physics-stack-library-2276/DELTA-03-SOURCE.tar.gz', 'examples/physics-stack-library-2276/DELTA-03-PROOF.tar.gz', 'examples/physics-stack-library-2276/DELTA-03.json', 'examples/physics-stack-trajectory-audit-2276/SOURCE-01.tar.gz', 'examples/physics-stack-trajectory-audit-2276/PROOF-01.tar.gz', 'examples/physics-stack-trajectory-audit-2276/ARCHIVE-01.json']
    value = {'status': 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION', 'baseCommit': 'bfa78f768213ad29deb0c02b200e9ec7a2a5f1f9', 'dependencies': {n: pin(ROOT/n) for n in dependencies}, 'archives': {}, 'API': False, 'fullP4Qualification': False}
    for role, paths in selected().items():
        path = HOME / ('CHECKPOINT-04-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with path.open('xb') as file, gzip.GzipFile(filename='', fileobj=file, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for source in paths:
                assert source.is_file() and not source.is_symlink()
                name, data = source.relative_to(ROOT).as_posix(), source.read_bytes()
                content = hashlib.sha256(data).hexdigest()
                members[name] = {'bytes': len(data), 'sha256': content}
                entry = tarfile.TarInfo(name)
                entry.mode, entry.mtime = 0o644, 0
                if content in first:
                    entry.type, entry.linkname = tarfile.LNKTYPE, first[content]
                    tar.addfile(entry)
                else:
                    first[content] = name
                    entry.size = len(data)
                    tar.addfile(entry, io.BytesIO(data))
        value['archives'][role] = {'file': path.name, **pin(path), 'members': members, 'uniqueBlobs': len(first)}
    verified = verify(value)
    with MANIFEST.open('x') as f:
        json.dump(value, f, indent=2)
        f.write('\n')
    return verified


assert len(sys.argv) == 2 and sys.argv[1] in ('--build', '--verify')
print(json.dumps(build() if sys.argv[1] == '--build' else verify(json.loads(MANIFEST.read_text()))))
