"""Root-only one fresh full Gram bank; six corrected audits precede one cost gate."""
import json
import math
from pathlib import Path
import re
import signal
import sys
import time
from bounds import Evidence, authenticate, command, pin, require, REPLY_BYTES
from physical import compare
from transport import Transport, bootstrap

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FRAME_IDS = ['ALIGNED-1','ALIGNED-16','OFFSET-1','OFFSET-16','YAW-1','YAW-16']


def main():
    require(len(sys.argv)==3 and re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}',sys.argv[1]),
            'USAGE:run.py FRESH_ID ROOT_REVIEWED_PROTOCOL_SHA')
    evidence=Evidence(HERE/'evidence'/sys.argv[1]);started=time.monotonic();deadline=started+170
    summary=dict(protocol='p4-full-gram-six-harness-v1',status='NOT_RUN',firstFailure=None,cases=[],
        controls={case:'NOT_RUN' for case in FRAME_IDS},counts=dict(candidateChecksAttempted=0,
        independentChecksAttempted=0,independentChecksPassed=0,freshFullWrapperCommands=0,
        fullFramesVerified=0,costDecisions=0,WorldCalls=0,baselineReruns=0),stageB='NOT_RUN',costDecision='NOT_RUN',
        reruns=dict(G0=0,U0=0,A10=0,R0=0,R1=0),oldCombinations='UNCHANGED_ENDED_NO_RETIME',
        oldV3ObservedMemory='REVOKED_UNCHANGED_NO_REAUDIT',wholeP4='UNCHANGED_NO_GO',directAPI='NOT_RUN',desktop='NOT_RUN')
    metadata={};io=None;cursor='authentication'
    old_handler=signal.signal(signal.SIGALRM,lambda *_:(_ for _ in ()).throw(TimeoutError('SHARED_INTERNAL_170S')))
    signal.alarm(170)
    def meta(name,path):
        value=bootstrap(path);metadata[name]=value;return value
    def control():
        return io.control(metadata,summary)
    def child(label,argv):
        result=command(argv,b'',ROOT,deadline)
        evidence.put(label+'.stdout.raw',result.pop('stdout'));evidence.put(label+'.stderr.raw',result.pop('stderr'))
        evidence.put(label+'.process.json',result);return result
    try:
        frozen_path=HERE/'AUTHOR-FREEZE-01.json';frozen=meta('frozen',frozen_path)
        require(frozen['rootReviewedProtocolSHA256']==sys.argv[2],'EXACT_ROOT_REVIEWED_PROTOCOL')
        authenticate(ROOT,frozen['files']);authenticate(ROOT,frozen['externalToolFiles'])
        protocol=meta('protocol',ROOT/frozen['runProtocol'])
        require(pin(ROOT/frozen['runProtocol'])['sha256']==sys.argv[2],'UNCHANGED_REVIEWED_PROTOCOL')
        python=protocol['python'];require(Path(sys.executable).resolve()==Path(python).resolve(),'PINNED_PYTHON')
        summary['freezePin']=pin(frozen_path)
        for field in ('qualifiedIntegerA10Guard','qualifiedR0Guard','qualifiedR1Guard','ownedGuard'):
            receipt=meta(field,ROOT/protocol[field])
            require(receipt['status']=='PASS' and receipt['exit']==0 and receipt['timedOut'] is False,'ACTUAL_GUARD_PASS:'+field)
        owned_qualification=meta('ownedQualification',ROOT/protocol['ownedQualification'])
        require(owned_qualification['status']=='PASS_OWNED_DATA_SEVEN_PURE_DATA_GROUPS' and owned_qualification['firstFailure'] is None
                and owned_qualification['finalAuthentication']=='ALL_FROZEN_FILES_AND_TOOLS_EQUAL'
                and owned_qualification['pinsPin']==pin(ROOT/protocol['ownedPins']),'ACTUAL_CORRECTED_HELPER_QUALIFICATION')
        prior=meta('priorA10',ROOT/protocol['qualifiedIntegerA10'])
        require(prior['status']=='PASS_POSITION_WITNESS_STAGE_A_TEN_PURE_KERNEL_CHECKS' and prior['firstFailure'] is None
                and prior['counts']['candidateChecksAttempted']==prior['counts']['independentChecksPassed']==10,'ACTUAL_UNCHANGED_INTEGER_A10')
        oldfreeze=meta('oldfreeze',ROOT/protocol['qualifiedIntegerFreeze'])
        require(prior['freezePin']==pin(ROOT/protocol['qualifiedIntegerFreeze']),'ORIGINAL_A10_SOURCE_BINDING')
        for path in protocol['reusedIntegerSourcePaths']:
            require(oldfreeze['files'][path]==frozen['files'][path]==pin(ROOT/path),'IDENTICAL_INTEGER_COMPONENT')
        del oldfreeze;metadata.pop('oldfreeze')
        for stage,status,calls in [('R0','PASS_R0_PURE17_ONE_GLOBAL_METER',17),('R1','PASS_R1_NINE_PAIRS_ONE_GLOBAL_METER',9)]:
            qualified=meta(stage,ROOT/protocol['qualified'+stage])
            require(qualified['status']==status and qualified['firstFailure'] is None
                    and qualified['finalAuthentication']=='ALL_FROZEN_SOURCES_AND_TOOLS_EQUAL'
                    and qualified['counts']['candidateCallsAttempted']==qualified['counts']['candidateReplies']==calls
                    and qualified['counts']['meterContexts']==1,'ACTUAL_SHARED_METER_COMPONENT_PASS:'+stage)
            sourcepins=meta(stage+'pins',ROOT/protocol['qualified'+stage+'Pins'])
            require(qualified['pinsPin']==pin(ROOT/protocol['qualified'+stage+'Pins']),'QUALIFIED_COMPONENT_SOURCE_SEAL:'+stage)
            for path in protocol['reused'+stage+'SourcePaths']:
                require(sourcepins['sources'][path]==frozen['files'][path]==pin(ROOT/path),'EXACT_COMPONENT_BYTES:'+stage)
            del sourcepins;metadata.pop(stage+'pins')
        io=Transport();control()
        bank=ROOT/protocol['bankDirectory'];manifest=meta('bankManifest',bank/'stage-b.json')
        require([c['id'] for c in manifest['cases']]==FRAME_IDS and manifest['candidateChecks']==manifest['callCap']==6
                and manifest['singleMeasuredBank'] is True and manifest['compactCalls']==432,'ONE_ORIGINAL_SIX_FRAME_BANK')
        corpus=meta('corpus',HERE/'CORPUS.json');authorities={c['id']:c for c in corpus['frames']}
        wrapper_manifest_path=ROOT/protocol['wrapperManifest'];wrapper_manifest=meta('wrapperManifest',wrapper_manifest_path)
        require(wrapper_manifest['cases']==manifest['cases'] and
                (wrapper_manifest_path.parent/wrapper_manifest['bankDirectory']).resolve()==bank.resolve(),'SAME_ORIGINAL_REQUEST_BANK')
        control();cursor='single-fresh-full-bank';wrapper_out=evidence.directory/'full-bank'
        summary['counts']['freshFullWrapperCommands']+=1
        process=child('full-bank-candidate',[python,'-B',str(HERE/'wrapper.py'),'world-bank',str(wrapper_manifest_path),str(wrapper_out)])
        for file in sorted(wrapper_out.rglob('*')):
            require(not file.is_symlink(),'NO_OUTPUT_SYMLINK')
            if file.is_file():evidence.adopt(file,REPLY_BYTES)
        wrapper=meta('wrapperSummary',wrapper_out/'summary.json')
        summary['wrapperReturnedCounts']=dict(wrapper['counts']);summary['wrapperFirstFailure']=wrapper['firstFailure']
        require(process['status']=='PASS_COMMAND_ONLY' and wrapper['status']==protocol['wrapperSuccessStatus']
                and wrapper['firstFailure'] is None,'FULL_WRAPPER_FIRST_FAILURE:'+str(wrapper['firstFailure']))
        require(wrapper['namespaceOverrides']==['solve_model'] and wrapper['geometryAlgorithm']=='PAIR_LOCAL_GRAM_MIXED_DETERMINANTS',
                'ONLY_NEW_GEOMETRY_SOLVE_MODEL')
        schema=protocol['wrapperSchema']
        rows=wrapper['frames'];require([row['caseId'] for row in rows]==FRAME_IDS,'ORIGINAL_FULL_FRAME_ORDER')
        cost_total=0;control()
        for case,row in zip(manifest['cases'],rows):
            cursor=case['id'];summary['controls'][cursor]='EXECUTED_NO_GO'
            request_path=bank/case['request'];require(pin(request_path)==case['requestPin']=={
                key:authorities[cursor]['request'][key] for key in ('bytes','sha256')},'EXACT_ORIGINAL_REQUEST_BYTES')
            request_doc=io.open(request_path,case['requestPin']);request=request_doc.value
            require(request['op']=='world' and (request['scene'],request['stepIndex'])==(row['scene'],row['step']),'ORIGINAL_REQUEST_FRAME')
            del request;io.close(request_doc);del request_doc
            for field,pinfield in [('fullReplyFile','fullReplyPin'),('kernelReplyFile','kernelReplyPin'),('modelExactFile','modelExactPin')]:
                require(Path(row[field]).name==row[field] and pin(wrapper_out/row[field])==row[pinfield],'ACTUAL_IN_CALL_FILE_PIN:'+field)
            reply_path=wrapper_out/row['fullReplyFile'];kernel_path=wrapper_out/row['kernelReplyFile']
            output=evidence.directory/(cursor+'-independent.json');summary['counts']['independentChecksAttempted']+=1
            control()
            process=child(cursor+'-checker',[python,'-B',str(ROOT/protocol['referenceDirectory']/'validator.py'),cursor,
                str(request_path),str(reply_path),str(kernel_path),str(output)])
            require(output.is_file(),'INDEPENDENT_REPORT_REQUIRED');output_pin=evidence.adopt(output)
            audit_doc=io.open(output,output_pin);audit=audit_doc.value
            require(process['status']=='PASS_COMMAND_ONLY' and audit['status']=='EXECUTED_PASS_FULL_GRAM_REFERENCE'
                    and audit['firstFailure'] is None,'INDEPENDENT_FIRST_FAILURE:'+str(audit['firstFailure']))
            require(audit['WorldCalls']==audit['coldQpCalls']==audit['candidateCallsByValidator']==0,'NO_HIDDEN_WORK')
            details=audit['audit'];census=details['closedLeafCensus'];samev3=details['sameV3Comparison']
            require(details['requestPin']==pin(request_path) and details['replyPin']==row['fullReplyPin']
                    and details['actualInCallKernelReplyPin']==row['kernelReplyPin'],'AUDIT_ACTUAL_FILES_BOUND')
            require((details['compactRecordsVerified'],details['numericWordsVerified'],details['conventionProblemsVerified'],details['axisVisitsVerified'])
                    ==(72,432,144,2160),'ALL_PHYSICAL_WORDS_AXES_CONVENTIONS')
            require(census['concreteExceptionsValidated']==census['concreteExceptionsConsumed']==len(census['consumedConcretePaths'])==1447
                    and len(set(census['consumedConcretePaths']))==1447 and census['certificateRenamesDescended']==72
                    and census['unconsumedExceptions']==[] and census['normalization'] is False and census['subtreeExclusion'] is False,'CLOSED_V2_1447_PATHS')
            require(samev3['allLeavesExact'] is True and samev3['numericExceptions']==0 and samev3['normalization'] is False
                    and samev3['subtreeExclusion'] is False,'PREVIOUS_ACTUAL_V3_FULL_PHYSICAL_AND_CERT_EXACT')
            require(details['combinedAuditLimitBytes']==32*1024*1024 and details['nonJSONReservationBytes']==8*1024*1024
                    and details['jsonBudgetIncludingSharedScratchBytes']==24*1024*1024
                    and details['walkerAndHelperScratchConcurrent'] is False and details['boundedPeakOwnedBytes']<=32*1024*1024,
                    'CORRECTED_AUDIT_SAME32_WITH_NO_CONCURRENT_SCRATCH')
            # Copy ONLY small receipt metadata into predeclared control ownership.
            selected=dict(path=str(output.relative_to(ROOT)),pin=output_pin,status=audit['status'],
                physicalLeavesCompared=census['physicalLeavesCompared'],concreteExceptionsConsumed=1447,
                sameV3AllLeavesExact=True,auditorOwnedBytes=details['explicitRetainedBytes'],
                auditorOwnedPeakBytes=details['observedRetainedPeakBytes'],auditorBoundedPeakBytes=details['boundedPeakOwnedBytes'])
            independent=json.loads(json.dumps(selected,allow_nan=False))
            del selected,details,census,samev3,audit;io.close(audit_doc);del audit_doc
            summary['counts']['independentChecksPassed']+=1
            kernel_doc=io.open(kernel_path,row['kernelReplyPin']);kernel=kernel_doc.value
            model_doc=io.open(wrapper_out/row['modelExactFile'],row['modelExactPin']);model=model_doc.value
            reply_doc=io.open(reply_path,row['fullReplyPin']);reply=reply_doc.value
            require(reply['ok'] is True and reply['resolved'] is True and reply['executionFailure'] is False,'ACTUAL_FULL_SUCCESS')
            require(kernel['protocol']=='p4-position-witness-kernel-v1' and kernel['status']=='EXACT_KKT_CERTIFIED','ACTUAL_IN_CALL_INTEGER_PROOF')
            require(set(model)=={'a','b','inverse','columns','d','m'} and model['d']==24 and model['m']==36
                    and row['legacyOuterCalls']['problemEquivalenceIntegerComparisons']==1848,'ALL924_MODEL_COEFFICIENT_PAIRS')
            certificate=kernel['certificate']
            fields={'translationsExact','lambdaExactKgM','primalMarginsExactM','objectiveExactKgM2',
                'stationarityExactKgM','complementarityExactKgM2','basisRows','basisRank','dynamicDof',
                'certificateExact','translations','lambdaKgM','primalMarginsM','objectiveKgM2'}
            require(set(certificate)==fields,'COMPLETE_IN_CALL_CERTIFICATE')
            for key in fields-{'stationarityExactKgM','complementarityExactKgM2'}:
                compare(certificate[key],reply['reference'][key],{'replace':[],'add':[],'remove':[]})
            require(certificate['stationarityExactKgM']==['0/1']*24 and certificate['complementarityExactKgM2']==['0/1']*36,'EXACT_ALL_ROW_ZERO_VECTORS')
            compare(kernel['proofCounters'],reply['reference']['proofCounters'],{'replace':[],'add':[],'remove':[]})
            for key,value in kernel['metrics'].items():compare(value,reply['metrics'][key],{'replace':[],'add':[],'remove':[]})
            del key,value
            packet_measurement=io.packets();core=row['coreCpuNs'];require(type(core) is int and core>=0,'ACTUAL_PARENT_CONTEXT_CPU')
            cost_total+=core;summary['counts']['fullFramesVerified']+=1;summary['controls'][cursor]='EXECUTED_PASS'
            summary['cases'].append(dict(id=cursor,status='EXECUTED_PASS',independent=independent,coreCpuNs=core,
                parentPacketOwnedBytes=packet_measurement['ownedBytes'],parentPacketAuxReservedBytes=packet_measurement['auxReservedPeakBytes']))
            del certificate,kernel,model,reply
            io.close(reply_doc);io.close(model_doc);io.close(kernel_doc)
            del reply_doc,model_doc,kernel_doc
            control()
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
        summary['wrapperSummaryPin'] = pin(wrapper_out / 'summary.json')
        counts = wrapper[schema['counts']]
        for name, expected in protocol['wrapperExpectedCounts'].items():
            require(counts[name] == expected, 'WRAPPER_ACTUAL_CENSUS:' + name)
        sat = wrapper['satCounters']
        require(sat['conventionProblems'] == 864 and sat['axisVisits'] == 12960, 'UNCHANGED_SAT_COMPLETE_POPULATION')
        require(type(sat['integerOperations']) is int and 0 <= sat['integerOperations'] <= 2000000 and sat['peakIntegerBits'] <= 16384, 'ORIGINAL_SEPARATE_SAT_BUDGET')
        summary['satCounters'] = sat
        require(wrapper['ownedTransport']['observations']=='QUALIFIED_ACTUAL_KEY_VALUE_AND_FRACTION_WALKER','QUALIFIED_WRAPPER_MEMORY_OBSERVER')
        summary['wrapperOwnedTransport']=dict(wrapper['ownedTransport'])
        summary['parentOwnedTransport']=io.receipt()
        control()
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
        summary['status']='NO_GO_FULL_GRAM_HARNESS'
        summary['firstFailure']=dict(cursor=cursor,type=type(error).__name__,message=str(error))
    finally:
        signal.alarm(0);signal.signal(signal.SIGALRM,old_handler)
        summary.update(elapsedWallNs=round((time.monotonic()-started)*1e9),writtenEvidenceBytesBeforeSummary=evidence.bytes,
            parentReservationBytes=24*1024*1024,auditorOrNodeReservationBytes=32*1024*1024,
            transportReservationBytes=8*1024*1024,combinedExplicitBytes=64*1024*1024,rssQualified=False,
            original1200Steps='NOT_RUN',baselineRemeasured=False,
            laterChecks='NOT_RUN_AFTER_FIRST_FAILURE' if summary['firstFailure'] else 'COMPLETE_PATH_REQUIRES_SEPARATE_REVIEW')
        if io is not None:summary['parentOwnedTransport']=io.receipt()
        evidence.put('summary.json',summary,terminal=True)
    print(json.dumps(dict(status=summary['status'],firstFailure=summary['firstFailure'],counts=summary['counts'],costDecision=summary['costDecision'])))
    return int(summary['firstFailure'] is not None)


if __name__=='__main__':raise SystemExit(main())
