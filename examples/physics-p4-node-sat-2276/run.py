#!/usr/bin/env python3
"""One owned Node reference worker; complete saved cold-position reply audit."""
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import signal
import sys
import time

import backend
import client
import observer
import verify

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAX_OUTPUT = 16 * 1024 * 1024
MAX_RETAINED = 64 * 1024 * 1024
WORKER_DATA_RESERVE = 12 * 1024 * 1024
sys.dont_write_bytecode = True


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(65536):
            digest.update(chunk)
    return digest.hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = value
    spec.loader.exec_module(value)
    return value


def main():
    if len(sys.argv) != 2 or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', sys.argv[1]) is None:
        raise ValueError('one fresh run ID required')
    out = HERE / 'evidence' / sys.argv[1]
    out.mkdir(parents=True, exist_ok=False)
    wall, cpu = time.monotonic_ns(), time.process_time_ns()
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_GUARD')))
    signal.alarm(170)
    counts = dict(framesAttempted=0, framesReturned=0, framesVerified=0, compactAttempts=0,
        compactReturns=0, scalarCalls=0, scalarReturns=0, coldKernelAttempts=0, coldKernelReturns=0,
        coldQpAttempts=0, coldQpReturns=0, forbiddenOldCompactAttempts=0, oldDecimalSatCalls=0,
        oldObserverBaselineCalls=0, WorldCalls=0, fixtureCalls=0, trigSeedCalls=0,
        compactRecordsVerified=0, numericWordsVerified=0, retainedPayloadLeavesVerified=0)
    summary = dict(protocol=observer.PROTOCOL, experiment='owned-node-reference-worker', status='NOT_RUN',
        counts=counts, frames=[], firstFailure=None, costGO='NOT_RUN', fullP4='NO_GO',
        line32PointLedgerQuality='NOT_RUN', wholeTrajectoryCostGO='NOT_RUN')
    charged = peak_owned = 0
    worker = context = protocol_log = None
    cursor = None
    numeric_pass = False
    baseline_core = None

    def put(name, data):
        nonlocal charged
        if charged + len(data) > MAX_OUTPUT:
            raise ValueError('TOTAL_EVIDENCE_LIMIT')
        (out / name).write_bytes(data)
        charged += len(data)

    def worker_log(kind, value):
        nonlocal charged
        if charged + 1024 * 1024 > MAX_OUTPUT:
            raise ValueError('WORKER_LOG_PREALLOCATION_LIMIT')
        data = json.dumps(dict(kind=kind, value=value), separators=(',', ':'), allow_nan=False).encode() + b'\n'
        if len(data) > 1024 * 1024:
            raise ValueError('WORKER_LOG_LINE_LIMIT')
        protocol_log.write(data)
        protocol_log.flush()
        charged += len(data)

    try:
        dependencies = json.loads((HERE / 'dependencies.json').read_text())
        for relative, pin in dependencies['pins'].items():
            path = ROOT / relative
            if path.stat().st_size != pin['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest() != pin['sha256']:
                raise ValueError('DEPENDENCY_DRIFT:' + relative)
        node = dependencies['nodeTool']
        node_path = Path(node['path'])
        if node_path.stat().st_size != node['bytes'] or file_sha256(node_path) != node['sha256']:
            raise ValueError('EXISTING_NODE_BINARY_DRIFT')
        for name in ('observer.py','verify.py'):
            if (HERE/name).read_bytes() != (ROOT/'examples/physics-p4-position-v2-2276'/name).read_bytes():
                raise ValueError('QUALIFIED_POSITION_COMPONENT_DRIFT:' + name)
        baseline_pin = dependencies['pairedCostBaseline']
        baseline = json.loads((ROOT / baseline_pin['path']).read_text())
        baseline_core = sum(f[baseline_pin['field']] for f in baseline['frames'])
        if baseline['status'] != 'PASS_OFFLINE_FULL_COLD_POSITION_V2' or baseline_core != baseline_pin['coreCpuNs']:
            raise ValueError('FIXED_BASELINE_DRIFT')
        summary['pairedCostBaseline'] = baseline_pin
        loader = module(ROOT/'examples/physics-p4-compact-v2-2276/loaders.py', 'p4_node_scalar_loaders')
        h = module(ROOT/'examples/physics-p4-sat-2276/run.py', 'p4_node_saved_helpers')
        corpus = json.loads((ROOT/'examples/physics-p4-sat-2276/corpus.json').read_text())
        paths = []
        for scene, step, session, input_sha, output_sha in corpus['frames']:
            folder = ROOT/'examples/physics-world-p4-2276/evidence'/session
            stem = f'{scene}-{step}-position-world'
            ip, op = folder/(stem+'.stdin.jsonl'), folder/(stem+'.stdout.raw')
            h.authenticated(ip, input_sha)
            h.authenticated(op, output_sha)
            paths.append((scene, step, ip, op, input_sha, output_sha))
        compact_dependencies = json.loads((ROOT/'examples/physics-p4-compact-v2-2276/dependencies.json').read_text())
        scalar, scalar_audit = loader.scalar_closure(ROOT, compact_dependencies)
        compact_verify = module(ROOT/'examples/physics-p4-compact-v2-2276/verify.py', 'p4_node_compact_observer')
        old_path = ROOT/dependencies['fullPositionPath']
        original = module(old_path, 'p4_node_original_cold_definitions')
        protocol_log = (out/'worker-protocol.jsonl').open('xb')
        worker = client.NodeWorker(node_path, HERE/'worker.mjs', time.monotonic()+min(170, max(0,170-(time.monotonic_ns()-wall)/1e9)), worker_log)
        meter = backend.MeterFacade(worker)
        context_type = backend.observer_type(observer.PositionObserver)
        context = context_type(original, old_path.read_text(), dependencies['spans'], h,
            backend.GeometryFacade, backend.CompactBackend(worker), scalar, meter, counts)
        transfer = context.transfer_audit
        put('function-transfer.json', json.dumps(transfer, indent=2).encode()+b'\n')
        put('function-transfer.diff', ''.join(difflib.unified_diff(transfer['originalWorldSource'].splitlines(True),
            transfer['transformedWorldSource'].splitlines(True), fromfile='authenticated-original-world', tofile='node-compact-world-v2')).encode())
        summary['scalarSourceAudit'] = scalar_audit
        summary['setupParentCpuNs'] = time.process_time_ns()-cpu
        for scene, step, ip, op, input_sha, output_sha in paths:
            counts['framesAttempted'] += 1
            cursor = dict(scene=scene, step=step)
            frame_wall, frame_cpu = time.monotonic_ns(), time.process_time_ns()
            if (ip.stat().st_size+op.stat().st_size)*128 + 32*1024*1024 + WORKER_DATA_RESERVE > MAX_RETAINED:
                raise ValueError('COMBINED_PARENT_WORKER_DECODE_PREBOUND')
            decode = time.process_time_ns()
            request, saved = json.loads(h.authenticated(ip,input_sha)), json.loads(h.authenticated(op,output_sha))
            if request['scene'] != scene or request['stepIndex'] != step or saved['resolved'] is not True:
                raise ValueError('FRAME_AUTHORITY_LAYOUT')
            decode_cpu = time.process_time_ns()-decode
            peak_owned = max(peak_owned,h.allocation((request,saved)))
            before_child_nested = worker.request_cpu_us
            observed = time.process_time_ns()
            reply = context.evaluate(request)
            parent_observer_cpu = time.process_time_ns()-observed
            counts['framesReturned'] += 1
            serialize = time.process_time_ns()
            if charged+2*1024*1024 > MAX_OUTPUT:
                raise ValueError('FRAME_OUTPUT_PREBOUND')
            data = json.dumps(reply,separators=(',',':'),allow_nan=False).encode()+b'\n'
            if len(data)>2*1024*1024:
                raise ValueError('FRAME_OUTPUT_LIMIT')
            put(f'{scene}-{step}-reply.json',data)
            serialize_cpu = time.process_time_ns()-serialize
            peak_owned=max(peak_owned,h.allocation((request,saved,reply,context.states)))
            if reply.get('resolved') is not True or reply.get('ok') is not True:
                raise ValueError('POSITION_OBSERVER_REFUSAL:'+str(reply.get('referenceStatus'))+':'+str(reply.get('violations')))
            if context.request_calls != 72:
                raise ValueError('ALL_72_COMPACT_CALLS_REQUIRED')
            audit = time.process_time_ns()
            checked = verify.verify(reply,saved,compact_verify)
            audit_cpu = time.process_time_ns()-audit
            counts['framesVerified'] += 1
            for name in ('compactRecordsVerified','numericWordsVerified','retainedPayloadLeavesVerified'):
                counts[name] += checked[name]
            summary['frames'].append(dict(scene=scene,step=step,elapsedWallNs=time.monotonic_ns()-frame_wall,
                parentFrameCpuNs=time.process_time_ns()-frame_cpu,parentDecodeCpuNs=decode_cpu,
                parentObserverIncludingCompactQpCpuNs=parent_observer_cpu,
                childRequestCpuUsNestedOnly=worker.request_cpu_us-before_child_nested,
                parentNestedAttribution=dict(context.times),parentSerializeWriteCpuNs=serialize_cpu,
                parentSavedAuditCpuNs=audit_cpu,referenceCounters=reply['reference']['counters'],verified=checked))
            context.states={}
            del request,saved,reply,data
        if (counts['framesVerified'],counts['coldQpAttempts'],counts['coldQpReturns'],counts['scalarCalls'],
            counts['compactRecordsVerified'],meter.models,meter.axes)!=(6,6,6,432,432,864,12960):
            raise ValueError('COMPLETE_POPULATION_REQUIRED')
        numeric_pass=True
        summary['numericCompatibility']='PASS_COMPLETE_SAVED_PHYSICAL_REPLY'
    except Exception as error:
        summary['status']='NO_GO_NODE_POSITION_REFERENCE'
        summary['firstFailure']=dict(type=type(error).__name__,message=str(error),cursor=cursor,counts=dict(counts))
    finally:
        # Leave the unchanged180s outer guard enough room for bounded owned cleanup.
        signal.alarm(0)
        lifecycle=None
        if worker is not None:
            try:
                lifecycle=worker.close()
            except Exception as error:
                summary['cleanupFailure']=dict(type=type(error).__name__,message=str(error))
            summary['ownedNodeLifecycle']=lifecycle
            summary['satCounters']=worker.stats
        if protocol_log is not None:
            protocol_log.close()
        clean=bool(lifecycle and lifecycle.get('completeCleanLifecycle'))
        child_cpu=lifecycle.get('ownedWait4',{}).get('totalCpuNs') if lifecycle else None
        parent_core=sum(f['parentObserverIncludingCompactQpCpuNs'] for f in summary['frames'])
        if numeric_pass and clean and child_cpu is not None:
            candidate=parent_core+child_cpu
            cost_go=candidate*10<=baseline_core*9
            summary['costGO']='GO' if cost_go else 'NO_GO'
            summary['status']='NUMERIC_EQ_PASS_NODE_COST_GO' if cost_go else 'NUMERIC_EQ_PASS_NODE_COST_NO_GO'
            summary['pairedCost']=dict(baselineCoreCpuNs=baseline_core,parentObserverCoreCpuNs=parent_core,
                entireOwnedChildLifetimeCpuNs=child_cpu,conservativeCandidateCoreCpuNs=candidate,
                requiredGainFraction=.1,observedConservativeGainFraction=1-candidate/baseline_core,
                candidateBoundaryConservativelyWider=True,exactSameTimingBoundaryClaimed=False,
                childStartupAndEpilogueIncluded=True,savedBaselineOnePairing=True,baselineRerun=False,
                requestCpuUsedForGate=False,noFurtherTuningAuthorized=not cost_go)
            if not cost_go:
                summary['firstFailure']=dict(type='COST_NO_GO',message='frozen10percent conservative aggregate CPU gain not met',
                    baselineCoreCpuNs=baseline_core,candidateCoreCpuNs=candidate,counts=dict(counts))
        elif numeric_pass:
            summary['status']='NUMERIC_EQ_PASS_NODE_LIFECYCLE_NO_GO'
            summary['performance']='NOT_RUN_OWNED_CPU_OR_CLEANUP_UNQUALIFIED'
        parent_lifetime=time.process_time_ns()
        summary.update(elapsedBatchWallNs=time.monotonic_ns()-wall,parentBatchCpuNs=parent_lifetime-cpu,
            parentProcessLifetimeCpuNs=parent_lifetime,ownedChildLifetimeCpuNs=child_cpu,
            wholeParentPlusOwnedChildCpuNs=None if child_cpu is None else parent_lifetime+child_cpu,
            peakMeasuredParentDataBytes=peak_owned,workerExplicitReserveBytes=WORKER_DATA_RESERVE,
            combinedMeasuredParentPlusWorkerReserveBytes=peak_owned+WORKER_DATA_RESERVE,
            writtenEvidenceBytesBeforeSummary=charged,
            timingBoundary='Parent core plus ENTIRE owned wait4 child CPU; conservative wider baseline. Terminal summary write excluded.',
            perRequestCpu='NESTED_ATTRIBUTION_ONLY_NOT_GATE',totalRuntimeRssBoundClaimed=False,
            originalQpBudgetsUnchanged=True,originalPhysicalGatesUnchanged=True,
            unsupported=['independent geometry NO_GO repair','32-point line/paired witness','ledger/quality','full1200-step P4'])
        put('summary.json',json.dumps(summary,indent=2,allow_nan=False).encode()+b'\n')
    return 0 if summary['status']=='NUMERIC_EQ_PASS_NODE_COST_GO' else 1


if __name__=='__main__':
    raise SystemExit(main())
