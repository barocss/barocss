"""Independent bounded public-state reference. No candidate/package imports or solve."""
from fractions import Fraction
import json
import math
import struct
import sys

LINE_BYTES = 2 * 1024 * 1024
GRAPH_BYTES = 16 * 1024 * 1024
MAX_WORDS = LINE_BYTES // 8
MAX_NODES = 262144
MAX_DEPTH = 32
GATE = Fraction.from_float(1e-10)
TANGENT_GATE = Fraction.from_float(1e-12)
VELOCITY_GATE = Fraction.from_float(1e-11)
CASES = {'ballistic-60': 60, 'ballistic-120': 120, 'ballistic-240': 240,
         'gravity-fall': 256, 'delayed-pair': 256}


class Invalid(ValueError):
    pass


def require(ok, label):
    if not ok:
        raise Invalid(label)


def number(value):
    require(type(value) in (int, float), 'finite JS Number required')
    try:
        result = float(value)
    except (OverflowError, ValueError):
        raise Invalid('finite JS Number required') from None
    require(math.isfinite(result), 'finite JS Number required')
    return result


def q(value):
    return Fraction.from_float(number(value))


def integer(value):
    result = number(value)
    require(result.is_integer() and abs(result) <= 3600, 'bounded integer-valued JS Number')
    return int(result)


def vector(value, size=3):
    require(type(value) is list and len(value) == size, 'vector shape')
    return [q(x) for x in value]


def add(a, b):
    return [x + y for x, y in zip(a, b)]


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def scale(a, x):
    return [v * x for v in a]


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), Fraction(0))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def word(value):
    return struct.pack('<d', number(value))


def restore_words(value, hexadecimal):
    """JSON numeric order, finite RNE-value agreement, actual signed-zero restoration."""
    require(type(hexadecimal) is str and len(hexadecimal) % 16 == 0,
            'numeric word hex shape')
    require(len(hexadecimal) <= MAX_WORDS * 16, 'numeric word count bound')
    require(all(c in '0123456789abcdef' for c in hexadecimal), 'lowercase numeric word hex')
    raw = bytes.fromhex(hexadecimal)
    offset, nodes = 0, 0

    def visit(item, depth):
        nonlocal offset, nodes
        nodes += 1
        require(depth <= MAX_DEPTH and nodes <= MAX_NODES, 'numeric tree bound')
        if type(item) in (int, float):
            require(offset + 8 <= len(raw), 'missing numeric word')
            restored = struct.unpack_from('<d', raw, offset)[0]
            offset += 8
            require(math.isfinite(restored) and restored == number(item), 'numeric word mismatch')
            return restored
        if item is None or type(item) in (bool, str):
            return item
        if type(item) is list:
            return [visit(x, depth + 1) for x in item]
        require(type(item) is dict and all(type(k) is str for k in item), 'JSON data required')
        return {k: visit(v, depth + 1) for k, v in item.items()}

    result = visit(value, 0)
    require(offset == len(raw), 'trailing numeric words')
    return result


def raw_body(body):
    return b''.join(word(x) for key, n in [('positionM', 3), ('velocityMps', 3),
                                          ('orientationXYZW', 4), ('angularVelocityRadps', 3)]
                    for x in body[key][:n])


def result(ok, violations, metrics=None, certificates=None, execution_failure=False):
    return {'ok': ok, 'resolved': not execution_failure, 'executionFailure': execution_failure,
            'status': 'VERIFIED' if ok else 'INVALID_INPUT' if execution_failure else 'PHYSICAL_NO_GO',
            'violations': violations, 'metrics': metrics or {}, 'certificates': certificates or {}}


def reported(value):
    try:
        converted = float(value)
    except OverflowError:
        return 'OUTSIDE_FINITE_BINARY64_REPORT_RANGE'
    return converted if math.isfinite(converted) else 'OUTSIDE_FINITE_BINARY64_REPORT_RANGE'


def verify(data):
    """Reference one authenticated case. Physical failures resolve; malformed input does not."""
    maxima, violations, current_step = {}, [], None
    certificate = {'candidateImports': 0, 'candidateSolves': 0,
                   'scope': 'CENTERED_FRICTIONLESS_SINGLE_PAIR_DISCRETE_ONLY',
                   'projectionWorkBoundary': 'Public-state reconstruction; includes unobserved free-position rounding',
                   'actualWorldCalls': 'CALLER_OWNED_NOT_INFERRED',
                   'actualRestoreCalls': 'CALLER_OWNED_NOT_INFERRED'}

    def gate(name, residual, limit=GATE):
        value = abs(residual)
        maxima[name] = max(maxima.get(name, Fraction(0)), value)
        if value > limit and len(violations) < 32:
            violations.append({'gate': name, 'stepIndex': current_step,
                               'residual': reported(value), 'limit': reported(limit)})

    def metric_values():
        return {k: reported(v) if isinstance(v, Fraction) else v for k, v in maxima.items()}

    try:
        require(type(data) is dict and set(data) == {'caseId', 'model', 'options', 'states'}, 'case data fields')
        case = data['caseId']
        require(type(case) is str and case in CASES, 'fixed case ID')
        model, options, states = data['model'], data['options'], data['states']
        require(type(model) is dict and type(options) is dict, 'public model/options')
        require(options.get('profile') == 'rigid-persistent-box-v1' and options.get('broadPhase') == 'direct', 'existing persistent profile')
        ballistic = case.startswith('ballistic-')
        hz = CASES[case] if ballistic else 120
        h = q(options.get('fixedStepSeconds'))
        require(h == q(1 / hz), 'fixed represented timestep')
        require(model.get('format') == 'barocss-physics-model' and integer(model.get('version')) == 1, 'public model format')
        require(model.get('units') == {'length': 'm', 'mass': 'kg', 'time': 's', 'angle': 'rad'}, 'SI units')
        require(model.get('frame', {}).get('basis') == 'right-handed-xyz' and
                model.get('frame', {}).get('rotation') == 'local-to-world-xyzw', 'frame convention')
        require(all(model.get(k) == [] for k in ['joints', 'cloths', 'fluids', 'sourceBindings']), 'no extra domains/actions')
        gravity = vector(model.get('gravityMps2'))
        require(gravity == vector([0, 0, 0] if case == 'delayed-pair' else [0, -9.81, 0]), 'fixed gravity')
        definitions, colliders = model.get('bodies'), model.get('colliders')
        require(type(definitions) is list and len(definitions) == (1 if ballistic else 2), 'fixed body population')
        require(type(colliders) is list and len(colliders) == len(definitions), 'one collider per body')
        ids = [b.get('id') for b in definitions]
        require(all(type(x) is str and 0 < len(x) <= 64 for x in ids) and len(set(ids)) == len(ids), 'opaque unique body IDs')
        by_definition = dict(zip(ids, definitions))
        by_collider = {}
        collider_ids = set()
        for c in colliders:
            require(type(c) is dict and c.get('bodyId') in by_definition and c['bodyId'] not in by_collider, 'collider body link')
            require(type(c.get('id')) is str and c['id'] not in collider_ids, 'collider identity')
            collider_ids.add(c['id'])
            require(c.get('sensor') is False and c.get('ccd') is False and c.get('filter') == {'categoryBits': 1, 'maskBits': 65535}, 'unfiltered unsensed discrete input')
            require(c.get('local') == {'positionM': [0, 0, 0], 'orientationXYZW': [0, 0, 0, 1]}, 'identity local collider')
            require(c.get('geometry', {}).get('kind') == 'box', 'box geometry')
            material = c.get('material', {})
            require(material.get('friction') == {'static': 0, 'dynamic': 0}, 'zero friction')
            vector(c['geometry'].get('halfExtentsM'))
            by_collider[c['bodyId']] = c
        dynamics = [b for b in definitions if b.get('kind') == 'dynamic']
        statics = [b for b in definitions if b.get('kind') == 'static']
        require(len(dynamics) == (2 if case == 'delayed-pair' else 1), 'dynamic population')
        require(len(statics) == (1 if case == 'gravity-fall' else 0), 'static population')
        for b in definitions:
            initial = b.get('initial', {})
            require(vector(initial.get('orientationXYZW'), 4) == vector([0, 0, 0, 1], 4), 'identity initial rotation')
            vector(initial.get('positionM'))
            if b['kind'] == 'dynamic':
                require(q(b.get('massKg')) == 2 and b.get('inertia') == {'kind': 'primitive-com', 'about': 'com', 'frame': 'body-local'}, 'fixed mass/inertia')
                require(vector(by_collider[b['id']]['geometry']['halfExtentsM']) == vector([.5, .5, .5]), 'unit cube')
                require(vector(initial.get('angularVelocityRadps')) == [0, 0, 0], 'zero initial spin')
                vector(initial.get('velocityMps'))
            else:
                require(b['kind'] == 'static', 'no kinematic body')
        if ballistic:
            moving = dynamics[0]
            require(vector(moving['initial']['positionM']) == vector([0, 10, 0]) and
                    vector(moving['initial']['velocityMps']) == [0, 0, 0], 'ballistic initial words')
        elif case == 'gravity-fall':
            moving, fixed = dynamics[0], statics[0]
            require(vector(moving['initial']['positionM']) == vector([0, .75, 0]) and
                    vector(moving['initial']['velocityMps']) == [0, 0, 0], 'fall initial words')
            require(vector(fixed['initial']['positionM']) == vector([0, -.5, 0]) and
                    vector(by_collider[fixed['id']]['geometry']['halfExtentsM']) == vector([2, .5, 2]), 'original floor top0')
        else:
            lower, upper = sorted(dynamics, key=lambda b: q(b['initial']['positionM'][1]))
            require(vector(lower['initial']['positionM']) == vector([0, -.5, 0]) and
                    vector(lower['initial']['velocityMps']) == [0, 0, 0] and
                    vector(upper['initial']['positionM']) == vector([0, .625, 0]) and
                    vector(upper['initial']['velocityMps']) == vector([0, -2, 0]), 'pair initial words')
        materials = [q(by_collider[b['id']]['material'].get('restitution')) for b in definitions]
        require(all(Fraction(0) <= e <= 1 for e in materials), 'restitution range')
        if case == 'delayed-pair':
            require(sorted(materials) == sorted([q(.25), q(.8)]), 'original min restitution materials')
        else:
            require(all(e == 0 for e in materials), 'e0 ballistic/fall')
        require(type(states) is list and len(states) == CASES[case] + 1, 'complete fixed state population')
        maps = []
        identity = states[0].get('identity')
        require(type(identity) is dict and identity.get('profile') == options['profile'], 'public identity profile')
        for index, state in enumerate(states):
            current_step = index
            require(type(state) is dict and integer(state.get('stepIndex')) == index, 'contiguous actual state indices')
            require(q(state.get('timeSeconds')) == q(index * number(options['fixedStepSeconds'])), 'actual public clock')
            require(state.get('identity') == identity, 'same provider/model identity')
            require(all(state.get(k) == [] for k in ['joints', 'ccdHits', 'cloths', 'fluids']), 'no extra state domains')
            bodies = state.get('bodies')
            require(type(bodies) is list and len(bodies) == len(ids), 'state body population')
            require(set(b.get('id') for b in bodies) == set(ids), 'state body IDs')
            bs = {b['id']: b for b in bodies}
            for bid, b in bs.items():
                require(b.get('kind') == by_definition[bid]['kind'] and b.get('sleeping') is False, 'body kind/sleeping')
                for key in ['positionM', 'velocityMps', 'angularVelocityRadps']:
                    vector(b.get(key))
                orientation = vector(b.get('orientationXYZW'), 4)
                if b['kind'] == 'dynamic':
                    for x in vector(b['angularVelocityRadps']):
                        gate('omegaRadps', x)
                    for x, expected in zip(orientation, [0, 0, 0, 1]):
                        gate('orientationComponent', x - expected)
                    for axis in [0, 2]:
                        gate('lateralPositionM', q(b['positionM'][axis]))
                        gate('lateralVelocityMps', q(b['velocityMps'][axis]))
                elif index:
                    require(raw_body(b) == raw_body(maps[0][bid]), 'static raw words retained')
            require(type(state.get('contacts')) is list and len(state['contacts']) <= 1, 'single eligible contact pair')
            maps.append(bs)
        require(states[0]['contacts'] == [], 'noncontact initial state')
        for bid, definition in by_definition.items():
            b = maps[0][bid]
            require(vector(b['positionM']) == vector(definition['initial']['positionM']), 'actual initial position')
            require(vector(b['velocityMps']) == vector(definition['initial'].get('velocityMps', [0, 0, 0])), 'actual initial velocity')
            require(vector(b['angularVelocityRadps']) == [0, 0, 0], 'actual initial spin')
        masses = {b['id']: q(b['massKg']) for b in dynamics}
        inertia = {bid: mass / 6 for bid, mass in masses.items()}
        first_contact, last_contact, contact_steps, anchor = None, None, 0, None
        cumulative_projection = Fraction(0)
        initial_gap = Fraction(1, 4) if case == 'gravity-fall' else Fraction(1, 8)
        for index in range(1, len(states)):
            current_step = index
            before, after = maps[index - 1], maps[index]
            contacts = states[index]['contacts']
            t = index * h
            free_v = {bid: add(vector(before[bid]['velocityMps']), scale(gravity, h)) for bid in masses}
            free_p = {bid: add(vector(before[bid]['positionM']), scale(free_v[bid], h)) for bid in masses}
            impulses = {bid: [Fraction(0)] * 3 for bid in ids}
            torques = {bid: [Fraction(0)] * 3 for bid in ids}
            for c in contacts:
                a, b = c.get('bodyAId'), c.get('bodyBId')
                require(a in before and b in before and a != b, 'actual contact endpoints')
                require(c.get('colliderAId') == by_collider[a]['id'] and c.get('colliderBId') == by_collider[b]['id'], 'contact collider provenance')
                normal, point, tangent = vector(c.get('normalAtoB')), vector(c.get('pointM')), vector(c.get('tangentImpulseOnBNs'))
                lam = q(c.get('normalImpulseNs'))
                require(lam >= 0 and 0 <= q(c.get('penetrationM')) <= 10, 'contact impulse/penetration bounds')
                gate('unitNormalSquared', dot(normal, normal) - 1)
                gate('verticalNormal', abs(normal[1]) - 1)
                for axis in [0, 2]:
                    gate('verticalNormal', normal[axis])
                for x in tangent:
                    gate('tangentImpulseNs', x, TANGENT_GATE)
                on_b = add(scale(normal, lam), tangent)
                for bid, applied in [(a, scale(on_b, -1)), (b, on_b)]:
                    impulses[bid] = add(impulses[bid], applied)
                    torques[bid] = add(torques[bid], cross(sub(point, vector(after[bid]['positionM'])), applied))
                va = free_v.get(a, [Fraction(0)] * 3)
                vb = free_v.get(b, [Fraction(0)] * 3)
                relative = dot(sub(vb, va), normal)
                closing = max(Fraction(0), -relative)
                effective_e = min(materials) if closing > Fraction(1, 2) else Fraction(0)
                inverse_mass = sum((1 / masses[bid] for bid in [a, b] if bid in masses), Fraction(0))
                reduced = 1 / inverse_mass
                expected_impulse = (1 + effective_e) * reduced * closing
                gate('normalImpulseNs', lam - expected_impulse)
                outgoing = dot(sub(vector(after[b]['velocityMps']), vector(after[a]['velocityMps'])), normal)
                gate('newtonRelativeVelocityMps', outgoing - effective_e * closing)
                free_ke = sum((masses[bid] * dot(free_v[bid], free_v[bid]) / 2 for bid in masses), Fraction(0))
                after_ke = sum((masses[bid] * dot(vector(after[bid]['velocityMps']), vector(after[bid]['velocityMps'])) / 2 +
                                inertia[bid] * dot(vector(after[bid]['angularVelocityRadps']), vector(after[bid]['angularVelocityRadps'])) / 2 for bid in masses), Fraction(0))
                loss = (1 - effective_e**2) * reduced * closing**2 / 2
                gate('contactKineticEnergyJ', after_ke - free_ke + loss)
            if contacts:
                contact_steps += 1
                last_contact = index
                if first_contact is None:
                    first_contact, anchor = index, after
                    require(index > 1, 'actual delayed first contact required')
                if case == 'delayed-pair' and index != first_contact:
                    gate('unexpectedRepeatedPairContact', Fraction(1), Fraction(0))
            for bid, mass in masses.items():
                gate('bodyMomentumNs', max(abs(x) for x in sub(scale(sub(vector(after[bid]['velocityMps']), vector(before[bid]['velocityMps'])), mass),
                                                              add(scale(gravity, mass*h), impulses[bid]))))
                spin_delta = scale(sub(vector(after[bid]['angularVelocityRadps']), vector(before[bid]['angularVelocityRadps'])), inertia[bid])
                for x in sub(spin_delta, torques[bid]):
                    gate('bodyAngularMomentumNms', x)
                projection_work = -mass * dot(gravity, sub(vector(after[bid]['positionM']), free_p[bid]))
                cumulative_projection += projection_work
                maxima['maxProjectionPotentialWorkJ'] = max(maxima.get('maxProjectionPotentialWorkJ', Fraction(0)), abs(projection_work))
                # Independent constant-acceleration closed form until any contact.
                if first_contact is None:
                    p0, v0 = vector(maps[0][bid]['positionM']), vector(maps[0][bid]['velocityMps'])
                    kick_drift = add(add(p0, scale(v0, t)), scale(gravity, h*h*index*(index+1)/2))
                    expected_v = add(v0, scale(gravity, t))
                    for x in sub(vector(after[bid]['positionM']), kick_drift):
                        gate('freeClosedFormPositionM', x)
                    for x in sub(vector(after[bid]['velocityMps']), expected_v):
                        gate('freeClosedFormVelocityMps', x, VELOCITY_GATE if ballistic else GATE)
                elif case == 'delayed-pair' and not contacts:
                    elapsed = (index - first_contact) * h
                    expected = add(vector(anchor[bid]['positionM']), scale(vector(anchor[bid]['velocityMps']), elapsed))
                    for x in sub(vector(after[bid]['positionM']), expected):
                        gate('postImpactLinearPositionM', x)
            if not ballistic:
                if case == 'gravity-fall':
                    gap = q(after[moving['id']]['positionM'][1]) - Fraction(1, 2)
                else:
                    gap = q(after[upper['id']]['positionM'][1]) - q(after[lower['id']]['positionM'][1]) - 1
                gate('negativeSurfaceGapM', max(Fraction(0), -gap))
                if contacts or case == 'gravity-fall' and first_contact is not None:
                    gate('contactSurfaceGapM', gap)
                if case == 'gravity-fall' and first_contact is not None:
                    for x in vector(after[moving['id']]['velocityMps']):
                        gate('supportedVelocityMps', x)
        certificate.update({'caseId': case, 'receivedStates': len(states), 'receivedTransitions': len(states)-1,
                            'firstContactStep': first_contact, 'lastContactStep': last_contact,
                            'contactSteps': contact_steps, 'candidateOracle': 'NONE'})
        maxima['projectionPotentialWorkSumJ'] = cumulative_projection
        if ballistic:
            require(first_contact is None, 'isolated ballistic case must have no contact')
            bid = dynamics[0]['id']
            t = CASES[case] * h
            p0, v0 = vector(maps[0][bid]['positionM']), vector(maps[0][bid]['velocityMps'])
            continuous_p = add(add(p0, scale(v0, t)), scale(gravity, t*t/2))
            continuous_v = add(v0, scale(gravity, t))
            position_error = q(maps[-1][bid]['positionM'][1]) - continuous_p[1]
            gate('continuousVelocityMps', q(maps[-1][bid]['velocityMps'][1])-continuous_v[1], VELOCITY_GATE)
            gate('continuousPositionAdmissionM', position_error, q(.083))
            if abs(position_error) == q(.083) and len(violations) < 32:
                violations.append({'gate': 'continuousPositionAdmissionM', 'stepIndex': CASES[case],
                                   'residual': reported(abs(position_error)), 'limit': .083, 'strictLess': True})
            actual_energy = masses[bid] * dot(vector(maps[-1][bid]['velocityMps']), vector(maps[-1][bid]['velocityMps'])) / 2 - masses[bid] * dot(gravity, vector(maps[-1][bid]['positionM']))
            initial_energy = masses[bid] * dot(v0, v0) / 2 - masses[bid] * dot(gravity, p0)
            energy_error = actual_energy - initial_energy
            expected_defect = -masses[bid] * dot(gravity, gravity) * t * h / 2
            gate('energyDefectRoundoffJ', energy_error-expected_defect)
            maxima.update({'continuousPositionErrorM': abs(position_error), 'continuousEnergyErrorJ': abs(energy_error),
                           'signedContinuousEnergyErrorJ': energy_error, 'analyticFirstOrderEnergyDefectJ': expected_defect})
            certificate['continuousEnergyConservedByIntegrator'] = False
        else:
            require(first_contact is not None, 'actual contact required')
            n = first_contact
            lo, hi = max(Fraction(0), (n-1)*h), (n+1)*h
            if case == 'gravity-fall':
                squared_time = 2 * initial_gap / -gravity[1]
                require(lo*lo <= squared_time <= hi*hi, 'continuous fall TOI outside h-scale discrete bracket')
                analytic_time = math.sqrt(float(squared_time))
            else:
                exact_time = initial_gap / 2
                require((n-1)*h <= exact_time <= n*h, 'pair TOI outside first-contact sample interval')
                analytic_time = float(exact_time)
            certificate['contactTime'] = {'continuousSeconds': analytic_time,
                'actualFirstContactSampleSeconds': float(n*h),
                'discreteSampleIntervalSeconds': [float((n-1)*h), float(n*h)],
                'gravityIntegratorComparisonBracketSeconds': [float(lo), float(hi)],
                'meaning': 'Discrete end-step event, not exact continuous TOI or remainder integration'}
        return result(not violations, violations, metric_values(), certificate)
    except (Invalid, KeyError, TypeError, ValueError, OverflowError, ZeroDivisionError, IndexError) as error:
        return result(False, [{'input': str(error)[:512]}], metric_values(), certificate, True)


def convergence(replies):
    """Three actual independent ballistic receipts; no simulated or inferred states."""
    require(type(replies) is list and len(replies) == 3, 'three ballistic receipts')
    require(all(type(r) is dict and r.get('ok') is True and r.get('resolved') is True and r.get('executionFailure') is False for r in replies), 'passing actual ballistic receipts')
    require([r['certificates']['caseId'] for r in replies] == ['ballistic-60', 'ballistic-120', 'ballistic-240'], 'ballistic receipt order')
    ratios, violations = {}, []
    for metric in ['continuousPositionErrorM', 'continuousEnergyErrorJ']:
        errors = [q(r['metrics'][metric]) for r in replies]
        require(all(x > 0 for x in errors), 'nonzero actual ballistic error')
        values = [errors[i]/errors[i+1] for i in range(2)]
        ratios[metric] = [float(x) for x in values]
        for value in values:
            if not q(1.99) <= value <= q(2.01):
                violations.append({'gate': 'firstOrderRatio', 'metric': metric, 'ratio': float(value), 'interval': [1.99, 2.01]})
    return result(not violations, violations, {'ratios': ratios}, {'actualBallisticReceipts': 3, 'order': 1})


def reject_duplicates(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, 'duplicate JSON key')
        out[key] = value
    return out


def main():
    total, requests = 0, 0
    while True:
        line = sys.stdin.buffer.readline(LINE_BYTES + 1)
        if not line:
            return
        total += len(line)
        requests += 1
        try:
            require(len(line) <= LINE_BYTES and line.endswith(b'\n'), '2MiB complete JSONL request')
            require(total <= GRAPH_BYTES and requests <= 8, '16MiB/8 request graph bound')
            envelope = json.loads(line, object_pairs_hook=reject_duplicates,
                                  parse_constant=lambda _: (_ for _ in ()).throw(Invalid('JSON nonfinite')))
            require(type(envelope) is dict, 'request envelope')
            if envelope.get('format') == 'dynamic-next-convergence-v1':
                require(set(envelope) == {'format', 'replies'}, 'convergence envelope fields')
                reply = convergence(envelope['replies'])
            else:
                require(set(envelope) == {'format', 'data', 'numericWordsF64leHex'} and envelope['format'] == 'dynamic-next-case-v1', 'case envelope fields')
                restored = restore_words(envelope['data'], envelope['numericWordsF64leHex'])
                reply = verify(restored)
        except (Invalid, KeyError, TypeError, ValueError, OverflowError, RecursionError) as error:
            reply = result(False, [{'input': str(error)[:512]}], execution_failure=True)
        encoded = json.dumps(reply, allow_nan=False, separators=(',', ':')) + '\n'
        require(len(encoded.encode()) <= 65536, 'bounded oracle reply')
        sys.stdout.write(encoded)
        sys.stdout.flush()
        if total > GRAPH_BYTES or requests >= 8 or len(line) > LINE_BYTES or not line.endswith(b'\n'):
            return


if __name__ == '__main__':
    main()
