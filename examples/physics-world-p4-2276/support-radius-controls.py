#!/usr/bin/env python3
"""Execute only the parent-frozen12 primitive recipes. No full reference or World call."""
import argparse
from decimal import (Decimal, Context, getcontext, setcontext, Clamped,
                     InvalidOperation, DivisionByZero, Inexact, Rounded,
                     Subnormal, Overflow, Underflow, FloatOperation)
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import signal
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RECIPE_SHA = 'ad6ee93d263ea5cb5ffc0c96011f7808826b564fb589879e96c271de887ff0cb'
CONTRACT_SHA = 'd4f53304f6c1bb11c31c35c695c564970fb8b44c88b7ef6debf28b14f94f3812'
SIGNALS = (Clamped, InvalidOperation, DivisionByZero, Inexact, Rounded,
           Subnormal, Overflow, Underflow, FloatOperation)
COUNTERS = ('calls', 'eligible', 'hits', 'misses', 'type_bypasses',
            'context_bypasses', 'capacity_bypasses', 'original_attempts',
            'original_returns', 'original_raises', 'key_build_cpu_ns',
            'key_build_wall_ns')
MIB = 1024 * 1024


def need(value, message):
    if not value:
        raise AssertionError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    need(path.is_file() and path.stat().st_size <= MIB, 'bounded source/recipe input required')
    return path.read_bytes()


def metadata(path, data):
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': sha(data)}


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def context_data(context):
    return {'prec': context.prec, 'rounding': context.rounding,
            'Emin': context.Emin, 'Emax': context.Emax,
            'capitals': context.capitals, 'clamp': context.clamp,
            'signalOrder': [item.__name__ for item in SIGNALS],
            'traps': [bool(context.traps[item]) for item in SIGNALS],
            'flags': [bool(context.flags[item]) for item in SIGNALS]}


def make_context(recipe):
    need(recipe['signalOrder'] == [item.__name__ for item in SIGNALS], 'fixed Context signal order changed')
    context = Context(prec=recipe['prec'], rounding=recipe['rounding'],
                      Emin=recipe['Emin'], Emax=recipe['Emax'],
                      capitals=recipe['capitals'], clamp=recipe['clamp'])
    for index, item in enumerate(SIGNALS):
        context.traps[item] = recipe['traps'][index]
        context.flags[item] = recipe['incomingFlags'][index]
    return context


class ProbeDecimal(Decimal):
    pass


def make_arguments(recipe):
    marked = set(recipe['decimalSubclassPaths'])

    def value(text, path):
        return (ProbeDecimal if path in marked else Decimal)(text)

    extents = [value(text, '/extents/' + str(i)) for i, text in enumerate(recipe['extents'])]
    if recipe['extentsContainer'] == 'tuple':
        extents = tuple(extents)
    else:
        need(recipe['extentsContainer'] == 'list', 'unknown literal fixture container')
    bases = tuple(tuple(value(text, '/bases/' + str(i) + '/' + str(j))
                        for j, text in enumerate(row)) for i, row in enumerate(recipe['bases']))
    direction = tuple(value(text, '/direction/' + str(i)) for i, text in enumerate(recipe['direction']))
    return extents, bases, direction


def decimal_data(value):
    need(isinstance(value, Decimal), 'original result must be Decimal in frozen recipes')
    parts = value.as_tuple()
    return {'type': type(value).__module__ + '.' + type(value).__qualname__,
            'sign': parts.sign, 'digits': list(parts.digits), 'exponent': parts.exponent}


def argument_data(value):
    if isinstance(value, Decimal):
        return {'identity': id(value), **decimal_data(value)}
    need(type(value) in (tuple, list), 'unexpected fixture snapshot object')
    return {'type': type(value).__name__, 'identity': id(value),
            'items': [argument_data(item) for item in value]}


def outcome(value=None, error=None):
    return {'kind': 'raise' if error is not None else 'return',
            'exception': None if error is None else {'type': type(error).__module__ + '.' + type(error).__qualname__, 'message': str(error)},
            'result': None if error is not None else decimal_data(value),
            'postContext': context_data(getcontext())}


def unchanged_settings(before, after):
    left, right = dict(before), dict(after)
    left.pop('flags'); right.pop('flags')
    need(left == right, 'Context settings/traps changed')


def invocation_args(arguments, style):
    if style == 'positional':
        return arguments, {}
    need(style == 'all-three-named-kwargs', 'unfrozen call style')
    return (), dict(zip(('extents', 'bases', 'direction'), arguments))


def run(run_id):
    need(run_id and len(run_id) <= 96 and run_id[0].isalnum()
         and all(char in 'abcdefghijklmnopqrstuvwxyz0123456789-' for char in run_id), 'invalid fresh primitive run ID')
    out = HERE / 'evidence' / run_id
    out.mkdir(parents=True, exist_ok=False)
    started = time.monotonic_ns()
    counts = {'wrapperCalls': 0, 'delegatedOriginalAttempts': 0,
              'directOriginalAttempts': 0, 'totalOriginalAttempts': 0}
    summary = {'kind': 'P4_SUPPORT_RADIUS_PRIMITIVES', 'runId': run_id,
               'status': 'IN_PROGRESS', 'groupsCompleted': 0, 'counts': counts,
               'originalOutcomes': {'returns': 0, 'raises': 0}, 'groups': [],
               'firstFailure': None, 'fullReferenceCalls': 0, 'WorldCalls': 0,
               'fixtureFunctionCalls': 0, 'trigCalls': 0,
               'runtime': {'python': sys.version, 'executable': sys.executable,
                           'platform': platform.platform(), 'implementation': sys.implementation.name}}
    memo = None
    current = None
    caller_context = getcontext()
    previous_alarm = None

    def save(name, value, exclusive=False):
        data = (json.dumps(value, allow_nan=False, separators=(',', ':')) + '\n').encode()
        need(len(data) <= (8 if name == 'first-failure.json' else 32) * MIB, 'primitive evidence bound exceeded')
        path = out / name
        with path.open('xb' if exclusive else 'wb') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())

    def progress():
        save('progress.json', summary)

    def charge(kind):
        need(counts['totalOriginalAttempts'] < 72, '72 original helper attempt ceiling exhausted')
        counts[kind] += 1; counts['totalOriginalAttempts'] += 1
        progress()

    def invoke(original, arguments, style, kind):
        charge(kind)
        args, kwargs = invocation_args(arguments, style)
        try:
            result = original(*args, **kwargs)
        except BaseException as error:
            summary['originalOutcomes']['raises'] += 1
            return None, error, outcome(error=error)
        summary['originalOutcomes']['returns'] += 1
        return result, None, outcome(value=result)

    def check_resources(stats, bounds):
        need(all(type(stats[name]) is int and stats[name] >= 0 for name in (*COUNTERS, 'entries', 'encoded_key_bytes', 'owned_bytes', 'peak_owned_bytes')), 'invalid actual cache statistics')
        need(stats['entries'] <= bounds['max_entries'] and stats['encoded_key_bytes'] <= bounds['max_encoded_bytes']
             and stats['owned_bytes'] <= bounds['max_owned_bytes'] and stats['peak_owned_bytes'] <= bounds['max_owned_bytes']
             and stats['calls'] <= bounds['max_logical_calls'], 'cache resource/accounting overrun')
        need(stats['calls'] == stats['hits'] + stats['original_attempts']
             and stats['original_attempts'] == stats['original_returns'] + stats['original_raises'], 'actual cache call accounting differs')
        need(all(type(key) is bytes and len(key) <= bounds['max_key_bytes'] for key in memo._entries), 'retained key is not bounded exact bytes')

    def deadline(_signal, _frame):
        raise RuntimeError('primitive170s internal deadline')

    try:
        recipe_path, contract_path = HERE / 'CACHE-CONTROLS.json', HERE / 'CACHE-CONTRACT.md'
        recipe_bytes, contract_bytes = read(recipe_path), read(contract_path)
        need(sha(recipe_bytes) == RECIPE_SHA and sha(contract_bytes) == CONTRACT_SHA, 'frozen primitive recipes/contract changed')
        recipes = json.loads(recipe_bytes)
        freeze_path = HERE / 'cache-implementation-freeze-01.json'
        freeze_bytes = read(freeze_path); freeze = json.loads(freeze_bytes)
        need(freeze['inputs'] == {'CACHE-CONTRACT.md': CONTRACT_SHA, 'CACHE-CONTROLS.json': RECIPE_SHA}
             and freeze['approvedPrimitiveLedger'] == recipes['exactPlannedLedger']
             and freeze['approvedBounds'] == recipes['defaultBounds'], 'parent implementation freeze changed scope')
        helper_path = ROOT / recipes['authority']['originalPath']
        helper_bytes = read(helper_path)
        need(sha(helper_bytes) == recipes['authority']['originalSha256'], 'immutable original helper changed')
        core_path = HERE / 'support-radius-cache.py'; core_bytes = read(core_path)
        summary['sources'] = {'cacheModule': metadata(core_path, core_bytes),
                              'controlsModule': metadata(Path(__file__).resolve(), read(Path(__file__).resolve())),
                              'recipes': metadata(recipe_path, recipe_bytes),
                              'originalHelper': metadata(helper_path, helper_bytes)}
        summary['authorityInputs'] = {'contract': metadata(contract_path, contract_bytes),
                                      'parentFreeze': metadata(freeze_path, freeze_bytes),
                                      'originalClosure': 'This standalone original module imports only Python standard-library Decimal/json/math/sys; no producer or other local provider.'}
        summary['bounds'] = recipes['defaultBounds']; progress()
        previous_alarm = signal.signal(signal.SIGALRM, deadline)
        signal.setitimer(signal.ITIMER_REAL, 170)
        core = load_module('p4_request_local_radius_cache', core_path)
        original_module = load_module('p4_immutable_radius_original', helper_path)
        original = original_module.support_radius
        for group in recipes['groups']:
            current = {'group': group['group'], 'name': group['name'], 'status': 'IN_PROGRESS',
                       'baselineResults': {}, 'wrapperResults': [], 'operations': [], 'firstFailure': None}
            summary['groups'].append(current); progress()
            ledger_before = dict(counts)
            fixtures = {name: make_arguments(value) for name, value in recipes['argumentFixtures'].items()}
            instances = {name: make_context(recipes['contextTemplates'][template]) for name, template in group['contextInstances'].items()}
            baselines = {}
            for recipe in group['baselineCalls']:
                context = make_context(recipes['contextTemplates'][recipe['contextTemplate']])
                previous = getcontext(); setcontext(context)
                try:
                    before = context_data(context)
                    _value, error, actual = invoke(original, fixtures[recipe['fixture']], recipe['callStyle'], 'directOriginalAttempts')
                    need((error is None) == (recipe['expectedOutcome'] == 'return'), 'direct original baseline outcome differs from frozen recipe')
                    unchanged_settings(before, actual['postContext'])
                    baselines[recipe['id']] = actual
                    current['baselineResults'][recipe['id']] = {'beforeContext': before, **actual}
                finally:
                    setcontext(previous)
            delegate = {'last_exception': None, 'last_outcome': None}

            def forwarding(*args, **kwargs):
                charge('delegatedOriginalAttempts')
                try:
                    value = original(*args, **kwargs)
                except BaseException as error:
                    summary['originalOutcomes']['raises'] += 1
                    delegate['last_exception'] = error
                    delegate['last_outcome'] = outcome(error=error)
                    raise
                summary['originalOutcomes']['returns'] += 1
                delegate['last_outcome'] = outcome(value=value)
                return value

            memo = core.SupportRadiusCache(forwarding, group['bounds'])
            empty_owned = memo.stats()['owned_bytes']
            snapshots = {}
            returned = []
            for ordinal, recipe in enumerate(group['sequence'], 1):
                current['operationOrdinal'] = ordinal; current['operation'] = recipe; progress()
                operation = recipe['op']
                if operation == 'wrapper_call':
                    previous = getcontext(); context = instances[recipe['contextInstance']]; setcontext(context)
                    try:
                        need(counts['wrapperCalls'] < 48, '48 wrapper invocation ceiling exhausted')
                        counts['wrapperCalls'] += 1; progress()
                        arguments = fixtures[recipe['fixture']]
                        before_input, before_context, before_stats = argument_data(arguments), context_data(context), memo.stats()
                        delegate['last_exception'] = delegate['last_outcome'] = None
                        args, kwargs = invocation_args(arguments, recipe['callStyle'])
                        result = error = None
                        try:
                            result = memo.call(*args, **kwargs)
                        except BaseException as caught:
                            error = caught
                        actual = outcome(value=result, error=error)
                        after_stats = memo.stats()
                        need((error is None) == (recipe['expectedOutcome'] == 'return'), 'wrapper return/raise differs from frozen recipe')
                        need(argument_data(arguments) == before_input, 'wrapper mutated original argument representations/identity')
                        unchanged_settings(before_context, actual['postContext'])
                        if recipe['baselineId'] is not None:
                            need(actual == baselines[recipe['baselineId']], 'wrapper result/exception/full post-flags differ from direct original')
                        if error is not None:
                            need(delegate['last_exception'] is error and delegate['last_outcome'] == actual, 'original exception identity/flags replaced')
                        disposition = recipe['expectedDisposition']
                        expected_delta = {'calls': 1, 'eligible': int(disposition not in ('type-bypass', 'context-bypass')),
                                          'hits': int(disposition == 'hit'), 'misses': int(disposition in ('miss-store', 'miss-original-raise', 'capacity-bypass')),
                                          'type_bypasses': int(disposition == 'type-bypass'), 'context_bypasses': int(disposition == 'context-bypass'),
                                          'capacity_bypasses': int(disposition == 'capacity-bypass'), 'original_attempts': int(disposition != 'hit'),
                                          'original_returns': int(disposition != 'hit' and error is None), 'original_raises': int(error is not None),
                                          'entries': int(disposition == 'miss-store')}
                        for name, delta in expected_delta.items():
                            need(after_stats[name] - before_stats[name] == delta, 'wrong actual cache disposition counter: ' + name)
                        check_resources(after_stats, group['bounds'])
                        if disposition == 'hit':
                            need(delegate['last_outcome'] is None, 'hit called original')
                        returned.append(result)
                        if group['group'] == 11 and len(returned) == 2:
                            need(returned[0] is returned[1], 'hit did not return stored immutable result identity')
                        current['wrapperResults'].append({'fixture': recipe['fixture'], 'disposition': disposition,
                                                          'beforeContext': before_context, 'outcome': actual,
                                                          'exceptionIdentityPreserved': None if error is None else True,
                                                          'inputSnapshot': before_input, 'statsBefore': before_stats, 'statsAfter': after_stats})
                    finally:
                        setcontext(previous)
                elif operation == 'snapshot_stats':
                    snapshot = memo.stats(); expected = memo.stats(); snapshot['entries'] = snapshot['calls'] = 999
                    need(memo.stats() == expected, 'stats aliases caller mutation')
                    snapshots[recipe['id']] = expected
                elif operation == 'clear':
                    before_context = context_data(getcontext()); memo.clear(); actual = memo.stats()
                    need(actual['entries'] == actual['encoded_key_bytes'] == 0 and all(actual[name] == 0 for name in COUNTERS), 'clear retained entries or counters')
                    need(actual['owned_bytes'] == empty_owned, 'clear did not release owned payload to empty baseline')
                    need(context_data(getcontext()) == before_context, 'clear changed active Context')
                elif operation == 'snapshot_arguments':
                    snapshots[recipe['id']] = argument_data(fixtures[recipe['fixture']])
                elif operation == 'attempt_result_attribute_write':
                    need(returned and type(returned[-1]) is Decimal, 'immutable builtin result required')
                    value = returned[-1]; before_value = decimal_data(value); before_context = context_data(getcontext())
                    try:
                        setattr(value, recipe['attribute'], recipe['value'])
                    except AttributeError:
                        pass
                    else:
                        raise AssertionError('Decimal result admitted mutable caller attribute')
                    need(decimal_data(value) == before_value and context_data(getcontext()) == before_context, 'result alias check mutated value/Context')
                elif operation == 'mutate_detached_stats':
                    expected = memo.stats(); changed = memo.stats(); changed.update(recipe['fields'])
                    need(memo.stats() == expected, 'detached stats mutation leaked')
                else:
                    raise AssertionError('unfrozen primitive operation')
                if group['group'] == 10 and 'inputs' in snapshots:
                    need(argument_data(fixtures['A']) == snapshots['inputs'], 'input snapshot changed after miss/hit')
                current['operations'].append({'ordinal': ordinal, 'op': operation, 'passed': True})
                progress()
            current['callLedgerActual'] = {name: counts[name] - ledger_before[name] for name in counts}
            need(current['callLedgerActual'] == group['callLedger'], 'actual group calls differ from frozen literal ledger')
            current['finalStats'] = memo.stats(); check_resources(current['finalStats'], group['bounds'])
            current['status'] = 'PASS'; summary['groupsCompleted'] += 1
            memo.clear(); memo = None; progress()
        need(summary['groupsCompleted'] == 12 and counts == recipes['exactPlannedLedger'], 'complete primitive count prefix differs')
        need(summary['originalOutcomes'] == {'returns': 46, 'raises': 5}, 'actual original return/raise ledger differs')
        for name, info in summary['sources'].items():
            need(sha(read(ROOT / info['path'])) == info['sha256'], 'primitive source changed during execution: ' + name)
        need(sha(read(contract_path)) == CONTRACT_SHA, 'contract changed during execution')
        summary['status'] = 'PASS_SUPPORT_RADIUS_PRIMITIVES'
    except BaseException as error:
        summary['status'] = 'FAIL'
        if current is not None:
            current['status'] = 'FAIL'
        failure = {'type': type(error).__module__ + '.' + type(error).__qualname__, 'message': str(error),
                   'group': current['group'] if current else None,
                   'operationOrdinal': current.get('operationOrdinal') if current else None,
                   'counts': dict(counts), 'activeContext': context_data(getcontext())}
        if memo is not None:
            try:
                failure['cacheStats'] = memo.stats()
            except BaseException as accounting:
                failure['cacheStatsError'] = str(accounting)
        summary['firstFailure'] = failure
        save('first-failure.json', {'firstFailure': failure, 'currentGroup': current}, True)
    finally:
        if previous_alarm is not None:
            signal.setitimer(signal.ITIMER_REAL, 0); signal.signal(signal.SIGALRM, previous_alarm)
        setcontext(caller_context)
        if memo is not None:
            try:
                memo.clear()
            except BaseException as error:
                summary['cleanupFailure'] = str(error); summary['status'] = 'FAIL'
        summary['elapsedWallNs'] = time.monotonic_ns() - started
        progress(); save('summary.json', summary, True)
    print(json.dumps({'runId': run_id, 'status': summary['status'], 'groupsCompleted': summary['groupsCompleted'], 'counts': counts, 'firstFailure': summary['firstFailure']}))
    return 0 if summary['status'] == 'PASS_SUPPORT_RADIUS_PRIMITIVES' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True)
    sys.exit(run(parser.parse_args().run_id))
