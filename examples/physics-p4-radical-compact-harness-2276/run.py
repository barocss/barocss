"""Root-only fresh six-frame direct-grid combination; no candidate/checker imports."""
import json
import math
from pathlib import Path
import re
import signal
import sys
import time
from bounds import Evidence, authenticate, command, pin, require, retained_size, REPLY_BYTES, EVIDENCE_BYTES
from transport import read_json
from physical import compare

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
REFERENCE = ROOT / 'examples/physics-p4-radical-compact-reference-2276'
FRAME_IDS = ['ALIGNED-1', 'ALIGNED-16', 'OFFSET-1', 'OFFSET-16', 'YAW-1', 'YAW-16']


def main():
    require(len(sys.argv) == 3, 'USAGE:run.py FRESH_ID ROOT_REVIEWED_PROTOCOL_SHA')
    run_id, reviewed = sys.argv[1:]
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', run_id) is not None, 'FRESH_RUN_ID')
    evidence = Evidence(HERE / 'evidence' / run_id)
    started = time.monotonic(); deadline = started + 170
    summary = dict(protocol='p4-direct-grid-full-six-harness-v1',status='NOT_RUN',firstFailure=None,cases=[],
        controls={case:'NOT_RUN' for case in FRAME_IDS},counts=dict(candidateChecksAttempted=0,
        candidateRepliesRetained=0,independentChecksAttempted=0,independentChecksPassed=0,
        freshFullWrapperCommands=0,fullFramesVerified=0,costDecisions=0,WorldCalls=0,baselineReruns=0),
        stageB='NOT_RUN',costDecision='NOT_RUN',wholeP4='UNCHANGED_NO_GO',directAPI='NOT_RUN',desktop='NOT_RUN',
        executionBoundary='OFFLINE_SAVED_REQUESTS_ONLY_NEW_COMBINATION',componentCostEligibility='OLD_INTEGER_COST_ENDED_NOT_REVIVED',
        rerunG0=0,rerunU0=0,rerunA=0)
    cursor='authentication'; peak=0
    old_handler=signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('INTERNAL_170S_DEADLINE')))
    signal.alarm(170)
    def child(label,argv,require_pass=True):
        result=command(argv,b'',ROOT,deadline)
        evidence.put(label+'.stdout.raw',result.pop('stdout'));evidence.put(label+'.stderr.raw',result.pop('stderr'))
        evidence.put(label+'.process.json',result)
        if require_pass: require(result['status']=='PASS_COMMAND_ONLY',result['firstFailure'] or 'CHILD_COMMAND_FAILED')
        return result
    def audited_case(case,request_path,reply_path,kernel_path):
        nonlocal peak
        parent_roots=(request,reply,saved,model_exact,manifest,corpus,wrapper,protocol,frozen,oldfreeze,prior,r0,r0pins,summary)
        audit_parent_bytes=retained_size(*parent_roots)
        require(audit_parent_bytes<=24*1024*1024,'AUDIT_PARENT_24M_RESERVATION')
        peak=max(peak,audit_parent_bytes)
        output=evidence.directory/(case['id']+'-independent.json')
        summary['counts']['independentChecksAttempted']+=1
        process=child(case['id']+'-checker',[python,'-B',str(REFERENCE/'validator.py'),case['id'],
            str(request_path),str(reply_path),str(kernel_path),str(output)],require_pass=False)
        output_pin=evidence.adopt(output);audit=read_json(output,retained=parent_roots)
        audit_parent_bytes=retained_size(*parent_roots,audit)
        require(audit_parent_bytes<=24*1024*1024,'AUDIT_REPORT_PARENT_24M_RESERVATION')
        peak=max(peak,audit_parent_bytes)
        require(process['status']=='PASS_COMMAND_ONLY' and audit['status']=='EXECUTED_PASS_FULL_DIRECT_GRID_REFERENCE' and audit['firstFailure'] is None,'INDEPENDENT_FULL_CASE_NO_GO:'+str(audit['firstFailure']))
        require(audit['WorldCalls']==0 and audit['coldQpCalls']==0,'INDEPENDENT_FORBIDDEN_WORK')
        require(audit['candidateCallsByValidator']==0,'NO_VALIDATOR_CANDIDATE_REEVALUATION')
        details=audit['audit'];census=details['closedLeafCensus']
        require(details['explicitRetainedBytes']+details['scratchReservedBytes']<=32*1024*1024 and details['combinedAuditLimitBytes']==32*1024*1024 and details['boundedPeakOwnedBytes']<=32*1024*1024,'AUDITOR_RETAINED_SCRATCH_AND_PEAK_32M_RESERVATION')
        summary['auditMemoryReservation']=dict(parentLimitBytes=24*1024*1024,auditorLimitBytes=32*1024*1024,transportEncodingHashBytes=8*1024*1024,combinedLimitBytes=64*1024*1024,notRSS=True)
        require(details['requestPin']==pin(request_path) and details['replyPin']==pin(reply_path) and details['actualInCallKernelReplyPin']==pin(kernel_path),'AUDITOR_ACTUAL_FULL_AND_IN_CALL_BINDING')
        require(details['immutableKernelRequestPin']==pin(bank/('kernel-'+case['id']+'.json')) and details['savedV2AuthorityPin']==pin(ROOT/authorities[case['id']]['positionV2Oracle']['path']),'AUDITOR_IMMUTABLE_KERNEL_AND_FULL_AUTHORITY_BINDING')
        require((details['compactRecordsVerified'],details['numericWordsVerified'],details['conventionProblemsVerified'],details['axisVisitsVerified'])==(72,432,144,2160),'COMPLETE_PER_FRAME_PHYSICAL_CERTIFICATE_CENSUS')
        require(census['concreteExceptionsValidated']==census['concreteExceptionsConsumed']==len(census['consumedConcretePaths'])==len(set(census['consumedConcretePaths']))==1447 and census['certificateRenamesDescended']==72 and census['physicalLeavesCompared']>0,'CLOSED_CONCRETE_PATH_CENSUS')
        require(census['unconsumedExceptions']==[] and census['normalization'] is False and census['subtreeExclusion'] is False and details['newIntervalRootCalls']==0,'NO_UNKNOWN_OMISSION_NORMALIZATION_OR_CANDIDATE_CALL')
        summary['counts']['independentChecksPassed']+=1
        return dict(path=str(output.relative_to(ROOT)),pin=output_pin,status=audit['status'],physicalLeavesCompared=census['physicalLeavesCompared'],concreteExceptionsConsumed=1447,certificateRenamesDescended=72,auditorBoundedPeakOwnedBytes=details['boundedPeakOwnedBytes'],auditorObservedRetainedPeakBytes=details['observedRetainedPeakBytes'],parentAuditRetainedBytes=audit_parent_bytes)
    try:
        frozen_path=HERE/'AUTHOR-FREEZE-01.json';frozen=read_json(frozen_path,EVIDENCE_BYTES)
        require(frozen['rootReviewedProtocolSHA256']==reviewed,'EXACT_ROOT_REVIEWED_PROTOCOL')
        authenticate(ROOT,frozen['files']);authenticate(ROOT,frozen['externalToolFiles'])
        summary['freezePin']=pin(frozen_path);protocol=read_json(ROOT/frozen['runProtocol'])
        require(pin(ROOT/frozen['runProtocol'])['sha256']==reviewed,'UNCHANGED_ROOT_REVIEWED_PROTOCOL')
        python=protocol['python'];require(Path(sys.executable).resolve()==Path(python).resolve(),'PINNED_PYTHON')
        bank=(ROOT/protocol['bankDirectory']).resolve();manifest=read_json(bank/'stage-b.json')
        require([c['id'] for c in manifest['cases']]==FRAME_IDS,'EXACT_ORIGINAL_SIX_ORDER')
        require(manifest['candidateChecks']==manifest['callCap']==6 and manifest['WorldCalls']==manifest['coldQpCalls']==manifest['fixtureCalls']==0,'ORIGINAL_SIX_NO_WORLD')
        corpus=read_json(HERE/'CORPUS.json');authorities={c['id']:c for c in corpus['frames']}
        for prerequisite_guard in ('qualifiedIntegerA10Guard','qualifiedR0Guard'):
            receipt=read_json(ROOT/protocol[prerequisite_guard])
            require(receipt['status']=='PASS' and receipt['exit']==0 and receipt['timedOut'] is False,'ACTUAL_PREREQUISITE_GUARD_PASS:'+prerequisite_guard)
        prior=read_json(ROOT/protocol['qualifiedIntegerA10'])
        require(prior['status']=='PASS_POSITION_WITNESS_STAGE_A_TEN_PURE_KERNEL_CHECKS' and prior['firstFailure'] is None and prior['counts']['candidateChecksAttempted']==prior['counts']['independentChecksPassed']==10,'ACTUAL_UNCHANGED_INTEGER_COMPONENT_A10')
        oldfreeze=read_json(ROOT/protocol['qualifiedIntegerFreeze'],EVIDENCE_BYTES)
        require(prior['freezePin']==pin(ROOT/protocol['qualifiedIntegerFreeze']),'ORIGINAL_A10_FREEZE_BINDING')
        for path in protocol['reusedIntegerSourcePaths']:
            require(oldfreeze['files'][path]==frozen['files'][path]==pin(ROOT/path),'EXACT_REUSED_INTEGER_COMPONENT_IDENTITY')
        r0=read_json(ROOT/protocol['qualifiedR0'])
        require(r0['status']=='PASS_R0_PURE17_ONE_GLOBAL_METER' and r0['firstFailure'] is None and r0['counts']['candidateCallsAttempted']==r0['counts']['candidateReplies']==r0['counts']['auditPasses']==17 and r0['counts']['meterContexts']==1 and r0['finalAuthentication']=='ALL_FROZEN_SOURCES_AND_TOOLS_EQUAL','ACTUAL_R0_SEVENTEEN_SHARED_METER_PASS')
        require(r0['pinsPin']==pin(ROOT/protocol['qualifiedR0Pins']),'EXACT_R0_SOURCE_PINS_BINDING')
        r0pins=read_json(ROOT/protocol['qualifiedR0Pins'])
        for path in protocol['reusedRadicalSourcePaths']:
            require(r0pins['sources'][path]==frozen['files'][path]==pin(ROOT/path),'EXACT_QUALIFIED_R0_COMPONENT_IDENTITY')
        summary['qualifiedPrerequisites']=dict(integerA10=pin(ROOT/protocol['qualifiedIntegerA10']),R0=pin(ROOT/protocol['qualifiedR0']),numericalReruns=0,oldCostRevived=False)
        require(manifest['format'] == 'p4-position-witness-stage-b-bank-v1' and manifest['singleMeasuredBank'] is True and manifest['compactCalls'] == 432, 'ONE_MEASURED_SIX_FRAME_BANK')
        # This new combination has its own Root-reviewed protocol and source seal.
        wrapper_out = evidence.directory / 'full-bank'
        require(not wrapper_out.exists(), 'FRESH_FULL_WRAPPER_DIRECTORY')
        wrapper_manifest_path = ROOT / protocol['wrapperManifest']
        wrapper_manifest = read_json(wrapper_manifest_path)
        require(wrapper_manifest['cases'] == manifest['cases'], 'SAME_ORIGINAL_WRAPPER_BANK_CASES')
        require((wrapper_manifest_path.parent / wrapper_manifest['bankDirectory']).resolve() == bank, 'SAME_WRAPPER_TRANSPORT_BANK')
        cursor = 'single-measured-full-bank'
        summary['counts']['freshFullWrapperCommands'] += 1
        wrapper_process=child('full-bank-candidate', [python, '-B', str(HERE / 'wrapper.py'), 'world-bank', str(wrapper_manifest_path), str(wrapper_out)],require_pass=False)
        for file in sorted(wrapper_out.rglob('*')):
            require(not file.is_symlink(), 'NO_WRAPPER_OUTPUT_SYMLINK')
            if file.is_file():
                evidence.adopt(file, REPLY_BYTES)
        wrapper = read_json(wrapper_out / protocol['wrapperSummaryFile'])
        summary['wrapperReturnedCounts']=wrapper['counts']
        summary['wrapperFirstFailure']=wrapper['firstFailure']
        require(wrapper_process['status']=='PASS_COMMAND_ONLY' and wrapper['status'] == protocol['wrapperSuccessStatus'] and wrapper['firstFailure'] is None, 'WRAPPER_COMPLETE_NUMERICAL_RETURN:'+str(wrapper['firstFailure']))
        schema = protocol['wrapperSchema']
        summary['wrapperReturnedCounts'] = wrapper[schema['counts']]
        rows = wrapper[schema['frames']]
        require([row[schema['caseId']] for row in rows] == FRAME_IDS, 'SIX_FRAME_WRAPPER_ORDER')
        cost_total = 0
        for case, row in zip(manifest['cases'], rows):
            cursor = case['id']
            summary['controls'][case['id']] = 'EXECUTED_NO_GO'
            request_path = bank / case['request']
            request = read_json(request_path)
            frame_id = case['id']
            require(pin(request_path) == {key: authorities[frame_id]['request'][key] for key in ('bytes', 'sha256')}, 'EXACT_ORIGINAL_WORLD_REQUEST_BYTES')
            reply_name = row[schema['replyFile']]
            require(Path(reply_name).name == reply_name, 'WRAPPER_REPLY_NAME')
            reply_path = wrapper_out / reply_name
            require(pin(reply_path) == row[schema['replyPin']], 'WRAPPER_ACTUAL_REPLY_PIN')
            reply = read_json(reply_path, retained=(request, manifest, corpus, wrapper))
            saved_path = ROOT / authorities[frame_id]['positionV2Oracle']['path']
            saved = read_json(saved_path, retained=(request, reply, manifest, corpus, wrapper))
            physical = dict(status='NEW_CLOSED_MAP_FULL_REPLY_VALIDATION_REQUIRED')
            model_name = row['modelExactFile']
            require(Path(model_name).name == model_name, 'ACTUAL_PRICED_NATIVE_MODEL_FILE')
            model_path = wrapper_out / model_name
            require(pin(model_path) == row['modelExactPin'], 'ACTUAL_PRICED_NATIVE_MODEL_PIN')
            model_exact = read_json(model_path, retained=(request, reply, saved, manifest, corpus, wrapper))
            require(set(model_exact) == {'a', 'b', 'inverse', 'columns', 'd', 'm'} and model_exact['d'] == 24 and model_exact['m'] == 36, 'PRICED_NATIVE_MODEL_SCHEMA')
            require(row['legacyOuterCalls']['problemEquivalenceIntegerComparisons'] == 1848, 'ALL_924_OUTER_NATIVE_COEFFICIENT_PAIRS_COMPARED')
            kernel_name = row[schema['kernelFile']]
            require(Path(kernel_name).name == kernel_name, 'ACTUAL_IN_CALL_KERNEL_FILE')
            kernel_path = wrapper_out / kernel_name
            require(pin(kernel_path) == row[schema['kernelPin']], 'ACTUAL_IN_CALL_KERNEL_PIN')
            audit = audited_case(case, request_path, reply_path, kernel_path)
            physical = dict(status='EXECUTED_PASS_CLOSED_MAP_FULL_PHYSICAL', report=audit['path'])
            kernel = read_json(kernel_path, retained=(request, reply, saved, model_exact, manifest, corpus, wrapper))
            require(kernel['protocol'] == 'p4-position-witness-kernel-v1' and kernel['status'] == 'EXACT_KKT_CERTIFIED', 'ACTUAL_IN_CALL_KERNEL_CERTIFIED')
            certificate = kernel['certificate']
            expected_fields = {'translationsExact', 'lambdaExactKgM', 'primalMarginsExactM', 'objectiveExactKgM2',
                'stationarityExactKgM', 'complementarityExactKgM2', 'basisRows', 'basisRank', 'dynamicDof',
                'certificateExact', 'translations', 'lambdaKgM', 'primalMarginsM', 'objectiveKgM2'}
            require(set(certificate) == expected_fields, 'IN_CALL_COMPLETE_CERTIFICATE_FIELDS')
            for key in expected_fields - {'stationarityExactKgM', 'complementarityExactKgM2'}:
                compare(certificate[key], reply['reference'][key], {'replace': [], 'add': [], 'remove': []})
            require(certificate['stationarityExactKgM'] == ['0/1'] * 24 and certificate['complementarityExactKgM2'] == ['0/1'] * 36,
                    'IN_CALL_EXACT_ZERO_VECTORS_BOUND_TO_INDEPENDENT_WORLD_KKT')
            compare(kernel['proofCounters'], reply['reference']['proofCounters'], {'replace': [], 'add': [], 'remove': []})
            for key, value in kernel['metrics'].items():
                compare(value, reply['metrics'][key], {'replace': [], 'add': [], 'remove': []})
            core = row[schema['coreCpuNs']]
            require(type(core) is int and core >= 0, 'ACTUAL_CORE_CPU_NANOSECONDS')
            cost_total += core
            peak = max(peak, retained_size(request, reply, saved, kernel, model_exact, manifest, corpus, wrapper))
            summary['counts']['fullFramesVerified'] += 1
            summary['controls'][frame_id] = 'EXECUTED_PASS'
            summary['cases'].append(dict(id=frame_id, status='EXECUTED_PASS', independent=audit, physical=physical, coreCpuNs=core))
            del request, reply, saved, kernel, certificate, model_exact
        require(wrapper['costDecision'] == 'DEFERRED_EXTERNAL_NUMERIC_AUDIT', 'NO_PREMATURE_COST_DECISION')
        require(wrapper['coreCpuNs'] == wrapper['parentCoreCpuNs'] == cost_total, 'ACTUAL_PARENT_CONTEXT_CPU_SUM')
        worker = wrapper['worker']
        require(worker['workerStarts'] == 1 and worker['requestCalls'] == 6 and worker['workerClosed'] is True and worker['exit'] == 0 and worker['cleanupError'] is None, 'ONE_GENUINELY_CLOSED_NATIVE_WORKER')
        require(worker['childCpuAuthority'] == 'RESOURCE_RUSAGE_CHILDREN_DELTA_AFTER_CLOSE_AND_WAIT' and worker['selfReportedChildCpuUsed'] is False, 'AUTHORITATIVE_CHILD_LIFETIME_CPU')
        before_cpu, after_cpu = worker['resourceBefore'], worker['resourceAfter']
        user_delta = after_cpu['userSeconds'] - before_cpu['userSeconds']
        system_delta = after_cpu['systemSeconds'] - before_cpu['systemSeconds']
        require(math.isfinite(user_delta) and math.isfinite(system_delta) and user_delta >= 0 and system_delta >= 0, 'ACTUAL_CHILD_CPU_MONOTONIC')
        child_cpu = math.ceil((user_delta + system_delta) * 1000000000)
        require(type(worker['childLifetimeCpuNs']) is int and worker['childLifetimeCpuNs'] == child_cpu, 'AUTHORITATIVE_CHILD_RESOURCE_CPU_DELTA')
        envelope_cpu = cost_total + child_cpu
        require(wrapper['conservativeEnvelopeCpuNs'] == envelope_cpu, 'CONSERVATIVE_COST_ENVELOPE')
        require(worker['parentTransportLimitBytes'] == worker['childTransportReservedBytes'] == 4 * 1024 * 1024 and worker['maxExplicitTransportReservedBytes'] <= 4 * 1024 * 1024, 'SHARED_TRANSPORT_EIGHT_MIB_SPLIT')
        summary['wrapperSummaryPin'] = pin(wrapper_out / protocol['wrapperSummaryFile'])
        counts = wrapper[schema['counts']]
        for name, expected in protocol['wrapperExpectedCounts'].items():
            require(counts[name] == expected, 'WRAPPER_ACTUAL_CENSUS:' + name)
        sat = wrapper['satCounters']
        require(sat['conventionProblems'] == 864 and sat['axisVisits'] == 12960, 'UNCHANGED_SAT_COMPLETE_POPULATION')
        require(type(sat['integerOperations']) is int and 0 <= sat['integerOperations'] <= 2000000 and sat['peakIntegerBits'] <= 16384, 'ORIGINAL_SEPARATE_SAT_BUDGET')
        summary['satCounters'] = sat
        require(summary['counts']['fullFramesVerified'] == summary['counts']['independentChecksPassed'] == 6, 'COMPLETE_SIX_FULL_PHYSICAL_AND_INDEPENDENT_GATES')
        authenticate(ROOT, frozen['files']); authenticate(ROOT, frozen['externalToolFiles'])
        summary['finalAuthentication'] = 'ALL_FROZEN_SOURCES_AND_TOOLS_EQUAL'
        summary['stageB'] = 'PASS_SIX_FULL_POSITION_REFERENCES_AND_INDEPENDENT_CHECKS'
        summary['counts']['costDecisions'] += 1
        summary['parentCoreCpuNs'] = cost_total
        summary['childLifetimeCpuNs'] = child_cpu
        summary['conservativeEnvelopeCpuNs'] = envelope_cpu
        summary['costBoundaryIdenticalToSavedBaseline'] = False
        summary['costAuthority'] = 'PARENT_SIX_CONTEXT_CPU_PLUS_OWNED_NODE_ENTIRE_LIFETIME_RESOURCE_CPU'
        summary['worker'] = worker
        summary['savedBaselineCoreCpuNs'] = 773147000
        summary['costDecision'] = 'GO' if envelope_cpu * 10 <= 773147000 * 9 else 'NO_GO'
        summary['status'] = 'PASS_POSITION_WITNESS_STAGE_B_COST_GO' if summary['costDecision'] == 'GO' else 'NO_GO_POSITION_WITNESS_STAGE_B_COST'
        if summary['costDecision'] == 'NO_GO':
            summary['firstFailure'] = dict(cursor='one-cost-decision', type='CostGate', message='CONSERVATIVE_NATIVE_CPU_ENVELOPE_EXCEEDS_FIXED_695832300NS_GATE')
    except Exception as error:
        summary['status'] = 'NO_GO_POSITION_WITNESS_HARNESS'
        summary['firstFailure'] = dict(cursor=cursor, type=type(error).__name__, message=str(error))
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)
        summary.update(elapsedWallNs=round((time.monotonic()-started)*1e9), peakExplicitRetainedDataBytes=peak,
                       explicitDataBoundary='Accounted retained Python data, not process RSS', writtenEvidenceBytesBeforeSummary=evidence.bytes,
                       laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else None,
                       setupIOAuditTiming='Wrapper attribution separately reported; node whole lifetime authority includes startup/IO/shutdown; no subtracting child self timing',
                       warm='NOT_RUN', original1200Steps='NOT_RUN', baselineRemeasured=False)
        evidence.put('summary.json', summary, terminal=True)
    print(json.dumps(dict(status=summary['status'], firstFailure=summary['firstFailure'], counts=summary['counts'], costDecision=summary['costDecision'])))
    return int(summary['firstFailure'] is not None)


if __name__ == '__main__':
    raise SystemExit(main())
