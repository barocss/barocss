#!/usr/bin/env python3
"""Native-only completion: closed T targets, authenticated complete Source, no integration."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import signal
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
MIB = 1048576
T02_SHA = '4597ad8a4d8ee710ff18c060f3dd2cf121efaa630e2ef187763126c17053e547'
M02_SHA = '90412a7e20b106939c14de7c5f8d619f0cd69d19caa780c91300ce540e3f0c36'
BASE_SHA = '5f5eee9ac2cd8b654eab134823a619254fd0b7c4ab8791419d077a71413a09eb'
FRACTION_BASE = 109442
DECIMAL_BASE = 23634120
SOURCE_PROOF = str(HERE.relative_to(ROOT) / 'T02-SOURCE-COMPLETE-PROOF.json')


def need(value, message, detail=None):
    if not value:
        error = ValueError(message); error.detail = detail; raise error


def file_sha(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''): result.update(block)
    return result.hexdigest()


def unique(rows):
    value = {}
    for key, child in rows:
        need(key not in value, 'duplicate JSON key'); value[key] = child
    return value


def definitions(name, path, digest):
    need(file_sha(path) == digest, 'immutable definition provider ' + name)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def authenticate(args):
    path = Path(args.freeze)
    need(path.stat().st_size <= 262144 and file_sha(path) == args.token, 'explicit parent token')
    # Fixed parent-produced ASCII authority; full bounded decoder is applied after
    # loading the authenticated definitions. This local envelope holds <=262144B.
    raw = path.read_bytes()
    need(raw.count(b'{') + raw.count(b'[') <= 2048, 'authority container preflight')
    freeze = json.loads(raw, object_pairs_hook=unique); raw = None
    need(freeze['status'] == 'PARENT_AUTHORIZED_G1B_NATIVE_COMPLETION' and
         freeze['mode'] == 'G1B_NATIVE_COMPLETION_ONLY' and freeze['phase'] == 'NATIVE_ONLY' and
         freeze['runtimeAuthorized'] is True and freeze['sourceWorldAuthorized'] is False and
         freeze['referenceRecomputeAuthorized'] is False and freeze['productionActivation'] is False and
         freeze['runId'] == args.run_id, 'Native-only runtime authority')
    names = ('reference-native-completion.py','NATIVE-COMPLETION-PLAN.md','NATIVE-COMPLETION-PLAN.json',
             'NATIVE-COMPLETION-PROTOCOL.md','NATIVE-COMPLETION-READY.json','NATIVE-COMPLETION-REVIEW.md',
             'native-completion.mjs','NATIVE-COMPLETION-DRIVER-PLAN.json','NATIVE-COMPLETION-DRIVER-READY.json',
             'T02-SOURCE-COMPLETE-PROOF.json','reference-trajectory.py','REFERENCE-READY-T02.json',
             'REFERENCE-BANK-REUSE-T02.json','reference-micro.py')
    for name in names: need(str(HERE.relative_to(ROOT) / name) in freeze['files'], 'required authority ' + name)
    for name, pin in freeze['files'].items():
        target = (ROOT / name).resolve()
        need(target.is_relative_to(ROOT) and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'file pin ' + name)
    for name, pin in freeze['toolFiles'].items():
        target = Path(name)
        need(target.is_absolute() and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'tool pin ' + name)
    need(Path(sys.executable).resolve() == Path(freeze['tools']['python']).resolve() and freeze['tools']['python'] in freeze['toolFiles'], 'actual pinned Python')
    need(freeze['highReview']['approved'] is True and freeze['highReview']['path'] in freeze['files'], 'pinned High approval')
    t = definitions('native_closed_t02', HERE / 'reference-trajectory.py', T02_SHA)
    m = definitions('native_closed_m02', HERE / 'reference-micro.py', M02_SHA)
    b = definitions('native_closed_baseline', ROOT / 'examples/physics-rigid-rotation-g1-2276/baseline-classify.py', BASE_SHA)
    # Definitions only. No Source JS module, candidate or numerical function runs.
    provider = t.read_data(HERE / 'evidence/g1b-micro-02/staged-providers.json', MIB)
    for pin in provider['stagedPins']:
        target = Path(pin['path']).resolve()
        need(target.is_relative_to(HERE / 'evidence/g1b-micro-02/build') and target.stat().st_size == pin['bytes'] and file_sha(target) == pin['sha256'], 'complete actual reused provider closure')
    provider = None
    return freeze, t, m, b


def build_server(t, m, b):
    Previous = t.build_server_types(m, b)

    class Arithmetic(b.Arithmetic):
        def operation(self):
            self.counts['fractionScalarOperations'] += 1
            need(self.counts['fractionScalarOperations'] <= 1000000 and
                 FRACTION_BASE + self.counts['fractionScalarOperations'] <= 10000000, 'new/global Fraction caps')

    class Server(Previous):
        def __init__(self, args, freeze):
            super().__init__(args, freeze, None)
            self.f = Arithmetic(self.counts)
            self.source_pin = None

        def source_authority(self, packet):
            proof = self.load(SOURCE_PROOF, 'sourceAuthority', 65536)
            need(proof['status'] == 'AUTHENTICATED_T02_SOURCE_COMPLETE', 'closed actual Source completion')
            refs = [proof[k] for k in ('originSummary','lastSourceReply','sourceFrames','sourceTrace','sourceCoefficients','sourceAlgorithmProvider')]
            refs += proof['sourceAuditProofs'] + proof['inputs']
            for pin in refs:
                declared = self.freeze['files'].get(pin['path'])
                need(declared is not None and declared['bytes'] == pin['bytes'] and declared['sha256'] == pin['sha256'], 'complete Source authority transitive pins')
            summary = self.manifest_data(proof['originSummary'], 'sourceSummary', 65536)
            need(summary['graphs']['source'] == proof['sourceGraph'] and proof['sourceGraph']['status'] == 'PASS_TRAJECTORY_GRAPH', 'actual Source graph PASS association')
            c = proof['sourceGraph']['counts']
            need(c['constructorAttempts'] == c['constructorReturns'] == c['disposeAttempts'] == c['disposeReturns'] == 8 and
                 c['getStateAttempts'] == c['getStateReturns'] == 18 and c['stepAttempts'] == 57 and c['acceptedSteps'] == 47 and
                 c['referenceAuditsReceived'] == 55, 'closed Source World/audit ledger')
            self.owners.pop('sourceSummary'); summary = c = None
            reply = self.manifest_data(proof['lastSourceReply'], 'sourceLastReply', 4096)
            need(reply['status'] == 'PASS_G1B_TRAJECTORY_AUDIT' and reply['graph'] == 'source' and reply['sourceGraphComplete'] is True and
                 reply['requestOrdinal'] == 56 and reply['counts']['observedStateAuditsReturned'] == 55, 'actual source55 completion reply')
            self.owners.pop('sourceLastReply'); reply = None
            sequence = [(cid, i) for cid, end in zip(t.IDS, t.ENDS) for i in range(end + 1)]
            need(len(proof['sourceAuditProofs']) == len(sequence) == 55 and len(proof['inputs']) == 8, 'all Source proof/input refs')
            for ordinal, (pin, (cid, index)) in enumerate(zip(proof['sourceAuditProofs'], sequence), 1):
                need(pin['ordinal'] == ordinal, 'ordered Source audit proof')
                row = self.manifest_data(pin, 'sourceAuditRow', 49152)
                need(row['graph'] == 'source' and row['caseId'] == cid and row['stepIndex'] == index, 'Source audit association')
                self.owners.pop('sourceAuditRow'); row = None
            coefficients = self.manifest_data(proof['sourceCoefficients'], 'sourceCoefficientEquality', 65536)
            need(coefficients == packet['actualNativeCoefficientsRaw'], 'current Native equals actual complete Source coefficients')
            self.owners.pop('sourceCoefficientEquality'); coefficients = None
            need(len(packet['cases']) == 8, 'eight current Native inputs')
            for index, pin in enumerate(proof['inputs']):
                need(pin['index'] == index, 'ordered actual Source input pins')
                row = self.manifest_data(pin, 'sourceInputEquality', 8192)
                need(row == packet['cases'][index]['pairRaw'], 'current Native input equals complete Source input')
                self.owners.pop('sourceInputEquality'); row = None
            # Hash-only authentication for frames/traces: never parse/retain Source
            # state, private metrics, errors, refinement maps or JS module objects.
            self.source_pin = {'path': SOURCE_PROOF, **self.freeze['files'][SOURCE_PROOF]}
            self.owners['sourceAuthorityPin'] = self.source_pin
            self.owners.pop('sourceAuthority'); proof = refs = sequence = pin = None
            self.memory({})

        def init(self, packet):
            self.source_authority(packet)
            need('actualNativeCoefficientsRaw' in packet and 'sourceCoefficientsRaw' not in packet, 'Native actual coefficients only')
            # The closed loader's historical parameter is an equality slot only.
            # Its value is the CURRENT Native raw words; no Source computation.
            packet['sourceCoefficientsRaw'] = packet.pop('actualNativeCoefficientsRaw')
            reply = super().init(packet)
            self.audit_cursor = 55; self.source_complete = True
            need(not self.initial and not self.private and not self.errors and not self.refinement_done, 'no retained Source numerical roots')
            self.memory({})
            reply.update(status='PASS_G1B_NATIVE_COMPLETION_BANK', sourceGraphComplete=True,
                         actualNativeAudits=0, reusedSourceAudits=55, logicalAuditCursor=55, sourceAuthority=self.source_pin)
            return reply

        def write(self, name, value, cap=MIB, reserved=False):
            if name.startswith('audit-') and value.get('stepIndex') == 0:
                # Store the complete actual private observation BEFORE releasing
                # its case root. This is measured input, never expected evidence.
                value['initialPrivateObservation'] = self.private['native:' + value['caseId']]
            return super().write(name, value, cap, reserved)

        def audit(self, packet):
            need(packet.get('graph') == 'native' and 55 <= self.audit_cursor < 110, 'fresh Native audits only')
            result = super().audit(packet)
            cid = packet['caseId']
            if packet['stepIndex'] == self.configs[cid]['steps']:
                self.initial.pop('native:' + cid); self.private.pop('native:' + cid)
                # Matched errors are needed until the finest grid completes.
                if cid == t.IDS[2]: self.errors.clear()
            result.update(status='PASS_G1B_NATIVE_COMPLETION_AUDIT', actualNativeAudits=self.counts['observedStateAuditsReturned'],
                          reusedSourceAudits=55, logicalAuditCursor=self.audit_cursor)
            self.memory({})
            return result

        def progress(self, failure=None):
            value = {'counts': self.counts, 'actualNativeAudits': self.counts['observedStateAuditsReturned'],
                     'logicalAuditCursor': self.audit_cursor, 'reusedSourceAudits': 55 if self.source_complete else 0,
                     'sourceGraphComplete': self.source_complete, 'firstFailure': failure}
            self.memory(value); data = t.wire(value); need(len(data) <= 8192, 'bounded progress')
            (self.out / 'progress.json').write_bytes(data)

        def finish(self):
            c = self.counts
            need(self.audit_cursor == 110 and self.source_complete and c['observedStateAuditsAttempted'] == c['observedStateAuditsReturned'] ==
                 c['properRationalRotationReturns'] == c['properRationalRotationAttempts'] == c['clockRoundings'] == 55 and c['privateBodyObservations'] == 8, 'actual Native55/logical110 ledger')
            need(all(c[k] == 0 for k in ('bodyGeometryCertificatesAttempted','bodyGeometryCertificatesReturned','oneDimensionalMonomialMoments',
                 'algebraicBisectionDecisions','algebraicRootsCertified','taylorWindowsAttempted','taylorWindowsReturned','decimal80Windows','decimal120Windows',
                 'decimalOperations','decimalConversions','decimalToFractionConversions','endpointDecimalSqrtOperations','WorldCalls','candidateCalls','PhysicsImports','referenceLinearSolves','trigEvaluations')), 'no fresh reference integration or engine calls')
            need(len(self.refinement_done) == 36 and len(self.refinement_proofs) == 2 and not self.initial and not self.private and not self.errors, 'Native refinement and completed-root release')
            self.finished = True
            summary = self.write('summary.json', {'status':'PASS_G1B_NATIVE_COMPLETION_FINISH','counts':dict(c),
                'actualNativeAudits':55,'reusedSourceAudits':55,'logicalAuditCursor':110,'sourceGraphComplete':True,
                'sourceAuthority':self.source_pin,'bank':self.bank_pin,
                'jointDecimal':DECIMAL_BASE,'jointStudyFraction':FRACTION_BASE+c['fractionScalarOperations'],
                'priorStudyFraction':FRACTION_BASE,'newNativeFraction':c['fractionScalarOperations'],
                'refinement':{'actualNativeChecks':36,'reusedSourceChecks':36,'allPass':True,'allBelowFloor':all(self.refinement_done.values()),'proofs':self.refinement_proofs},
                'countBoundary':'Saved summary before reply57; returned56 then final reply57; reused Source55 are not new calls.',
                'peakOwnedUpperBytes':self.peak,'productionActivation':False,'heapOrRssClaim':False},65536)
            return {'status':'PASS_G1B_NATIVE_COMPLETION_FINISH','actualNativeAudits':55,'reusedSourceAudits':55,
                    'logicalAuditCursor':110,'sourceGraphComplete':True,'bank':self.bank_pin,'summary':summary}

    return Server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('run-id','freeze','token','out'): parser.add_argument('--' + key, required=True)
    args = parser.parse_args(); started = time.monotonic_ns(); server = None; t = None
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('170s Native completion deadline')))
    signal.setitimer(signal.ITIMER_REAL, 170)
    try:
        freeze,t,m,b = authenticate(args)
        Server = build_server(t,m,b); server = Server(args,freeze)
        ready = {'status':'READY_G1B_NATIVE_COMPLETION_REFERENCE','protocol':'G1B_NATIVE_COMPLETION_JSONL_V1','requestOrdinal':0,
                 'runId':args.run_id,'authoritySha256':args.token,'counts':dict(server.counts)}
        server.memory(ready); data=t.wire(ready); need(len(data)<=4096,'bounded READY')
        sys.stdout.buffer.write(data); sys.stdout.buffer.flush(); data=ready=None
        while not server.finished:
            line=packet=reply=response=None
            for key in ('activeLine','activePacket','activeReply','activeResponse'): server.owners.pop(key,None)
            line=sys.stdin.buffer.readline(262145)
            need(line and len(line)<=262144 and line.endswith(b'\n'),'complete bounded request; no premature EOF')
            server.owners['activeLine']=line;server.memory({},t.decode_bound(line))
            need(time.monotonic_ns()-started<170000000000,'deadline before request')
            packet=t.parse(line);server.owners['activePacket']=packet
            server.counts['requestsAttempted']+=1;ordinal=server.counts['requestsAttempted'];op=packet.get('op')
            need(ordinal<=57,'fixed57requests');server.progress()
            if op=='init':need(ordinal==1,'INIT first');reply=server.init(packet)
            elif op=='audit':need(2<=ordinal<=56,'55Native audits');reply=server.audit(packet)
            elif op=='finish':need(ordinal==57,'FINISH57');reply=server.finish()
            else:raise ValueError('unknown Native completion operation')
            reply.update(op=op,requestOrdinal=ordinal,counts={**server.counts,'requestsReturned':server.counts['requestsReturned']+1})
            server.owners['activeReply']=reply;server.write('reply-'+str(ordinal).zfill(4)+'.json',reply,4096)
            server.counts['requestsReturned']+=1;server.progress()
            response=t.wire(reply);need(len(response)<=4096,'bounded reply');server.owners['activeResponse']=response;server.memory(reply)
            sys.stdout.buffer.write(response);sys.stdout.buffer.flush()
        return 0
    except BaseException as error:
        signal.setitimer(signal.ITIMER_REAL,4)
        detail={'type':type(error).__name__,'message':str(error)[:2048],'detail':getattr(error,'detail',None)}
        if server is not None:
            failure={'status':'FAIL_G1B_NATIVE_COMPLETION_REFERENCE','op':locals().get('op'),'requestOrdinal':server.counts['requestsAttempted'],
                     'counts':dict(server.counts),'firstFailure':detail}
            try:
                server.progress({'type':detail['type'],'message':detail['message']})
                artifact=server.write('first-failure.json',failure,57344,reserved=True)
            except BaseException as receipt_error:
                artifact=None;failure['firstFailure']['receiptError']=str(receipt_error)[:512]
            failure['firstFailure']['detail']=None
            if artifact:failure['artifact']=artifact
            data=t.wire(failure)
            if len(data)>4096:failure['firstFailure']['message']=failure['firstFailure']['message'][:512];data=t.wire(failure)
            need(len(data)<=4096,'bounded failure wire');sys.stdout.buffer.write(data);sys.stdout.buffer.flush()
        else:sys.stderr.write(json.dumps({'status':'FAIL_G1B_NATIVE_COMPLETION_REFERENCE_STARTUP','firstFailure':{'type':detail['type'],'message':detail['message']}})+'\n')
        return 1
    finally:signal.setitimer(signal.ITIMER_REAL,0)


if __name__ == '__main__':sys.exit(main())
