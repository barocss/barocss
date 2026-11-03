"""Pure IO checkpoint of qualified OPT10 and ended L227. No physics calls."""
import gzip
import hashlib
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
MANIFEST = HOME / 'CHECKPOINT-09.json'


def build():
    io.require(not MANIFEST.exists(), 'fresh checkpoint required')
    source = {Path(__file__).resolve(), ROOT / 'packages/barocss-physics/src/stack/strict-line.ts'}
    source.update(ROOT / p for p in (
        'packages/barocss-physics/ROADMAP.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    source.update(p for p in io.files(HOME, False) if any(s in p.name.lower() for s in
        ('opt10', 'optimization-10')) or p.name == 'RESULTS.md')
    source.add(HOME / 'baseline/strict-line-opt09.ts')
    complete = ROOT / 'examples/physics-stack-complete-2276'
    source.update(io.files(complete, False))
    source.update(p for p in io.files(complete / 'baseline') if p.name.startswith('pre-opt10-'))
    for folder in ('physics-stack-lexeme-archive-2276', 'physics-stack-evidence-scope-2276'):
        source.update(io.files(ROOT / 'examples' / folder, False))
    proof, receipts = set(), {}
    library_runs = ['run-14', 'boundary-opt10-01', 'canonical-opt10-01'] + [
        p.name for p in (HOME / 'evidence').iterdir()
        if p.is_dir() and p.name.startswith('arithmetic-') and 'opt10' in p.name]
    for name in library_runs:
        folder = HOME / 'evidence' / name
        proof.update(io.files(folder))
        if (folder / 'result.json').exists():
            io.receipt(folder / 'result.json', receipts)
    prefix = complete / 'evidence/prefix-07'
    proof.update(io.files(prefix))
    io.receipt(prefix / 'campaign-result.json', receipts)
    lexemes = ROOT / 'examples/physics-stack-lexeme-archive-2276/evidence'
    for name in ('controls-01', 'exact-01', 'lexemes-01', 'screen-01'):
        proof.update(io.files(lexemes / name))
    guards = ['stack-library-arithmetic-opt10-01', 'stack-library-build-13',
        'stack-opt10-canonical-arithmetic-01', 'stack-lexeme-controls-01',
        'stack-lexeme-preserve-01', 'stack-library-docbuild-08', 'stack-library-docsite-08']
    guards += ['stack-opt10-' + n + '-01' for n in ('boundary', 'physical-parity',
        'retained06', 'retained07', 'retained16', 'retained25', 'retained26', 'retained32')]
    for name in guards:
        folder = ROOT / 'examples/physics-world-p5-2276/evidence' / name
        io.receipt(folder / 'result.json', receipts, guard=True)
        proof.update(io.files(folder, False))
    value = dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
        baseCommit='9db3211707acaf94dddd292772c066895c2fec8d',
        scope='OPT10 actual Source/Native/canonical and complete prefix07; ended L227 first screen; source audit only',
        API=False, originalFullP4Qualification=False,
        stationaryCandidate='NOT_INCLUDED_NOT_QUALIFIED',
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,
        receiptStatusesArePreservedNotUpgraded=True, selectedReceipts=receipts,
        dependencies={io.relative(HOME / n): io.pin(HOME / n) for n in (
            'CHECKPOINT-08.json', 'CHECKPOINT-08-SOURCE.tar.gz', 'CHECKPOINT-08-PROOF.tar.gz')},
        externalLocalOriginalsNotInArchives={}, archives={})
    total = 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-09-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with archive.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for path in sorted(paths):
                item, name = io.pin(path), io.relative(path)
                if item['bytes'] > io.LIMIT:
                    value['externalLocalOriginalsNotInArchives'][name] = {
                        **item, 'notInGit': True, 'includedInArchives': False}
                    continue
                total += item['bytes']
                io.require(total <= io.TOTAL_LIMIT, 'selected input limit')
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
                io.require(io.pin(path) == item, 'input changed during write')
        value['archives'][role] = dict(file=archive.name, **io.pin(archive),
            members=members, uniqueBlobs=len(first))
    result = io.verify(value)
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


if __name__ == '__main__':
    io.require(sys.argv[1:] in (['--build'], ['--verify']), '--build or --verify required')
    print(json.dumps(build() if sys.argv[1] == '--build' else io.verify(io.read_json(MANIFEST))))
