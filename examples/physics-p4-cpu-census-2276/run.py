"""Root-only ONE instrumented retired-kernel run and bounded sample-weight analysis."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import selectors
import signal
import subprocess
import sys
import time

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
FILE_CAP = 2 * 1024 * 1024
TOTAL_CAP = 16 * 1024 * 1024
DATA_CAP = 64 * 1024 * 1024


def need(ok, reason):
    if not ok: raise ValueError(reason)


def pin(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''): digest.update(block)
    return dict(bytes=path.stat().st_size, sha256=digest.hexdigest())


def data_size(value):
    seen, pending, size = set(), [value], 0
    while pending:
        item = pending.pop()
        if id(item) in seen: continue
        seen.add(id(item)); size += sys.getsizeof(item)
        need(size <= DATA_CAP, 'EXPLICIT_PARENT_DATA_LIMIT')
        if isinstance(item, dict): pending.extend(item.keys()); pending.extend(item.values())
        elif isinstance(item, (list, tuple, set)): pending.extend(item)
    return size


def decode(path):
    need(path.stat().st_size <= FILE_CAP, 'JSON_FILE_LIMIT')
    raw = path.read_bytes()
    # Reserve conservatively before dense decoding. Syntax delimiters over-count strings safely.
    reserve = len(raw) * 8 + sum(raw.count(c) for c in (b'{', b'[', b',', b':')) * 256 + 8388608
    need(reserve <= DATA_CAP, 'JSON_PREALLOCATION_LIMIT')
    value = json.loads(raw); data_size((raw, value)); return value


def child_file_cap():
    resource.setrlimit(resource.RLIMIT_FSIZE, (FILE_CAP, FILE_CAP))


def analyse(profile, deadline):
    nodes, samples, deltas = profile['nodes'], profile['samples'], profile['timeDeltas']
    need(len(nodes) <= 8192 and len(samples) == len(deltas) <= 131072, 'PROFILE_CENSUS_BOUND')
    indexed = {node['id']: node for node in nodes}
    need(len(indexed) == len(nodes), 'UNIQUE_PROFILE_NODE_IDS')
    parent = {}
    for node in nodes:
        for child in node.get('children', []):
            need(child in indexed and child not in parent, 'PROFILE_SINGLE_PARENT_TREE')
            parent[child] = node['id']
    roots = set(indexed) - set(parent); need(len(roots) == 1, 'ONE_PROFILE_ROOT')
    identities = {}
    for node_id, node in indexed.items():
        frame = node['callFrame']
        identities[node_id] = (frame.get('url', ''), frame.get('functionName', ''), frame.get('lineNumber', -1), frame.get('columnNumber', -1))
    for node_id in indexed:
        seen_path = set()
        while node_id in parent:
            need(node_id not in seen_path and len(seen_path) < 256, 'PROFILE_FULL_TREE_DEPTH_OR_CYCLE')
            seen_path.add(node_id); node_id = parent[node_id]
        need(node_id in roots, 'PROFILE_FULL_TREE_REACHABILITY')
    exclusive, inclusive = {}, {}
    total = 0
    for index, (node_id, delta) in enumerate(zip(samples, deltas)):
        if index % 256 == 0: need(time.monotonic() < deadline, 'ANALYSIS_DEADLINE')
        need(node_id in indexed and type(delta) is int and delta >= 0, 'VALID_NONNEGATIVE_SAMPLE_DELTA')
        total += delta; key = identities[node_id]
        exclusive[key] = exclusive.get(key, 0) + delta
        visited_nodes, visited_functions = set(), set()
        while True:
            need(node_id not in visited_nodes and len(visited_nodes) < 256, 'PROFILE_DEPTH_OR_CYCLE')
            visited_nodes.add(node_id); visited_functions.add(identities[node_id])
            if node_id not in parent: break
            node_id = parent[node_id]
        for function in visited_functions: inclusive[function] = inclusive.get(function, 0) + delta
    def top(weights):
        return [dict(url=key[0], function=key[1], lineNumberZeroBased=key[2], columnNumberZeroBased=key[3], sampleWeightMicroseconds=weight, label='SAMPLE_WEIGHT_NOT_COST_CPU')
                for key, weight in sorted(weights.items(), key=lambda item: (-item[1], item[0]))[:20]]
    result = dict(label='SAMPLE_WEIGHT_NOT_COST_CPU', nodes=len(nodes), samples=len(samples), intervalRequestedMicroseconds=1000,
                  totalSampleWeightMicroseconds=total, topExclusive=top(exclusive), topInclusive=top(inclusive),
                  interpretation='TimeDelta-weighted diagnostic samples, not cost CPU or an actual speed ratio')
    data_size((profile, indexed, parent, identities, exclusive, inclusive, result))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('fresh_id'); parser.add_argument('--reviewed-pins-sha', required=True)
    args = parser.parse_args()
    need(args.fresh_id and len(args.fresh_id) <= 64 and all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.fresh_id), 'FRESH_ID')
    started = time.monotonic(); deadline = started + 170
    pins_path = HOME / 'PINS.json'; need(pin(pins_path)['sha256'] == args.reviewed_pins_sha, 'EXACT_ROOT_REVIEWED_PINS')
    pins = decode(pins_path)
    need(Path(sys.executable).resolve() == Path(pins['python']['path']).resolve(), 'PINNED_PYTHON_DRIVER_REQUIRED')
    for name, expected in pins['sources'].items(): need(pin(ROOT / name) == expected, 'SOURCE_DRIFT:' + name)
    for name, expected in pins['tools'].items(): need(pin(Path(name)) == expected, 'TOOL_DRIFT:' + name)
    out = HOME / 'evidence' / args.fresh_id; out.mkdir(parents=True, exist_ok=False)
    profile_dir = out / 'profile'; profile_dir.mkdir()
    need(time.monotonic() < deadline, 'AUTHENTICATION_DEADLINE'); written = 0
    summary = dict(status='NOT_RUN', label='INSTRUMENTED_DIAGNOSTIC_ONLY', firstFailure=None, candidateCommands=0,
                   costDecisions=0, baselineReruns=0, independentRepeats=0, retiredCandidateEligibility='UNCHANGED_ENDED', wholeP4='UNCHANGED_NO_GO')
    child = None
    def put(name, value, terminal=False):
        nonlocal written
        raw = value if isinstance(value, bytes) else (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()
        need(written + len(raw) <= TOTAL_CAP - (0 if terminal else 65536), 'EVIDENCE_TOTAL_LIMIT')
        with (out / name).open('xb') as stream: stream.write(raw)
        written += len(raw)
    old_handler = signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_DEADLINE')))
    signal.alarm(170)
    try:
        request = ROOT / pins['request']; expected_reply = ROOT / pins['qualifiedReply']
        reply = out / 'reply.json'; profile = profile_dir / 'kernel.cpuprofile'
        argv = [pins['node']['path'], '--cpu-prof', '--cpu-prof-interval=1000', '--cpu-prof-dir=' + str(profile_dir), '--cpu-prof-name=kernel.cpuprofile', str(ROOT / pins['candidate']), 'kernel', str(request), str(reply)]
        put('header.json', dict(argv=argv, nodeVersion=pins['node']['version'], versionAuthority='PINNED_BINARY_AND_PRIOR_ROOT_RECEIPT', versionProbePerformed=False, pythonExecutable=sys.executable, pythonVersion=sys.version, pins=pin(pins_path), request=pin(request), qualifiedReply=pin(expected_reply), profileIntervalMicroseconds=1000, environmentPolicy='PRESERVE_ALL_ENV_REQUIRE_NODE_OPTIONS_EMPTY_OR_ABSENT', label='INSTRUMENTED_DIAGNOSTIC_ONLY', networkOrListenFlags=[]))
        buffers = dict(stdout=bytearray(), stderr=bytearray())
        summary['candidateCommands'] = 1
        env = dict(os.environ)
        need(not env.get('NODE_OPTIONS'), 'NONEMPTY_NODE_OPTIONS_REQUIRES_REVIEW_NO_OVERRIDE')
        child = subprocess.Popen(argv, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0, start_new_session=False, preexec_fn=child_file_cap)
        with selectors.DefaultSelector() as selection:
            for name in buffers:
                stream = getattr(child, name); os.set_blocking(stream.fileno(), False); selection.register(stream, selectors.EVENT_READ, name)
            while selection.get_map():
                remaining = math.floor((deadline - time.monotonic()) * 1000); need(remaining > 0, 'PROFILE_COMMAND_DEADLINE')
                for key, _ in selection.select(min(remaining, 100) / 1000):
                    chunk = os.read(key.fd, 65536)
                    if not chunk: selection.unregister(key.fileobj); continue
                    need(len(buffers[key.data]) + len(chunk) <= FILE_CAP, 'PROCESS_OUTPUT_LIMIT')
                    buffers[key.data].extend(chunk)
            remaining = math.floor((deadline - time.monotonic()) * 1000); need(remaining > 0, 'PROFILE_EXIT_DEADLINE')
            child.wait(timeout=remaining / 1000)
        for name, raw in buffers.items(): put(name + '.raw', bytes(raw))
        put('process.json', dict(exit=child.returncode, inheritedCensusGroup=True, childPid=child.pid, nodeOptionsPreserved=True, nodeOptionsEmptyOrAbsent=True))
        need(child.returncode == 0, 'PROFILE_NODE_EXIT')
        for file in (reply, profile):
            need(file.is_file() and file.stat().st_size <= FILE_CAP, 'PROFILE_OR_REPLY_FILE_LIMIT')
            written += file.stat().st_size
        need(written <= TOTAL_CAP - 65536, 'EVIDENCE_TOTAL_LIMIT')
        need(pin(reply) == pin(expected_reply) and reply.read_bytes() == expected_reply.read_bytes(), 'ALL_REPLY_BYTES_FIELDS_COUNTERS_MUST_MATCH_QUALIFIED_ALIGNED16')
        summary['replyIdentity'] = dict(status='ALL_BYTES_FIELDS_COUNTERS_IDENTICAL', actual=pin(reply), qualified=pin(expected_reply))
        result = analyse(decode(profile), deadline); put('hotspots.json', result)
        summary['profilePin'] = pin(profile); summary['sampleAnalysis'] = result
        summary['status'] = 'PASS_D0_INSTRUMENTED_DIAGNOSTIC_IDENTICAL_MATH_ONLY'
    except Exception as error:
        summary['status'] = 'NO_GO_D0_DIAGNOSTIC_FIRST_FAILURE'; summary['firstFailure'] = dict(type=type(error).__name__, message=str(error))
    finally:
        if child is not None and child.poll() is None:
            child.kill()
            try: child.wait(timeout=2)
            except Exception as error: summary['cleanupError'] = str(error)
        if child is not None:
            for stream in (child.stdout, child.stderr):
                if not stream.closed: stream.close()
        signal.alarm(0); signal.signal(signal.SIGALRM, old_handler)
        summary.update(elapsedWallNs=round((time.monotonic()-started)*1e9), writtenBytesBeforeSummary=written,
                       diagnosticOnly=True, actualSpeedRatio='NOT_MEASURED', costCPU='NOT_MEASURED')
        put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], output=str(out))))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__': raise SystemExit(main())
