"""Independent exact geometry audit and DATA-only transformed validated targets."""
import argparse
import json
import struct
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OPS = 0


def calc(op, a, b):
    global OPS
    OPS += 1
    assert OPS <= 100000, 'Fraction operation cap'
    if op == '+':
        return a + b
    if op == '-':
        return a - b
    if op == '*':
        return a * b
    return a / b


def add(a, b):
    return calc('+', a, b)


def sub(a, b):
    return calc('-', a, b)


def mul(a, b):
    return calc('*', a, b)


def div(a, b):
    return calc('/', a, b)


def total(values):
    result = Fraction(0)
    for value in values:
        result = add(result, value)
    return result


def power(value, exponent):
    result = Fraction(1)
    for _ in range(exponent):
        result = mul(result, value)
    return result


def absolute(value):
    global OPS
    OPS += 1
    assert OPS <= 100000, 'Fraction operation cap'
    return abs(value)


def decode(value):
    if isinstance(value, dict):
        if set(value) == {'$f64le'}:
            raw = bytes.fromhex(value['$f64le'])
            assert len(raw) == 8
            return Fraction.from_float(struct.unpack('<d', raw)[0])
        return {key: decode(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode(item) for item in value]
    assert not isinstance(value, float), 'unencoded native scalar'
    return value


def load(path, limit):
    assert path.stat().st_size <= limit
    return json.loads(path.read_text(), parse_float=lambda _: (_ for _ in ()).throw(ValueError('float JSON')))


def object_bound(*roots):
    seen = set()
    charged = 0

    def visit(value, depth=0):
        nonlocal charged
        assert depth <= 32
        if isinstance(value, (list, dict)):
            identity = id(value)
            if identity in seen:
                return
            seen.add(identity)
            assert len(seen) <= 8192
            charged += 64 + 16 * len(value)
            for key, item in (value.items() if isinstance(value, dict) else enumerate(value)):
                if isinstance(key, str):
                    charged += 2 * len(key)
                visit(item, depth + 1)
        elif isinstance(value, Fraction):
            charged += 64 + (value.numerator.bit_length() + value.denominator.bit_length() + 7) // 8
        elif isinstance(value, str):
            charged += 32 + 2 * len(value)
        else:
            charged += 16
        assert charged <= 8 * 1048576

    for root in roots:
        visit(root)
    return {'uniqueObjects': len(seen), 'logicalBytes': charged}


def rotation(q):
    x, y, z, w = q
    squared = total(mul(v, v) for v in q)
    assert squared > 0
    # Homogeneous quaternion geometry, independent of producer normalization.
    xx, yy, zz = mul(x, x), mul(y, y), mul(z, z)
    xy, xz, yz, xw, yw, zw = [mul(a, b) for a, b in [(x,y),(x,z),(y,z),(x,w),(y,w),(z,w)]]
    two = lambda v: div(mul(2, v), squared)
    r = [[sub(1,two(add(yy,zz))),two(sub(xy,zw)),two(add(xz,yw))],
         [two(add(xy,zw)),sub(1,two(add(xx,zz))),two(sub(yz,xw))],
         [two(sub(xz,yw)),two(add(yz,xw)),sub(1,two(add(xx,yy)))]]
    for i in range(3):
        for j in range(3):
            assert total(mul(r[k][i], r[k][j]) for k in range(3)) == (1 if i == j else 0)
    determinant = total(mul(r[0][i], sub(mul(r[1][(i+1)%3],r[2][(i+2)%3]),
                                              mul(r[1][(i+2)%3],r[2][(i+1)%3]))) for i in range(3))
    assert determinant == 1
    return r, squared


def integral_inertia(pair):
    half = pair['model']['colliders'][0]['geometry']['halfExtentsM']
    mass = pair['model']['bodies'][0]['massKg']
    moments = [[div(sub(power(h,n+1), power(sub(0,h),n+1)), n+1) for n in range(3)] for h in half]
    volume = mul(mul(moments[0][0], moments[1][0]), moments[2][0])
    density = div(mass, volume)
    assert mul(density, volume) == mass
    for axis in range(3):
        assert moments[axis][1] == 0
    inertia = []
    for axis in range(3):
        integrals = []
        for coordinate in range(3):
            if coordinate != axis:
                integrals.append(mul(density, mul(mul(moments[0][2 if coordinate == 0 else 0],
                                                      moments[1][2 if coordinate == 1 else 0]),
                                                  moments[2][2 if coordinate == 2 else 0])))
        inertia.append(total(integrals))
    return inertia


def physical(body, inertia):
    r, squared = rotation(body['orientationXYZW'])
    omega = body['angularVelocityRadps']
    local = [total(mul(r[j][i],omega[j]) for j in range(3)) for i in range(3)]
    momentum = [mul(inertia[i],local[i]) for i in range(3)]
    world_l = [total(mul(r[i][j],momentum[j]) for j in range(3)) for i in range(3)]
    energy = div(total(mul(local[i],momentum[i]) for i in range(3)),2)
    return r, squared, world_l, energy


def interval(item):
    return tuple(Fraction(int(item[key]['numerator']),int(item[key]['denominator'])) for key in ['lo','hi'])


def signed(value, sign):
    assert sign in [-1,1]
    return value if sign == 1 else (sub(0,value[1]),sub(0,value[0]))


def targets(bank, case):
    values = bank['values']
    r = [[interval(item) for item in row] for row in values['R']]
    omega = [interval(item) for item in values['omega']]
    q = [interval(item) for item in values['q']]
    perm = [int(i) for i in case['bodyPermutation']]
    assert perm in [[0,1,2],[1,2,0],[2,0,1]]
    r = [[r[i][j] for j in perm] for i in perm]
    omega = [omega[i] for i in perm]
    q = [q[i] for i in perm] + [q[3]]
    signs = [int(i) for i in case['worldSigns']]
    assert signs in [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]]
    r = [[signed(value,signs[i]) for value in row] for i,row in enumerate(r)]
    omega = [signed(value,signs[i]) for i,value in enumerate(omega)]
    axis = case['worldHalfTurnAxis']
    if axis is not None:
        axis = int(axis)
        maps = [[(3,1),(2,-1),(1,1),(0,-1)],
                [(2,1),(3,1),(0,-1),(1,-1)],
                [(1,-1),(0,1),(3,1),(2,-1)]]
        q = [signed(q[i],sign) for i,sign in maps[axis]]
    q = [signed(value,int(case['quatSign'])) for value in q]
    return {'R': [item for row in r for item in row], 'omega':omega, 'q':q}


def display(value):
    return {'decimal': format(float(value), '.17g'), 'numerator':str(value.numerator),
            'denominator':str(value.denominator)}


def audit(packet):
    pair = decode(packet['inputRaw'])
    case = decode(packet['case'])
    before, after = decode(packet['beforeRaw']), decode(packet['afterRaw'])
    assert before['stepIndex'] == 0 and after['stepIndex'] == 1
    assert before['timeSeconds'] == 0 and after['timeSeconds'] == pair['options']['fixedStepSeconds']
    assert len(before['bodies']) == len(after['bodies']) == 1
    for state in [before,after]:
        for key in ['contacts','joints','ccdHits','cloths','fluids','events']:
            assert state[key] == []
    initial = before['bodies'][0]
    final = after['bodies'][0]
    for body in [initial, final]:
        assert body['positionM'] == body['velocityMps'] == [0,0,0]
    # These radial authored inputs normalize to exactly the declared proper frame.
    expected_q = [0,0,0,int(case['quatSign'])]
    if case['worldHalfTurnAxis'] is not None:
        expected_q = [0,0,0,0]
        expected_q[int(case['worldHalfTurnAxis'])] = 1
    assert initial['orientationXYZW'] == expected_q
    assert initial['angularVelocityRadps'] == case['omegaWorldRadps']
    inertia = integral_inertia(pair)
    r0,s0,l0,e0 = physical(initial,inertia)
    r1,s1,l1,e1 = physical(final,inertia)
    l_errors = [absolute(sub(a,b)) for a,b in zip(l1,l0)]
    e_error = absolute(sub(e1,e0))
    abs_gate, rel_gate = Fraction(1,10**12), Fraction(1,10**12)
    for residual, prior, current in zip(l_errors,l0,l1):
        assert residual <= add(abs_gate,mul(rel_gate,max(1,absolute(prior),absolute(current)))), 'angular momentum'
    assert e_error <= add(abs_gate,mul(rel_gate,max(1,absolute(e0),absolute(e1)))), 'energy'
    assert absolute(sub(s0,1)) <= abs_gate and absolute(sub(s1,1)) <= abs_gate, 'quaternion squared norm'
    errors = {'worldL':max(l_errors),'energy':e_error,'qSquaredNorm':max(absolute(sub(s0,1)),absolute(sub(s1,1))),
              'R':Fraction(0),'omega':Fraction(0),'q':Fraction(0)}
    actual = {'R':[v for row in r1 for v in row], 'omega':final['angularVelocityRadps'],
              'q':final['orientationXYZW']}
    prior_targets = None
    resources = object_bound(packet,pair,case,before,after,inertia,r0,r1,l0,l1)
    for precision in [80,120]:
        path = ROOT / 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-trajectory-01-reference-rows' / f'bank-{precision}-02.json'
        bank = load(path,32768)
        assert bank['certificate']['window'] == 2
        assert bank['certificate']['order'] == 32 and bank['certificate']['completeResidualDegree'] == 64
        target = targets(bank,case)
        for kind, points in target.items():
            for index,(low,high) in enumerate(points):
                assert low <= high and sub(high,low) <= Fraction(1,10**24)
                if prior_targets:
                    a,b = prior_targets[kind][index]
                    assert max(a,low) <= min(b,high), 'precision enclosure intersection'
                for endpoint in [low,high]:
                    residual = absolute(sub(actual[kind][index],endpoint))
                    bound = add(Fraction(1,10**11),mul(Fraction(1,10**12),absolute(endpoint)))
                    assert residual <= bound, kind + ' trajectory'
                    errors[kind] = max(errors[kind],residual)
        resources = {key:max(resources[key],value) for key,value in object_bound(packet,pair,case,before,after,
                          inertia,r0,r1,l0,l1,bank,target,prior_targets,actual,errors).items()}
        prior_targets = target
    return {'status':'PASS_G1C_FRAME_AUDIT','id':packet['id'],'graph':packet['graph'],
            'errors':{key:display(value) for key,value in errors.items()},'inertiaKgM2':[display(v) for v in inertia],
            'fractionOperations':OPS,'newMonomialIntegrals':9,'newODEWindows':0,'decimalOperations':0,'sqrtOrTrigCalls':0,
            'resources':resources,'scope':'ONE_STEP_FINITE_TRANSFORMED_VALIDATED_TARGETS_ONLY'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    packet = load(args.input,65536)
    try:
        result = audit(packet)
    except Exception as error:
        result = {'status':'FAIL_G1C_FRAME_AUDIT','id':packet.get('id'),'graph':packet.get('graph'),
                  'firstFailure':{'name':type(error).__name__,'message':str(error)},'fractionOperations':OPS}
    text = json.dumps(result,indent=2)+'\n'
    assert len(text.encode()) <= 65536
    with args.output.open('x') as output:
        output.write(text)
    print(json.dumps({'status':result['status'],'fractionOperations':OPS}))
    if result['status'].startswith('FAIL'):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
