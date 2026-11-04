"""Root entry: two modes only; fresh ordered scene owners, never a physics import."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def need(value, reason):
    if not value:
        raise ValueError(reason)


def pin(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            h.update(block)
    return dict(bytes=Path(path).stat().st_size, sha256=h.hexdigest())


def read_json(path, limit=1024*1024):
    need(Path(path).stat().st_size <= limit, 'BOUNDED_METADATA:' + str(path))
    return json.loads(Path(path).read_bytes())


def write_json(path, value, limit=1024*1024):
    raw = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    need(len(raw) <= limit, 'FIXED_METADATA_BOUND')
    with Path(path).open('xb') as stream:
        stream.write(raw)


def main():
    need(len(sys.argv) in (4, 5), 'USAGE:run.py prefix|full FRESH_OUT PINS_SHA [PREFIX_OUT]')
    mode, target, pins_sha = sys.argv[1:4]
    need(mode in ('prefix', 'full') and len(sys.argv) == (4 if mode == 'prefix' else 5), 'TWO_FIXED_MODES')
    home = Path(__file__).resolve().parent
    root = home.parents[1]
    out = Path(target).resolve()
    out.mkdir(parents=True, exist_ok=False)
    start = time.monotonic()
    signal.signal(signal.SIGALRM, lambda *_: os._exit(1))
    signal.setitimer(signal.ITIMER_REAL, 180)  # Common read-only preflight; no scene children yet.
    need(pin(home / 'PINS.json')['sha256'] == pins_sha, 'REVIEWED_PINS_REQUIRED')
    pins = read_json(home / 'PINS.json', 512*1024)

    def authenticate():
        need(pin(home / 'PINS.json')['sha256'] == pins_sha, 'PINS_CHANGED')
        need(Path(sys.executable).resolve() == Path(pins['python']).resolve() and sys.version == pins['pythonVersion'], 'PINNED_PYTHON')
        for name, expected in pins['files'].items():
            need(pin(root / name) == expected, 'PIN_DRIFT:' + name)

    authenticate()
    need(pins.get('profile') == 'STATIONARY_NORMAL_EXACT_V1', 'NEW_ALGORITHM_PROFILE_REQUIRED')
    need(pins.get('stationaryCandidateAdmission') == 'ROOT_SAME32_SOURCE_NATIVE_FRACTION_FLOAT_CONFIRMED', 'NEW_CANDIDATE_NOT_ADMITTED')
    seal_sha = pin(home / 'SOURCE-SEAL.json')['sha256']
    seal = read_json(home / 'SOURCE-SEAL.json')
    for name, expected in seal['files'].items():
        need(pin(home / name)['sha256'] == expected, 'SOURCE_SEAL:' + name)
    controls = read_json(root / pins['windowControlsReceipt'])
    need(controls['status'] == 'PASS_FIXED8_COMPLETE_WINDOW_AND_COMMITTED_960_BARRIER' and controls['tests'] == 8, 'FIXED8_ACTUAL_PASS')
    need(pins['controlResultSHA256'] == pin(root / pins['windowControlsReceipt'])['sha256'], 'FIXED8_RECEIPT')
    # Exact source-bound Root receipts are pinned, including their full statuses.
    need(pins['prerequisitesQualified'] is True, 'PREREQUISITES_NOT_QUALIFIED')
    admission = dict(mode=mode, pinsSHA=pins_sha, sourceSealSHA256=seal_sha, prefix=None)
    if mode == 'full':
        prefix = Path(sys.argv[4]).resolve()
        gate = read_json(prefix / 'campaign-result.json')
        need(gate['status'] == 'COMBINED_PREFIX_CONFIRMED' and gate['mode'] == 'prefix' and gate['profile'] == pins['profile']
             and gate['pinsSHA'] == pins_sha and gate['sourceSealSHA256'] == seal_sha
             and gate['contiguousPhysicalAccepted'] == 48 and len(gate['scenes']) == 3,
             'SAME_SOURCE_COMBINED_PREFIX_REQUIRED')
        for item in gate['scenes']:
            need(item['steps'] == 16 and item['cpuStatus'] == 'CPU_COMPLETE_ORIGINAL_SCENE', 'PREFIX_PHYSICAL_CPU_GATE')
            need(pin(prefix / item['scene'] / 'summary.json')['sha256'] == item['ownerSummarySHA256'], 'PREFIX_OWNER_RECEIPT')
            need(pin(prefix / item['scene'] / 'host/result.json')['sha256'] == item['physicalResultSHA256'], 'PREFIX_PHYSICAL_RECEIPT')
        admission['prefix'] = dict(path=str(prefix / 'campaign-result.json'), sha256=pin(prefix / 'campaign-result.json')['sha256'])
    write_json(out / 'admission.json', admission, 16384)
    write_json(out / 'campaign-inputs.json', dict(pinsSHA=pins_sha, sourceSealSHA256=seal_sha,
        mode=mode, metadataReserveBytes=8*2**20, emergencyReserveBytes=2*2**20,
        normalAndEmergencySharedCapBytes=280*2**20, externalInputsCopied=False), 16384)
    write_json(out / 'budget.json', dict(cap=280*2**20, used=8*2**20, reserve=2*2**20), 1024)
    need(time.monotonic()-start < 170, 'COMMON_PREFLIGHT170')
    preflight_seconds = time.monotonic()-start
    signal.setitimer(signal.ITIMER_REAL, 0)
    scenes = []
    failure = None
    for scene in ('ALIGNED', 'OFFSET', 'YAW'):
        command = [pins['python'], '-B', str(home / 'scene-owner.py'), str(out / scene), pins_sha,
                   mode, scene, str(out / 'budget.json'), str(out)]
        # The direct owner sets its own group before any Node/Worker/reference spawn.
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, start_new_session=False)
        try:
            stdout, stderr = process.communicate(timeout=181)
        except subprocess.TimeoutExpired:
            if os.getpgid(process.pid) == process.pid:
                os.killpg(process.pid, signal.SIGKILL)
            else:
                process.kill()
            stdout, stderr = process.communicate()
        need(len(stdout) <= 4096 and len(stderr) <= 4096, 'OWNER_CONTROL_OUTPUT_BOUND')
        (out / (scene+'-owner.stdout')).write_bytes(stdout)
        (out / (scene+'-owner.stderr')).write_bytes(stderr)
        try:
            need(process.returncode == 0 and not stdout and not stderr, 'OWNER_STOPPED')
            owner = read_json(out / scene / 'summary.json')
            result = read_json(out / scene / 'host/result.json', 128*1024)
            steps = 16 if mode == 'prefix' else 1200
            need(owner['status'] == 'CPU_COMPLETE_ORIGINAL_SCENE' and result['status'] == 'COMPLETE_SCENE_PHYSICAL_CONFIRMED', 'SCENE_OR_CPU_NOT_QUALIFIED')
            need(owner['scene'] == scene and owner['mode'] == mode and result['lastContiguous'] == steps, 'SCENE_POPULATION_IDENTITY')
            scenes.append(dict(scene=scene, steps=steps, cpuStatus=owner['status'],
                ownerSummarySHA256=pin(out / scene / 'summary.json')['sha256'],
                physicalResultSHA256=pin(out / scene / 'host/result.json')['sha256'],
                contiguousPhysicalAccepted=result['lastContiguous'], cpuUs=owner['completeNodeSubtreeCpuUs'],
                archive=result['archive'], recovery=result['recovery']))
        except Exception as error:
            failure = dict(scene=scene, errorClass=type(error).__name__, message=str(error)[:1024],
                           ownerExit=process.returncode, laterScenes='NOT_RUN')
            break
    try:
        authenticate()
        need(pin(home / 'SOURCE-SEAL.json')['sha256'] == seal_sha, 'FINAL_SOURCE_SEAL')
    except Exception as error:
        failure = failure or dict(errorClass=type(error).__name__, message=str(error)[:1024])
    accepted = sum(item['contiguousPhysicalAccepted'] for item in scenes)
    full = failure is None and len(scenes) == 3 and mode == 'full' and accepted == 3600
    status = 'ORIGINAL_INDEPENDENT_PHYSICS_3600_CONFIRMED' if full else 'COMBINED_PREFIX_CONFIRMED' if failure is None and len(scenes) == 3 and mode == 'prefix' else 'COMPLETE_CAMPAIGN_STOPPED'
    write_json(out / 'campaign-result.json', dict(status=status, mode=mode, profile=pins['profile'], pinsSHA=pins_sha,
        sourceSealSHA256=seal_sha, scenes=scenes, firstFailure=failure, contiguousPhysicalAccepted=accepted,
        originalIndependentFullPhysics=full, independentFullPhysicsSteps=3600 if full else 0,
        preflightSeconds=preflight_seconds, budget=read_json(out / 'budget.json'),
        strictGlobal64MiBCertification='NOT_QUALIFIED', API=False, publicWorld='NOT_RUN', desktop='NOT_RUN'))
    return 0 if failure is None and len(scenes) == 3 else 1


if __name__ == '__main__':
    sys.exit(main())
