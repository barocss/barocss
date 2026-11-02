"""Independent exact-rational Newton/momentum audit of represented public input/output.

This does not import the JS candidate, its Jacobian, manifold or iteration order.
Scope: equal unit cubes, centered principal-axis impact; zero friction/gravity.
"""
import json
import struct
import sys
from fractions import Fraction as F
from pathlib import Path


def decode(x):
    if isinstance(x, dict):
        if '$f64le' in x:
            return F.from_float(struct.unpack('<d', bytes.fromhex(x['$f64le']))[0])
        return {k: decode(v) for k, v in x.items()}
    if isinstance(x, list):
        return [decode(v) for v in x]
    if isinstance(x, float):
        return F.from_float(x)
    return x


def audit(directory):
    frozen = json.loads((directory / 'frozen-inputs.json').read_text())
    maxima = dict(velocity=F(0), omega=F(0), impulse=F(0), energy=F(0), momentum=F(0), angular=F(0), tangent=F(0), gap=F(0))
    gates = {k: F('1e-12') if k == 'tangent' else F('1e-10') for k in maxima}
    results = []

    def gate(key, residual):
        residual = abs(residual)
        maxima[key] = max(maxima[key], residual)
        assert residual <= gates[key], (key, float(residual), float(gates[key]))

    for graph in ['source', 'native']:
        for case in frozen['cases']:
            path = directory / (graph + '-' + case['id'] + '.json')
            data = decode(json.loads(path.read_text()))
            inp, before, after = data['input'], data['before'], data['after']
            model = inp['model']
            assert all(g == 0 for g in model['gravityMps2'])
            a_id, b_id = inp['fixed'], inp['moving']
            initial = {b['id']: b for b in before['bodies']}
            final = {b['id']: b for b in after['bodies']}
            bodies = {b['id']: b for b in model['bodies']}
            colliders = {c['bodyId']: c for c in model['colliders']}
            for c in colliders.values():
                assert c['material']['friction'] == {'static': 0, 'dynamic': 0}
            axis = max(range(3), key=lambda i: abs(initial[b_id]['positionM'][i] - initial[a_id]['positionM'][i]))
            u_a, u_b = initial[a_id]['velocityMps'][axis], initial[b_id]['velocityMps'][axis]
            closing = u_a - u_b
            e = min(colliders[a_id]['material']['restitution'], colliders[b_id]['material']['restitution']) if closing > F(1, 2) else F(0)
            m_b = bodies[b_id]['massKg']
            dynamic_pair = bodies[a_id]['kind'] == 'dynamic'
            if closing <= 0:
                v_a, v_b = u_a, u_b
            elif dynamic_pair:
                m_a = bodies[a_id]['massKg']
                # Solve two physical constraints: conserved P and relative Newton velocity.
                p = m_a * u_a + m_b * u_b
                separation = e * closing
                v_a = (p - m_b * separation) / (m_a + m_b)
                v_b = v_a + separation
            else:
                v_a, v_b = F(0), e * closing
            expected_j = m_b * (v_b - u_b)
            actual_j = sum((c['normalImpulseNs'] for c in after['contacts']), F(0))
            gate('impulse', actual_j - expected_j)
            for c in after['contacts']:
                for t in c['tangentImpulseOnBNs']:
                    gate('tangent', t)
            for body_id, speed in [(a_id, v_a), (b_id, v_b)]:
                for i in range(3):
                    gate('velocity', final[body_id]['velocityMps'][i] - (speed if i == axis else 0))
                    gate('omega', final[body_id]['angularVelocityRadps'][i])
            expected_energy = F(0)
            actual_energy = F(0)
            p_before, p_after = F(0), F(0)
            for body_id, speed in [(a_id, v_a), (b_id, v_b)]:
                if bodies[body_id]['kind'] != 'dynamic':
                    continue
                mass = bodies[body_id]['massKg']
                expected_energy += mass * speed * speed / 2
                # Unit homogeneous cube I=m/6, independently from geometry.
                actual_energy += mass * sum(v*v for v in final[body_id]['velocityMps']) / 2
                actual_energy += mass * sum(w*w for w in final[body_id]['angularVelocityRadps']) / 12
                p_before += mass * initial[body_id]['velocityMps'][axis]
                p_after += mass * final[body_id]['velocityMps'][axis]
                for i in range(3):
                    j, k = (i+1) % 3, (i+2) % 3
                    def angular(state):
                        b = state[body_id]
                        return mass * (b['positionM'][j]*b['velocityMps'][k] - b['positionM'][k]*b['velocityMps'][j]) + mass * b['angularVelocityRadps'][i] / 6
                    gate('angular', angular(final) - angular(initial))
            gate('energy', actual_energy - expected_energy)
            gate('momentum', p_after - p_before - (0 if dynamic_pair else expected_j))
            expected_gap = max(F(0), -closing * inp['options']['fixedStepSeconds'])
            gate('gap', final[b_id]['positionM'][axis] - final[a_id]['positionM'][axis] - 1 - expected_gap)
            if closing > F(1, 2) and e > 0:
                assert final[b_id]['velocityMps'][axis] - final[a_id]['velocityMps'][axis] > 0
            results.append({'graph': graph, 'id': case['id'], 'eExact': str(e), 'outgoingExact': [str(v_a), str(v_b)], 'impulseExact': str(expected_j)})
    return {'status': 'PASS_INDEPENDENT_NEWTON_MOMENTUM', 'audits': len(results), 'maxima': {k: float(v) for k,v in maxima.items()}, 'cases': results, 'candidateCalls': 0, 'WorldCalls': 0}


if __name__ == '__main__':
    directory = Path(sys.argv[1])
    try:
        report = audit(directory)
    except Exception as error:
        report = {'status': 'FAIL_INDEPENDENT_NEWTON_MOMENTUM', 'firstFailure': repr(error)}
    output = directory / 'independent-reference.json'
    with output.open('x') as file:
        json.dump(report, file, indent=2)
        file.write('\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'cases'}))
    sys.exit(0 if report['status'].startswith('PASS_') else 1)
