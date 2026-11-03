"""Root only. Deterministic source/small-receipt archive; large evidence stays external."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import stat
import tarfile

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
CASE = HOME / 'evidence/full-03'
PINS_SHA = 'caa9078c2911ec2aa2687ad51ba5b49af192fdbaa536dfe2303e1eebce4cf1cd'
SEAL_SHA = '0c42153c4d3624a0fb0fbf05ffebd6bcfbe5b0590c10ce224aa37bbeb0cd4e7f'
ARCHIVE_SHA = '234f9b7a7c1b8f0120cfac61262a91b7ba59961214b8b5119f23d092376b1d9d'


def need(value, reason):
    if not value:
        raise ValueError(reason)


def pin(path):
    need(path.is_file() and not path.is_symlink(), 'REGULAR_OWNED_FILE:' + str(path))
    before = path.stat()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    after = path.stat()
    need((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns), 'CHANGED_DURING_HASH')
    return dict(bytes=after.st_size, sha256=h.hexdigest())


def read(path):
    need(path.stat().st_size <= 2**21, 'SMALL_JSON_BOUND')
    return json.loads(path.read_bytes())


def main():
    baseline = HOME / 'baseline'
    target = baseline / 'full-03-source.tar.gz'
    manifest_path = baseline / 'full-03-preserved.json'
    need(not target.exists() and not manifest_path.exists(), 'FRESH_OUTPUTS_REQUIRED')
    need(pin(HOME / 'PINS.json')['sha256'] == PINS_SHA, 'EXACT_ACTIVE_FULL03_PINS')
    need(pin(HOME / 'SOURCE-SEAL.json')['sha256'] == SEAL_SHA, 'EXACT_ACTIVE_FULL03_SEAL')
    pins, seal = read(HOME / 'PINS.json'), read(HOME / 'SOURCE-SEAL.json')
    need(len(pins['files']) == 670, 'EXACT670_INPUTS')
    for name, expected in pins['files'].items():
        need(pin(ROOT / name) == expected, 'INPUT_DRIFT:' + name)
    need(len(seal['files']) == 28, 'EXACT28_SEALED_FILES')
    for name, expected in seal['files'].items():
        need(pin(HOME / name)['sha256'] == expected, 'SEALED_SOURCE_DRIFT:' + name)
    large = CASE / 'ALIGNED/host/events.gz'
    external = pin(large)  # Exactly one64KiB-stream hash; never decompress/copy this214MB evidence.
    need(external == dict(bytes=213852828, sha256=ARCHIVE_SHA), 'EXACT_FULL03_EXTERNAL_ARCHIVE')
    host, owner, campaign = (read(CASE / name) for name in
        ['ALIGNED/host/result.json', 'ALIGNED/summary.json', 'campaign-result.json'])
    need(host['scene'] == 'ALIGNED' and host['selectedSteps'] == 1200, 'EXACT_ENDED_CASE')
    need(host['status'] == 'COMPLETE_SCENE_STOPPED' and campaign['status'] == 'COMPLETE_CAMPAIGN_STOPPED', 'ENDED_NO_GO_REQUIRED')
    paths = {p for p in HOME.iterdir() if p.is_file()}
    paths.update(p for p in CASE.rglob('*') if p.is_file() and p != large)
    for group in ['stack-full03-failure-recovery-01', 'stack-full03-failure-recovery-02']:
        folder = ROOT / 'examples/physics-world-p5-2276/evidence' / group
        if folder.exists():
            paths.update(p for p in folder.iterdir() if p.is_file() and p.stat().st_size <= 2**21)
    members = {}
    for path in sorted(paths):
        need(path.stat().st_size <= 2**21, 'UNEXPECTED_LARGE_SOURCE_OR_METADATA:' + str(path))
        members[str(path.relative_to(ROOT))] = dict(**pin(path), mode=stat.S_IMODE(path.stat().st_mode))
    facts = dict(status='PRESERVED_ENDED_FULL03_NOT_RECLASSIFIED', pinsSHA256=PINS_SHA,
        sourceSealSHA256=SEAL_SHA, checkedInputFiles=670,
        hostContiguousPhysicalAccepted=host['counts']['contiguousPhysicalAccepted'],
        hostFullyVerified=host['counts']['fullyVerifiedPhaseSteps'], hostCounts=host['counts'],
        hostFirstObserved=host['firstObserved'], hostEarliest=host['earliest'],
        ownerStatus=owner['status'], ownerFirstFailure=owner['firstFailure'],
        campaignStatus=campaign['status'], campaignAccepted=campaign['contiguousPhysicalAccepted'],
        campaignScenes=campaign['scenes'], laterScenes='NOT_RUN',
        hostArchiveReceipt=host['archive'], budget=read(CASE / 'budget.json'),
        externalArchives={str(large.relative_to(ROOT)): external}, sourceAndSmallReceipts=members,
        failureRecovery=read(CASE / 'ALIGNED/host/failure-recovery.json') if (CASE / 'ALIGNED/host/failure-recovery.json').exists() else 'NOT_PRESENT',
        auditFirstPathFailurePreserved='NOT_ASSERTED_FOR_FULL03', physicalFailureNotInferredFromAuditPathFailure=True,
        originalIndependentFullPhysics=False, API=False, strictGlobal64MiBCertification='NOT_QUALIFIED',
        archiveLargePayloadIncluded=False, providerOrNumericalSourceExecution='NONE', numericalCalls=0,
        tarMetadata=dict(uid=0, gid=0, uname='', gname='', mtime=0, modes='ORIGINAL'))
    metadata = (json.dumps(facts, sort_keys=True, indent=2) + '\n').encode()
    need(len(metadata) <= 2**21, 'PRESERVATION_MANIFEST_BOUND')
    embedded_name = 'preservation/full-03-data.json'
    with target.open('xb') as output:
        with gzip.GzipFile(filename='', fileobj=output, mode='wb', mtime=0, compresslevel=9) as zipped:
            with tarfile.open(fileobj=zipped, mode='w|') as archive:
                for name, expected in sorted(members.items()):
                    path = ROOT / name
                    info = tarfile.TarInfo(name)
                    info.size, info.mode, info.mtime = expected['bytes'], expected['mode'], 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ''
                    with path.open('rb') as stream:
                        archive.addfile(info, stream)
                info = tarfile.TarInfo(embedded_name)
                info.size, info.mode, info.mtime = len(metadata), 0o644, 0
                archive.addfile(info, io.BytesIO(metadata))
    expected_names = set(members) | {embedded_name}
    observed = set()
    with tarfile.open(target, 'r:gz') as archive:
        for info in archive:
            need(info.isfile() and info.name in expected_names and info.name not in observed, 'EXTRACT_MEMBERSHIP')
            observed.add(info.name)
            need(info.uid == info.gid == info.mtime == 0 and info.uname == info.gname == '', 'EXTRACT_METADATA')
            expected = members.get(info.name, dict(bytes=len(metadata), sha256=hashlib.sha256(metadata).hexdigest(), mode=0o644))
            need(info.size == expected['bytes'] and info.mode == expected['mode'], 'EXTRACT_SIZE_MODE')
            h = hashlib.sha256()
            with archive.extractfile(info) as stream:
                for block in iter(lambda: stream.read(65536), b''):
                    h.update(block)
            need(h.hexdigest() == expected['sha256'], 'EXTRACT_HASH')
    need(observed == expected_names, 'COMPLETE_EXTRACT_MEMBERSHIP')
    for name, expected in members.items():
        need(pin(ROOT / name) == {k: expected[k] for k in ['bytes', 'sha256']}, 'POST_ARCHIVE_SOURCE_DRIFT')
    need(pin(HOME / 'PINS.json')['sha256'] == PINS_SHA and pin(HOME / 'SOURCE-SEAL.json')['sha256'] == SEAL_SHA, 'FINAL_ACTIVE_SEAL')
    result = dict(**facts, sourceArchive={**pin(target), 'path': str(target.relative_to(ROOT))},
        extractedMembersVerified=len(observed), embeddedMetadataSHA256=hashlib.sha256(metadata).hexdigest())
    with manifest_path.open('x') as stream:
        stream.write(json.dumps(result, sort_keys=True, indent=2) + '\n')
    print(json.dumps(dict(status=result['status'], archive=result['sourceArchive'],
        manifest=str(manifest_path.relative_to(ROOT)), manifestPin=pin(manifest_path),
        hostContiguous=result['hostContiguousPhysicalAccepted'], campaignAccepted=result['campaignAccepted'])))


if __name__ == '__main__':
    main()
