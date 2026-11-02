"""Audited cold-position definitions with one explicit compact V2 protocol."""
import ast
from fractions import Fraction
import hashlib
import json
import time
import types

PROTOCOL = 'p4-full-position-observer-v2'


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def transfer(source, pins):
    nodes = {node.name: node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)}
    segments = {}
    for name in ('world', 'kernel'):
        segment = ast.get_source_segment(source, nodes[name])
        if len(segment.encode()) != pins[name]['bytes'] or digest(segment) != pins[name]['sha256']:
            raise ValueError('ORIGINAL_FUNCTION_SPAN_DRIFT:' + name)
        segments[name] = segment
    old = segments['world']
    changes = []
    current = old

    def replace(before, after, count):
        nonlocal current
        found = current.count(before)
        if found != count:
            raise ValueError('TEXT_TRANSFER_COUNT:' + before)
        current = current.replace(before, after)
        changes.append(dict(before=before, after=after, occurrences=count))

    replace('def world(request):', 'def world_v2(request):', 1)
    replace('PARENT.compact_pair(', 'compact_pair_v2(', 2)
    replace('precisionMaxDifferenceM=max([0.0]+[F.finite(x["precisionMaxDifferenceM"]) for x in records])',
            'maxCertifiedSatWidthM=max([0.0]+[certificate_width(x) for x in records])', 1)
    replace('metrics["precisionMaxDifferenceM"] = max(metrics["precisionMaxDifferenceM"],max([0.0]+[F.finite(x["precisionMaxDifferenceM"]) for x in hyp_records]))',
            'metrics["maxCertifiedSatWidthM"] = max(metrics["maxCertifiedSatWidthM"],max([0.0]+[certificate_width(x) for x in hyp_records]))', 1)
    gate = 'F.finite(record["precisionMaxDifferenceM"]) > 1e-25'
    if current.count(gate) != 2:
        raise ValueError('TWO_ORIGINAL_PRECISION_GATES_REQUIRED')
    for stage in ('PRE', 'HYP'):
        replacement = 'not certificate_ok(record,"' + stage + '")'
        current = current.replace(gate, replacement, 1)
        changes.append(dict(before=gate, after=replacement, occurrences=1, order=stage))
    if 'precisionMaxDifferenceM' in current or 'PARENT.compact_pair' in current:
        raise ValueError('LEGACY_GEOMETRY_REFERENCE_REMAINS')
    return current, dict(originalWorldSource=old, transformedWorldSource=current,
        originalWorldSha256=digest(old), transformedWorldSha256=digest(current),
        unchangedKernelSha256=digest(segments['kernel']), substitutions=changes,
        oldPhysicalGateExpressionsRetained=True, originalFilesEdited=False)


def certificate_width(record):
    intervals = record['satCertificateV2']['numericIntervals'].values()
    return float(max(Fraction(int(i['high']) - int(i['low']), 1 << i['precision']) for i in intervals))


def certificate_ok(record, stage):
    cert = record['satCertificateV2']
    if cert['protocol'] != 'p4-compact-observer-v2' or cert['oldDecimalRuns'] != 0:
        return False
    if cert['omittedLegacyField'] != 'precisionMaxDifferenceM' or cert['exactWinnerUsedForScalarSelection'] is not False:
        return False
    for convention in ('raw', 'normalized'):
        axes = cert[convention]['axes']
        if len(axes) != 15 or [a['axis'] for a in axes] != list(range(15)):
            return False
    names = {'rawNormalizedDepthDifferenceM', 'rawNormalizedMarginDifferenceM'}
    if stage == 'HYP':
        names |= {'rawDepthM', 'normalizedDepthM'}
    if set(cert['physicalGates']) != names or any(value != 'PASS' for value in cert['physicalGates'].values()):
        return False
    for interval in cert['numericIntervals'].values():
        low, high = Fraction(int(interval['low']), 1 << interval['precision']), Fraction(int(interval['high']), 1 << interval['precision'])
        if low > high or high - low > Fraction(1, 10**25):
            return False
    return True


class PositionObserver:
    def __init__(self, original, source, spans, h, k, compact_backend, scalar, meter, counts):
        self.original, self.h, self.k, self.compact_backend = original, h, k, compact_backend
        self.scalar, self.meter, self.counts = scalar, meter, counts
        self.request_calls = 0
        self.states = {}
        self.times = dict(compactCpuNs=0, coldQpCpuNs=0, kernelIncludingQpCpuNs=0)
        text, self.transfer_audit = transfer(source, spans)

        def solve_exact(problem):
            counts['coldQpAttempts'] += 1
            started = time.process_time_ns()
            try:
                result = original.F.solve_exact(problem)
                counts['coldQpReturns'] += 1
                return result
            finally:
                self.times['coldQpCpuNs'] += time.process_time_ns() - started

        # A new globals binding, never a mutation of an old module/function.
        fp = types.SimpleNamespace(**vars(original.F))
        fp.solve_exact = solve_exact
        kernel_globals = dict(vars(original), F=fp)
        exact_kernel = types.FunctionType(original.kernel.__code__, kernel_globals,
                                          original.kernel.__name__, original.kernel.__defaults__, original.kernel.__closure__)

        def kernel(request):
            if request.get('scope') != 'full-pair':
                raise ValueError('ONLY_FROZEN_FULL_PAIR_SCOPE')
            counts['coldKernelAttempts'] += 1
            started = time.process_time_ns()
            try:
                result = exact_kernel(request)
                counts['coldKernelReturns'] += 1
                return result
            finally:
                self.times['kernelIncludingQpCpuNs'] += time.process_time_ns() - started

        def forbidden(*_):
            counts['forbiddenOldCompactAttempts'] += 1
            raise ValueError('OLD_DECIMAL_COMPACT_FORBIDDEN')

        parent = types.SimpleNamespace(raw_bodies=original.PARENT.raw_bodies,
            eligible=original.PARENT.eligible, selection_difference=original.PARENT.selection_difference,
            strip_scalar=original.PARENT.strip_scalar, compact_pair=forbidden)
        namespace = dict(vars(original), PARENT=parent, kernel=kernel,
                         compact_pair_v2=self.compact, certificate_width=certificate_width,
                         certificate_ok=certificate_ok)
        for name in ('world', 'evaluate', 'main'):
            namespace.pop(name, None)
        exec(compile(text, original.__file__ + '[world-v2]', 'exec'), namespace)
        self.world = namespace['world_v2']
        self.transfer_audit.update(kernelCodeObjectIdentical=exact_kernel.__code__ is original.kernel.__code__,
                                   originalModuleMutated=False, oldCompactFallback=False)

    def begin(self, request):
        if request['hypBodies'] is None or request['hypRawHex'] is None:
            raise ValueError('FROZEN_COMPLETE_PRE_HYP_CORPUS_REQUIRED')
        self.request_calls = 0
        self.states = {}
        self.times = dict(compactCpuNs=0, coldQpCpuNs=0, kernelIncludingQpCpuNs=0)
        for stage, key, raw in (('PRE', 'preBodies', 'preRawHex'), ('HYP', 'hypBodies', 'hypRawHex')):
            bodies = self.h.restore(request[key], request[raw])
            if len(bodies) != 9 or len({b['id'] for b in bodies}) != 9:
                raise ValueError('ORIGINAL_NINE_BODY_LAYOUT')
            prepared = {b['id']: self.k.prepare(b, self.meter) for b in bodies}
            identity = {b['id']: json.dumps(b, sort_keys=True, separators=(',', ':'), allow_nan=False) for b in bodies}
            order = [key for key, _, _ in self.original.PARENT.eligible(bodies)]
            if len(order) != 36:
                raise ValueError('ALL_36_PAIRS_REQUIRED')
            self.states[stage] = dict(prepared=prepared, identity=identity, order=order)

    def compact(self, a, b, pair_key):
        self.counts['compactAttempts'] += 1
        ordinal = self.request_calls
        self.request_calls += 1
        if ordinal >= 72:
            raise ValueError('MAXIMUM_72_COMPACT_CALLS_PER_FRAME')
        stage = 'PRE' if ordinal < 36 else 'HYP'
        state = self.states[stage]
        if pair_key != state['order'][ordinal % 36]:
            raise ValueError('EXACT_ORIGINAL_PAIR_ORDER')
        for body in (a, b):
            if json.dumps(body, sort_keys=True, separators=(',', ':'), allow_nan=False) != state['identity'][body['id']]:
                raise ValueError('PREPARED_BODY_INPUT_BITS_DRIFT')
        captured = []

        def scalar(x, y):
            self.counts['scalarCalls'] += 1
            result = self.scalar(x, y)
            self.counts['scalarReturns'] += 1
            captured.append(result)
            return result

        started = time.process_time_ns()
        try:
            record = self.compact_backend.compact(state['prepared'][a['id']], state['prepared'][b['id']],
                                                  a, b, stage, scalar, self.k, self.meter)
            if len(captured) != 1:
                raise ValueError('EXACTLY_ONE_SCALAR_RETURN_REQUIRED')
            record['scalar'] = captured[0]
            self.counts['compactReturns'] += 1
            return record
        finally:
            self.times['compactCpuNs'] += time.process_time_ns() - started

    def evaluate(self, request):
        self.begin(request)
        reply = self.world(request)
        return dict(referenceProtocol=PROTOCOL, **reply)
