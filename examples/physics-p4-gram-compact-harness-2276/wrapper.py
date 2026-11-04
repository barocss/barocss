"""One fresh six-frame full-reference witness bank. Root executes; no World import."""
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time
import types
from node_bridge import NativeWorker
from transport import Transport, bootstrap

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MAX_REPLY = 2 * 1024 * 1024
MAX_EVIDENCE = 16 * 1024 * 1024
MAX_OUTER = 22 * 1024 * 1024
PROTOCOL = 'p4-position-witness-direct-grid-v3'
ARITHMETIC = 'guarded exact witness; one fraction-free factorization; all-row KKT'
AUTHORITY = 'exact-global-KKT-with-untrusted-native-basis'
CORE = ROOT / 'examples/physics-p4-integer-witness-2276'
COMPACT = ROOT / 'examples/physics-p4-radical-compact-2276'
GEOMETRY = ROOT / 'examples/physics-p4-gram-compact-2276'
OWNED = ROOT / 'examples/physics-p4-owned-data-2276'
PRODUCTION_PATHS = tuple(CORE / name for name in ('candidate.mjs', 'smallworker.mjs', 'CONTRACT.md', 'ALLOCATION.md', 'GUARD-POLICY.md', 'ALGORITHM.md')) + (HERE / 'wrapper.py', HERE / 'node_bridge.py', COMPACT / 'backend.py', GEOMETRY / 'geometry.py', HERE / 'transport.py', OWNED / 'owned.py', OWNED / 'PINS.json', OWNED / 'evidence/selftest-01/summary.json')
DEFAULT_AUTHORITY = dict(positionDependencies='examples/physics-p4-position-v2-2276/dependencies.json',
    compactDependencies='examples/physics-p4-compact-v2-2276/dependencies.json',
    corpus='examples/physics-p4-sat-2276/corpus.json')
sys.dont_write_bytecode = True


def pin(path):
    path = Path(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return dict(bytes=path.stat().st_size, sha256=digest.hexdigest())


def authenticated(path, expected):
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT) or pin(path) != expected:
        raise ValueError('AUTHENTICATION_DRIFT:' + str(path))
    return path


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


class WitnessObserver:
    def __init__(self, original, observer_v2, source, spans, h, k, cb, scalar, meter, counts, bridge, deadline, io):
        self.original, self.h, self.k, self.compact_backend = original, h, k, cb
        self.scalar, self.meter, self.counts = scalar, meter, counts
        self.bridge, self.deadline, self.io = bridge, deadline, io
        self.request_calls, self.states = 0, {}
        self.times = dict(compactCpuNs=0, parentBridgeCpuNs=0, legacyAdmissionCpuNs=0)
        self.last_kernel = self.last_model_exact = self.legacy_model = None
        self.legacy = dict(admissionCalls=0, arithmeticInstances=0, problemEquivalenceIntegerComparisons=0)
        text, self.transfer_audit = observer_v2.transfer(source, spans)
        anchor = 'model = F.decode(request["problem"],F.Arithmetic())'
        if text.count(anchor) != 1:
            raise ValueError('EXACT_OUTER_MODEL_ANCHOR')
        text = text.replace(anchor, anchor + '\n    capture_legacy_model(model)', 1)
        self.transfer_audit['witnessModelCaptureAnchorCount'] = 1
        self.transfer_audit['witnessWorldSource'] = text
        self.transfer_audit['witnessWorldSha256'] = hashlib.sha256(text.encode()).hexdigest()
        self.transfer_audit['compactCertificateBinding'] = 'NEW_ACTUAL_V3_BACKEND_AND_V3_HELPERS_NO_V2_REPLY_REWRITE'
        self.transfer_audit['kernelBinding'] = 'new raw-input witness checker; original kernel/solve_exact never called'

        def forbidden(*_args, **_kwargs):
            counts['oldKernelCalls'] += 1
            raise ValueError('OLD_COLD_KERNEL_FORBIDDEN')

        def forbidden_qp(*_args, **_kwargs):
            counts['coldQpCalls'] += 1
            raise ValueError('OLD_COLD_QP_FORBIDDEN')

        def decode(*args, **kwargs):
            self.legacy['admissionCalls'] += 1
            started = time.process_time_ns()
            try:
                return original.F.decode(*args, **kwargs)
            finally:
                self.times['legacyAdmissionCpuNs'] += time.process_time_ns() - started

        def arithmetic():
            self.legacy['arithmeticInstances'] += 1
            return original.F.Arithmetic()

        def old_compact(*_):
            counts['forbiddenOldCompactAttempts'] += 1
            raise ValueError('OLD_DECIMAL_COMPACT_FORBIDDEN')

        fp = types.SimpleNamespace(**vars(original.F)); fp.decode = decode
        fp.Arithmetic = arithmetic; fp.solve_exact = forbidden_qp
        parent = types.SimpleNamespace(raw_bodies=original.PARENT.raw_bodies,
            eligible=original.PARENT.eligible, selection_difference=original.PARENT.selection_difference,
            strip_scalar=original.PARENT.strip_scalar, compact_pair=old_compact)
        namespace = dict(vars(original), F=fp, PARENT=parent, kernel=self.kernel,
            compact_pair_v2=self.compact, certificate_width=cb.certificate_width,
            certificate_ok=cb.certificate_ok, capture_legacy_model=self.capture_legacy_model)
        for name in ('world', 'evaluate', 'main'):
            namespace.pop(name, None)
        # Source compilation only; no original kernel object is used as a callable.
        exec(compile(text, original.__file__ + '[witness-world]', 'exec'), namespace)
        self.world = namespace['world_v2']
        self.begin = types.MethodType(observer_v2.PositionObserver.begin, self)
        self.compact_qualified = types.MethodType(observer_v2.PositionObserver.compact, self)

    def compact(self, *args):
        return self.compact_qualified(*args)

    def capture_legacy_model(self, model):
        if self.legacy_model is not None:
            raise ValueError('ONE_OUTER_MODEL_REQUIRED')
        self.legacy_model = model

    def check_model_equivalence(self, own):
        old = self.legacy_model
        if type(own) is not dict or set(own) != {'a', 'b', 'inverse', 'columns', 'd', 'm'}:
            raise ValueError('EXACT_NATIVE_MODEL_ENVELOPE_REQUIRED')
        if old is None or type(own['d']) is not int or type(own['m']) is not int or old['d'] != own['d'] or old['m'] != own['m']:
            raise ValueError('INDEPENDENT_PROBLEM_LAYOUT_MISMATCH')
        if type(own['columns']) is not dict or any(type(k) is not str or type(v) is not int for k, v in own['columns'].items()) or old['columns'] != own['columns']:
            raise ValueError('INDEPENDENT_PROBLEM_COLUMN_MISMATCH')
        # Canonical text equality only; no Python reconstruction or native-model normalization.
        for a, b in ((old['a'], own['a']), ([old['b']], [own['b']]), ([old['inverse']], [own['inverse']])):
            if type(b) is not list or len(a) != len(b):
                raise ValueError('INDEPENDENT_PROBLEM_ROW_LAYOUT')
            for old_row, new_row in zip(a, b):
                if type(new_row) is not list or len(old_row) != len(new_row):
                    raise ValueError('INDEPENDENT_PROBLEM_ROW_LAYOUT')
                for fraction, text in zip(old_row, new_row):
                    self.legacy['problemEquivalenceIntegerComparisons'] += 2
                    if type(text) is not str or text != str(fraction.numerator) + '/' + str(fraction.denominator):
                        raise ValueError('INDEPENDENT_PROBLEM_COEFFICIENT_MISMATCH')

    def kernel(self, request):
        if request.get('op') != 'kernel' or request.get('scope') != 'full-pair' or self.last_kernel is not None:
            raise ValueError('ONE_FULL_PAIR_WITNESS_KERNEL_REQUIRED')
        observation = self.io.wrapper_graph((self.control_roots, self.request, self.states, self.legacy_model, self.meter, self.legacy, self.times),
            (self.k.Box, self.k.Basis, self.k.Meter))
        self.outer_bytes = observation['ownedBytes']
        self.counts['proofCalls'] += 1
        started = time.process_time_ns()
        response = self.bridge.request(request['problem'], request['result'])
        result = response['reply']
        self.last_model_exact = response['modelExact']
        self.times['parentBridgeCpuNs'] += time.process_time_ns() - started
        self.last_kernel = result
        if self.last_model_exact is not None:
            self.check_model_equivalence(self.last_model_exact)
        elif result['resolved']:
            raise ValueError('RESOLVED_NATIVE_PROOF_REQUIRES_PRICED_MODEL')
        if not result['resolved']:
            return dict(ok=False, resolved=False, executionFailure=True,
                referenceStatus='REFERENCE_WITNESS_REJECTED', metrics=None,
                reference=dict(proofCounters=result['proofCounters'], reason=result['reason']),
                violations=result['violations'])
        certificate = result['certificate']
        reference = {key:certificate[key] for key in ('translations', 'lambdaKgM', 'primalMarginsM',
            'objectiveKgM2', 'certificateExact', 'basisRows', 'basisRank', 'dynamicDof',
            'translationsExact', 'lambdaExactKgM', 'primalMarginsExactM', 'objectiveExactKgM2')}
        reference.update(referenceStatus='SOLVED', infeasibilityCertificate=None,
            uniqueActiveSetClaimed=False, arithmetic=ARITHMETIC,
            numericRepresentation='null denotes finite exact rational outside Float64; exact fields remain authoritative',
            proofCounters=result['proofCounters'], proofAuthority=AUTHORITY,
            witnessProvenance=dict(source='request.result.basisRows', trusted=False,
                usedAsSearchSeed=False, basisRows=list(request['result']['basisRows'])))
        return dict(ok=result['ok'], resolved=True, executionFailure=False, referenceStatus='SOLVED',
            metrics=result['metrics'], reference=reference, violations=result['violations'])

    def evaluate(self, request):
        self.request, self.legacy_model, self.last_kernel, self.last_model_exact = request, None, None, None
        self.outer_bytes = 0
        self.legacy = dict(admissionCalls=0, arithmeticInstances=0, problemEquivalenceIntegerComparisons=0)
        self.begin(request)
        # Qualified begin resets timing. Keep qualified compact slot; add named disjoint proof/legacy roots.
        self.times['parentBridgeCpuNs'] = self.times['legacyAdmissionCpuNs'] = 0
        reply = self.world(request)
        return dict(referenceProtocol=PROTOCOL, **reply)


def main(argv):
    if len(argv) != 3 or argv[0] != 'world-bank':
        raise ValueError('wrapper.py world-bank MANIFEST OUTPUTDIR')
    started_wall, started_cpu = time.monotonic_ns(), time.process_time_ns()
    deadline = time.monotonic() + 170
    manifest_path, out = Path(argv[1]).resolve(), Path(argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=False)
    counts = dict(framesAttempted=0, framesReturned=0, framesVerifiedByExternalAuditor=0,
        proofCalls=0, compactAttempts=0, compactReturns=0, scalarCalls=0, scalarReturns=0,
        coldQpCalls=0, oldKernelCalls=0, WorldCalls=0, forbiddenOldCompactAttempts=0)
    summary = dict(status='NOT_COMPLETED', firstFailure=None, counts=counts, frames=[],
        coreCpuNs=0, costDecision='DEFERRED_EXTERNAL_NUMERIC_AUDIT')
    written = 0
    context = bridge = io = None
    request_doc = None

    def put(name, value, terminal=False):
        nonlocal written
        allowance = MAX_EVIDENCE if terminal else MAX_EVIDENCE - 65536
        path = out / name
        encoder = json.JSONEncoder(separators=(',', ':'), allow_nan=False)
        length = 0
        with path.open('xb') as stream:
            for part in encoder.iterencode(value):
                data = part.encode()
                if length + len(data) + 1 > MAX_REPLY or written + length + len(data) + 1 > allowance:
                    raise ValueError('OUTPUT_RESOURCE_LIMIT')
                stream.write(data); length += len(data)
            stream.write(b'\n'); length += 1
        written += length
        return path.name, pin(path)

    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('INTERNAL_170S_GUARD')))
    signal.alarm(170)
    try:
        if manifest_path.stat().st_size > MAX_REPLY:
            raise ValueError('MANIFEST_LIMIT')
        manifest = bootstrap(manifest_path)
        pins = manifest['dependencyPins']
        if type(pins) is not dict:
            raise ValueError('SOURCE_PINS_REQUIRED')
        for name, expected in pins.items():
            authenticated(ROOT / name, expected)
        for source_path in PRODUCTION_PATHS:
            relative = str(source_path.relative_to(ROOT))
            if relative not in pins:
                raise ValueError('OWN_SOURCE_PIN_REQUIRED:' + relative)
        summary['guardPolicy'] = dict(path=str((CORE / 'GUARD-POLICY.md').relative_to(ROOT)), pin=pin(CORE / 'GUARD-POLICY.md'), scope='GCD_REM_PLUS_BOUNDED_INTEGER_CODEC_AND_F64_WORD_CONSTANT_FASTPATHS_ONLY', allOldGuardChecksUnchanged=False, pricesAndCapsUnchanged=True)
        authority = manifest['authority']
        if authority != DEFAULT_AUTHORITY:
            raise ValueError('EXACT_FROZEN_AUTHORITY_PATHS_REQUIRED')
        for name in authority.values():
            if name not in pins:
                raise ValueError('AUTHORITY_PIN_REQUIRED')
        dependencies = bootstrap(ROOT / authority['positionDependencies'])
        compact_dependencies = bootstrap(ROOT / authority['compactDependencies'])
        for group in (dependencies['pins'], compact_dependencies['pins']):
            for name, expected in group.items():
                if pins.get(name) != expected:
                    raise ValueError('COMPLETE_TRANSITIVE_SOURCE_PIN_REQUIRED:' + name)
        node = manifest['nodeExecutable']
        if pin(node) != manifest['nodeExecutablePin']:
            raise ValueError('EXACT_PINNED_NODE22_REQUIRED')
        io = Transport(ledger_limit=20 * 1024 * 1024)
        io.control(manifest, dependencies, compact_dependencies, summary)
        bridge = NativeWorker(node, str(CORE / 'smallworker.mjs'), ROOT, deadline)
        loader = module(ROOT / 'examples/physics-p4-compact-v2-2276/loaders.py', 'p4_witness_loaders')
        h = module(ROOT / 'examples/physics-p4-sat-2276/run.py', 'p4_witness_helpers')
        oldk = module(ROOT / 'examples/physics-p4-sat-2276/integer_sat.py', 'p4_witness_sat')
        geometry = module(GEOMETRY / 'geometry.py', 'p4_frozen_gram_geometry_facade')
        k = geometry.make_namespace(oldk)
        changed = [key for key, value in vars(oldk).items() if getattr(k, key) is not value]
        if changed != ['solve_model']:
            raise ValueError('ONLY_SOLVE_MODEL_NAMESPACE_OVERRIDE')
        summary['geometryAlgorithm'] = 'PAIR_LOCAL_GRAM_MIXED_DETERMINANTS'
        summary['namespaceOverrides'] = changed
        cb = module(COMPACT / 'backend.py', 'p4_direct_grid_compact')
        observer_v2 = module(ROOT / 'examples/physics-p4-position-v2-2276/observer.py', 'p4_witness_old_world_transfer')
        original = module(ROOT / dependencies['fullPositionPath'], 'p4_witness_legacy_outer_definitions')
        scalar, scalar_audit = loader.scalar_closure(ROOT, compact_dependencies)
        context = WitnessObserver(original, observer_v2, (ROOT / dependencies['fullPositionPath']).read_text(),
            dependencies['spans'], h, k, cb, scalar, k.Meter(), counts, bridge, deadline, io)
        context.control_roots = (manifest, dependencies, compact_dependencies, summary, context.transfer_audit, scalar_audit)
        io.control(*context.control_roots)
        summary['setupCpuNs'] = time.process_time_ns() - started_cpu
        put('function-transfer.json', context.transfer_audit)
        put('scalar-source-audit.json', scalar_audit)
        bank = (manifest_path.parent / manifest['bankDirectory']).resolve()
        if not bank.is_relative_to(ROOT) or len(manifest['cases']) != 6:
            raise ValueError('FROZEN_SIX_FRAME_BANK_REQUIRED')
        expected_order = [('ALIGNED', 1), ('ALIGNED', 16), ('OFFSET', 1), ('OFFSET', 16), ('YAW', 1), ('YAW', 16)]
        for case, (scene, step) in zip(manifest['cases'], expected_order):
            counts['framesAttempted'] += 1
            case_id = case['id']
            if type(case_id) is not str or len(case_id) > 64 or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._' for c in case_id):
                raise ValueError('CASE_ID_REQUIRED')
            request_path = (bank / case['request']).resolve()
            if not request_path.is_relative_to(bank):
                raise ValueError('REQUEST_PATH_SCOPE')
            authenticated(request_path, case['requestPin'])
            request_doc = io.open(request_path, case['requestPin'])
            request = request_doc.value
            if request.get('op') != 'world' or (request.get('scene'), request.get('stepIndex')) != (scene, step):
                raise ValueError('ORIGINAL_WORLD_FRAME_ORDER')
            begin = time.process_time_ns()
            reply = context.evaluate(request)
            core_cpu = time.process_time_ns() - begin
            counts['framesReturned'] += 1
            if context.last_kernel is None or context.request_calls != 72:
                raise ValueError('COMPLETE_FRAME_PROOF_AND_72_PAIRS_REQUIRED')
            observed = io.wrapper_graph((manifest, dependencies, compact_dependencies, summary, context.transfer_audit,
                scalar_audit, request, context.states, context.legacy_model, context.meter, context.legacy, context.times, context.last_kernel, context.last_model_exact, reply),
                (k.Box, k.Basis, k.Meter))
            outer_post = observed['ownedBytes']
            model_file, model_pin = put(case_id + '-model-exact.json', context.last_model_exact)
            kernel_file, kernel_pin = put(case_id + '-kernel.json', context.last_kernel)
            full_file, full_pin = put(case_id + '-reply.json', reply)
            summary['frames'].append(dict(caseId=case_id, scene=scene, step=step,
                fullReplyFile=full_file, kernelReplyFile=kernel_file,
                fullReplyPin=full_pin, kernelReplyPin=kernel_pin, modelExactFile=model_file, modelExactPin=model_pin, coreCpuNs=core_cpu,
                compactCpuNs=context.times['compactCpuNs'], parentBridgeCpuNs=context.times['parentBridgeCpuNs'],
                legacyAdmissionCpuNs=context.times['legacyAdmissionCpuNs'], legacyOuterCalls=dict(context.legacy),
                parentOwnedBeforeBridgeBytes=context.outer_bytes, parentOwnedPostReplyBytes=outer_post,
                residualWorldCpuNs=core_cpu-context.times['compactCpuNs']-context.times['parentBridgeCpuNs']))
            summary['coreCpuNs'] += core_cpu
            if not reply.get('ok') or not reply.get('resolved') or not context.last_kernel['ok']:
                raise ValueError('FIRST_WITNESS_WORLD_NO_GO:' + str(context.last_kernel['reason']))
            context.states = {}; context.last_kernel = context.last_model_exact = context.legacy_model = None
            context.request = None
            del request, reply
            io.close(request_doc); request_doc = None
        if (counts['framesReturned'], counts['proofCalls'], counts['compactAttempts'], counts['compactReturns'],
            counts['scalarCalls'], counts['scalarReturns'], counts['coldQpCalls'], counts['oldKernelCalls'], counts['WorldCalls']) != (6,6,432,432,432,432,0,0,0):
            raise ValueError('COMPLETE_BOUND_CENSUS_REQUIRED')
        summary['satCounters'] = context.meter.stats()
        if context.meter.models != 864 or context.meter.axes != 12960:
            raise ValueError('ALL_15_AXES_BOTH_CONVENTIONS_REQUIRED')
        worker_stats = bridge.stats()
        if worker_stats['workerStarts'] != 1 or worker_stats['requestCalls'] != 6 or not worker_stats['workerClosed'] or worker_stats['exit'] != 0 or worker_stats['cleanupError'] is not None:
            raise ValueError('ONE_GENUINE_CLOSED_SIX_CALL_NATIVE_WORKER_REQUIRED')
        summary['worker'] = worker_stats
        summary['parentCoreCpuNs'] = summary['coreCpuNs']
        summary['conservativeEnvelopeCpuNs'] = summary['parentCoreCpuNs'] + worker_stats['childLifetimeCpuNs']
        summary['costBoundary'] = 'PARENT_SIX_CONTEXT_CPU_PLUS_NODE_ENTIRE_LIFETIME_RESOURCE_CPU_NOT_IDENTICAL_BASELINE_BOUNDARY'
        for name, expected in pins.items():
            authenticated(ROOT / name, expected)
        if pin(node) != manifest['nodeExecutablePin']:
            raise ValueError('FINAL_NODE_TOOL_DRIFT')
        summary['finalAuthentication'] = 'ALL_WRAPPER_DEPENDENCIES_AND_NODE_EQUAL'
        summary['ownedTransport'] = io.receipt()
        summary['memoryBoundary'] = 'OUTER_CONTROL_2M_PLUS_WRAPPER_DATA14M_AND_SCRATCH8M_EQUALS_PARENT24M_NOT_RSS'
        summary['status'] = 'RETURNED_SIX_WORLD_WITNESS_REPLIES_PENDING_AUDIT'
    except Exception as error:
        summary['status'] = 'NO_GO_WORLD_WITNESS_BANK'
        summary['firstFailure'] = dict(type=type(error).__name__, message=str(error), counts=dict(counts))
        if context is not None and context.last_kernel is not None:
            try:
                put('first-failure-actual-kernel.json', context.last_kernel)
            except Exception as capture_error:
                summary['firstFailure']['captureError'] = str(capture_error)
    finally:
        if bridge is not None:
            try:
                if not bridge.closed:
                    bridge.close(force=True)
            except Exception as cleanup_error:
                if summary['firstFailure'] is None:
                    summary['status'] = 'NO_GO_WORLD_WITNESS_BANK'
                    summary['firstFailure'] = dict(type=type(cleanup_error).__name__, message=str(cleanup_error))
                else:
                    summary['firstFailure']['workerCleanupError'] = str(cleanup_error)
            summary['worker'] = bridge.stats()
            if summary['firstFailure'] is not None:
                prefix = bridge.last_line or bytes(bridge.output)
                if written + len(prefix) <= MAX_EVIDENCE - 65536:
                    with (out / 'worker-last-rpc-prefix.raw').open('xb') as stream:
                        stream.write(prefix)
                    written += len(prefix)
            stderr = bytes(bridge.stderr)
            if written + len(stderr) > MAX_EVIDENCE - 65536:
                summary['status'] = 'NO_GO_WORLD_WITNESS_BANK'
                summary['firstFailure'] = summary['firstFailure'] or dict(type='EvidenceLimit', message='WORKER_STDERR_EVIDENCE_LIMIT')
            else:
                with (out / 'worker-stderr.raw').open('xb') as stream:
                    stream.write(stderr)
                written += len(stderr)
        signal.alarm(0)
        summary.update(totalCpuNs=time.process_time_ns()-started_cpu,
            wallNs=time.monotonic_ns()-started_wall, evidenceBytesBeforeSummary=written,
            legacyOuterArithmetic='separate guarded calls/CPU, never inside new proof counter or used as proof inputs',
            independentAudit='NOT_RUN_BY_WRAPPER', WorldCalls=0)
        put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'],
        summaryFile=str(out/'summary.json'), summaryPin=pin(out/'summary.json'))))
    return 0 if summary['firstFailure'] is None else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
