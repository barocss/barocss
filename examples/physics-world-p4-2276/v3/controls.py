#!/usr/bin/env python3
"""Frozen paired original SAT controls. This module also exposes DATA-only auth."""
import argparse
import copy
from decimal import Decimal, Context, getcontext, setcontext
import hashlib
import importlib.util
from pathlib import Path
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
OLD_GATE_SHA = '3ef692f14da3e035e14bab90733fd771728dac704dba80dff0b09f43813cd647'
RECIPE_SHA = 'bcbcd482cb350fb8171f2067f9ed0cd260c01f3ae43c5100d943c2f2c6602c8f'
CONTRACT_SHA = '611d9da9911eebc3df290c2dbdcc22489fd70c9c1f3e6efddf337de7f6d91b41'
FREEZE_SHA = 'e856c539d7f2594ca32bde5a82efbf5a5599bcf36138a1a1b519bb5acd56c5db'
SAT_PATH = 'examples/physics-rigid-feature-penetration-diagnostic/geometry-reference.py'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


if sha((HERE.parent / 'support-radius-gate.py').read_bytes()) != OLD_GATE_SHA:
    raise RuntimeError('unchanged v1 DATA/auth helper changed')
G = load(HERE.parent / 'support-radius-gate.py', 'unchanged_v1_gate_data_for_v2')
C = G.C


def source_pin(path):
    data = C.read_bound(path, 2 * C.MIB)
    return {'path': str(path.resolve().relative_to(ROOT)), 'bytes': len(data), 'sha256': sha(data)}


def source_pins():
    return {name: source_pin(path) for name, path in {
        'cacheModule': HERE / 'accounting-cache.py', 'controlsModule': HERE / 'controls.py',
        'gateModule': HERE / 'gate.py', 'recipes': HERE / 'CONTROL-RECIPES.json',
        'contract': HERE / 'SCOPE-CONTRACT.md', 'implementationFreeze': HERE / 'implementation-freeze-01.json',
        'originalHelper': ROOT / SAT_PATH, 'frozenV2Core': HERE.parent / 'v2/scoped-cache.py'}.items()}


def check_pins(pins):
    for value in pins.values():
        G.checked(C.safe_path(value['path']), value['bytes'], value['sha256'])


def authenticate():
    recipe = C.strict_json(G.checked(HERE / 'CONTROL-RECIPES.json', 44263, RECIPE_SHA))
    G.checked(HERE / 'SCOPE-CONTRACT.md', 10749, CONTRACT_SHA)
    freeze = C.strict_json(G.checked(HERE / 'implementation-freeze-01.json', 1015, FREEZE_SHA))
    C.need(freeze['status'] == 'parent_scope_frozen_before_implementation' and
           freeze['bookkeepingUpperBoundBytes'] == 262144 and freeze['totalCacheCeilingBytes'] == 67108864 and
           freeze['maxPairedSAT'] == 24 and freeze['maxOriginalHelperAttempts'] == 720 and
           freeze['studyBefore'] == 38 and freeze['studyMaximum'] == 44, 'v3 parent accounting/population freeze differs')
    for value in recipe['authority']['immutableInputs']:
        G.checked(C.safe_path(value['path']), value['bytes'], value['sha256'])
    authority, cases = G.inputs()
    old = C.strict_json((HERE.parent / 'evidence/support-radius-02/summary.json').read_bytes())
    C.need(old['numericStatus'] == 'NUMERIC_EQ_PASS' and old['costStatus'] == 'COST_NO_GO' and
           old['pairedCpu']['uncachedTotalNs'] == 885643000 and old['counts']['currentRawMatched'] == 6,
           'v1 result or original uncached cost authority changed')
    v2 = C.strict_json((HERE.parent / 'v2/evidence/gate-01/summary.json').read_bytes())
    C.need(v2['numericStatus'] == 'NUMERIC_EQ_PASS' and v2['costStatus'] == 'COST_NO_GO' and
           v2['pairedCpu']['candidateTotalNs'] == 1233559000 and v2['studyActualFullEvaluations'] == 38,
           'qualified v2 numerical/cost authority changed')
    return recipe, authority, cases


def snapshot(value):
    if type(value) is Decimal:
        p = value.as_tuple()
        return {'$Decimal': [p.sign, list(p.digits), p.exponent]}
    if type(value) is tuple:
        return {'$tuple': [snapshot(x) for x in value]}
    if type(value) is list:
        return [snapshot(x) for x in value]
    if type(value) is dict:
        if any(type(key) is not str for key in value):
            return {'$dict': [[snapshot(key), snapshot(item)] for key, item in value.items()]}
        return {key: snapshot(item) for key, item in value.items()}
    return value


def context_snapshot(context, signals):
    return {'settings': [context.prec, context.rounding, context.Emin, context.Emax,
                         context.capitals, context.clamp],
            'traps': [bool(context.traps[s]) for s in signals],
            'flags': [bool(context.flags[s]) for s in signals]}


def make_context(template, signals):
    context = Context(**{name: template[name] for name in ('prec', 'rounding', 'Emin', 'Emax', 'capitals', 'clamp')},
                      traps=[], flags=[])
    for index, signal_type in enumerate(signals):
        context.traps[signal_type] = template['traps'][index]
        context.flags[signal_type] = template['incomingFlags'][index]
    return context


def fixture(recipe):
    result = {}
    for label in ('a', 'b'):
        body = recipe[label]
        result[label] = {name: (tuple(Decimal(x) for x in value) if type(value) is list
                               else value if name == 'id' else Decimal(value))
                         for name, value in body.items()}
    return result


def retained_snapshot(cache):
    return snapshot({key.hex(): (entry[0], entry[1]) for key, entry in cache._pairs.items()})


def validate_stats(stats, bounds):
    for key, value in stats.items():
        C.need(type(value) is int and value >= 0, 'invalid v3 integer statistic: ' + key)
    for stat, bound in (('sat_attempts', 'max_sat_calls'), ('support_calls', 'max_logical_support_calls'),
                        ('pair_entries', 'max_pair_entries'), ('stage_entries', 'max_stage_entries'),
                        ('encoded_key_bytes', 'max_encoded_bytes'), ('owned_bytes', 'max_owned_bytes'),
                        ('peak_owned_bytes', 'max_owned_bytes')):
        C.need(stats[stat] <= bounds[bound], 'v3 resource counter exceeded: ' + stat)
    C.need(stats['measuredAllocationSumBytes'] <= stats['ownedUpperBoundBytes'] <= bounds['max_owned_bytes'] and
           stats['fixedBookkeepingMeasuredBytes'] <= stats['bookkeepingUpperBoundBytes'] == 262144 and
           stats['owned_bytes'] == stats['ownedUpperBoundBytes'] and stats['peak_owned_bytes'] == stats['peakOwnedUpperBoundBytes'],
           'accounting measurement/upper-bound classification differs')
    C.need(stats['sat_attempts'] == stats['sat_returns'] + stats['sat_raises'] and
           stats['original_sat_attempts'] == stats['original_sat_returns'] + stats['original_sat_raises'] and
           stats['original_sat_attempts'] <= stats['sat_attempts'] and
           stats['support_calls'] == stats['hits'] + stats['original_attempts'] and
           stats['original_attempts'] == stats['original_returns'] + stats['original_raises'] and
           stats['pending_pair_entries'] == stats['pending_stage_entries'] == 0, 'v2 actual counter/scope ledger differs')


def run(run_id):
    C.need(re.fullmatch('[a-z0-9][a-z0-9-]{0,95}', run_id), 'invalid fresh v3 controls ID')
    out = HERE / 'evidence' / run_id; out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns(); charged = 0; current = None
    original_context = getcontext(); module = original_sat = original_support = cache = None
    totals = {'baselineSatAttempts': 0, 'candidateSatAttempts': 0, 'baselineOriginalSupportAttempts': 0,
              'candidateOriginalSupportAttempts': 0, 'candidateLogicalSupportCalls': 0, 'candidateHits': 0}
    summary = {'workId': 'physics-world-p4-accounting-cache-v3-2276', 'runId': run_id,
               'status': 'IN_PROGRESS', 'groupsCompleted': 0, 'counts': totals, 'groups': [], 'firstFailure': None,
               'fullReferenceCalls': 0, 'WorldCalls': 0, 'fixtureCalls': 0, 'trigCalls': 0, 'NodeProjectionCalls': 0}
    state = {'baselineLastException': None, 'candidateLastException': None,
             'baselineLastFlags': None, 'candidateLastFlags': None, 'livePendingAuditFailure': None, 'key': None}
    def put(name, data):
        nonlocal charged
        C.need(charged + len(data) <= 32 * C.MIB, 'v3 controls evidence ceiling')
        with (out / name).open('xb') as stream:
            stream.write(data)
        charged += len(data)
    def progress():
        (out / 'progress.json').write_bytes(C.encoded(summary))
    def deadline(_signum, _frame):
        raise C.CensusFailure('170s v3 controls deadline')
    def original_total():
        return totals['baselineOriginalSupportAttempts'] + totals['candidateOriginalSupportAttempts']
    def baseline_delegate(*args, **kwargs):
        C.need(original_total() < 720, '720 actual original support attempts exhausted')
        totals['baselineOriginalSupportAttempts'] += 1
        try:
            return original_support(*args, **kwargs)
        except BaseException as error:
            state['baselineLastException'] = error
            state['baselineLastFlags'] = context_snapshot(getcontext(), core.SIGNALS)
            raise
    def candidate_observer(event, value, _context):
        totals['candidateOriginalSupportAttempts'] += 1
        C.need(original_total() <= 720, '720 actual original support attempts exhausted')
        if event == 'raise':
            state['candidateLastException'] = value
            state['candidateLastFlags'] = context_snapshot(_context, core.SIGNALS)
            if cache is not None:
                try:
                    cache.audit()  # actual live pending state before original exception leaves scope
                except BaseException as error:
                    # Preserve the actual original exception object; fail the
                    # DATA audit separately after that object reaches caller.
                    state['livePendingAuditFailure'] = {'type': type(error).__name__, 'message': str(error)}
    def scope_observer(key):
        state['key'] = key
    previous = signal.signal(signal.SIGALRM, deadline); signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        recipe, authority, _unused = authenticate()
        pins = source_pins(); summary.update(sources=pins, authority=authority, bounds=recipe['defaultBounds'])
        progress()
        core = load(HERE / 'accounting-cache.py', 'frozen_v2_scoped_cache_controls')
        C.need(core.DEFAULT_BOUNDS == recipe['defaultBounds'], 'v2 core bounds differ from recipes')
        summary['sourceTransferProof'] = core.transfer_proof()
        summary['accountingMeaning'] = {'owned_bytes': 'conservative owned upper bound', 'peak_owned_bytes': 'peak conservative upper bound', 'measuredAllocationSumBytes': 'actual sizeof observations; shared immutable objects may count twice; not unique heap/RSS', 'bookkeepingUpperBoundBytes': 262144}
        module = load(ROOT / SAT_PATH, 'unchanged_sat_for_v2_controls')
        original_sat, original_support = module.sat_pair, module.support_radius
        summary['originalCallables'] = {name: {'functionId': id(function), 'codeId': id(function.__code__),
            'file': str(Path(function.__code__.co_filename).resolve()), 'firstLine': function.__code__.co_firstlineno}
            for name, function in (('sat_pair', original_sat), ('support_radius', original_support))}
        keys = {}; main = capacity = None
        for row in recipe['cases']:
            current = {'case': row['case'], 'name': row['name'], 'phase': 'before-baseline'}
            group = {'case': row['case'], 'name': row['name'], 'branches': {}, 'passed': False}
            summary['inFlight'] = group; progress()
            for branch in ('baseline', 'candidate'):
                current['phase'] = branch
                template = recipe['contextTemplates'][row['context']]
                context = make_context(template, core.SIGNALS); bodies = fixture(recipe['fixtures'][row['fixture']])
                initial_context = context_snapshot(context, core.SIGNALS); initial_body = snapshot(bodies)
                state[branch + 'LastException'] = None; state['key'] = None
                state[branch + 'LastFlags'] = None
                state['livePendingAuditFailure'] = None
                support_before = totals[branch + 'OriginalSupportAttempts']
                retained = None
                if branch == 'candidate':
                    if row['cacheAction'] == 'create':
                        if row['cache'] == 'capacity' and main is not None:
                            main.clear(); main = None
                        cache = core.SatScopedCache(module, recipe['cacheInstances'][row['cache']]['bounds'], candidate_observer, scope_observer, audit_mutations=True)
                        if row['cache'] == 'main': main = cache
                        else: capacity = cache
                    else:
                        cache = main if row['cache'] == 'main' else capacity
                    if row['cacheAction'] == 'clear-before':
                        C.need(cache.stats()['pair_entries'] > 0, 'reset control had no old entry')
                        cache.clear()
                        C.need(cache.stats()['pair_entries'] == cache.stats()['stage_entries'] == cache.stats()['sat_attempts'] == 0,
                               'clear did not reset retained state and counters')
                    group['ownershipBefore'] = cache.audit()
                    before_stats = cache.stats(); retained = retained_snapshot(cache)
                result = caught = None
                setcontext(context)
                totals[branch + 'SatAttempts'] += 1
                C.need(totals['baselineSatAttempts'] + totals['candidateSatAttempts'] <= 24, '24 SAT attempts exhausted')
                try:
                    if branch == 'baseline':
                        module.support_radius = baseline_delegate
                        result = original_sat(bodies['a'], bodies['b'], row['normalizeQuaternion'])
                    else:
                        cache.install()
                        result = module.sat_pair(bodies['a'], bodies['b'], row['normalizeQuaternion'])
                except BaseException as error:
                    caught = error
                finally:
                    if branch == 'candidate': cache.restore()
                    else: module.support_radius = original_support
                final_context = context_snapshot(context, core.SIGNALS)
                branch_record = {'outcome': 'raises' if caught is not None else 'returns',
                                 'originalSupportAttempts': totals[branch + 'OriginalSupportAttempts'] - support_before,
                                 'contextBefore': initial_context, 'contextAfter': final_context,
                                 'contextObjectUnchanged': getcontext() is context,
                                 'inputUnchanged': C.difference(initial_body, snapshot(bodies)) is None,
                                 'returned': snapshot(result), 'exception': None if caught is None else {
                                     'type': type(caught).__name__, 'module': type(caught).__module__, 'message': str(caught),
                                     'sameOriginalObject': caught is state[branch + 'LastException'],
                                     'sameOriginalFlags': C.difference(final_context, state[branch + 'LastFlags']) is None}}
                setcontext(original_context)
                group['branches'][branch] = branch_record
                branch_record['livePendingAuditFailure'] = state['livePendingAuditFailure']
                if branch == 'candidate':
                    branch_record['ownershipAfter'] = cache.audit()
                    after_stats = cache.stats(); validate_stats(after_stats, cache._bounds)
                    delta = {name: after_stats[name] - before_stats[name] for name in core.COUNTERS}
                    totals['candidateLogicalSupportCalls'] += delta['support_calls']; totals['candidateHits'] += delta['hits']
                    branch_record.update(cacheStats=after_stats, cacheDelta=delta,
                                         invariantKeyHex=None if state['key'] is None else state['key'].hex())
                    keys[row['case']] = state['key']
                    branch_record['retainedUnchanged'] = C.difference(retained, retained_snapshot(cache)) is None
                    group['actualLedger'] = {name: branch_record['originalSupportAttempts'] if name == 'candidateOriginalAttempts'
                                             else delta['support_calls'] if name == 'candidateLogicalCalls'
                                             else delta['hits'] if name == 'candidateHits'
                                             else group['branches']['baseline']['originalSupportAttempts']
                                             for name in row['predictedSupportLedger']}
                progress()
                C.need(state['livePendingAuditFailure'] is None, 'live pending allocation audit failed')
                C.need(branch_record['outcome'] == row['expectedSatOutcome'], 'SAT return/raise classification differs')
                C.need(branch_record['contextObjectUnchanged'] and branch_record['inputUnchanged'], 'Context object or caller input changed')
                C.need(initial_context['settings'] == final_context['settings'] and initial_context['traps'] == final_context['traps'],
                       'Context settings or traps changed')
                if caught is not None:
                    C.need(branch_record['exception']['type'] == 'Inexact' and branch_record['exception']['sameOriginalObject'] and
                           branch_record['exception']['sameOriginalFlags'],
                           'original trapped exception type/identity differs')
                    C.need(final_context['flags'][3:5] == [True, True], 'original trap flags differ')
            a, b = group['branches']['baseline'], group['branches']['candidate']
            C.need(C.difference(a['returned'], b['returned']) is None and C.difference(a['exception'], b['exception']) is None and
                   C.difference(a['contextAfter'], b['contextAfter']) is None, 'complete original/candidate SAT/flag comparison differs')
            C.need(C.difference(row['predictedSupportLedger'], group['actualLedger']) is None, 'predicted finite helper ledger differs')
            number = row['case']
            if number in (2, 8): C.need(keys[number] == keys[1], 'same invariant key differs')
            if number in (3, 4, 5, 6, 7): C.need(keys[number] != keys[1], 'distinct complete invariant key collapsed')
            if number == 2: C.need(C.difference(summary['groups'][0]['branches']['candidate']['returned'], b['returned']) is not None,
                                   'fresh center did not change original report')
            if number in (9, 11): C.need(b['retainedUnchanged'], 'failed/capacity call changed retained entries')
            if number == 9: C.need(b['cacheStats']['pair_entries'] == 1, 'failed SAT committed new pair')
            if number == 10: C.need(b['cacheStats']['pair_entries'] == 1 and b['cacheStats']['stage_entries'] == 28,
                                    'rotated traversal did not commit exactly one complete pair')
            if number == 11: C.need(b['cacheDelta']['pair_capacity_bypasses'] == 1 and b['cacheDelta']['capacity_bypasses'] == 24,
                                    'unstored capacity bypass differs')
            if number == 12:
                C.need(keys[12] == keys[10], 'retained pair key changed after capacity bypass')
                capacity.clear(); empty = capacity.stats()
                C.need(empty['pair_entries'] == empty['stage_entries'] == empty['encoded_key_bytes'] == empty['sat_attempts'] == 0,
                       'final request clear failed')
            detached = copy.deepcopy(b['returned'])
            retained_before_copy_mutation = retained_snapshot(cache)
            if type(detached) is dict: detached['$test_only_mutation'] = True
            C.need(C.difference(retained_before_copy_mutation, retained_snapshot(cache)) is None, 'detached report mutation leaked')
            C.need(all(type(value[0]) is Decimal and type(value[1]) is tuple and len(value[1]) == 9 and
                       all(type(flag) is bool for flag in value[1])
                       for entry in cache._pairs.values() for value in entry[1].values()), 'cache retained mutable report/input data')
            group['passed'] = True; summary['groups'].append(group); summary['groupsCompleted'] += 1
            put(str(number).zfill(2) + '.json', C.encoded(group)); summary.pop('inFlight', None); progress()
        C.need(totals == {'baselineSatAttempts': 12, 'candidateSatAttempts': 12, 'baselineOriginalSupportAttempts': 273,
                          'candidateOriginalSupportAttempts': 221, 'candidateLogicalSupportCalls': 273, 'candidateHits': 52},
               'full paired actual control population differs')
        summary['totalSatAttempts'] = 24; summary['totalOriginalSupportAttempts'] = original_total()
        C.need(module.sat_pair is original_sat and module.support_radius is original_support, 'original module pointers not restored')
        check_pins(pins)
        for name, wanted in authority['providerPins'].items():
            C.need(sha(C.read_bound(C.safe_path(name), 2 * C.MIB)) == wanted, 'original provider changed')
        summary['status'] = 'PASS_ACCOUNTING_CACHE_CONTROLS'
    except BaseException as error:
        summary['status'] = 'FAIL'; summary['firstFailure'] = {'type': type(error).__name__, 'message': str(error),
                                                            'reached': copy.deepcopy(current), 'counts': dict(totals)}
    finally:
        if module is not None and original_sat is not None:
            module.sat_pair = original_sat; module.support_radius = original_support
        if cache is not None:
            cache.restore()
            try: cache.clear()
            except BaseException as error:
                summary['cleanupError'] = {'type': type(error).__name__, 'message': str(error)}
                summary['status'] = 'FAIL'
                if summary['firstFailure'] is None: summary['firstFailure'] = {'phase': 'cleanup', **summary['cleanupError']}
        setcontext(original_context)
        signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, previous)
        summary['elapsedWallNs'] = time.monotonic_ns() - started; summary['chargedArtifactBytes'] = charged
        summary['totalSatAttempts'] = totals['baselineSatAttempts'] + totals['candidateSatAttempts']
        summary['totalOriginalSupportAttempts'] = original_total()
        progress(); put('summary.json', C.encoded(summary))
    return 0 if summary['status'] == 'PASS_ACCOUNTING_CACHE_CONTROLS' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--run-id', required=True)
    args = parser.parse_args(); sys.exit(run(args.run_id))
