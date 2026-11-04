"""Root only. Deterministic source/small-receipt archive; large evidence stays external."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import stat
import sys
import re
import tarfile

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
CASE = HOME / 'evidence/full-05'
PINS_SHA = '46260824e261fe3582447723c89942f14dd0650052006c075ef48c9436873b7c'
SEAL_SHA = '4d37cd6b94b293a982dd4a47ff338d13c5812df26ea0d735790535693744d5c8'
ARCHIVE_SHA = '6f5871abe2d1f5f54e20c05ac7c3a90d4c287faa8987df2fd60c86b2f3dae230'


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
    target = baseline / 'full-05-source.tar.gz'
    manifest_path = baseline / 'full-05-preserved.json'
    need(not target.exists() and not manifest_path.exists(), 'FRESH_OUTPUTS_REQUIRED')
    need(pin(HOME / 'PINS.json')['sha256'] == PINS_SHA, 'EXACT_ACTIVE_FULL05_PINS')
    need(pin(HOME / 'SOURCE-SEAL.json')['sha256'] == SEAL_SHA, 'EXACT_ACTIVE_FULL05_SEAL')
    pins, seal = read(HOME / 'PINS.json'), read(HOME / 'SOURCE-SEAL.json')
    need(len(pins['files']) == 704, 'EXACT704_INPUTS')
    for name, expected in pins['files'].items():
        need(pin(ROOT / name) == expected, 'INPUT_DRIFT:' + name)
    need(len(seal['files']) == 39, 'EXACT39_SEALED_FILES')
    for name, expected in seal['files'].items():
        need(pin(HOME / name)['sha256'] == expected, 'SEALED_SOURCE_DRIFT:' + name)
    need(len(sys.argv) == 2 and re.fullmatch('[0-9a-f]{64}', sys.argv[1]),
         'usage: preserve-full-05.py ROOT_REVIEWED_OFFSET_ARCHIVE_SHA256')
    large = CASE / 'ALIGNED/host/events.gz'
    large_offset = CASE / 'OFFSET/host/events.gz'
    external = pin(large)
    external_offset = pin(large_offset)
    need(external == dict(bytes=222546917, sha256=ARCHIVE_SHA), 'EXACT_ALIGNED_EXTERNAL_ARCHIVE')
    need(external_offset == dict(bytes=60566605, sha256=sys.argv[1]), 'EXACT_OFFSET_PARTIAL_EXTERNAL_ARCHIVE')
    campaign = read(CASE / 'campaign-result.json')
    need(campaign['status'] == 'COMPLETE_CAMPAIGN_STOPPED', 'ENDED_NO_GO_REQUIRED')
    need(campaign['contiguousPhysicalAccepted'] == 1200, 'ACTUAL_CAMPAIGN_ACCEPTED1200')
    scenes = {}
    for name in ['ALIGNED', 'OFFSET', 'YAW']:
        folder = CASE / name
        scenes[name] = {}
        for role, suffix in [('host', 'host/result.json'), ('owner', 'summary.json'),
                             ('closedPhaseProgress', 'host/phase-checkpoint.json'),
                             ('archiveStop', 'host/stop.json'), ('closure', 'host/closure.json')]:
            path = folder / suffix
            scenes[name][role] = dict(present=path.is_file(), receipt=read(path) if path.is_file() else None)
    need(scenes['ALIGNED']['host']['receipt']['status'] == 'COMPLETE_SCENE_PHYSICAL_CONFIRMED', 'ALIGNED_LIVE_COMPLETED')
    need(scenes['ALIGNED']['owner']['receipt']['status'] == 'CPU_COMPLETE_ORIGINAL_SCENE', 'ALIGNED_CLEAN_CPU')
    need(scenes['OFFSET']['host']['receipt']['status'] == 'COMPLETE_SCENE_STOPPED', 'OFFSET_STOPPED')
    need(scenes['OFFSET']['archiveStop']['receipt']['code'] == 'RETAINED_CAP', 'OFFSET_RETAINED_CAP')
    paths = {p for p in HOME.iterdir() if p.is_file()}
    paths.update(p for p in CASE.rglob('*') if p.is_file() and p not in (large, large_offset))
    for group in ['stack-full04-offline-recovery-01']:
        folder = ROOT / 'examples/physics-world-p5-2276/evidence' / group
        if folder.exists():
            paths.update(p for p in folder.iterdir() if p.is_file() and p.stat().st_size <= 2**21)
    members = {}
    for path in sorted(paths):
        need(path.stat().st_size <= 2**21, 'UNEXPECTED_LARGE_SOURCE_OR_METADATA:' + str(path))
        members[str(path.relative_to(ROOT))] = dict(**pin(path), mode=stat.S_IMODE(path.stat().st_mode))
    facts = dict(status='PRESERVED_ENDED_FULL05_NOT_RECLASSIFIED', pinsSHA256=PINS_SHA,
        sourceSealSHA256=SEAL_SHA, checkedInputFiles=704, observedSceneLayers=scenes,
        campaignStatus=campaign['status'], campaignAccepted=campaign['contiguousPhysicalAccepted'],
        campaignScenes=campaign['scenes'], campaignFirstFailure=campaign['firstFailure'], laterYAW='NOT_RUN',
        budget=read(CASE / 'budget.json'),
        externalArchives={str(large.relative_to(ROOT)): external, str(large_offset.relative_to(ROOT)): external_offset},
        sourceAndSmallReceipts=members, originalIndependentFullPhysics=False, API=False,
        strictGlobal64MiBCertification='NOT_QUALIFIED', archiveLargePayloadIncluded=False,
        providerOrNumericalSourceExecution='NONE', numericalCalls=0,
        tarMetadata=dict(uid=0, gid=0, uname='', gname='', mtime=0, modes='ORIGINAL'))
    metadata = (json.dumps(facts, sort_keys=True, indent=2) + '\n').encode()
    need(len(metadata) <= 2**21, 'PRESERVATION_MANIFEST_BOUND')
    embedded_name = 'preservation/full-05-data.json'
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
        alignedHostContiguous=scenes['ALIGNED']['host']['receipt']['counts']['contiguousPhysicalAccepted'], offsetHostContiguous=scenes['OFFSET']['host']['receipt']['counts']['contiguousPhysicalAccepted'], campaignAccepted=result['campaignAccepted'])))


if __name__ == '__main__':
    main()
