#!/usr/bin/env python3
"""Bounded independent rotation reference. No candidate or World imports.

Study: {pairRaw, commandsRaw, dtBase, seed?: {path, sha256}}.
Numbers in raw inputs use {$f64le: little-endian-hex}. A seed is optional
for other studies; the frozen JT study authenticates and reuses its old bank.
Bank is JSONL: header, 6 targets at precision80, 6 at120, complete footer.
Audit input is JSONL: {study: ...}, then {graph,grid,stepIndex,stateRaw}.
grid is 60,120,240; time is stepIndex*dtBase*60/grid. Accuracy and work
are checked at the six matched times. Norm/L are checked at every frame.
"""
import argparse
import hashlib
import importlib.util
import json
import signal
import sys
import time
from decimal import Decimal
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIB = 1048576


def need(value, message):
    if not value:
        raise ValueError(message)


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


OLD = module('general_old_reference', 'examples/physics-rigid-rotation-g1e-2276/reference-force.py')


class Reference(OLD.Reference):
    def __init__(self):
        super().__init__()
        self.started = time.monotonic()
        self.counts.update(historicalSeedDecimalOperations=0, reusedTaylorWindows=0)
        self.roots['counts'] = self.counts

    def memory(self, *extra):
        """Charge complete retained DATA graph, including tuple and scalar children."""
        seen = set()
        charged = MIB

        def visit(value, depth=0):
            nonlocal charged
            need(depth <= 48, 'retained graph depth48')
            if id(value) in seen:
                return
            seen.add(id(value))
            need(len(seen) + 3072 <= 8192, 'full retained graph8192 objects')
            charged += sys.getsizeof(value)
            if isinstance(value, dict):
                for key, item in value.items():
                    visit(key, depth + 1); visit(item, depth + 1)
            elif isinstance(value, (list, tuple)):
                for item in value:
                    visit(item, depth + 1)
            elif isinstance(value, F):
                self.f.checked(value)
                visit(value.numerator, depth + 1); visit(value.denominator, depth + 1)
            elif isinstance(value, Decimal):
                need(value.is_finite() and len(value.as_tuple().digits) <= 2048, 'retained Decimal bound')
                # Extra charge covers implementation-dependent Decimal coefficient storage.
                charged += len(value.as_tuple().digits)
            elif isinstance(value, int):
                need(value.bit_length() <= 8192, 'retained integer bound')
            else:
                need(value is None or isinstance(value, (str, bytes, bool)), 'retained DATA type')
            need(charged <= 8 * MIB, 'full retained graph8MiB')

        visit(self.roots)
        for value in extra:
            visit(value)
        self.peak_bytes = max(self.peak_bytes, charged)
        self.peak_objects = max(self.peak_objects, len(seen) + 3072)

    def engine(self, precision):
        owner = self
        base = self.micro.Intervals

        class SparseIntervals(base):
            def __init__(inner):
                super().__init__(precision, owner.counts, owner.f)
                inner.cache = {}

            def literal(inner, value):
                if value not in inner.cache:
                    inner.cache[value] = super().literal(value)
                return inner.cache[value]

            def iszero(inner, cell):
                inner.tick()
                if not cell[0].is_zero():
                    return False
                inner.tick()
                return cell[1].is_zero()

            def mul(inner, a, b):
                # A sign-stable product needs only its extremal endpoint pair.
                # All comparisons and arithmetic still enter the old32M ledger.
                zero = Decimal(0)
                if inner.iszero(a) or inner.iszero(b):
                    return inner.literal(0)
                ap, bp = inner.le(zero, a[0]), inner.le(zero, b[0])
                an = False if ap else inner.le(a[1], zero)
                bn = False if bp else inner.le(b[1], zero)
                if ap and bp: low, high = (a[0], b[0]), (a[1], b[1])
                elif an and bn: low, high = (a[1], b[1]), (a[0], b[0])
                elif ap and bn: low, high = (a[1], b[0]), (a[0], b[1])
                elif an and bp: low, high = (a[0], b[1]), (a[1], b[0])
                else:
                    return super().mul(a, b)
                return inner.check(inner.down.multiply(*low)), inner.check(inner.up.multiply(*high))

        result = SparseIntervals()
        self.roots['engineLiterals'] = result.cache
        self.roots['decimalContexts'] = result.report()
        return result

    def canonical_general(self, study):
        need(set(study) in ({'pairRaw','commandsRaw','dtBase'}, {'pairRaw','commandsRaw','dtBase','seed'}), 'study keys')
        pair, commands = self.decode(study['pairRaw']), self.decode(study['commandsRaw'])
        dt = self.decode(study['dtBase'])
        need(isinstance(dt, F) and dt > 0, 'positive dtBase')
        model = pair['model']
        need(model['format'] == 'barocss-physics-model' and model['version'] == 1, 'model identity')
        need(model['frame']['basis'] == 'right-handed-xyz' and model['frame']['rotation'] == 'local-to-world-xyzw', 'rotation convention')
        need(model['units'] == {'length':'m','mass':'kg','time':'s','angle':'rad'}, 'SI units')
        need(model['gravityMps2'] == [0,0,0] and all(model[key] == [] for key in ('joints','cloths','fluids','sourceBindings')), 'isolated zero-gravity rotor')
        need(len(model['bodies']) == len(model['colliders']) == 1, 'one body and one collider')
        body, collider = model['bodies'][0], model['colliders'][0]
        need(body['kind'] == 'dynamic' and body['massKg'] > 0, 'positive dynamic mass')
        need(body['inertia'] == {'kind':'primitive-com','about':'com','frame':'body-local'}, 'native primitive COM inertia')
        need(collider['bodyId'] == body['id'] and collider['geometry']['kind'] == 'box', 'native box reference geometry')
        need(all(h > 0 for h in collider['geometry']['halfExtentsM']), 'positive box dimensions')
        need(collider['local'] == {'positionM':[0,0,0], 'orientationXYZW':[0,0,0,1]}, 'centered aligned primitive')
        initial = body['initial']
        need(initial['positionM'] == initial['velocityMps'] == [0,0,0], 'resting COM')
        need(len(initial['orientationXYZW']) == 4 and len(initial['angularVelocityRadps']) == 3, 'initial rotational shape')
        impulse, torque = [F(0)] * 3, [F(0)] * 3
        for command in commands:
            need(command['bodyId'] == body['id'], 'command body')
            if command['kind'] == 'angularImpulse':
                vector, target = command['angularImpulseNms'], impulse
            else:
                need(command['kind'] == 'torque', 'angular loads only')
                vector, target = command['torqueNm'], torque
            need(len(vector) == 3, 'load vector shape')
            for i in range(3): target[i] = self.f.add(target[i],vector[i])
        self.memory(pair,commands,dt)
        return pair,impulse,torque,dt

    def geometry(self, pair):
        inertia = self.geo.integral_inertia(pair)
        need(all(value > 0 for value in inertia), 'positive integral moments')
        self.counts['geometryCertificates'] += 1
        self.counts['oneDimensionalMonomialMoments'] += 9
        return inertia

    def plant(self, study):
        pair, impulse, torque, dt = self.canonical_general(study)
        inertia = self.geometry(pair)
        body = pair['model']['bodies'][0]
        rotation, norm, l0, e0 = self.geo.physical(body['initial'],inertia)
        local_j = [self.f.dot([rotation[j][i] for j in range(3)],impulse) for i in range(3)]
        local_l = [self.f.add(self.f.mul(inertia[i],self.f.dot([rotation[j][i] for j in range(3)],body['initial']['angularVelocityRadps'])),local_j[i]) for i in range(3)]
        # Reference coordinates need a component bound, not the candidate's
        # Euclidean normalization. This rational scale keeps |p_i|<=1/2
        # without an irrational square root or a needlessly large D=s/I.
        scale = 2 * max(abs(x) for x in local_l) or F(1)
        kick = self.f.add(self.f.dot(body['initial']['angularVelocityRadps'],impulse),self.f.div(self.f.dot(local_j,[self.f.div(local_j[i],inertia[i]) for i in range(3)]),F(2)))
        eplus = self.f.add(e0,kick)
        return {'pair':pair,'J':impulse,'tau':torque,'dt':dt,'inertia':inertia,'R0':rotation,'qNorm0':norm,
                'L0':l0,'E0':e0,'Eplus':eplus,'kickWork':kick,'scale':scale,'workScale':max(F(1),abs(eplus)),
                'start': [self.f.div(x,scale) for x in local_l]+[x for row in rotation for x in row]+[F(0)]}

    def sparse_terms(self, plant, engine):
        diagonal = [self.f.div(plant['scale'],v) for v in plant['inertia']]
        rows = [{} for _ in range(13)]

        def put(row, coefficient, indices):
            indices = tuple(sorted(indices))
            row[indices] = self.f.add(row.get(indices,F(0)),coefficient)

        for i in range(3):
            for j in range(3):
                for k in range(3):
                    sign = self.micro.alternating(i,j,k)
                    if sign: put(rows[i],sign*diagonal[k],(j,k))
            for j in range(3):
                put(rows[i],self.f.div(plant['tau'][j],plant['scale']),(3+3*j+i,))
        for i in range(3):
            for j in range(3):
                for k in range(3):
                    for ell in range(3):
                        sign = -self.micro.alternating(k,j,ell)
                        if sign: put(rows[3+3*i+j],sign*diagonal[ell],(3+3*i+k,ell))
                put(rows[12],self.f.div(self.f.mul(plant['tau'][i],diagonal[j]),plant['workScale']),(3+3*i+j,j))
        return [[(engine.literal(value),indices) for indices,value in row.items() if value] for row in rows]

    def field_coefficient(self, degree, coefficients, terms, engine):
        zero = engine.literal(0)
        result = []
        for row in terms:
            value = zero
            for constant, indices in row:
                if len(indices) == 1:
                    monomial = coefficients[degree][indices[0]] if degree < len(coefficients) else zero
                else:
                    monomial = zero
                    for k in range(max(0,degree-len(coefficients)+1),min(degree,len(coefficients)-1)+1):
                        a,b = coefficients[k][indices[0]],coefficients[degree-k][indices[1]]
                        if not engine.iszero(a) and not engine.iszero(b):
                            monomial = engine.add(monomial,engine.mul(a,b))
                if not engine.iszero(monomial):
                    value = engine.add(value,engine.mul(constant,monomial))
            result.append(value)
        return result

    def window(self, initial, terms, h, engine, ordinal):
        self.counts['taylorWindowsAttempted'] += 1
        need(self.counts['taylorWindowsAttempted'] <= 48, '48 new Taylor windows cap')
        self.counts['decimal'+str(engine.precision)+'Windows'] += 1
        coefficients = [initial]
        scratch = {'initial':initial,'terms':terms,'coefficients':coefficients}
        self.roots['window'] = scratch
        for degree in range(32):
            row = self.field_coefficient(degree,coefficients,terms,engine)
            scratch['current'] = row
            coefficients.append([engine.div(value,engine.literal(degree+1)) for value in row])
            self.memory()
        tube = engine.literal(F(17,16))[1]
        m = lip = Decimal(0)
        for row in terms:
            field = derivative = Decimal(0)
            for constant,indices in row:
                magnitude = engine.absupper(constant)
                term = magnitude
                for _ in indices: term = engine.scalar_mul_up(term,tube)
                field = engine.scalar_add_up(field,term)
                term = engine.scalar_mul_up(magnitude,Decimal(len(indices)))
                for _ in indices[1:]: term = engine.scalar_mul_up(term,tube)
                derivative = engine.scalar_add_up(derivative,term)
            m,lip = engine.select([m,field],True),engine.select([lip,derivative],True)
        hi = engine.literal(h)
        start = engine.select([engine.absupper(cell) for cell in initial],True)
        need(engine.lt(engine.scalar_add_up(start,engine.scalar_mul_up(hi[1],m)),tube), 'Picard convex tube')
        need(engine.lt(engine.scalar_mul_up(hi[1],lip),Decimal('0.125')), 'Picard contraction1/8')
        polynomial_range = self.micro.polynomial_value(coefficients,(Decimal(0),hi[1]),engine)
        scratch['polynomialRange'] = polynomial_range
        need(all(engine.le(engine.absupper(cell),tube) for cell in polynomial_range), 'polynomial inside same tube')
        eta, power = [Decimal(0)] * 13,engine.literal(1)
        scratch['eta'] = eta
        digest = hashlib.sha256()
        for row in coefficients:
            for cell in row:
                for endpoint in cell:
                    chunk = str(endpoint).encode('ascii')
                    digest.update(str(len(chunk)).encode('ascii')+b':'+chunk)
        for degree in range(65):
            values = self.field_coefficient(degree,coefficients,terms,engine)
            residual = [engine.sub(engine.mul(engine.literal(degree+1),coefficients[degree+1][i]),v) if degree < 32 else engine.neg(v) for i,v in enumerate(values)]
            scratch['residual'] = residual
            for i,cell in enumerate(residual):
                eta[i] = engine.scalar_add_up(eta[i],engine.scalar_mul_up(engine.absupper(cell),power[1]))
            power = engine.mul(power,hi)
        defect = engine.select(eta,True)
        error = engine.div(engine.mul((defect,defect),hi),engine.sub(engine.literal(1),engine.mul((lip,lip),hi)))[1]
        endpoint = self.micro.polynomial_value(coefficients,hi,engine)
        # Decimal unary minus would use the global context. copy_negate is exact.
        widened = [engine.add(cell,(error.copy_negate(),error)) for cell in endpoint]
        certificate = {'window':ordinal,'precision':engine.precision,'order':32,'completeResidualDegree':64,
                       'coefficientTreeSha256':digest.hexdigest(),'M':engine.fraction(m),'L':engine.fraction(lip),
                       'defectUpper':engine.fraction(defect),'solutionErrorUpper':engine.fraction(error)}
        scratch.update(endpoint=endpoint,widened=widened,certificate=certificate)
        self.memory(power)
        self.counts['taylorWindowsReturned'] += 1
        del self.roots['window']
        return widened,certificate

    def observable_general(self, state, plant, engine):
        diagonal = [engine.literal(self.f.div(plant['scale'],v)) for v in plant['inertia']]
        # The inherited observable uses matrix geometry and the positive trace
        # quaternion branch. It has a micro-only sqrt16 guard, so do it here.
        rotation = [state[3+3*i:6+3*i] for i in range(3)]
        omega = [engine.literal(0) for _ in range(3)]
        for i in range(3):
            for j in range(3): omega[i] = engine.add(omega[i],engine.mul(rotation[i][j],engine.mul(diagonal[j],state[j])))
        trace = engine.literal(1)
        for i in range(3): trace = engine.add(trace,rotation[i][i])
        qw = engine.div(engine.sqrt(trace),engine.literal(2))
        need(engine.lt(Decimal('0.5'),qw[0]), 'positive trace chart for finite reference horizon')
        denominator = engine.mul(engine.literal(4),qw)
        q = [engine.div(engine.sub(rotation[2][1],rotation[1][2]),denominator),
             engine.div(engine.sub(rotation[0][2],rotation[2][0]),denominator),
             engine.div(engine.sub(rotation[1][0],rotation[0][1]),denominator),qw]
        result = engine.fractions({'R':rotation,'omega':omega,'q':q,'W':[engine.mul(state[12],engine.literal(plant['workScale']))]})
        for _,cell in self.micro.interval_tree_rows(result):
            need(F(0) <= cell['hi']-cell['lo'] <= F(1,10**24), 'observable width1e-24')
        self.memory(state,rotation,omega,q,result)
        return result

    def seed_state(self, study, plant, engine):
        seed = study['seed']
        need(set(seed) == {'path','sha256'}, 'seed keys')
        path = (ROOT / seed['path']).resolve()
        need(path.is_relative_to(ROOT), 'seed repository path')
        need(path.stat().st_size <= MIB, 'seed byte cap')
        raw = path.read_bytes()
        need(hashlib.sha256(raw).hexdigest() == seed['sha256'], 'authenticated old seed hash')
        bank = self.load(path,MIB)
        self.roots['seedScratch'] = {'raw':raw,'bank':bank}
        need(bank['status'] == 'PASS_REFERENCE_BANK' and bank['counts']['taylorWindowsReturned'] == 8, 'historical complete bank')
        matches = [case for case in bank['cases'] if case['id'] == 'JT']
        need(len(matches) == 1, 'one old JT row')
        row = matches[0]
        old_pair,old_j,old_tau,old_dt = self.canonical({key:row[key] for key in ('id','pairRaw','commandsRaw')})
        need(old_pair['model'] == plant['pair']['model'] and old_j == plant['J'] and old_tau == plant['tau'], 'seed physical input binding')
        need(old_dt == plant['dt']/2, 'seed ends after two new windows')
        target = self.unpack(row['targets'][str(engine.precision)])
        self.intersection(self.unpack(row['targets']))
        values = target['values']
        def iv(cell): return engine.literal(cell['lo'])[0],engine.literal(cell['hi'])[1]
        rotation = [[iv(cell) for cell in r] for r in values['R']]
        omega = [iv(cell) for cell in values['omega']]
        momentum = []
        for i in range(3):
            cell = engine.literal(0)
            for j in range(3): cell = engine.add(cell,engine.mul(rotation[j][i],omega[j]))
            momentum.append(engine.mul(engine.literal(self.f.div(plant['inertia'][i],plant['scale'])),cell))
        state = momentum+[x for r in rotation for x in r]+[engine.div(iv(values['W'][0]),engine.literal(plant['workScale']))]
        self.counts['historicalSeedDecimalOperations'] = bank['counts']['decimalOperations']
        self.counts['reusedTaylorWindows'] += 2
        self.memory(raw,bank,target,state)
        del self.roots['seedScratch']
        return state

    def encode_line(self, stream, value):
        raw = self.packet(value)
        need(len(raw) <= 262144, 'bank line256KiB')
        self.memory(value,raw)
        stream.write(raw); stream.flush()

    def build_general(self, study, output):
        plant = self.plant(study)
        self.roots.update(study=study,plant=plant)
        cross = {}
        self.roots['crossPrecisionTargets'] = cross
        with output.open('xb') as stream:
            self.encode_line(stream,{'kind':'header','status':'BUILDING_REFERENCE_BANK','study':study,
                'inertia':plant['inertia'],'L0':plant['L0'],'Eplus':plant['Eplus'],'kickWork':plant['kickWork'],
                'trajectoryAbsolute':F(1,10**11),'trajectoryRelative':F(1,10**12),'normAbsolute':F(1,10**12),
                'invariantAbsolute':F(1,10**12),'invariantRelative':F(1,10**12),'proofScope':'six matched physical times; norms and world momentum at every audited frame'})
            for precision in (80,120):
                engine = self.engine(precision)
                terms = self.sparse_terms(plant,engine)
                state = self.seed_state(study,plant,engine) if 'seed' in study else [engine.literal(v) for v in plant['start']]
                first = 3 if 'seed' in study else 1
                certificates = []
                self.roots['buildScratch'] = {'state':state,'terms':terms,'certificates':certificates}
                for window in range(first,25):
                    state,certificate = self.window(state,terms,self.f.div(plant['dt'],F(4)),engine,window)
                    certificates.append(certificate)
                    self.roots['buildScratch']['state'] = state
                    if window % 4 == 0:
                        ordinal = window//4
                        values = self.observable_general(state,plant,engine)
                        if precision == 80:
                            cross[ordinal] = values
                        else:
                            a = dict(self.micro.interval_tree_rows(cross[ordinal]))
                            b = dict(self.micro.interval_tree_rows(values))
                            need(a.keys() == b.keys(), 'dual precision shape')
                            for key,cell in a.items():
                                need(max(cell['lo'],b[key]['lo']) <= min(cell['hi'],b[key]['hi']), '80/120 intersection '+key)
                            del cross[ordinal]
                        self.encode_line(stream,{'kind':'target','precision':precision,'ordinal':ordinal,
                            'time':plant['dt']*ordinal,'values':values,'certificates':certificates})
                        certificates.clear()
                del self.roots['buildScratch']
            expected = 44 if 'seed' in study else 48
            need(self.counts['taylorWindowsReturned'] == expected and not cross, 'complete frozen reference study')
            result = {'kind':'footer','status':'PASS_REFERENCE_BANK','counts':dict(self.counts),'resources':self.resources()}
            self.encode_line(stream,result)
        return result

    def read_lines(self, path, total_cap=4*MIB):
        need(path.stat().st_size <= total_cap, 'JSONL total byte cap')
        with path.open('rb') as stream:
            for raw in stream:
                need(len(raw) <= 262144 and self.micro.decode_bound(raw) <= 6*MIB, 'bounded JSONL line')
                value = json.loads(raw,object_pairs_hook=self.micro.unique,parse_float=lambda _: (_ for _ in ()).throw(ValueError('bare float')),
                                   parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')))
                self.memory(raw,value)
                yield value

    def audit_general(self, observed, bank_path):
        records = self.read_lines(observed)
        first = next(records)
        need(set(first) == {'study'}, 'audit study header')
        study = first['study']
        plant = self.plant(study)
        self.roots.update(study=study,plant=plant)
        # Retain only80/120 intersections; all supplied frames then share them.
        targets, completed = {},False
        self.roots['auditTargets'] = targets
        lines = self.read_lines(bank_path)
        header = next(lines)
        self.roots['bankHeader'] = header
        need(header['kind'] == 'header' and header['study'] == study, 'bank exact study binding')
        for raw in lines:
            if raw['kind'] == 'footer':
                need(raw['status'] == 'PASS_REFERENCE_BANK' and len(targets) == 6, 'complete reference bank footer')
                completed = True
                continue
            need(not completed and raw['kind'] == 'target', 'bank row ordering')
            ordinal,precision = raw['ordinal'],raw['precision']
            need(1 <= ordinal <= 6 and precision in (80,120), 'target identity')
            values = self.unpack(raw['values'])
            need(self.unpack(raw['time']) == ordinal*plant['dt'], 'target exact physical time')
            if precision == 80:
                need(ordinal not in targets, 'unique80 target')
                targets[ordinal] = {'seen120':False,'values':values}
            else:
                need(ordinal in targets and not targets[ordinal]['seen120'], 'unique ordered120 target')
                left = dict(self.micro.interval_tree_rows(targets[ordinal]['values']))
                for key,cell in self.micro.interval_tree_rows(values):
                    need(key in left, 'matching target coordinate')
                    a = left[key]
                    a['lo'],a['hi'] = max(a['lo'],cell['lo']),min(a['hi'],cell['hi'])
                    need(a['lo'] <= a['hi'], 'authenticated dual precision intersection')
                targets[ordinal]['seen120'] = True
            self.memory(raw,values)
        need(completed and all(row['seen120'] for row in targets.values()), 'complete six dual precision targets')
        result = {'status':'PASS_REFERENCE_AUDIT','physicalStatus':'PASS','firstPhysicalFailure':None,'errors':{},'frames':0,'matchedFrames':0}
        self.roots['auditResult'] = result

        def check(name, actual, expected, row, trajectory=False, norm=False, work=False):
            error = self.f.absolute(self.f.sub(actual,expected))
            if norm: bound = F(1,10**12)
            elif trajectory: bound = F(1,10**11)+F(1,10**12)*abs(expected)
            else: bound = F(1,10**12)+F(1,10**12)*max(F(1),abs(actual),abs(expected))
            location = {'graph':row['graph'],'grid':row['grid'],'stepIndex':row['stepIndex']}
            if name not in result['errors'] or error > result['errors'][name]['measured']:
                result['errors'][name] = {'measured':error,'bound':bound,'location':location}
            if error > bound:
                result['physicalStatus'] = 'PHYSICAL_NO_GO'
                if result['firstPhysicalFailure'] is None:
                    result['firstPhysicalFailure'] = dict(location,quantity=name,observed=actual,expected=expected,measured=error,bound=bound)

        for row in records:
            need(set(row) == {'graph','grid','stepIndex','stateRaw'} and row['graph'] in ('source','native'), 'observed row envelope')
            grid,step = row['grid'],row['stepIndex']
            need(grid in (60,120,240) and type(step) is int and 0 <= step <= grid//10, 'finite grid endpoint')
            state = self.decode(row['stateRaw'])
            need(state['stepIndex'] == step and len(state['bodies']) == 1, 'observed public frame identity')
            body = state['bodies'][0]
            need(body['id'] == plant['pair']['model']['bodies'][0]['id'], 'observed body identity')
            if step == 0:
                initial = plant['pair']['model']['bodies'][0]['initial']
                need(all(body[key] == value for key,value in initial.items()), 'actual initial frame matches study')
            time_value = plant['dt']*F(60*step,grid)
            check('time',state['timeSeconds'],time_value,row,norm=True)
            rotation,norm,l,e = self.geo.physical(body,plant['inertia'])
            result['frames'] += 1
            self.counts['observedStateAudits'] += 1
            check('squaredQNorm',norm,F(1),row,norm=True)
            for i in range(3):
                expected = plant['L0'][i]+(plant['J'][i] if step else 0)+plant['tau'][i]*time_value
                check('worldL',l[i],expected,row)
                check('comPosition',body['positionM'][i],F(0),row,norm=True)
                check('linearMomentum',body['velocityMps'][i],F(0),row,norm=True)
            numerator = step*60
            if step and numerator % grid == 0:
                ordinal = numerator//grid
                values = targets[ordinal]['values']
                q = body['orientationXYZW']
                # q and -q represent the same physical rotation.
                if self.f.dot(q,[(v['lo']+v['hi'])/2 for v in values['q']]) < 0: q = [-v for v in q]
                actual = {'R':rotation,'omega':body['angularVelocityRadps'],'q':q}
                for key,items in actual.items():
                    points = [v for r in items for v in r] if key == 'R' else items
                    cells = [v for r in values[key] for v in r] if key == 'R' else values[key]
                    for point,cell in zip(points,cells):
                        for endpoint in ('lo','hi'): check(key,point,cell[endpoint],row,trajectory=True)
                for endpoint in ('lo','hi'):
                    work = values['W'][0][endpoint]
                    check('continuousWork',e-plant['Eplus'],work,row,work=True)
                    check('energy',e,plant['Eplus']+work,row,work=True)
                result['matchedFrames'] += 1
            self.memory(row,state,rotation,l,result)
        need(result['frames'] > 0 and result['matchedFrames'] > 0, 'nonempty audited trajectory')
        result['counts'],result['resources'] = dict(self.counts),self.resources()
        return result


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--build-bank',action='store_true')
    mode.add_argument('--audit',action='store_true')
    parser.add_argument('--input',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--bank',type=Path)
    args = parser.parse_args()
    reference = None
    def deadline(*_): raise TimeoutError('reference170s deadline inside180s harness')
    signal.signal(signal.SIGALRM,deadline)
    signal.setitimer(signal.ITIMER_REAL,170)
    try:
        need(args.bank is not None if args.audit else args.bank is None, 'bank argument mode')
        reference = Reference()
        if args.build_bank:
            study = reference.load(args.input,65536)
            reference.roots['input'] = study
            result = reference.build_general(study,args.output)
        else:
            result = reference.audit_general(args.input,args.bank)
            reference.write(args.output,result,262144)
        print(json.dumps({'status':result['status'],'physicalStatus':result.get('physicalStatus'),'counts':reference.counts,'resources':reference.resources()}))
        return 0
    except BaseException as error:
        result = {'status':'FAIL_REFERENCE_OPERATION','firstFailure':{'type':type(error).__name__,'message':str(error)[:2048]},'counts':reference.counts if reference else {}}
        failure_path = args.output if not args.output.exists() else args.output.with_suffix(args.output.suffix+'.failure.json')
        if not failure_path.exists():
            with failure_path.open('x') as stream: json.dump(result,stream,separators=(',',':')); stream.write('\n')
        print(json.dumps(result))
        return 1
    finally:
        signal.setitimer(signal.ITIMER_REAL,0)


if __name__ == '__main__':
    sys.exit(main())
