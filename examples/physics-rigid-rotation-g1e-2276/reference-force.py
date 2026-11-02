#!/usr/bin/env python3
"""Independent finite forced-rotation bank builder and closed-data auditor."""
import argparse
import hashlib
import importlib.util
import json
import signal
import sys
from decimal import Decimal
from fractions import Fraction as F
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIB = 1048576


def need(value, message):
    if not value:
        raise ValueError(message)


def definitions(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Reference:
    def __init__(self):
        self.micro = definitions('g1e_interval_definitions', 'examples/physics-rigid-rotation-g1b-2276/reference-micro.py')
        self.base = definitions('g1e_fraction_definitions', 'examples/physics-rigid-rotation-g1-2276/baseline-classify.py')
        self.geo = definitions('g1e_geometry_definitions', 'examples/physics-rigid-rotation-g1c-2276/reference-frame.py')
        self.counts = {key: 0 for key in ('decimalOperations', 'decimalConversions', 'decimalToFractionConversions',
            'endpointDecimalSqrtOperations', 'fractionScalarOperations', 'taylorWindowsAttempted', 'taylorWindowsReturned',
            'decimal80Windows', 'decimal120Windows', 'oneDimensionalMonomialMoments', 'geometryCertificates',
            'observedStateAudits', 'WorldCalls', 'candidateCalls', 'PhysicsImports')}
        counts = self.counts
        class Arithmetic(self.base.Arithmetic):
            def operation(inner):
                counts['fractionScalarOperations'] += 1
                need(counts['fractionScalarOperations'] <= 1000000, 'Fraction1M cap')
        self.f = Arithmetic(counts)
        self.geo.calc = lambda op, a, b: {'+': self.f.add, '-': self.f.sub, '*': self.f.mul, '/': self.f.div}[op](F(a), F(b))
        self.geo.absolute = lambda value: self.f.absolute(F(value))
        self.roots, self.peak_bytes, self.peak_objects = {}, 0, 0

    def memory(self, *extra):
        seen, charged = set(), MIB  # Fixed temporary arithmetic/frames/Context allowance, inside 8 MiB.
        def visit(value, depth=0):
            nonlocal charged
            need(depth <= 40, 'owned tree depth')
            if id(value) in seen:
                return
            seen.add(id(value)); need(len(seen) + 3072 <= 8192, '8192 distinct objects including transient reserve')
            if isinstance(value, dict):
                charged += 64 + 32 * len(value)
                for key, child in value.items(): visit(key, depth + 1); visit(child, depth + 1)
            elif isinstance(value, (list, tuple)):
                charged += 64 + 16 * len(value)
                for child in value: visit(child, depth + 1)
            elif isinstance(value, F):
                self.f.checked(value); charged += 96 + (value.numerator.bit_length() + value.denominator.bit_length() + 7) // 8
            elif isinstance(value, Decimal):
                need(value.is_finite() and len(value.as_tuple().digits) <= 2048, 'bounded retained Decimal')
                charged += 384 + len(value.as_tuple().digits)
            elif isinstance(value, (str, bytes)):
                charged += 64 + 4 * len(value)
            elif value is None or isinstance(value, (int, bool)):
                charged += 64
            else:
                raise ValueError('unknown owned DATA type ' + type(value).__name__)
            need(charged <= 8 * MIB, 'full owned reference8MiB cap')
        visit(self.roots)
        for root in extra: visit(root)
        self.peak_bytes = max(self.peak_bytes, charged)
        self.peak_objects = max(self.peak_objects, len(seen) + 3072)

    def load(self, path, cap):
        need(path.stat().st_size <= cap, 'bounded input bytes')
        raw = path.read_bytes()
        need(self.micro.decode_bound(raw) <= 6 * MIB, 'bounded decoder precharge')
        value = json.loads(raw, object_pairs_hook=self.micro.unique,
            parse_float=lambda _: (_ for _ in ()).throw(ValueError('bare floating-point JSON')),
            parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')))
        self.memory(raw, value)
        return value

    def decode(self, value, path=''):
        if type(value) is dict:
            if set(value) == {'$f64le'}: return self.f.checked(self.base.decode_word(value['$f64le']))
            return {key: self.decode(item, path + '/' + key) for key, item in value.items()}
        if type(value) is list:
            return [self.decode(item, path + '/' + str(index)) for index, item in enumerate(value)]
        need(value is None or type(value) in (str, bool) or (type(value) is int and path.endswith('/stepIndex')), 'encoded physical number required ' + path)
        return value

    def packet(self, value):
        return (json.dumps(self.micro.packed(value), separators=(',', ':'), allow_nan=False) + '\n').encode('ascii')

    def write(self, path, result, cap):
        encoded = self.packet(result); need(len(encoded) <= cap, 'bounded result bytes')
        self.memory(result, encoded)
        # A fixed reserve covers the report's changed integer words and final encoding.
        result['resources'] = self.resources()
        result['resources']['peakLogicalBytes'] += 65536
        result['resources']['peakDistinctObjects'] += 64
        result['resources']['reportSerializationReserveBytes'] = 65536
        need(result['resources']['peakLogicalBytes'] <= 8*MIB and result['resources']['peakDistinctObjects'] <= 8192, 'report reserve inside unchanged caps')
        encoded = self.packet(result); need(len(encoded) <= cap, 'bounded final result bytes')
        self.memory(result, encoded)
        need(result['resources']['peakLogicalBytes'] >= self.peak_bytes and result['resources']['peakDistinctObjects'] >= self.peak_objects, 'resource report covers final encoding')
        with path.open('xb') as stream: stream.write(encoded)

    def canonical(self, case):
        need(set(case) == {'id', 'pairRaw', 'commandsRaw'} and case['id'] in ('J', 'JT'), 'exact case envelope')
        pair, commands = self.decode(case['pairRaw']), self.decode(case['commandsRaw'])
        need(set(pair) == {'model', 'options'}, 'exact pair envelope')
        model, options = pair['model'], pair['options']
        need(set(model) == {'format','version','revision','frame','units','gravityMps2','bodies','colliders','joints','cloths','fluids','sourceBindings'}, 'exact model keys')
        need(model['format'] == 'barocss-physics-model' and model['version'] == 1 and type(model['revision']) is str, 'model identity')
        need(set(model['frame']) == {'id','basis','rotation'} and type(model['frame']['id']) is str and model['frame']['basis'] == 'right-handed-xyz' and model['frame']['rotation'] == 'local-to-world-xyzw', 'coordinate convention')
        need(model['units'] == {'length':'m','mass':'kg','time':'s','angle':'rad'} and model['gravityMps2'] == [0,0,0], 'SI zero gravity')
        need(all(model[key] == [] for key in ('joints','cloths','fluids','sourceBindings')) and len(model['bodies']) == len(model['colliders']) == 1, 'isolated rotor')
        body, collider = model['bodies'][0], model['colliders'][0]
        need(set(body) == {'id','kind','massKg','inertia','initial'} and body['id'] == 'rotor' and body['kind'] == 'dynamic' and body['massKg'] == 1, 'literal body')
        need(body['inertia'] == {'kind':'primitive-com','about':'com','frame':'body-local'}, 'primitive COM inertia')
        need(body['initial'] == {'positionM':[0,0,0], 'orientationXYZW':[0,0,0,1], 'velocityMps':[0,0,0], 'angularVelocityRadps':[1,1,1]}, 'literal initial state')
        half = [self.base.decode_word(word) for word in ('9a9999999999b93f','9a9999999999c93f','333333333333d33f')]
        need(set(collider) == {'id','bodyId','geometry','local','material','sensor','ccd','filter'} and type(collider['id']) is str, 'exact collider keys')
        need(collider['bodyId'] == 'rotor' and collider['geometry'] == {'kind':'box','halfExtentsM':half}, 'literal native box')
        need(collider['local'] == {'positionM':[0,0,0], 'orientationXYZW':[0,0,0,1]} and collider['sensor'] is False and collider['ccd'] is False, 'collider frame/flags')
        need(collider['material'] == {'restitution':0,'friction':{'static':0,'dynamic':0}}, 'literal material')
        need(collider['filter'] == {'categoryBits':1,'maskBits':65535}, 'literal collider filter')
        dt = self.base.decode_word('111111111111813f')
        need(options == {'profile':'rigid-discrete-v1','fixedStepSeconds':dt,'broadPhase':'direct'}, 'fixed options')
        impulse, torque = [F(1,1024),F(-1,2048),F(1,4096)], [F(0)] * 3
        expected = [{'kind':'angularImpulse','bodyId':'rotor','angularImpulseNms':impulse}]
        if case['id'] == 'JT':
            torque = [F(1,128),F(-1,256),F(1,512)]
            expected.append({'kind':'torque','bodyId':'rotor','torqueNm':torque})
        need(commands == expected, 'literal ordered one-step commands')
        self.memory(pair, commands)
        return pair, impulse, torque, dt

    def geometry(self, pair):
        inertia = self.geo.integral_inertia(pair)
        need(all(value > 0 for value in inertia) and len(set(inertia)) == 3, 'positive distinct integral moments')
        self.counts['oneDimensionalMonomialMoments'] += 9; self.counts['geometryCertificates'] += 1
        return inertia

    def terms(self, diagonal, torque, engine):
        # Tensor-index equations. A monomial is (directed coefficient, tuple of state indices).
        rows = [[] for _ in range(13)]
        for i in range(3):
            for j in range(3):
                for k in range(3):
                    sign = self.micro.alternating(i,j,k)
                    if sign: rows[i].append((diagonal[k] if sign > 0 else engine.neg(diagonal[k]), (j,k)))
            for j in range(3):
                rows[i].append((engine.literal(self.f.mul(F(16),torque[j])), (3 + 3*j + i,)))
        for i in range(3):
            for j in range(3):
                for k in range(3):
                    for ell in range(3):
                        sign = -self.micro.alternating(k,j,ell)
                        if sign: rows[3+3*i+j].append((diagonal[ell] if sign > 0 else engine.neg(diagonal[ell]), (3+3*i+k,ell)))
                rows[12].append((engine.mul(engine.literal(torque[i]), diagonal[j]), (3+3*i+j,j)))
        return rows

    def field_coefficient(self, degree, coefficients, terms, engine):
        result = []
        for row in terms:
            value = engine.literal(0)
            for constant, indices in row:
                if not indices:
                    monomial = engine.literal(1 if degree == 0 else 0)
                elif len(indices) == 1:
                    monomial = coefficients[degree][indices[0]] if degree < len(coefficients) else engine.literal(0)
                else:
                    monomial = engine.literal(0)
                    for k in range(max(0,degree-len(coefficients)+1), min(degree,len(coefficients)-1)+1):
                        monomial = engine.add(monomial,engine.mul(coefficients[k][indices[0]],coefficients[degree-k][indices[1]]))
                value = engine.add(value,engine.mul(constant,monomial))
            result.append(value)
        return result

    def window(self, initial, diagonal, torque, h, engine, ordinal):
        self.counts['taylorWindowsAttempted'] += 1
        need(self.counts['taylorWindowsAttempted'] <= 8, 'eight windows cap')
        self.counts['decimal'+str(engine.precision)+'Windows'] += 1
        scratch = {'initial':initial}; self.roots['window'] = scratch
        terms = self.terms(diagonal,torque,engine); coefficients = [initial]
        scratch.update(terms=terms,coefficients=coefficients)
        for degree in range(32):
            row = self.field_coefficient(degree,coefficients,terms,engine); scratch['current'] = row
            coefficients.append([engine.div(value,engine.literal(degree+1)) for value in row]); self.memory()
        tube = engine.literal(F(17,16))[1]; M = L = Decimal(0)
        for row in terms:
            field = derivative = Decimal(0)
            for constant, indices in row:
                magnitude = engine.absupper(constant); term = magnitude
                for _ in indices: term = engine.scalar_mul_up(term,tube)
                field = engine.scalar_add_up(field,term)
                if indices:
                    term = engine.scalar_mul_up(magnitude,Decimal(len(indices)))
                    for _ in indices[1:]: term = engine.scalar_mul_up(term,tube)
                    derivative = engine.scalar_add_up(derivative,term)
            M = engine.select([M,field],True); L = engine.select([L,derivative],True)
        need(engine.le(M,Decimal(8)) and engine.le(L,Decimal(16)), 'forced field/Lipschitz caps')
        hi = engine.literal(h); hu = hi[1]
        start = engine.select([engine.absupper(value) for value in initial],True)
        need(engine.lt(engine.scalar_add_up(start,engine.scalar_mul_up(hu,M)),tube) and
             engine.lt(engine.scalar_mul_up(hu,M),engine.literal(F(1,16))[0]) and
             engine.lt(engine.scalar_mul_up(hu,L),engine.literal(F(1,8))[0]), 'Picard tube and contraction')
        polynomial_range = self.micro.polynomial_value(coefficients,(Decimal(0),hu),engine)
        scratch['polynomialRange'] = polynomial_range
        need(all(engine.le(engine.absupper(value),tube) for value in polynomial_range), 'polynomial in convex tube')
        eta = [Decimal(0)] * 13; power = engine.literal(1)
        scratch['eta'] = eta
        digest = hashlib.sha256()
        for row in coefficients:
            for cell in row:
                for endpoint in cell:
                    chunk = str(endpoint).encode('ascii'); digest.update(str(len(chunk)).encode('ascii')+b':'+chunk)
        for degree in range(65):
            value = self.field_coefficient(degree,coefficients,terms,engine)
            value = [engine.sub(engine.mul(engine.literal(degree+1),coefficients[degree+1][i]),v) if degree < 32 else engine.neg(v) for i,v in enumerate(value)]
            scratch['residual'] = value
            for i,cell in enumerate(value): eta[i] = engine.scalar_add_up(eta[i],engine.scalar_mul_up(engine.absupper(cell),power[1]))
            power = engine.mul(power,hi); self.memory(power)
        defect = engine.select(eta,True)
        error = engine.div(engine.mul((defect,defect),hi),engine.sub(engine.literal(1),engine.mul((L,L),hi)))[1]
        endpoint = self.micro.polynomial_value(coefficients,hi,engine); scratch['endpoint'] = endpoint
        widened = [engine.add(value,(engine.neg((error,error))[0],error)) for value in endpoint]
        scratch['widened'] = widened
        certificate = {'window':ordinal,'precision':engine.precision,'order':32,'completeResidualDegree':64,
            'coefficientTreeSha256':digest.hexdigest(),'MperSecond':engine.fraction(M),'LperSecond':engine.fraction(L),
            'tubeComponentBound':F(17,16),'initialAbsoluteUpper':engine.fraction(start),'defectAbsoluteUpper':engine.fraction(defect),
            'solutionErrorUpper':engine.fraction(error),'contexts':engine.report(),
            'proof':'Fixed initial intervals enter C0 and all recurrence coefficients; full degree64 defect gives e<=eta*h/(1-L*h). Work coordinate is W/(1 J).'}
        self.memory(certificate,widened)
        self.counts['taylorWindowsReturned'] += 1
        del self.roots['window']
        return widened,certificate

    def observable(self, state, diagonal, engine):
        scratch = {'state':state,'diagonal':diagonal}; self.roots['observable'] = scratch
        rotation = [state[3+3*i:6+3*i] for i in range(3)]
        omega = []
        for row in rotation:
            value = engine.literal(0)
            for j in range(3): value = engine.add(value,engine.mul(row[j],engine.mul(diagonal[j],state[j])))
            omega.append(value)
        trace = engine.literal(0)
        for i in range(3): trace = engine.add(trace,rotation[i][i])
        qw = engine.div(engine.sqrt(engine.add(engine.literal(1),trace)),engine.literal(2))
        need(self.counts['endpointDecimalSqrtOperations'] <= 16, 'sqrt endpoint16 cap')
        need(engine.lt(Decimal('0.5'),qw[0]), 'continuous positive trace branch')
        denominator = engine.mul(engine.literal(4),qw)
        q = [engine.div(engine.sub(rotation[2][1],rotation[1][2]),denominator),
             engine.div(engine.sub(rotation[0][2],rotation[2][0]),denominator),
             engine.div(engine.sub(rotation[1][0],rotation[0][1]),denominator),qw]
        result = engine.fractions({'R':rotation,'omega':omega,'q':q,'W':[state[12]]})
        scratch.update(rotation=rotation,omega=omega,q=q,result=result)
        for _,cell in self.micro.interval_tree_rows(result):
            need(self.f.le(F(0),self.f.sub(cell['hi'],cell['lo'])) and self.f.le(self.f.sub(cell['hi'],cell['lo']),F(1,10**24)), 'observable width1e-24')
        self.memory(); del self.roots['observable']
        return result

    def build(self, packet):
        need(set(packet) == {'cases'} and type(packet['cases']) is list and [case['id'] for case in packet['cases']] == ['J','JT'], 'exact ordered build envelope')
        bank = {'status':'PASS_REFERENCE_BANK','cases':[]}; self.roots.update(input=packet,bank=bank,counts=self.counts)
        for case in packet['cases']:
            pair,J,tau,dt = self.canonical(case); inertia = self.geometry(pair)
            initial = pair['model']['bodies'][0]['initial']
            r0,_,l0,e0 = self.geo.physical(initial,inertia)
            localJ = [self.f.dot([r0[j][i] for j in range(3)],J) for i in range(3)]
            kick = self.f.add(self.f.dot(initial['angularVelocityRadps'],J),self.f.div(self.f.dot(localJ,[self.f.div(localJ[i],inertia[i]) for i in range(3)]),F(2)))
            p = [self.f.mul(F(16),self.f.add(self.f.mul(inertia[i],F(1)),localJ[i])) for i in range(3)]
            start = p + [value for row in r0 for value in row] + [F(0)]
            row = dict(case,inertia=inertia,Lbefore=l0,Ebefore=e0,kickWork=kick,Eplus=self.f.add(e0,kick),targets={})
            bank['cases'].append(row); self.roots['buildScratch'] = {'pair':pair,'start':start,'J':J,'tau':tau,'dt':dt,'r0':r0,'localJ':localJ,'p':p}
            for precision in (80,120):
                engine = self.micro.Intervals(precision,self.counts,self.f)
                diagonal = [engine.literal(self.f.div(F(1,16),value)) for value in inertia]
                state = [engine.literal(value) for value in start]
                certificates = []; scratch = self.roots['buildScratch']; scratch.update(diagonal=diagonal,state=state,certificates=certificates)
                for window in (1,2):
                    state,certificate = self.window(state,diagonal,tau,self.f.div(dt,F(2)),engine,window)
                    scratch['state'] = state; certificates.append(certificate)
                    values = self.observable(state,diagonal,engine); scratch['values'] = values; self.memory()
                row['targets'][str(precision)] = {'values':values,'certificates':certificates}
                scratch.pop('values'); scratch.pop('certificates'); scratch.pop('state'); scratch.pop('diagonal')
            self.intersection(row['targets'])
            del self.roots['buildScratch']
        need(self.counts['taylorWindowsReturned'] == 8 and self.counts['endpointDecimalSqrtOperations'] == 16, 'complete finite bank counts')
        bank['counts'] = dict(self.counts); self.memory(bank)
        bank['resources'] = self.resources()
        return bank

    def intersection(self, targets):
        need(set(targets) == {'80','120'}, 'exact target precision keys')
        for target in targets.values():
            need(set(target) == {'values','certificates'} and len(target['certificates']) == 2, 'target and two certificates')
            need([cell['window'] for cell in target['certificates']] == [1,2] and all(cell['order'] == 32 and cell['completeResidualDegree'] == 64 for cell in target['certificates']), 'fixed Taylor certificate identity')
            values = target['values']
            need(set(values) == {'R','omega','q','W'} and len(values['R']) == 3 and all(len(row) == 3 for row in values['R']) and len(values['omega']) == 3 and len(values['q']) == 4 and len(values['W']) == 1, 'exact observable shapes')
        cells = [dict(self.micro.interval_tree_rows(targets[str(precision)]['values'])) for precision in (80,120)]
        need(set(cells[0]) == set(cells[1]), 'same observable shapes')
        for path,a in cells[0].items():
            b = cells[1][path]
            need(self.f.le(max(a['lo'],b['lo']),min(a['hi'],b['hi'])), '80/120 intersection '+path)

    def unpack(self, value):
        if type(value) is dict:
            if set(value) == {'numerator','denominator'}:
                need(all(type(v) is str and len(v) <= 1300 for v in value.values()), 'bounded Fraction record')
                return self.f.checked(F(int(value['numerator']),int(value['denominator'])))
            return {key:self.unpack(item) for key,item in value.items()}
        if type(value) is list: return [self.unpack(item) for item in value]
        return value

    def audit(self, record, bank_raw):
        need(set(record) == {'graph','id','pairRaw','commandsRaw','beforeRaw','afterRaw'} and record['graph'] in ('source','native'), 'exact audit envelope')
        case = {key:record[key] for key in ('id','pairRaw','commandsRaw')}
        pair,J,tau,dt = self.canonical(case)
        need(bank_raw['status'] == 'PASS_REFERENCE_BANK' and len(bank_raw['cases']) == 2 and bank_raw['counts']['taylorWindowsReturned'] == 8 and bank_raw['counts']['endpointDecimalSqrtOperations'] == 16, 'paid finite bank status/counts')
        matches = [row for row in bank_raw['cases'] if row['id'] == case['id']]; need(len(matches) == 1, 'unique paid case')
        need(all(matches[0][key] == case[key] for key in case), 'exact paid raw input binding')
        bank = self.unpack(matches[0]); self.intersection(bank['targets'])
        before,after = self.decode(record['beforeRaw']),self.decode(record['afterRaw'])
        self.roots.update(record=record,bankRaw=bank_raw,bank=bank,before=before,after=after,counts=self.counts)
        need(before['stepIndex'] == 0 and after['stepIndex'] == 1 and before['timeSeconds'] == 0 and after['timeSeconds'] == dt, 'single physical public clock')
        for state in (before,after):
            need(len(state['bodies']) == 1 and all(state[key] == [] for key in ('contacts','joints','ccdHits','cloths','fluids','events')), 'isolated observed frame')
            need(state['bodies'][0]['id'] == 'rotor', 'observed body identity')
        initial = before['bodies'][0]
        need(all(initial[key] == value for key,value in pair['model']['bodies'][0]['initial'].items()), 'actual before matches authored initial')
        inertia = self.geometry(pair); need(inertia == bank['inertia'], 'integral inertia matches paid bank')
        r0,s0,l0,e0 = self.geo.physical(initial,inertia)
        final = after['bodies'][0]; r1,s1,l1,e1 = self.geo.physical(final,inertia)
        self.counts['observedStateAudits'] = 2
        expectedL = [self.f.add(self.f.add(l0[i],J[i]),self.f.mul(tau[i],dt)) for i in range(3)]
        localJ = [self.f.dot([r0[j][i] for j in range(3)],J) for i in range(3)]
        kick = self.f.add(self.f.dot(initial['angularVelocityRadps'],J),self.f.div(self.f.dot(localJ,[self.f.div(localJ[i],inertia[i]) for i in range(3)]),F(2)))
        eplus = self.f.add(e0,kick); need(eplus == bank['Eplus'] and kick == bank['kickWork'] and l0 == bank['Lbefore'], 'independent impulse-work/before geometry binding')
        result = {'status':'PASS_REFERENCE_AUDIT','physicalStatus':'PASS','graph':record['graph'],'id':case['id'],
            'errors':{},'firstPhysicalFailure':None,'energy':{'before':e0,'afterImpulse':eplus,'after':e1,'kickWork':kick,'measuredContinuousWork':self.f.sub(e1,eplus)}}
        self.roots['auditScratch'] = {'pair':pair,'inertia':inertia,'r0':r0,'r1':r1,'l0':l0,'l1':l1,'expectedL':expectedL,'localJ':localJ,'result':result}
        def check(name, observed, expected, trajectory=False, absolute=False, location=None):
            error = self.f.absolute(self.f.sub(observed,expected))
            bound = F(1,10**12) if absolute else self.f.add(F(1,10**11) if trajectory else F(1,10**12),self.f.mul(F(1,10**12),self.f.absolute(expected) if trajectory else max(F(1),self.f.absolute(observed),self.f.absolute(expected))))
            previous = result['errors'].get(name)
            if previous is None or error > previous['measured']: result['errors'][name] = {'measured':error,'bound':bound,'location':location}
            if not self.f.le(error,bound):
                result['physicalStatus'] = 'PHYSICAL_NO_GO'
                if result['firstPhysicalFailure'] is None: result['firstPhysicalFailure'] = {'quantity':name,'measured':error,'bound':bound,'observed':observed,'expected':expected,'location':location}
        for i in range(3): check('worldL',l1[i],expectedL[i],location={'component':i})
        check('beforeSquaredQNorm',s0,F(1),absolute=True); check('squaredQNorm',s1,F(1),absolute=True)
        for body in (initial,final):
            for value in body['positionM']: check('comPosition',value,F(0),absolute=True)
            for value in body['velocityMps']: check('linearMomentum',value,F(0),absolute=True)
        for precision in ('80','120'):
            values = bank['targets'][precision]['values']
            for _,cell in self.micro.interval_tree_rows(values):
                need(self.f.le(F(0),self.f.sub(cell['hi'],cell['lo'])) and self.f.le(self.f.sub(cell['hi'],cell['lo']),F(1,10**24)), 'paid target width')
            actual = {'R':r1,'omega':final['angularVelocityRadps'],'q':final['orientationXYZW']}
            for key in actual:
                points = [v for row in actual[key] for v in row] if key == 'R' else actual[key]
                cells = [v for row in values[key] for v in row] if key == 'R' else values[key]
                for index,(point,cell) in enumerate(zip(points,cells)):
                    for endpoint in ('lo','hi'): check(key,point,cell[endpoint],trajectory=True,location={'precision':precision,'component':index,'endpoint':endpoint})
            for endpoint in ('lo','hi'):
                work = values['W'][0][endpoint]
                check('continuousWork',self.f.sub(e1,eplus),work,location={'precision':precision,'endpoint':endpoint})
                check('energy',e1,self.f.add(eplus,work),location={'precision':precision,'endpoint':endpoint})
        self.memory(); result['counts'] = dict(self.counts); result['resources'] = self.resources()
        return result

    def resources(self):
        return {'peakLogicalBytes':self.peak_bytes,'byteCap':8*MIB,'peakDistinctObjects':self.peak_objects,'objectCap':8192,'transientAllowanceBytes':MIB,'transientObjectReserve':3072,'measurement':'owned DATA plus fixed transient allowance; not RSS'}


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--build-bank',action='store_true'); mode.add_argument('--audit',action='store_true')
    parser.add_argument('--input',type=Path,required=True); parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--bank',type=Path); args = parser.parse_args()
    reference = None
    def deadline(*_): raise TimeoutError('reference170s deadline')
    signal.signal(signal.SIGALRM,deadline); signal.setitimer(signal.ITIMER_REAL,170)
    try:
        need(args.bank is not None if args.audit else args.bank is None, 'bank argument only and required for audit')
        reference = Reference(); packet = reference.load(args.input,65536); reference.roots['packet'] = packet
        if args.build_bank:
            result = reference.build(packet)
        else:
            bank = reference.load(args.bank,MIB); reference.roots['bankInput'] = bank
            result = reference.audit(packet,bank)
        reference.write(args.output,result,MIB if args.build_bank else 65536)
        print(json.dumps({'status':result['status'],'physicalStatus':result.get('physicalStatus'),'counts':reference.counts,'resources':reference.resources()}))
        return 0
    except BaseException as error:
        result = {'status':'FAIL_REFERENCE_OPERATION','firstFailure':{'type':type(error).__name__,'message':str(error)[:2048]},'counts':reference.counts if reference else {}}
        if not args.output.exists():
            with args.output.open('x') as stream: json.dump(result,stream,separators=(',',':')); stream.write('\n')
        print(json.dumps(result)); return 1
    finally:
        signal.setitimer(signal.ITIMER_REAL,0)


if __name__ == '__main__':
    sys.exit(main())
