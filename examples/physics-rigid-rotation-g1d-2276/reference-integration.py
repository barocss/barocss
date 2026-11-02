"""Analytic principal-spin and validated general-flow integration audit."""
import argparse
import importlib.util
import json
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
UTILITY = ROOT / 'examples/physics-rigid-rotation-g1c-2276/reference-frame.py'
SPEC = importlib.util.spec_from_file_location('g1_geometry', UTILITY)
geo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(geo)
add, sub, mul, div, absolute = geo.add, geo.sub, geo.mul, geo.div, geo.absolute


def retained_bound(roots):
    # 1 MiB covers bounded parsing/encoding overlap and transient exact-series
    # and monomial scratch. It is part of, not additional to, the 8 MiB cap.
    seen = set()
    charged = 1048576

    def visit(value, depth=0):
        nonlocal charged
        assert depth <= 32
        if isinstance(value,(dict,list,tuple,Fraction,str,Path)):
            identity = id(value)
            if identity in seen:
                return
            seen.add(identity)
            assert len(seen) <= 8192
        if isinstance(value,(dict,list,tuple)):
            charged += 128 + 32*len(value)
            for key,item in (value.items() if isinstance(value,dict) else enumerate(value)):
                if isinstance(key,str):
                    visit(key,depth+1)
                visit(item,depth+1)
        elif isinstance(value,Fraction):
            charged += 128 + (value.numerator.bit_length()+value.denominator.bit_length()+7)//8
        elif isinstance(value,(str,Path)):
            charged += 64 + 4*len(str(value))
        else:
            assert value is None or isinstance(value,(bool,int))
            charged += 32
        assert charged <= 8*1048576

    visit(roots)
    return {'uniqueObjects':len(seen),'logicalBytes':charged,'includedTransientAllowanceBytes':1048576}


def trig_enclosure(angle, cosine):
    """20 terms; alternating series, with exact first omitted-term enclosure."""
    assert 0 <= angle <= Fraction(1,8)
    squared = mul(angle,angle)
    term = Fraction(1) if cosine else angle
    result = Fraction(0)
    for k in range(20):
        result = add(result,term) if k % 2 == 0 else sub(result,term)
        denominator = (2*k+1)*(2*k+2) if cosine else (2*k+2)*(2*k+3)
        next_term = div(mul(term,squared),denominator)
        assert 0 <= next_term <= term
        term = next_term
    # The 21st term has positive sign; successive magnitudes decrease to zero.
    return result, add(result,term)


def negative(interval):
    return sub(0,interval[1]), sub(0,interval[0])


def principal_target(dt, inertia, commands, n):
    assert len(commands) == 2
    impulse = next(command for command in commands if command['kind'] == 'angularImpulse')
    torque = next(command for command in commands if command['kind'] == 'torque')
    assert impulse['bodyId'] == torque['bodyId'] == 'rotor'
    assert impulse['angularImpulseNms'] == [0,0,Fraction(1,64)]
    assert torque['torqueNm'] == [0,0,Fraction(1,8)]
    momentum = add(impulse['angularImpulseNms'][2],mul(dt,torque['torqueNm'][2]))
    omega = div(momentum,inertia[2])
    angle = mul(mul(n,dt),omega)
    sine, cosine = trig_enclosure(angle,False), trig_enclosure(angle,True)
    half = div(angle,2)
    sine_half, cosine_half = trig_enclosure(half,False), trig_enclosure(half,True)
    zero, one = (Fraction(0),Fraction(0)), (Fraction(1),Fraction(1))
    target = {'R':[cosine,negative(sine),zero,sine,cosine,zero,zero,zero,one],
              'omega':[zero,zero,(omega,omega)],'q':[zero,zero,sine_half,cosine_half]}
    return target, [Fraction(0),Fraction(0),momentum], div(mul(momentum,momentum),mul(2,inertia[2]))


def check_target(actual, target, errors):
    for kind, intervals in target.items():
        for index,(low,high) in enumerate(intervals):
            assert low <= high and sub(high,low) <= Fraction(1,10**24), 'reference width'
            for endpoint in [low,high]:
                residual = absolute(sub(actual[kind][index],endpoint))
                bound = add(Fraction(1,10**11),mul(Fraction(1,10**12),absolute(endpoint)))
                assert residual <= bound, kind + ' trajectory'
                errors[kind] = max(errors[kind],residual)


def audit(packet):
    pair = geo.decode(packet['inputRaw'])
    commands = geo.decode(packet['commandsRaw'])
    initial = geo.decode(packet['initialRaw'])
    states = geo.decode(packet['statesRaw'])
    assert packet['id'] in ['kick','recording']
    assert len(commands) == 2 and commands[1] == [], 'commands expire after first step'
    assert len(states) == 2 and len(initial['bodies']) == 1
    assert initial['stepIndex'] == initial['timeSeconds'] == 0
    assert initial['bodies'][0]['orientationXYZW'] == [0,0,0,1]
    expected_omega = [0,0,0] if packet['id'] == 'kick' else [1,1,1]
    assert initial['bodies'][0]['angularVelocityRadps'] == expected_omega
    base_path = ROOT / 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-native-completion-02/input-1.json'
    expected_pair = geo.decode(geo.load(base_path,65536))
    expected_pair['model']['bodies'][0]['initial']['angularVelocityRadps'] = expected_omega
    assert pair == expected_pair, 'exact frozen plant and options'
    assert pair['model']['gravityMps2'] == [0,0,0]
    assert pair['model']['bodies'][0]['massKg'] == 1
    dt = pair['options']['fixedStepSeconds']
    inertia = geo.integral_inertia(pair)
    _,s0,l0,e0 = geo.physical(initial['bodies'][0],inertia)
    assert absolute(sub(s0,1)) <= Fraction(1,10**12)
    errors = {key:Fraction(0) for key in ['worldL','energy','qSquaredNorm','R','omega','q']}
    errors['qSquaredNorm'] = absolute(sub(s0,1))
    endpoint_reports = []
    applied_work = None
    free_drift = None
    resource = retained_bound(locals())
    prior_l = prior_e = None
    for n,state in enumerate(states,1):
        assert state['stepIndex'] == n and state['timeSeconds'] == mul(n,dt)
        assert len(state['bodies']) == 1
        for key in ['contacts','events','joints','ccdHits','cloths','fluids']:
            assert state[key] == []
        body = state['bodies'][0]
        assert body['positionM'] == body['velocityMps'] == [0,0,0]
        r,squared,momentum,energy = geo.physical(body,inertia)
        actual = {'R':[v for row in r for v in row],'omega':body['angularVelocityRadps'],
                  'q':body['orientationXYZW']}
        target = bank = None
        if packet['id'] == 'kick':
            target, expected_l, expected_e = principal_target(dt,inertia,commands[0],n)
            check_target(actual,target,errors)
        else:
            assert commands == [[],[]]
            expected_l, expected_e = l0, e0
            previous = None
            for precision in [80,120]:
                path = ROOT / 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-trajectory-01-reference-rows' / f'bank-{precision}-{2*n:02d}.json'
                bank = geo.load(path,32768)
                assert bank['certificate']['window'] == 2*n
                assert bank['certificate']['order'] == 32 and bank['certificate']['completeResidualDegree'] == 64
                target = {key:[geo.interval(item) for item in value] for key,value in bank['values'].items() if key != 'R'}
                target['R'] = [geo.interval(item) for row in bank['values']['R'] for item in row]
                if previous:
                    for key,values in target.items():
                        for (low,high),(prior_low,prior_high) in zip(values,previous[key]):
                            assert max(low,prior_low) <= min(high,prior_high), 'precision intersection'
                check_target(actual,target,errors)
                charge = retained_bound(locals())
                resource = {key:max(resource[key],value) for key,value in charge.items()}
                previous = target
        for observed,expected in zip(momentum,expected_l):
            residual = absolute(sub(observed,expected))
            bound = add(Fraction(1,10**12),mul(Fraction(1,10**12),max(1,absolute(observed),absolute(expected))))
            assert residual <= bound, 'world angular momentum including applied load'
            errors['worldL'] = max(errors['worldL'],residual)
        e_error = absolute(sub(energy,expected_e))
        e_bound = add(Fraction(1,10**12),mul(Fraction(1,10**12),max(1,absolute(energy),absolute(expected_e))))
        assert e_error <= e_bound, 'kinetic energy after load / free flow'
        errors['energy'] = max(errors['energy'],e_error)
        norm_error = absolute(sub(squared,1))
        assert norm_error <= Fraction(1,10**12)
        errors['qSquaredNorm'] = max(errors['qSquaredNorm'],norm_error)
        if prior_l is not None:
            for now,prior in zip(momentum,prior_l):
                assert absolute(sub(now,prior)) <= add(Fraction(1,10**12),mul(Fraction(1,10**12),max(1,absolute(now),absolute(prior))))
            assert absolute(sub(energy,prior_e)) <= add(Fraction(1,10**12),mul(Fraction(1,10**12),max(1,absolute(energy),absolute(prior_e))))
            free_drift = {'worldLResiduals':[geo.display(absolute(sub(now,prior))) for now,prior in zip(momentum,prior_l)],
                          'energyResidualJ':geo.display(absolute(sub(energy,prior_e)))}
        elif packet['id'] == 'kick':
            expected_work = sub(expected_e,e0)
            observed_work = sub(energy,e0)
            applied_work = {'expectedWorkJ':geo.display(expected_work),'observedWorkJ':geo.display(observed_work),
                            'residualJ':geo.display(absolute(sub(observed_work,expected_work))),
                            'expectedAngularMomentumNms':[geo.display(v) for v in expected_l]}
        prior_l,prior_e = momentum,energy
        endpoint_reports.append({'stepIndex':n,'worldL':[geo.display(v) for v in momentum],
                                 'energyJ':geo.display(energy)})
        charge = retained_bound(locals())
        resource = {key:max(resource[key],value) for key,value in charge.items()}
    return {'status':'PASS_G1D_INTEGRATION_AUDIT','id':packet['id'],'graph':packet['graph'],
            'endpointStateAudits':2,'initialGeometryChecks':1,
            'errors':{key:geo.display(value) for key,value in errors.items()},
            'inertiaKgM2':[geo.display(value) for value in inertia],
            'endpointReports':endpoint_reports,'appliedWork':applied_work,'freeDrift':free_drift,
            'fractionOperations':geo.OPS,'newMonomialIntegrals':9,
            'rationalTrigEnclosures':8 if packet['id']=='kick' else 0,
            'newODEWindows':0,'decimalOperations':0,'sqrtCalls':0,'resources':resource,
            'scope':'PRINCIPAL_KICK_OR_GENERAL_RECORDING_TWO_STEPS_ONLY'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args = parser.parse_args()
    packet = geo.load(args.input,65536)
    try:
        result = audit(packet)
    except Exception as error:
        result = {'status':'FAIL_G1D_INTEGRATION_AUDIT','graph':packet.get('graph'),'id':packet.get('id'),
                  'firstFailure':{'name':type(error).__name__,'message':str(error)},'fractionOperations':geo.OPS}
    text = json.dumps(result,indent=2)+'\n'
    assert len(text.encode()) <= 65536
    with args.output.open('x') as output:
        output.write(text)
    print(json.dumps({'status':result['status'],'fractionOperations':geo.OPS}))
    if result['status'].startswith('FAIL'):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
