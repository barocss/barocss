#!/usr/bin/env python3
"""Authorized G1b T-only continuation/reference; no candidate or Physics import."""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time
from decimal import Decimal
from fractions import Fraction

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MIB = 1048576
CLOSED_M_SHA = '90412a7e20b106939c14de7c5f8d619f0cd69d19caa780c91300ce540e3f0c36'
BASELINE_SHA = '5f5eee9ac2cd8b654eab134823a619254fd0b7c4ab8791419d077a71413a09eb'
M_DECIMAL_BASE = 2758004
STUDY_FRACTION_BASE = 28292
IDS = ('T01-dt60','T02-dt120','T03-dt240','P01-principal-x','P02-principal-y','P03-principal-z','Z01-zero','Q01-negative-q-off-axis')
ENDS = (6,12,24,1,1,1,1,1)
M_BANK = 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-micro-02/reference/bank.json'
M_SUMMARY = 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-micro-02/reference/summary.json'
M_TOP = 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-micro-02/summary.json'
M_INPUT = 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-micro-02/input-raw.json'
M_COEFFICIENTS = 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-micro-02/source-coefficients-raw.json'
G1A_BANK = 'examples/physics-rigid-rotation-g1-2276/evidence/g1a-repair-02/reference/analytic-bank.json'
PRINCIPAL_KEY = 'principal:4803839602528529/576460752303423488'


class Failure(Exception):
    def __init__(self, message, detail=None):
        super().__init__(message)
        self.detail = detail

def need(value, message, detail=None):
    if not value: raise Failure(message, detail)

def sha(data): return hashlib.sha256(data).hexdigest()

def file_sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''): h.update(block)
    return h.hexdigest()

def unique(rows):
    result = {}
    for key, value in rows:
        need(key not in result, 'duplicate JSON key')
        result[key] = value
    return result

def decode_bound(data):
    nodes = depth = strings = bare = 0
    quoted = escaped = False
    for c in data:
        if quoted:
            strings += 1
            if escaped: escaped = False
            elif c == 92: escaped = True
            elif c == 34: quoted = False
        elif c == 34: nodes += 1; quoted = True; bare = 0
        elif c in (123, 91): nodes += 1; depth += 1; bare = 0
        elif c in (125, 93): depth -= 1; bare = 0
        elif c in (9, 10, 13, 32, 44, 58): bare = 0
        else:
            if bare == 0: nodes += 1
            bare += 1
        need(nodes <= 8192 and 0 <= depth <= 32 and bare <= 1300, 'JSON allocation census')
    need(not quoted and depth == 0, 'complete bounded JSON envelope')
    return 512 * nodes + 4 * strings + 4 * len(data) + 131072

def parse(data):
    need(decode_bound(data) <= 6 * MIB, 'bounded decoder allocation')
    return json.loads(data, object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(Failure('non-JSON number')))

def packed(value):
    if type(value) is Fraction:
        need(max(value.numerator.bit_length(), value.denominator.bit_length()) <= 4096, 'encoded rational bound')
        return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}
    if type(value) is dict: return {k: packed(v) for k, v in value.items()}
    if type(value) in (list, tuple): return [packed(v) for v in value]
    return value

def wire(value): return (json.dumps(packed(value), ensure_ascii=True, allow_nan=False, separators=(',', ':')) + '\n').encode('ascii')

def fmaximum(values, arithmetic):
    iterator = iter(values); result = next(iterator)
    for value in iterator:
        if arithmetic.le(result, value): result = value
    return result

def interval_tree_rows(value, path=''):
    if type(value) is dict and set(value) == {'lo', 'hi'}: yield path, value
    elif type(value) is dict:
        for key, child in value.items(): yield from interval_tree_rows(child, path + '/' + key)
    else:
        for index, child in enumerate(value): yield from interval_tree_rows(child, path + '/' + str(index))

def enclose_tree(value, convert):
    return {key: convert(item) for key, item in value.items()}


def read_data(path, cap):
    path = Path(path)
    need(path.stat().st_size <= cap, 'bounded DATA input ' + str(path))
    data = path.read_bytes()
    need(decode_bound(data) + 2 * len(data) + 2 * MIB <= 8 * MIB, 'DATA decoder precharge')
    return parse(data)


def authenticate(args):
    path = Path(args.freeze)
    need(path.stat().st_size <= 262144 and file_sha(path) == args.token, 'explicit parent token')
    freeze = read_data(path, 262144)
    need(freeze['status'] == 'PARENT_AUTHORIZED_G1B_TRAJECTORY' and freeze['mode'] == 'G1B_T_STAGED_ONLY' and
         freeze['phase'] == 'T' and freeze['runtimeAuthorized'] is True and freeze['phaseTAuthorized'] is True and
         freeze['productionActivation'] is False and freeze['runId'] == args.run_id, 'T-only runtime authority')
    names = ('PHASE-T-PLAN-01.md','PHASE-T-PLAN-01.json','REFERENCE-PROTOCOL-T01.md','REFERENCE-OPTIMIZATION-T01.md',
             'AUTHORING-FREEZE-T02.json','reference-trajectory.py','REFERENCE-READY-T01.json',
             'TRAJECTORY-EXECUTION-REVIEW-T01.md','trajectory-campaign.mjs','TRAJECTORY-READY-T01.json',
             'TRAJECTORY-DRIVER-PLAN-01.md','TRAJECTORY-DRIVER-PLAN-01.json','TRAJECTORY-READY-T02.json','reference-micro.py')
    for name in names: need(str(HERE.relative_to(ROOT) / name) in freeze['files'], 'required authority ' + name)
    for name in (M_BANK,M_SUMMARY,M_TOP,M_INPUT,M_COEFFICIENTS,G1A_BANK,
                 'examples/physics-rigid-rotation-g1b-2276/evidence/g1b-micro-02/staged-providers.json',
                 'examples/physics-rigid-rotation-g1-2276/baseline-classify.py'):
        need(name in freeze['files'], 'closed authority ' + name)
    for name, pin in freeze['files'].items():
        target = (ROOT / name).resolve()
        need(target.is_relative_to(ROOT) and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'file pin ' + name)
    for name, pin in freeze['toolFiles'].items():
        target = Path(name)
        need(target.is_absolute() and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'tool pin ' + name)
    need(Path(sys.executable).resolve() == Path(freeze['tools']['python']).resolve() and freeze['tools']['python'] in freeze['toolFiles'], 'actual pinned Python')
    need(freeze['highReview']['approved'] is True and freeze['highReview']['path'] in freeze['files'], 'pinned High review')
    provider = read_data(HERE / 'evidence/g1b-micro-02/staged-providers.json', MIB)
    for pin in provider['stagedPins']:
        target = Path(pin['path']).resolve()
        need(target.is_relative_to(HERE / 'evidence/g1b-micro-02/build') and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'complete actual reused provider closure')
    provider = None
    baseline_path = ROOT / 'examples/physics-rigid-rotation-g1-2276/baseline-classify.py'
    need(file_sha(HERE / 'reference-micro.py') == CLOSED_M_SHA and file_sha(baseline_path) == BASELINE_SHA, 'closed M02/reference helper definitions')
    def definitions(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
    micro = definitions('g1b_closed_m02_definitions', HERE / 'reference-micro.py')
    baseline = definitions('g1b_closed_baseline_definitions', baseline_path)
    return freeze, micro, baseline


def build_server_types(micro, baseline):
    class Arithmetic(baseline.Arithmetic):
        def operation(self):
            self.counts['fractionScalarOperations'] += 1
            need(self.counts['fractionScalarOperations'] <= 1000000 and
                 self.counts['fractionScalarOperations'] + STUDY_FRACTION_BASE <= 10000000, 'T/joint Fraction caps')

    class Intervals(micro.Intervals):
        def tick(self):
            self.counts['decimalOperations'] += 1
            need(self.counts['decimalOperations'] <= 21000000 and
                 self.counts['decimalOperations'] + M_DECIMAL_BASE <= 32000000, 'T/joint Decimal caps')

        def sqrt(self, value):
            need(self.counts['endpointDecimalSqrtOperations']+2+8<=108,'joint M+T endpoint sqrt cap')
            return super().sqrt(value)

    class Server(micro.Server):
        def __init__(self, args, freeze, unused):
            super().__init__(args, freeze, baseline)
            self.f = Arithmetic(self.counts)
            self.counts.update(reusedGeometryCertificates=0,reusedAlgebraicRootCertificates=0,
                               reusedTaylorWindows=0,restored12StateEndpoints=0,principalBankCopies=0,
                               savedRationalConversions=0,clockRoundings=0)
            self.configs = {}; self.contexts = {}; self.principals = {}
            self.owners.update(configs=self.configs,contextRegistry=self.contexts,principalTargets=self.principals)
            self.baseline_input = None
            self.audit_cursor = 0
            self.errors = {}; self.owners['errors'] = self.errors
            self.refinement_done={};self.refinement_proofs=[]
            self.owners.update(refinementDone=self.refinement_done,refinementProofs=self.refinement_proofs)

        def load(self, name, owner, cap=MIB):
            path = ROOT / name
            pin = self.freeze['files'][name]
            need(path.stat().st_size == pin['bytes'] and file_sha(path) == pin['sha256'] and pin['bytes'] <= cap, 'closed DATA authority ' + name)
            raw = path.read_bytes(); self.owners['activeDataBytes'] = raw
            self.memory({}, decode_bound(raw))
            value = parse(raw); self.owners[owner] = value
            self.owners.pop('activeDataBytes'); self.memory({})
            return value

        def unpack(self, value):
            if type(value) is dict:
                if set(value) == {'numerator','denominator'}:
                    n, d = value['numerator'], value['denominator']
                    need(type(n) is type(d) is str and len(n) <= 1300 and len(d) <= 1300 and
                         n.lstrip('-').isdigit() and d.isdigit() and int(d) > 0, 'bounded saved exact rational')
                    self.counts['savedRationalConversions'] += 1
                    return self.f.checked(Fraction(int(n),int(d)))
                return {k:self.unpack(v) for k,v in value.items()}
            if type(value) is list: return [self.unpack(v) for v in value]
            return value

        def context_reference(self, report):
            key = sha(wire(report))
            if key not in self.contexts:
                need(len(self.contexts) < 8, 'fixed actual Context registry capacity')
                self.contexts[key] = {'id':key,'actual':report}
            return self.contexts[key]['id']

        def factor_context(self, certificate):
            certificate = dict(certificate)
            report = certificate.pop('contexts',None)
            if report is not None: certificate['contextRef'] = self.context_reference(report)
            return certificate

        def expected_pair(self, index):
            value = copy.deepcopy(self.baseline_input)
            dt = value['options']['fixedStepSeconds']
            word = int.from_bytes(bytes.fromhex(dt['$f64le']),'little')
            shift = 1 if index == 0 else -1 if index == 2 else 0
            dt['$f64le'] = (word+shift*(1<<52)).to_bytes(8,'little').hex()
            zero,one,minus = {'$f64le':'0000000000000000'},{'$f64le':'000000000000f03f'},{'$f64le':'000000000000f0bf'}
            initial = value['model']['bodies'][0]['initial']
            if index in (3,4,5): initial['angularVelocityRadps']=[one if i==index-3 else zero for i in range(3)]
            if index == 6: initial['angularVelocityRadps']=[zero,zero,zero]
            if index == 7: initial['orientationXYZW']=[zero,zero,zero,minus]
            return value

        def initial_metrics(self, observed):
            return {key:observed[key] for key in ('angularMomentumKgM2ps','rotationalEnergyJ','quaternionSquaredNorm','comPositionM','linearMomentumKgMps')}

        def window(self, initial, diagonal, h, engine, window_index):
            self.counts['taylorWindowsAttempted'] += 1
            self.counts['decimal' + str(engine.precision) + 'Windows'] += 1
            self.transient = MIB
            scratch = {'initial': initial, 'contexts': {'down': engine.down, 'up': engine.up}}
            self.owners['currentWindow'] = scratch
            self.memory({})
            terms = micro.equation_terms(diagonal, engine); scratch['terms'] = terms
            coefficients = [initial]; scratch['coefficients'] = coefficients
            h_interval = engine.literal(h)
            eta_by_component = [Decimal(0) for _ in range(12)]
            power = engine.literal(1)
            scratch['etaByComponent'] = eta_by_component
            for degree in range(32):
                current = micro.polynomial_field_coefficient(degree, coefficients, terms, engine)
                scratch['currentFieldCoefficient'] = current
                coefficients.append([engine.div(value, engine.literal(degree + 1)) for value in current])
                # Same degree residual and power sum, reusing this immutable F_n.
                residual_coefficient = [engine.sub(engine.mul(engine.literal(degree + 1), coefficients[degree + 1][i]), current[i]) for i in range(12)]
                scratch['currentResidualCoefficient'] = residual_coefficient
                for index, cell in enumerate(residual_coefficient):
                    eta_by_component[index] = engine.scalar_add_up(eta_by_component[index], engine.scalar_mul_up(engine.absupper(cell), power[1]))
                power = engine.mul(power, h_interval)
                self.memory({})
            tube = engine.literal(Fraction(17, 16))
            tube_abs = tube[1]
            M = L = Decimal(0)
            for row in terms:
                field_bound = derivative_bound = Decimal(0)
                for constant, _, _ in row:
                    magnitude = engine.absupper(constant)
                    field_bound = engine.scalar_add_up(field_bound, engine.scalar_mul_up(magnitude, engine.scalar_mul_up(tube_abs, tube_abs)))
                    derivative_bound = engine.scalar_add_up(derivative_bound, engine.scalar_mul_up(Decimal(2), engine.scalar_mul_up(magnitude, tube_abs)))
                M = engine.select([M, field_bound], True); L = engine.select([L, derivative_bound], True)
            need(engine.le(M, Decimal(8)) and engine.le(L, Decimal(16)), 'verified full-tube field/Lipschitz bounds')
            h_upper = h_interval[1]
            start_max = engine.select([engine.absupper(value) for value in initial], True)
            need(engine.lt(engine.scalar_add_up(start_max, engine.scalar_mul_up(h_upper, M)), tube_abs) and
                 engine.lt(engine.scalar_mul_up(h_upper, M), engine.literal(Fraction(1, 16))[0]) and
                 engine.lt(engine.scalar_mul_up(h_upper, L), engine.literal(Fraction(1, 8))[0]), 'Picard map/tube contraction with full initial width')
            polynomial_range = micro.polynomial_value(coefficients, (Decimal(0), h_upper), engine)
            scratch['polynomialRange'] = polynomial_range
            need(all(engine.le(engine.absupper(value), tube_abs) for value in polynomial_range), 'every fixed Taylor polynomial lies in the same convex tube')
            # Stream all65 residual coefficients. No degree64 matrix tree is retained.
            coefficient_hash = hashlib.sha256()
            for row in coefficients:
                for lo, hi in row:
                    for endpoint in (lo, hi):
                        chunk = str(endpoint).encode('ascii'); need(len(chunk) <= 4096, 'bounded coefficient hash chunk')
                        coefficient_hash.update(str(len(chunk)).encode('ascii') + b':' + chunk)
            for degree in range(32, 65):
                value = micro.polynomial_field_coefficient(degree, coefficients, terms, engine)
                value = [engine.neg(x) for x in value]
                scratch['currentResidualCoefficient'] = value
                for index, cell in enumerate(value):
                    eta_by_component[index] = engine.scalar_add_up(eta_by_component[index], engine.scalar_mul_up(engine.absupper(cell), power[1]))
                power = engine.mul(power, h_interval)
            eta = engine.select(eta_by_component, True)
            numerator = engine.mul((eta, eta), h_interval)
            denominator = engine.sub(engine.literal(1), engine.mul((L, L), h_interval))
            error = engine.div(numerator, denominator)[1]
            endpoint = micro.polynomial_value(coefficients, h_interval, engine)
            scratch['endpointPolynomial'] = endpoint
            negative_error = engine.neg((error, error))[0]
            widened = [engine.add(value, (negative_error, error)) for value in endpoint]
            scratch['endpointWithError'] = widened
            self.memory({})
            certificate = {'window': window_index, 'order': 32, 'completeResidualDegree': 64,
                'coefficientTreeSha256': coefficient_hash.hexdigest(), 'MperSecond': engine.fraction(M),
                'LperSecond': engine.fraction(L), 'tubeComponentBound': Fraction(17, 16),
                'fullInitialAbsoluteUpper': engine.fraction(start_max),
                'defectAbsoluteUpper': engine.fraction(eta), 'uniformSolutionErrorUpper': engine.fraction(error),
                'proof': 'For every fixed initial z, interval coefficients enclose the exact recurrence coefficients; complete residual bounds all corresponding fixed polynomials. e(0)=0; previous uncertainty enters C0 and every recurrence coefficient.',
                'contexts': engine.report()}
            certificate = self.factor_context(certificate)
            scratch['certificate'] = certificate
            self.memory({})
            self.counts['taylorWindowsReturned'] += 1
            self.owners.pop('currentWindow'); self.transient = 0
            return widened, certificate


        def init(self, packet):
            need(self.counts['bankInitializations'] == 0 and packet['authoritySha256'] == self.args.token,'one authorized T bank')
            top = self.load(M_TOP,'closedTop',65536)
            need(top['status']=='PASS_STAGED_G1B_MICRO_ONLY' and top['firstFailure'] is None and not top['cleanupErrors'],'actual successful M02 authority')
            summary = self.load(M_SUMMARY,'closedSummary',65536)
            need(summary['status']=='PASS_G1B_MICRO_FINISH' and summary['counts']['decimalOperations']==M_DECIMAL_BASE and
                 summary['counts']['fractionScalarOperations']==15662 and summary['counts']['taylorWindowsReturned']==4,'actual M cost/window authority')
            self.closed_counts = dict(summary['counts']); self.owners['closedCounts']=self.closed_counts
            self.reference_moment_words=summary['privateObservations']['source']['raw']['inertiaDiagonalKgM2']
            self.owners['referenceMomentWords']=self.reference_moment_words
            self.owners.pop('closedTop'); self.owners.pop('closedSummary'); top=summary=None
            self.baseline_input=self.load(M_INPUT,'canonicalBase',65536)
            certified=self.load(M_COEFFICIENTS,'closedCoefficientWords',65536)
            need(packet['sourceCoefficientsRaw']==certified,'actual Source words equal certified M02 authority')
            self.source_coefficients_raw=packet['sourceCoefficientsRaw']; self.owners['sourceCoefficientsRaw']=self.source_coefficients_raw
            self.owners.pop('closedCoefficientWords'); certified=None
            closed=self.load(M_BANK,'closedBankRaw',MIB)
            self.geometry=self.unpack(closed['geometry']); self.owners['geometry']=self.geometry
            self.h=self.unpack(closed['nativeWindowSeconds']); self.owners['nativeWindow']=self.h
            for precision in ('80','120'):
                self.bank[precision]={}
                for index in ('1','2'):
                    row=self.unpack(closed['bank'][precision][index])
                    row['certificate']=self.factor_context(row['certificate'])
                    self.bank[precision][index]=row
            self.owners.pop('closedBankRaw'); closed=row=None
            self.counts.update(reusedGeometryCertificates=1,reusedAlgebraicRootCertificates=3,reusedTaylorWindows=4)
            rows=packet['cases']
            need(type(rows)is list and len(rows)==8 and [r['caseId'] for r in rows]==list(IDS),'eight ordered frozen cases')
            for i,row in enumerate(rows):
                need(type(row['steps'])is int and row['steps']==ENDS[i],'fixed case horizon')
                expected=self.expected_pair(i); self.owners['expectedPair']=expected
                need(row['pairRaw']==expected,'canonical M-based native case '+IDS[i])
                dt=baseline.decode(row['pairRaw']['options']['fixedStepSeconds'])
                stride=self.f.div(dt,self.h)
                need(stride in (Fraction(1),Fraction(2),Fraction(4)),'exact native grid ratio')
                self.configs[IDS[i]]={'index':i,'steps':ENDS[i],'dt':dt,'stride':int(stride),'kind':'general' if i<3 or i==7 else 'principal' if i<6 else 'zero','axis':i-3,'negative':i==7}
            packet['cases']=None; rows=row=expected=None; self.owners.pop('expectedPair')
            inertia=[self.geometry['tensorKgM2'][i][i] for i in range(3)]
            diagonal=[self.f.div(Fraction(1,16),v) for v in inertia]
            inverse_diagonal=[self.f.div(v,Fraction(1,16)) for v in inertia]
            self.owners['diagonalExact']=diagonal; self.owners['inverseDiagonalExact']=inverse_diagonal
            old=self.load(G1A_BANK,'principalBankRaw',MIB)
            for precision in ('80','120'):
                entry=self.unpack(old['bank'][PRINCIPAL_KEY][precision]);value=entry['values']
                for axis,perm in enumerate(((2,0,1),(1,2,0),(0,1,2))):
                    self.principals[precision+':'+str(axis)]={'R':[[value['R'][perm[i]][perm[j]] for j in range(3)] for i in range(3)],
                        'omega':[value['omega'][perm[i]] for i in range(3)],'q':[value['q'][perm[i]] for i in range(3)]+[value['q'][3]]}
                    self.counts['principalBankCopies']+=1
            self.owners.pop('principalBankRaw');old=entry=value=None
            for precision in (80,120):
                engine=Intervals(precision,self.counts,self.f)
                active={'contexts':{'down':engine.down,'up':engine.up}}
                self.owners['precisionScratch']=active
                d=[engine.literal(v) for v in diagonal]; inv=[engine.literal(v) for v in inverse_diagonal]
                active.update(diagonal=d,inverseDiagonal=inv)
                saved=self.bank[str(precision)]['2']['values']
                def restore(cell):return engine.literal(cell['lo'])[0],engine.literal(cell['hi'])[1]
                r=[[restore(v) for v in row] for row in saved['R']]
                omega=[restore(v) for v in saved['omega']]
                active.update(restoredR=r,restoredOmega=omega)
                p=[]
                for i in range(3):
                    value=engine.literal(0)
                    for j in range(3):value=engine.add(value,engine.mul(r[j][i],omega[j]))
                    p.append(engine.mul(inv[i],value))
                state=p+[v for row in r for v in row];active['state']=state
                self.counts['restored12StateEndpoints']+=1
                self.transient=MIB;self.memory({})
                for window_index in range(3,25):
                    state,certificate=self.window(state,d,self.h,engine,window_index)
                    active.update(state=state,certificate=certificate)
                    self.transient=MIB;self.memory({})
                    values,width=self.observable(state,d,engine)
                    self.bank[str(precision)][str(window_index)]={'values':values,'maxObservableWidth':width,'certificate':certificate}
                    self.memory({});self.transient=0
            self.owners.pop('precisionScratch');active=state=p=r=omega=saved=engine=values=certificate=None
            for index in range(1,25):
                a=dict(interval_tree_rows(self.bank['80'][str(index)]['values']));b=dict(interval_tree_rows(self.bank['120'][str(index)]['values']))
                for path in a:need(self.f.le(a[path]['lo'],b[path]['hi'])and self.f.le(b[path]['lo'],a[path]['hi']),'independently certified precisions intersect')
            self.counts['bankInitializations']=1
            self.bank_pin=self.write('bank.json',{'scope':'T_ONLY','reuse':{'Mbank':self.freeze['files'][M_BANK],'G1aprincipal':self.freeze['files'][G1A_BANK],
                'window2p':'outward I*R^Tomega/L*; no unobserved endpoint'},'geometry':self.geometry,'bank':self.bank,'principals':self.principals,
                'contextRegistry':self.contexts,'newCounts':dict(self.counts),'closedMCounts':self.closed_counts},2*MIB)
            return {'status':'PASS_G1B_TRAJECTORY_BANK','bank':self.bank_pin,'sourceGraphComplete':False}

        def targets(self, config, index):
            if index==0 or config['kind']=='zero':
                omega=[Fraction(int(config['kind']!='zero' and (config['kind']=='general' or j==config['axis']))) for j in range(3)]
                q=[Fraction(0),Fraction(0),Fraction(0),Fraction(-1 if config['negative'] else 1)]
                def interval(v):return {'lo':v,'hi':v}
                return {'exact':{'R':[[interval(Fraction(int(i==j)))for j in range(3)]for i in range(3)],'omega':[interval(v)for v in omega],'q':[interval(v)for v in q]}}
            if config['kind']=='principal':return {p:self.principals[p+':'+str(config['axis'])]for p in ('80','120')}
            result={p:self.bank[p][str(index*config['stride'])]['values']for p in ('80','120')}
            if config['negative']:
                result={p:{**v,'q':[{'lo':self.f.neg(c['hi']),'hi':self.f.neg(c['lo'])}for c in v['q']]}for p,v in result.items()}
            return result

        def trajectory(self, observed, state, config, index):
            actual={'R':observed['properRotation'],'omega':state['bodies'][0]['angularVelocityRadps'],'q':state['bodies'][0]['orientationXYZW']}
            targets=self.targets(config,index);reports={}
            self.owners['trajectoryScratch']={'actual':actual,'targets':targets,'reports':reports}
            for precision,target in targets.items():
                errors={}
                for quantity in ('R','omega','q'):
                    values=[x for row in actual[quantity]for x in row]if quantity=='R'else actual[quantity]
                    references=[x for row in target[quantity]for x in row]if quantity=='R'else target[quantity]
                    maximum=Fraction(0)
                    for component,(v,c)in enumerate(zip(values,references)):
                        for endpoint in ('lo','hi'):
                            error=self.f.absolute(self.f.sub(v,c[endpoint]));bound=self.f.add(Fraction(1,10**11),self.f.mul(Fraction(1,10**12),self.f.absolute(c[endpoint])))
                            need(self.f.le(error,bound),'strict T trajectory component',{'quantity':quantity,'component':component,'actual':v,'reference':c,'error':error,'bound':bound})
                            maximum=fmaximum((maximum,error),self.f)
                    errors[quantity]=maximum
                reports[precision]=errors
            self.owners.pop('trajectoryScratch');return reports

        def refinement(self, graph):
            reports=[]
            for coarse,fine in ((IDS[0],IDS[1]),(IDS[1],IDS[2])):
                for fine_index in (4,8,12,16,20,24):
                    a=self.errors.get(graph+':'+coarse+':'+str(fine_index));b=self.errors.get(graph+':'+fine+':'+str(fine_index))
                    if a is None or b is None:continue
                    for quantity in ('R','omega','q'):
                        gate_key=graph+':'+coarse+':'+fine+':'+str(fine_index)+':'+quantity
                        if gate_key in self.refinement_done:continue
                        bound=fmaximum((self.f.div(a[quantity],Fraction(9,5)),Fraction(1,10**11)),self.f)
                        need(self.f.le(b[quantity],bound),'matched T refinement',{'graph':graph,'timeIndex':fine_index,'quantity':quantity,'coarse':a[quantity],'fine':b[quantity],'bound':bound})
                        self.refinement_done[gate_key]=self.f.le(a[quantity],Fraction(1,10**11))and self.f.le(b[quantity],Fraction(1,10**11))
                        reports.append({'coarse':coarse,'fine':fine,'timeIndex':fine_index,'quantity':quantity,'coarseError':a[quantity],'fineError':b[quantity],'bound':bound,'roundingFloor':self.f.le(a[quantity],Fraction(1,10**11))and self.f.le(b[quantity],Fraction(1,10**11))})
            return reports

        def rounded_clock(self, value):
            # Representation conversion only: positive dyadic -> IEEE RN ties-even.
            self.counts['clockRoundings']+=1
            n,d=value.numerator,value.denominator
            need(n>=0 and d>0 and d&(d-1)==0,'nonnegative dyadic public clock')
            shift=max(0,n.bit_length()-53)
            if shift:
                q,r=divmod(n,1<<shift);half=1<<(shift-1)
                if r>half or r==half and q&1:q+=1
                n=q<<shift
            return self.f.checked(Fraction(n,d))

        def observe_private_t(self, raw, state_raw, observed, graph, cid):
            need(set(raw)=={'bodyId','inertiaDiagonalKgM2','orientationXYZW','cacheSnapshotSha256'}and raw['bodyId']=='rotor'and
                 raw['orientationXYZW']==state_raw['bodies'][0]['orientationXYZW']and len(raw['cacheSnapshotSha256'])==64 and
                 all(c in '0123456789abcdef'for c in raw['cacheSnapshotSha256']),'actual private pose/cache association')
            moments=baseline.decode(raw['inertiaDiagonalKgM2']);need(len(moments)==3,'three observed moments')
            need(raw['inertiaDiagonalKgM2']==self.reference_moment_words,'all actual admitted moment words remain identical')
            omega=baseline.decode(state_raw['bodies'][0]['angularVelocityRadps'])
            local=[self.f.dot([observed['properRotation'][j][i]for j in range(3)],omega)for i in range(3)]
            p=[self.f.div(self.f.mul(moments[i],local[i]),Fraction(1,16))for i in range(3)]
            self.private[graph+':'+cid]={'raw':raw,'actualScaledInitialMomentum':p,'nativeMinusIntegral':[self.f.sub(moments[i],self.geometry['tensorKgM2'][i][i])for i in range(3)]}
            self.counts['privateBodyObservations']+=1

        def audit(self, packet):
            sequence=[(g,cid,i)for g in ('source','native')for cid,end in zip(IDS,ENDS)for i in range(end+1)]
            need(self.counts['bankInitializations']==1 and self.audit_cursor<len(sequence),'finite T audit prefix')
            graph,cid,index=sequence[self.audit_cursor]
            need(packet['graph']==graph and packet['caseId']==cid and type(packet['stepIndex'])is int and packet['stepIndex']==index,'ordered T case/state')
            need((index==0)==('initialPrivateRaw'in packet),'only16initial private records')
            raw=packet['stateRaw'];state=baseline.decode(raw);config=self.configs[cid]
            self.owners['currentState']=state
            need(state['stepIndex']==index and len(state['bodies'])==1 and state['bodies'][0]['id']=='rotor'and
                 all(not state[k]for k in ('contacts','joints','events','ccdHits','cloths','fluids')),'isolated triaxial state')
            underlying_time=self.f.mul(Fraction(index),config['dt'])
            need(self.f.equal(state['timeSeconds'],self.rounded_clock(underlying_time)),'exact rounded public clock label')
            observed=baseline.observed_audit(state,self.geometry,baseline.decode(self.baseline_input['model']['bodies'][0]['massKg']),self.f,self.counts)
            self.owners['currentObserved']=observed
            if index==0:
                self.observe_private_t(packet['initialPrivateRaw'],raw,observed,graph,cid)
                self.initial[graph+':'+cid]=self.initial_metrics(observed)
            report,failure=baseline.assessment(graph+':'+cid,self.initial[graph+':'+cid],observed,self.f,None)
            self.owners['currentAssessment']=report;need(failure is None,'unchanged T physical gate',report)
            trajectory=self.trajectory(observed,state,config,index);self.owners['currentTrajectory']=trajectory
            if config['index']<3 and index>0 and index*config['stride']in (4,8,12,16,20,24):
                self.errors[graph+':'+cid+':'+str(index*config['stride'])]={q:fmaximum((trajectory[p][q]for p in trajectory),self.f)for q in ('R','omega','q')}
            refinement=self.refinement(graph)if index==config['steps']else[]
            proof={'graph':graph,'caseId':cid,'stepIndex':index,'stateRawSha256':sha(wire(raw)),'physical':report,'trajectoryErrors':trajectory,'refinement':refinement}
            self.owners['currentProof']=proof
            artifact=self.write('audit-'+str(self.audit_cursor+1).zfill(4)+'.json',proof,49152)
            if refinement:self.refinement_proofs.append(artifact)
            self.audit_cursor+=1
            if self.audit_cursor==55:
                need(sum(key.startswith('source:')for key in self.refinement_done)==36,'all36source refinement checks')
                self.source_complete=True
            for k in ('currentState','currentObserved','currentAssessment','currentTrajectory','currentProof'):self.owners.pop(k)
            return {'status':'PASS_G1B_TRAJECTORY_AUDIT','graph':graph,'caseId':cid,'stepIndex':index,'sourceGraphComplete':self.source_complete,
                    'metrics':{'physicalChecks':len(report['checks']),'trajectory':'PASS_BOTH_CERTIFICATES','refinement':'PASS_WHEN_AVAILABLE'},'artifact':artifact}

        def finish(self):
            need(self.audit_cursor==110 and self.source_complete and self.counts['observedStateAuditsReturned']==self.counts['properRationalRotationReturns']==110 and
                 self.counts['privateBodyObservations']==16 and self.counts['clockRoundings']==110 and self.counts['taylorWindowsReturned']==44 and
                 self.counts['decimal80Windows']==self.counts['decimal120Windows']==22 and self.counts['endpointDecimalSqrtOperations']==88 and
                 self.counts['bodyGeometryCertificatesAttempted']==self.counts['algebraicBisectionDecisions']==0,'complete unchanged T ledger')
            need(len(self.refinement_done)==72 and len(self.refinement_proofs)==4,'all72refinement checks stored once')
            refinements={'checks':72,'allPass':True,'allBelowFloor':all(self.refinement_done.values()),'proofs':self.refinement_proofs};self.finished=True
            summary=self.write('summary.json',{'status':'PASS_G1B_TRAJECTORY_FINISH','counts':dict(self.counts),'jointDecimal':M_DECIMAL_BASE+self.counts['decimalOperations'],
                'jointStudyFraction':STUDY_FRACTION_BASE+self.counts['fractionScalarOperations'],'refinement':refinements,'bank':self.bank_pin,
                'countBoundary':'Before committingreply112; savedsummaryreturned111; finalreplyreturned112; receivedcountsdriver-owned.',
                'peakOwnedUpperBytes':self.peak,'productionActivation':False,'heapOrRssClaim':False},65536)
            return {'status':'PASS_G1B_TRAJECTORY_FINISH','sourceGraphComplete':True,'bank':self.bank_pin,'summary':summary}

    return Server


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('run-id','freeze','token','out'):parser.add_argument('--'+key,required=True)
    args=parser.parse_args();started=time.monotonic_ns()
    signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('170s trajectory deadline')))
    signal.setitimer(signal.ITIMER_REAL,170);server=None
    try:
        freeze,micro,baseline=authenticate(args)
        Server=build_server_types(micro,baseline);server=Server(args,freeze,None)
        ready={'status':'READY_G1B_TRAJECTORY_REFERENCE','protocol':'G1B_TRAJECTORY_JSONL_V1','requestOrdinal':0,
               'runId':args.run_id,'authoritySha256':args.token,'counts':dict(server.counts)}
        server.memory(ready);data=wire(ready);need(len(data)<=4096,'bounded READY')
        sys.stdout.buffer.write(data);sys.stdout.buffer.flush();data=None
        line=packet=reply=response=None
        while not server.finished:
            line=packet=reply=response=None
            for key in ('activeLine','activePacket','activeReply','activeResponse'):server.owners.pop(key,None)
            line=sys.stdin.buffer.readline(262145)
            need(line and len(line)<=262144 and line.endswith(b'\n'),'complete bounded request; EOF before finish fails')
            server.owners['activeLine']=line;server.memory({},decode_bound(line))
            need(time.monotonic_ns()-started<170000000000,'deadline before next request')
            packet=parse(line);server.owners['activePacket']=packet
            server.counts['requestsAttempted']+=1;ordinal=server.counts['requestsAttempted'];op=packet.get('op')
            need(ordinal<=112,'fixed112request population');server.progress()
            if op=='init':need(ordinal==1,'init first');reply=server.init(packet)
            elif op=='audit':need(2<=ordinal<=111,'110audits');reply=server.audit(packet)
            elif op=='finish':need(ordinal==112,'finish112');reply=server.finish()
            else:raise Failure('unknown trajectory protocol operation')
            reply.update(op=op,requestOrdinal=ordinal,counts={**server.counts,'requestsReturned':server.counts['requestsReturned']+1})
            server.owners['activeReply']=reply
            server.write('reply-'+str(ordinal).zfill(4)+'.json',reply,4096)
            server.counts['requestsReturned']+=1;server.progress()
            response=wire(reply);need(len(response)<=4096,'compact reply cap')
            server.owners['activeResponse']=response;server.memory(reply)
            sys.stdout.buffer.write(response);sys.stdout.buffer.flush()
        return 0
    except BaseException as error:
        signal.setitimer(signal.ITIMER_REAL,4)
        detail={'type':type(error).__name__,'message':str(error)[:2048],'detail':getattr(error,'detail',None)}
        if server is not None:
            failure={'status':'FAIL_G1B_TRAJECTORY_REFERENCE','op':locals().get('op'),'requestOrdinal':server.counts['requestsAttempted'],
                     'counts':dict(server.counts),'firstFailure':detail}
            try:
                server.progress({'type':detail['type'],'message':detail['message']})
                artifact=server.write('first-failure.json',failure,57344,reserved=True)
            except BaseException as receipt_error:
                artifact=None;failure['firstFailure']['receiptError']=str(receipt_error)[:512]
            # The full mathematical first failure remains in its authenticated artifact.
            failure['firstFailure']['detail']=None
            if artifact:failure['artifact']=artifact
            data=wire(failure)
            if len(data)>4096:failure['firstFailure']['message']=failure['firstFailure']['message'][:512];data=wire(failure)
            need(len(data)<=4096,'bounded failure wire')
            sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
        else:sys.stderr.write(json.dumps({'status':'FAIL_G1B_TRAJECTORY_REFERENCE_STARTUP','firstFailure':{'type':detail['type'],'message':detail['message']}})+'\n')
        return 1
    finally:signal.setitimer(signal.ITIMER_REAL,0)


if __name__=='__main__':sys.exit(main())
