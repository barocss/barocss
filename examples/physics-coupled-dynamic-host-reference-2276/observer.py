#!/usr/bin/env python3
"""Independent saved-word host observer. AUTHOR MUST NOT EXECUTE."""
from pathlib import Path
from hashlib import sha256
import importlib.util
import json
import struct
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
UTILITY = ROOT / 'examples/physics-coupled-dynamic-reference-2276/audit-pure.py'
UTILITY_HASH = 'fbb772ee12e86520673dd682031d3a6b5b483bba8371a5b9029cb482a5ee8820'
GOLD_HASH = '0f710491f0063fd0b0e988ea915cd6342c5e013e695057d503a27a7d7ba7c943'
OPTIONS_HASH = 'd898d9bfc70e36d79b76b187a9ac8f2d578b5df7ad6ca5b528bf3e252d5a5f9b'
MODEL_HASHES = {'before': '8f9c34238b98216656789f1d49a4c88779d55c1af1927d1b51b5f87464edb132',
                'at': 'de76b4d60f43c50be503558c10cc8b2f2d20ae4846b942473c2bf25f3f533c36',
                'after': '17d1c9e777c73221d1cfe2b39b605ac2e8077a72dab07d439ee16af93ddda620'}
PHASE_CAPS = {'worlds': 4, 'attempts': 8, 'records': 8192, 'applications': 4352,
              'queries': 72, 'queryPoints': 288, 'anchorChecks': 7776}
BYTE_CAP = 16 * 1024 * 1024
OUTPUT_CAP = 65536
START = None
READ = 0
lib = None


class NoGo(Exception):
    pass


def need(ok, reason):
    if not ok:
        raise NoGo(reason)


def deadline():
    need(START is None or time.monotonic() - START < 180, 'HOST_OBSERVER_TIME_CAP')


def read_bytes(path, expected=None):
    global READ
    deadline()
    size = path.stat().st_size
    need(size <= BYTE_CAP and READ + size <= BYTE_CAP, 'HOST_OBSERVER_READ_CAP')
    data = path.read_bytes()
    READ += len(data)
    digest = sha256(data).hexdigest()
    if expected is not None:
        need(digest == expected, 'HOST_OBSERVER_INPUT_HASH_' + path.name)
    return data, {'bytes': len(data), 'sha256': digest}


def read_json(path, expected=None):
    data, pin = read_bytes(path, expected)
    return json.loads(data), pin


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def same(a, b, reason):
    need(canonical(a) == canonical(b), reason)


def raw(value):
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return {'$f64le': struct.pack('<d', value).hex()}
    if isinstance(value, list):
        return [raw(v) for v in value]
    if isinstance(value, dict):
        return {key: raw(v) for key, v in value.items()}
    raise NoGo('HOST_NONDATA_VALUE')


def words(values):
    return [struct.pack('>d', value).hex() for value in values]


def cache_words(cache):
    return [struct.pack('>d', cache['normalNs']).hex(), words(cache['tangentNs'])]


def vectors(actual, expected, reason, tolerance=None):
    need(len(actual) == len(expected), reason + '_SHAPE')
    limit = lib.IMPULSE if tolerance is None else tolerance
    for a, b in zip(actual, expected):
        lib.gate(lib.singleton(lib.sub(a, b)), limit, reason)


def body_contact(body, point):
    return lib.va(lib.vector(body['velocityMps']),
                  lib.cross(lib.vector(body['angularVelocityRadps']),
                            lib.vs(point, lib.vector(body['positionM']))))


def energy(body):
    if body['kind'] == 'static':
        return lib.Q(0)
    v, w = lib.vector(body['velocityMps']), lib.vector(body['angularVelocityRadps'])
    return lib.add(lib.div(lib.dot(v, v), 2), lib.div(lib.dot(w, w), 12))


def check_cache(cache, target, reason):
    need(cache_words(cache) == cache_words(target), reason)


def load_utility():
    global lib
    _, pin = read_bytes(UTILITY, UTILITY_HASH)
    spec = importlib.util.spec_from_file_location('immutable_independent_host_math_01', UTILITY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.START = START
    lib = module
    return pin


def packet_inputs(raw_packet, packet):
    case_id = packet['caseId']
    need(case_id in MODEL_HASHES, 'HOST_ORIGINAL_CASE_ID')
    base = ROOT / 'examples/physics-persistent-cone-design-2276/evidence/model-01'
    paths = {'model': base / (case_id + '-model.json'), 'options': base / 'options.json'}
    expected_hashes = {'model': MODEL_HASHES[case_id], 'options': OPTIONS_HASH}
    loaded, pins = {}, {}
    for name, path in paths.items():
        data, pin = read_json(path, expected_hashes[name])
        loaded[name], pins[name] = data, pin
        descriptor = packet['frozenInput'][name]
        need(Path(descriptor['path']).resolve() == path.resolve() and
             descriptor['bytes'] == pin['bytes'] and descriptor['sha256'] == pin['sha256'],
             'HOST_ORIGINAL_FROZEN_DESCRIPTOR_' + name)
        same(raw_packet[name], raw(data), 'HOST_COMPLETE_MODEL_OPTIONS_WORDS_' + name)
    need(packet['mode'] == 'step' and packet['before']['stepIndex'] == 0 and
         packet['before']['contacts'] == [] and packet['before']['pairWrenches'] == [],
         'HOST_FIRST_COLD_INTERVAL')
    need(packet['privateBefore']['world']['persistentPoints'] == [] and
         packet['privateBefore']['accepted']['cacheFrames'] == {}, 'HOST_COLD_PRIVATE_CACHE')
    for key, cap in PHASE_CAPS.items():
        value = packet['trace']['counts'][key]
        need(isinstance(value, float) and value.is_integer() and 0 <= value <= cap, 'HOST_PHASE_CAP_' + key)
    return loaded, pins


def attempt_records(raw_packet, packet):
    worlds = packet['trace']['worlds']
    world = next(w for w in worlds if w['id'] == packet['worldId'])
    attempt = next(a for a in world['history'] if a['attempt'] == packet['attemptId'])
    records = attempt['records']
    need(len(records) <= PHASE_CAPS['records'], 'HOST_SELECTED_RECORD_CAP')
    raw_world = next(w for w in raw_packet['trace']['worlds'] if lib.decode(w['id']) == packet['worldId'])
    raw_attempt = next(a for a in raw_world['history'] if lib.decode(a['attempt']) == packet['attemptId'])
    return records, raw_attempt['records']


def bind_plan(raw_records, records, model, gold_case):
    plans = [e for e in records if e['kind'] == 'coupled-plan']
    queries = [e for e in records if e['kind'] == 'geometry-query']
    force = [q for q in queries if not q['final']]
    need(len(plans) == 1 and force, 'HOST_ONE_REAL_PREWARM_PLAN')
    plan, first = plans[0], force[0]
    need(records.index(first) < records.index(plan) <
         next((i for i, e in enumerate(records) if e['kind'] == 'impulse-application'), len(records)),
         'HOST_QUERY_THEN_PLAN_THEN_APPLICATION')
    need(plan['hostStep'] == 1 and first['outerPass'] == 0, 'HOST_FIRST_FORCE_PASS_PLAN')
    need(first['result']['status'] == 'HIT' and len(first['result']['points']) == 1 and
         first['result']['feature']['kind'] == 'FACE' and first['result']['feature']['owner'] == 'b',
         'HOST_ONE_REAL_NATIVE_FACE')
    inp, point, b = plan['input'], first['result']['points'][0], first['bodyB']
    for key, value in (('pointM', point['pointM']), ('comM', b['positionM']),
                       ('orientationXYZW', b['orientationXYZW']), ('freeVelocityMps', b['velocityMps']),
                       ('freeAngularVelocityRadps', b['angularVelocityRadps'])):
        same(raw(inp[key]), raw(value), 'HOST_ACTUAL_PREWARM_BODY_INPUT_' + key)
    need(inp['nativeFaceAxis'] == first['result']['feature']['axis'] and
         words(inp['reportedNormal']) == words(first['result']['normal']), 'HOST_ACTUAL_NATIVE_FRAME_INPUT')
    for key in ('a', 'b', 'midpoint'):
        need(lib.vector(point['exact'][key]) == lib.vector(inp['pointM']), 'HOST_EXACT_NATIVE_ENDPOINT_' + key)
    need(lib.vector(inp['nativePointExact']) == lib.vector(inp['pointM']), 'HOST_NATIVE_POINT_INPUT')
    materials = {c['bodyId']: c['material']['friction'] for c in model['colliders']}
    need(inp['muDynamicA'] == materials['a-floor']['dynamic'] and
         inp['muDynamicB'] == materials['z-cube']['dynamic'] and
         inp['muStaticA'] == materials['a-floor']['static'] and inp['muStaticB'] == materials['z-cube']['static'],
         'HOST_ACTUAL_MODEL_MATERIAL_WORDS')
    for key in ('feature', 'point', 'normal', 'exactNormalDirection'):
        expected = point if key == 'point' else first['result'][key]
        same(raw(plan['geometry'][key]), raw(expected), 'HOST_PLAN_ACTUAL_GEOMETRY_' + key)
    p = lib.physical_input(inp, model, gold_case)
    p['colliderIds'] = {shape['bodyId']: shape['id'] for shape in model['colliders']}
    lib.gold_proof(gold_case)
    target = plan['result']
    status = 'DYNAMIC_TARGET' if gold_case['id'] == 'after' else 'STATIC_TARGET'
    need(target['status'] == status and ((p['margin'] > 0) == (status == 'DYNAMIC_TARGET')),
         'HOST_EXACT_STATIC_PRIORITY_AND_REQUIRED_DYNAMIC_TARGET')
    lib.gold_words(target, gold_case)
    # Static certificate immutability is a full raw comparison, independent of
    # the new target's own certificate assertions or new admission counters.
    if status == 'STATIC_TARGET':
        old_path = ROOT / 'examples/physics-coupled-contact-2276/evidence/source-01' / (gold_case['id'] + '-step-trace.json')
        old_dag, _ = read_json(old_path, lib.TRACE_HASHES[gold_case['id']])
        old = lib.trace_dag(old_dag)
        old_plan = lib.collect(old['trace'], 'coupled-plan')
        need(len(old_plan) == 1, 'HOST_ONE_IMMUTABLE_STATIC_PLAN')
        raw_plan = next(e for e in raw_records if e['kind'] == 'coupled-plan')
        for key in ('status', 'worldImpulseNs', 'normalNs', 'tangentNs', 'certificate'):
            same(raw_plan['result'][key], old_plan[0]['result'][key], 'HOST_ENTIRE_OLD_STATIC_' + key)
    return plan, first, queries, p


def fixed_queries(queries, first, p):
    first_point = first['result']['points'][0]
    fixed_body_pose = lambda query, side: [raw(query['pair'][side]['positionM']), raw(query['pair'][side]['orientationXYZW'])]
    for query in queries:
        need(query['owner'] == 'step' and query['result']['status'] == 'HIT' and
             len(query['result']['points']) == 1 and query['projectedDepthM'] == 0, 'HOST_FIXED_TOUCH_QUERY')
        for side, prefix in (('a', 'A'), ('b', 'B')):
            same(fixed_body_pose(query, side), fixed_body_pose(first, side), 'HOST_FIXED_QUERY_POSE_' + side)
            body, pair = query['body' + prefix], query['pair'][side]
            need(body['id'] == pair['id'] and words(body['positionM']) == words(pair['positionM']) and
                 words(body['orientationXYZW']) == words(pair['orientationXYZW']), 'HOST_QUERY_ACTUAL_BODY_POSE')
        need(words(query['result']['normal']) == words(first['result']['normal']), 'HOST_FIXED_PUBLIC_NORMAL')
        exact_normal = lib.vector(query['result']['exactNormalDirection'])
        need(lib.cross(exact_normal, p['frame'][0]) == [0, 0, 0] and
             lib.dot(exact_normal, p['frame'][0]) > 0, 'HOST_EVERY_QUERY_NATIVE_NORMAL_CORRESPONDENCE')
        same(raw(query['result']['feature']), raw(first['result']['feature']), 'HOST_FIXED_NATIVE_FEATURE')
        point = query['result']['points'][0]
        need(point['id'] == first_point['id'], 'HOST_FIXED_NATIVE_POINT_ID')
        for key in ('a', 'b', 'midpoint'):
            need(lib.vector(point['exact'][key]) == p['point'], 'HOST_FIXED_EXACT_NATIVE_POINT')
        for key in ('pointM', 'aPointM', 'bPointM'):
            need(lib.vector(point[key]) == p['point'], 'HOST_FIXED_REPRESENTED_NATIVE_POINT')


def physical_residual(J, postA, postB, p, dynamic, owner):
    n = p['frame'][0]
    N = lib.dot(n, J)
    T = lib.vs(J, lib.vm(n, N))
    actual = lib.vs(body_contact(postB, p['point']), body_contact(postA, p['point']))
    expected = lib.va(p['free'], [lib.dot(row, J) for row in p['K']])
    vectors(actual, expected, owner + '_ACTUAL_BODY_K_CONTACT_VELOCITY', lib.SPEED)
    un = lib.dot(n, actual)
    tangent = lib.vs(actual, lib.vm(n, un))
    lib.gate(lib.singleton(un), lib.SPEED, owner + '_ZERO_NATIVE_NORMAL_SPEED')
    need(N > 0, owner + '_POSITIVE_NORMAL_LOAD')
    slip = lib.sqrt_exact(lib.dot(tangent, tangent))
    if dynamic:
        need(slip[0] > lib.SPEED, owner + '_POSITIVE_FINAL_TANGENT_SLIP')
        cone = lib.ins(lib.sqrt_exact(lib.dot(T, T)), lib.singleton(lib.mul(p['mu'], N)))
        lib.gate(cone, lib.IMPULSE, owner + '_DYNAMIC_CONE_MAGNITUDE')
        opposition = []
        for i in range(3):
            residual = lib.ia(lib.singleton(T[i]), lib.idiv(
                lib.singleton(lib.mul(lib.mul(p['mu'], N), tangent[i])), slip))
            lib.gate(residual, lib.IMPULSE, owner + '_DYNAMIC_OPPOSITION_' + str(i))
            opposition.append(lib.interval_data(residual))
    else:
        vectors(actual, [lib.Q(0)] * 3, owner + '_STATIC_COMPLETE_ZERO_CONTACT_VELOCITY', lib.SPEED)
        excess = lib.sub(lib.sqrt_exact(lib.dot(T, T))[1], N)
        need(excess <= lib.IMPULSE, owner + '_STATIC_CONE_EXCESS')
        cone, opposition = None, []
    return {'normalNs': lib.rat(N), 'worldTangentNs': lib.rv(T),
            'actualContactVelocity': lib.rv(actual), 'physicalKContactVelocity': lib.rv(expected),
            'normalSpeedMps': lib.rat(un), 'finalTangentSlip': lib.interval_data(slip),
            'dynamicConeResidual': lib.interval_data(cone) if cone else None,
            'dynamicOpposition': opposition}


def applications(raw_records, records, plan, first, queries, p, expected_count):
    events = [e for e in records if e['kind'] == 'impulse-application']
    raw_events = [e for e in raw_records if e['kind'] == 'impulse-application']
    need(len(events) == expected_count, 'HOST_REAL_APPLICATION_CENSUS')
    need(not any(e['kind'] == 'pose-correction' for e in records), 'HOST_NO_POSE_CORRECTION')
    target = plan['result']
    dynamic = target['status'] == 'DYNAMIC_TARGET'
    query_by_id = {q['queryId']: q for q in queries}
    cache_init = [e for e in records if e['kind'] == 'cache-init']
    need(len(cache_init) == 1 and cache_init[0]['key'] == plan['key'] and
         cache_init[0]['queryId'] == first['queryId'] and cache_init[0]['prior'] is None and
         cache_init[0]['producingFrame'] is None and cache_init[0]['actualCache']['normalNs'] == 0 and
         cache_init[0]['actualCache']['tangentNs'] == [0, 0, 0], 'HOST_ONE_REAL_COLD_CACHE_INITIALIZATION')
    Jtarget = lib.vector(target['worldImpulseNs'])
    netJ = [lib.Q(0)] * 3
    netMA, netMB = [lib.Q(0)] * 3, [lib.Q(0)] * 3
    total_work = lib.Q(0)
    first_response = None
    for i, (event, raw_event) in enumerate(zip(events, raw_events)):
        deadline()
        branch = event['branch']
        need(event['eventKind'] == ('coupled-dynamic' if dynamic else 'coupled-static') and
             branch['targetStatus'] == target['status'] and branch['targetApplied'] is (i == 0) and
             branch['zeroSlot'] is (i != 0) and branch['slot'] == i + 1 and branch['hostStep'] == 1 and
             branch['key'] == event['key'] == plan['key'], 'HOST_REAL_TARGET_SLOT_BINDING')
        need(event['outerPass'] == i // 8 and event['iteration'] == i % 8 and event['order'] == 0,
             'HOST_ORIGINAL_EIGHT_BY_EIGHT_SLOTS')
        need(words(branch['worldImpulseNs']) == words(target['worldImpulseNs']) and
             cache_words(branch) == cache_words(target) and lib.vector(branch['nativeNormal']) == p['frame'][0],
             'HOST_BRANCH_IMMUTABLE_GOLD_TARGET')
        query = query_by_id[event['queryId']]
        point = query['result']['points'][0]
        need(records.index(query) < records.index(event) and event['pointId'] == point['id'], 'HOST_APPLICATION_REAL_QUERY_OWNERSHIP')
        same(raw_event['native'], raw(point['exact']), 'HOST_APPLICATION_NATIVE_PROVENANCE')
        same(raw_event['feature'], raw(query['result']['feature']), 'HOST_APPLICATION_FEATURE_PROVENANCE')
        need(words(event['normal']) == words(query['result']['normal']), 'HOST_APPLICATION_NORMAL_PROVENANCE')
        for key in ('pointM', 'anchorOnAM', 'anchorOnBM'):
            need(lib.vector(event[key]) == p['point'], 'HOST_COMMON_ACTUAL_ANCHOR')
        applied = lib.vector(event['impulseOnBNs'])
        need(applied == (Jtarget if i == 0 else [0, 0, 0]), 'HOST_ONCE_WHOLE_J_THEN_REAL_ZEROS')
        need(lib.vector(event['impulseOnANs']) == lib.vm(applied, -1), 'HOST_ACTUAL_IMPULSE_RECIPROCITY')
        check_cache(event['cacheAfter'], target, 'HOST_ACTUAL_CACHE_GOLD_WORDS')
        vectors([lib.dot(lib.vector(event['cacheAfter']['tangentNs']), p['frame'][0]),
                 lib.dot(lib.vector(event['cacheAfter']['tangentNs']), p['publicNormal'])],
                [0, 0], 'HOST_ACTUAL_NATIVE_PUBLIC_CACHE_PLANES')
        for side, prefix in (('a', 'A'), ('b', 'B')):
            pre, post = event['body' + prefix + 'Before'], event['body' + prefix + 'After']
            need(words(pre['positionM']) == words(query['body' + prefix]['positionM']) and
                 words(pre['orientationXYZW']) == words(query['body' + prefix]['orientationXYZW']),
                 'HOST_REAL_EVENT_QUERY_BODY_POSE')
            same(raw_event['body' + prefix + 'Before']['positionM'], raw_event['body' + prefix + 'After']['positionM'], 'HOST_IMPULSE_PRESERVES_POSITION')
            same(raw_event['body' + prefix + 'Before']['orientationXYZW'], raw_event['body' + prefix + 'After']['orientationXYZW'], 'HOST_IMPULSE_PRESERVES_ORIENTATION')
        same(raw_event['bodyABefore'], raw_event['bodyAAfter'], 'HOST_STATIC_REACTION_PRESERVES_ALL_BODY_WORDS')
        if i:
            same(raw_event['bodyBBefore'], raw_event['bodyBAfter'], 'HOST_REAL_ZERO_CALL_PRESERVES_ALL_BODY_WORDS')
            check_cache(event['cacheBefore'], target, 'HOST_LATER_CACHE_GOLD_WORDS')
            prior_raw = raw_events[i - 1]
            for prefix in ('A', 'B'):
                same(raw_event['body' + prefix + 'Before'], prior_raw['body' + prefix + 'After'], 'HOST_NO_HIDDEN_BODY_MUTATION_BETWEEN_CALLS')
            producing = event['producingFrame']
            need(producing is not None and producing['queryId'] == events[i - 1]['queryId'] and
                 producing['pointId'] == events[i - 1]['pointId'], 'HOST_LATER_ACTUAL_PRODUCING_FRAME')
        else:
            need(event['cacheBefore']['normalNs'] == 0 and event['cacheBefore']['tangentNs'] == [0, 0, 0], 'HOST_FIRST_ACTUAL_COLD_CACHE')
            need(event['cacheOrigin'] == 'cold' and event['producingFrame'] is None, 'HOST_FIRST_CACHE_ORIGIN_HAS_NO_WARM_FRAME')
            same(raw_event['bodyBBefore'], raw(first['bodyB']), 'HOST_FIRST_APPLICATION_REAL_FREE_QUERY_BODY')
            pre, post = event['bodyBBefore'], event['bodyBAfter']
            deltaV = lib.vs(lib.vector(post['velocityMps']), lib.vector(pre['velocityMps']))
            deltaW = lib.vs(lib.vector(post['angularVelocityRadps']), lib.vector(pre['angularVelocityRadps']))
            vectors(deltaV, applied, 'HOST_ACTUAL_LINEAR_MOMENTUM', lib.SPEED)
            torque = lib.cross(p['arm'], applied)
            vectors(lib.vm(deltaW, lib.div(1, p['inverseInertia'])), torque, 'HOST_ACTUAL_COM_ANGULAR_MOMENTUM', lib.SPEED)
            origin = lib.va(lib.cross(p['com'], deltaV), lib.vm(deltaW, lib.div(1, p['inverseInertia'])))
            vectors(origin, lib.cross(p['point'], applied), 'HOST_ACTUAL_ORIGIN_MOMENT', lib.SPEED)
            relative_pre = lib.vs(body_contact(pre, p['point']), body_contact(event['bodyABefore'], p['point']))
            relative_post = lib.vs(body_contact(post, p['point']), body_contact(event['bodyAAfter'], p['point']))
            work = lib.div(lib.dot(applied, lib.va(relative_pre, relative_post)), 2)
            measured = lib.sub(energy(post), energy(pre))
            vectors([measured], [work], 'HOST_ACTUAL_MIDPOINT_KINETIC_WORK', lib.SPEED)
            need(work <= lib.SPEED and measured <= lib.SPEED, 'HOST_ACTUAL_PASSIVE_WORK')
            total_work = lib.add(total_work, work)
            first_response = physical_residual(applied, event['bodyAAfter'], post, p, dynamic, 'actual-first-application')
        netJ = lib.va(netJ, applied)
        netMB = lib.va(netMB, lib.cross(p['point'], applied))
        netMA = lib.va(netMA, lib.cross(p['point'], lib.vm(applied, -1)))
    need(netJ == Jtarget, 'HOST_INDEPENDENT_EVENT_SUM_GOLD_J')
    return events, {'netJ': netJ, 'momentA': netMA, 'momentB': netMB,
                    'work': total_work, 'firstResponse': first_response}


def pair_wrench(wrench, totals, p, target, postA, postB, owner):
    need(wrench['bodyAId'] == 'a-floor' and wrench['bodyBId'] == 'z-cube' and
         wrench['colliderAId'] == p['colliderIds']['a-floor'] and wrench['colliderBId'] == p['colliderIds']['z-cube'], owner + '_PAIR_OWNERSHIP')
    for side, expectedJ, expectedM in (('onA', lib.vm(totals['netJ'], -1), totals['momentA']),
                                       ('onB', totals['netJ'], totals['momentB'])):
        vectors(lib.vector(wrench[side]['linearImpulseNs']), expectedJ, owner + '_PRODUCER_J', lib.SPEED)
        vectors(lib.vector(wrench[side]['angularImpulseAboutWorldOriginNms']), expectedM, owner + '_PRODUCER_ORIGIN_MOMENT', lib.SPEED)
    need(words(wrench['onB']['linearImpulseNs']) == words(target['worldImpulseNs']), owner + '_PRODUCER_GOLD_J_WORDS')
    return physical_residual(lib.vector(wrench['onB']['linearImpulseNs']), postA, postB, p,
                             target['status'] == 'DYNAMIC_TARGET', owner)


def accepted(raw_packet, packet, raw_records, records, plan, first, queries, p, gold_case):
    need(packet.get('rejected') is None and packet['after']['stepIndex'] == 1 and
         words([packet['after']['timeSeconds']]) == words([packet['options']['fixedStepSeconds']]), 'HOST_REAL_ACCEPTED_FIRST_STEP')
    force, final = [q for q in queries if not q['final']], [q for q in queries if q['final']]
    need(len(force) == 8 and len(final) == 1 and [q['outerPass'] for q in force] == list(range(8)),
         'HOST_ORIGINAL_EIGHT_FORCE_ONE_FINAL_QUERIES')
    prepared = [e for e in records if e['kind'] == 'attempt-prepared']
    need(len(prepared) == 1, 'HOST_ONE_REAL_PREPARED_ACCEPTANCE')
    events, totals = applications(raw_records, records, plan, first, queries, p, 64)
    postA = next(b for b in packet['after']['bodies'] if b['id'] == 'a-floor')
    postB = next(b for b in packet['after']['bodies'] if b['id'] == 'z-cube')
    last = events[-1]
    for actual_body, last_body in ((postA, last['bodyAAfter']), (postB, last['bodyBAfter'])):
        for key in ('positionM', 'orientationXYZW', 'velocityMps', 'angularVelocityRadps'):
            same(raw(actual_body[key]), raw(last_body[key]), 'HOST_ACCEPTED_BODY_LAST_ACTUAL_APPLICATION_' + key)
    final_query = final[0]
    for prefix, body in (('A', postA), ('B', postB)):
        for key in ('positionM', 'orientationXYZW', 'velocityMps', 'angularVelocityRadps'):
            same(raw(final_query['body' + prefix][key]), raw(body[key]), 'HOST_FINAL_QUERY_ACTUAL_ACCEPTED_BODY_' + key)
    target = plan['result']
    final_response = physical_residual(totals['netJ'], postA, postB, p, target['status'] == 'DYNAMIC_TARGET', 'accepted-event-sum')
    actual_velocity = lib.vs(body_contact(postB, p['point']), body_contact(postA, p['point']))
    for proof in gold_case['reference']:
        for actual, enclosure in zip(actual_velocity, proof['physical']['idealFinalWorldVelocity']):
            lib.gate(lib.ins(lib.singleton(actual), lib.interval(enclosure)), lib.SPEED, 'HOST_ACTUAL_ACCEPTED_GOLD_FINAL_VELOCITY')
    before_cube = next(b for b in packet['before']['bodies'] if b['id'] == 'z-cube')
    vectors([lib.sub(energy(postB), energy(before_cube))], [totals['work']], 'HOST_ACCEPTED_WHOLE_INTERVAL_WORK', lib.SPEED)
    private = packet['privateAfter']
    need(private['accepted']['stepIndex'] == 1, 'HOST_REAL_PRIVATE_ACCEPTANCE')
    world_cache, accepted_cache = private['world']['persistentPoints'], private['accepted']['actualCache']
    need(len(world_cache) == len(accepted_cache) == 1 and world_cache[0][0] == accepted_cache[0][0] == plan['key'], 'HOST_COMPLETE_ACTUAL_CACHE_POPULATION')
    same(raw(world_cache), raw(accepted_cache), 'HOST_ACCEPTED_WORLD_ACTUAL_CACHE_RAW_EQUALITY')
    check_cache(world_cache[0][1], target, 'HOST_COMMITTED_CACHE_GOLD_WORDS')
    frames = private['accepted']['cacheFrames']
    need(set(frames) == {plan['key']}, 'HOST_COMPLETE_PRODUCING_FRAME_POPULATION')
    frame = frames[plan['key']]
    need(frame['queryId'] == last['queryId'] and frame['pointId'] == last['pointId'], 'HOST_COMMITTED_FRAME_LAST_REAL_QUERY')
    for key, actual in (('normal', last['normal']), ('feature', last['feature']), ('native', last['native'])):
        same(raw(frame[key]), raw(actual), 'HOST_COMMITTED_PRODUCING_FRAME_' + key)
    producing_query = next(q for q in queries if q['queryId'] == last['queryId'])
    same(raw(frame['pair']), raw(producing_query['pair']), 'HOST_COMMITTED_FRAME_ACTUAL_PAIR_POSE')
    contacts = packet['after']['contacts']
    need(packet['after']['schemaVersion'] == 2 and len(contacts) == 1 and len(contacts[0]['points']) == 1,
         'HOST_COMPLETE_ACCEPTED_SCHEMA2_CONTACT_POPULATION')
    contact, point = contacts[0], contacts[0]['points'][0]
    need(contact['bodyAId'] == 'a-floor' and contact['bodyBId'] == 'z-cube' and
         contact['colliderAId'] == p['colliderIds']['a-floor'] and contact['colliderBId'] == p['colliderIds']['z-cube'] and
         point['id'] == final_query['result']['points'][0]['id'], 'HOST_ACCEPTED_NATIVE_POINT_OWNERSHIP')
    need(set(contact) == {'colliderAId', 'colliderBId', 'bodyAId', 'bodyBId', 'points'} and
         set(point) == {'id', 'normalAtoB', 'anchorM', 'pointOnAM', 'pointOnBM', 'signedGapM'}, 'HOST_ACCEPTED_CANONICAL_GEOMETRY_ONLY_FIELDS')
    need(lib.vector(point['anchorM']) == p['point'] and words(point['normalAtoB']) == words(final_query['result']['normal']),
         'HOST_ACCEPTED_ACTUAL_ANCHOR_NORMAL')
    for key in ('pointOnAM', 'pointOnBM'):
        vectors(lib.vector(point[key]), p['point'], 'HOST_ACCEPTED_NATIVE_SURFACE_ENDPOINT', lib.IMPULSE)
    vectors([lib.Q(point['signedGapM'])], [0], 'HOST_ACCEPTED_NATIVE_SIGNED_GAP', lib.IMPULSE)
    wrenches = packet['after']['pairWrenches']
    need(len(wrenches) == 1, 'HOST_COMPLETE_ACCEPTED_PRODUCER_WRENCH_POPULATION')
    producer = pair_wrench(wrenches[0], totals, p, target, postA, postB, 'accepted-actual-producer')
    return {'status': 'EXECUTED_PASS_COUPLED_HOST_GOLD_TARGET', 'actualApplications': 64,
            'actualWholeTargetApplications': 1, 'actualZeroApplications': 63,
            'actualForceQueries': 8, 'actualFinalQueries': 1,
            'eventSum': final_response, 'producer': producer, 'firstApplication': totals['firstResponse'],
            'actualMidpointWork': lib.rat(totals['work']), 'committedCache': 'GOLD_WORDS_ACTUAL_STORAGE',
            'acceptedPopulation': 'ONE_REAL_FINAL_NATIVE_POINT_AND_ONE_REAL_PRODUCER_WRENCH'}


def rollback(raw_packet, records):
    need(raw_packet.get('rejected') is not None and not any(e['kind'] == 'attempt-prepared' for e in records),
         'HOST_FAULT_PREFIX_HAS_NO_PREPARED_SUCCESSOR')
    same(raw_packet['before'], raw_packet['after'], 'HOST_PREFIX_ACCEPTED_STATE_RAW_ROLLBACK')
    same(raw_packet['privateBefore'], raw_packet['privateAfter'], 'HOST_PREFIX_PRIVATE_RAW_ROLLBACK')


def observe(mode, packet_path, reference_path):
    utility_pin = load_utility()
    dag, packet_pin = read_json(packet_path)
    raw_packet = lib.trace_dag(dag)
    packet = lib.decode(raw_packet)
    inputs, input_pins = packet_inputs(raw_packet, packet)
    gold, gold_pin = read_json(reference_path, GOLD_HASH)
    need(gold['status'] == 'REFERENCE_READY' and gold['WorldCalls'] == gold['candidateCalls'] == 0, 'HOST_GOLD_READY_BEFORE_CANDIDATES')
    gold_case = next(c for c in gold['cases'] if c['id'] == packet['caseId'])
    records, raw_records = attempt_records(raw_packet, packet)
    report = {'caseId': packet['caseId'], 'mode': mode, 'packetPin': packet_pin,
              'utilityPin': utility_pin, 'goldPin': gold_pin, 'inputPins': input_pins,
              'phaseCounts': packet['trace']['counts'], 'broaderPhysicalObservers': 'REQUIRED_UNCHANGED_PREDECESSORS'}
    if mode == 'prefix-before':
        rollback(raw_packet, records)
        need(packet['rejected']['code'] == 'NUMERIC_LIMIT' and
             packet['rejected']['message'] == 'PRIVATE_B_FAULT_BEFORE_APPLICATION' and
             not any(e['kind'] in ('coupled-plan', 'geometry-query', 'impulse-application', 'producer-bucket-mutated-before-unknown') for e in records),
             'HOST_KNOWN_PREQUERY_PREFIX_NO_APPLICATION')
        report.update(status='EXECUTED_PASS_COUPLED_HOST_PREAPPLICATION_PREFIX', actualApplications=0,
                      actualNativeTarget='NOT_RUN_NO_QUERY', dynamicResiduals='NOT_RUN_NO_APPLICATION')
        return report
    plan, first, queries, p = bind_plan(raw_records, records, inputs['model'], gold_case)
    fixed_queries(queries, first, p)
    report['independentVirtualK'] = [lib.rv(row) for row in p['K']]
    report['independentNativeFrame'] = [lib.rv(row) for row in p['frame']]
    if mode == 'accepted':
        report.update(accepted(raw_packet, packet, raw_records, records, plan, first, queries, p, gold_case))
    else:
        need(mode == 'prefix-after', 'HOST_OBSERVER_MODE')
        rollback(raw_packet, records)
        need(packet['rejected']['name'] == 'Error' and
             packet['rejected']['message'] == 'PRIVATE_PHASE_AFTER_ACTUAL_CANDIDATE_IMPULSE',
             'HOST_EXISTING_UNKNOWN_MARKER_TAG')
        buckets = [e for e in records if e['kind'] == 'producer-bucket-mutated-before-unknown']
        need(len(queries) == len(buckets) == 1 and buckets[0]['contributionNonzero'] is True,
             'HOST_ACTUAL_POST_J_PREFIX_POPULATION')
        events, totals = applications(raw_records, records, plan, first, queries, p, 1)
        bucket = buckets[0]
        need(records.index(events[0]) < records.index(bucket), 'HOST_REAL_APPLICATION_BEFORE_BUCKET_FAULT')
        producer = pair_wrench(bucket['bucket'], totals, p, plan['result'], events[0]['bodyAAfter'], events[0]['bodyBAfter'], 'fault-prefix-actual-bucket')
        report.update(status='EXECUTED_PASS_COUPLED_HOST_POSTAPPLICATION_PREFIX', actualApplications=1,
                      actualProducerBucketMutations=1, firstApplication=totals['firstResponse'], producer=producer,
                      acceptedInterval='NOT_APPLICABLE_ROLLED_BACK',
                      recordingModelAndMarkerIdentity='REQUIRES_SEPARATE_DRIVER_RAW_SNAPSHOT_AND_IDENTITY_PROOF')
    return report


def main():
    global START
    START = time.monotonic()
    need(len(sys.argv) == 5 and sys.argv[1] in ('accepted', 'prefix-before', 'prefix-after'), 'HOST_MODE_PACKET_GOLD_OUTPUT_REQUIRED')
    mode, packet_path, reference_path, output_path = sys.argv[1], *[Path(p).resolve() for p in sys.argv[2:]]
    with output_path.open('xb') as stream:
        result = {'status': 'NO_GO_COUPLED_HOST_GOLD_TARGET', 'firstFailure': None,
                  'WorldCalls': 0, 'candidateCalls': 0, 'referenceGeneratorCalls': 0,
                  'nativePublicBrowserPerformance': 'NOT_RUN', 'scope': 'ORIGINAL_FIRST_COLD_ONE_POINT_INTERVAL_ONLY'}
        try:
            result.update(observe(mode, packet_path, reference_path))
        except Exception as error:
            result['firstFailure'] = {'type': type(error).__name__, 'reason': str(error)}
        result.update(elapsedSeconds=time.monotonic() - START, readBytes=READ,
                      rationalOps=lib.OPS if lib is not None else 0,
                      peakBits=lib.PEAK if lib is not None else 0)
        data = (canonical(result) + '\n').encode()
        if len(data) > OUTPUT_CAP:
            result = {'status': 'NO_GO_COUPLED_HOST_GOLD_TARGET',
                      'firstFailure': result['firstFailure'] or {'type': 'NoGo', 'reason': 'HOST_OBSERVER_TERMINAL_CAP'},
                      'WorldCalls': 0, 'candidateCalls': 0, 'referenceGeneratorCalls': 0}
            data = (canonical(result) + '\n').encode()
        stream.write(data)
    print(canonical({'status': result['status'], 'firstFailure': result['firstFailure'],
                     'output': str(output_path), 'sha256': sha256(data).hexdigest()}))
    return 0 if result['firstFailure'] is None else 1


if __name__ == '__main__':
    sys.exit(main())
