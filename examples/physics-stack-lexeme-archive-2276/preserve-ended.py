"""Root-only pure hash/JSON IO. No codec import, decompression or candidate execution."""
import hashlib
import json
from pathlib import Path

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
PINS_SHA = '79729f2e0d02100437944022ed0f9ba452be91e81982137bbb4f9af12cdeb8a4'
SEAL_SHA = '7eec3c5fc1e7af055de171188bf4a5fd1345d84129a9bc40fe8a1098ecbec4c5'

def need(value, reason):
    if not value:
        raise ValueError(reason)

def pin(path):
    need(path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED')
    before = path.stat()
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(65536):
            digest.update(block)
    after = path.stat()
    need((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns), 'INPUT_CHANGED')
    return dict(bytes=after.st_size, sha256=digest.hexdigest())

def read(path):
    need(path.stat().st_size <= 2**21, 'SMALL_JSON_BOUND')
    return json.loads(path.read_bytes())

def main():
    output = HOME / 'FIRST-SCREEN-FAILURE.json'
    need(not output.exists(), 'FRESH_OUTPUT_REQUIRED')
    need(pin(HOME / 'PINS.json')['sha256'] == PINS_SHA, 'EXACT_ENDED_PINS')
    need(pin(HOME / 'SOURCE-SEAL.json')['sha256'] == SEAL_SHA, 'EXACT_ENDED_SEAL')
    pins = read(HOME / 'PINS.json')
    need(len(pins['files']) == 43, 'EXACT43_SOURCE_INPUTS')
    for name, expected in pins['files'].items():
        need(pin(ROOT / name) == expected, 'FROZEN_INPUT_DRIFT:' + name)
    for name, expected in read(HOME / 'SOURCE-SEAL.json')['files'].items():
        need(pin(HOME / name)['sha256'] == expected, 'SEALED_INPUT_DRIFT:' + name)
    case = HOME / 'evidence/screen-01'
    host = read(case / 'host/result.json')
    owner = read(case / 'summary.json')
    stop = read(case / 'host/stop.json')
    need(host['error']['code'] == 'RETAINED_CAP' and owner['status'] == 'SCREEN_NO_GO', 'EXACT_ENDED_NO_GO')
    need(stop['compressedBytes'] == 83886080 and stop['kernelWrittenCompleteFrames'] == 5707, 'EXACT_FIRST_SCREEN_STOP')
    archive = case / 'host/events.gz'
    need(archive.stat().st_size == 83886080, 'EXACT_PARTIAL_FILE_SIZE')
    # Includes exactly one streamed read of the80MiB partial archive; never decodes it.
    files = {str(path.relative_to(ROOT)): pin(path) for path in sorted(case.rglob('*')) if path.is_file()}
    source = {str(path.relative_to(ROOT)): pin(path) for path in sorted(HOME.iterdir())
              if path.is_file() and path.name != output.name}
    result = dict(status='ENDED_NO_GO_RETAINED_CAP_NO_RETRY_NOT_ADOPTED', sourcePINS_SHA256=PINS_SHA,
        sourceSealSHA256=SEAL_SHA, sourceInputsReauthenticated=43, actualScreenFiles=files,
        preservationMetadataAndSourceFiles=source, host=host, owner=owner, stop=stop,
        fullRecovery='NOT_RUN', completeOwnedNodeCPU='UNKNOWN', firstFailurePreserved=True,
        originalFullP4Qualification=False, API=False, candidateExecutionCalls=0,
        archiveDecompressions=0, hashBufferBytes=65536, noUniversalFitForecast=True)
    encoded = (json.dumps(result, sort_keys=True, indent=2) + '\n').encode()
    need(len(encoded) <= 65536, 'PRESERVATION_METADATA64K')
    with output.open('xb') as stream:
        stream.write(encoded)
    print(json.dumps(dict(status=result['status'], output=str(output.relative_to(ROOT)), pin=pin(output))))

if __name__ == '__main__':
    main()
