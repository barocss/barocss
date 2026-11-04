"""Checkpoint14: anisotropic inertia source/evidence archive IO; Root executes only."""
import argparse
import gzip
import importlib.util
import json
from pathlib import Path
import re
import stat
import tarfile

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
spec = importlib.util.spec_from_file_location('checkpoint08_io', HOME / 'checkpoint-08.py')
io = importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)
MANIFEST = HOME / 'CHECKPOINT-14.json'
BASE = ROOT / 'examples/physics-anisotropic-inertia-2276'
OUTPUT = ROOT / 'output/playwright/anisotropic-inertia'
GUARDS = ROOT / 'examples/physics-world-p5-2276/evidence'
EXPECTED_DEPENDENCIES = {'CHECKPOINT-13.json': {'bytes': 176332, 'sha256': '0591d4049ba05af6108a634d313930525145f31d4e0a7143bc1c3888f97fab7e'}, 'CHECKPOINT-13-SOURCE.tar.gz': {'bytes': 176978, 'sha256': '9e9e3673717de8fe3d09765eea3102e1224030685086856c174c86743961e5b9'}, 'CHECKPOINT-13-PROOF.tar.gz': {'bytes': 1110739, 'sha256': '295d1b2eece63b68701a0027e8c8300a96319e5dbc22ce60d914e05bbba1ac2b'}}


def build(consumer_id, desktop_id):
    io.require(re.fullmatch(r'consumers-[a-z0-9-]+', consumer_id), 'explicit consumer ID required')
    io.require(re.fullmatch(r'anisotropic-desktop-[a-z0-9-]+', desktop_id), 'explicit desktop ID required')
    io.require(not MANIFEST.exists(), 'immutable manifest exists')
    for role in ('SOURCE', 'PROOF'):
        io.require(not (HOME / ('CHECKPOINT-14-' + role + '.tar.gz')).exists(), 'immutable archive exists')
    dependencies = {io.relative(HOME / name): io.pin(HOME / name) for name in EXPECTED_DEPENDENCIES}
    io.require({Path(name).name: item for name, item in dependencies.items()} == EXPECTED_DEPENDENCIES,
               'immutable checkpoint13 triple changed')
    prior = io.read_json(HOME / 'CHECKPOINT-13.json')
    io.require(prior['status'] == 'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION', 'checkpoint13 status')
    source = {Path(__file__).resolve(), HOME / 'checkpoint-08.py'}
    source.update(io.files(ROOT / 'packages/barocss-physics/src'))
    for name in ('package.json', 'build-root.mjs', 'build-types.mjs', 'tsconfig.json', 'README.md', 'ROADMAP.md'):
        source.add(ROOT / 'packages/barocss-physics' / name)
    scripts = ROOT / 'packages/barocss-physics/scripts'
    if scripts.is_dir():
        source.update(io.files(scripts))
    for p in io.files(BASE):
        if not {'evidence', 'baseline', 'output', 'node_modules', '__pycache__'}.intersection(p.relative_to(BASE).parts):
            source.add(p)
    source.update(ROOT / name for name in (
        'examples/physics-anisotropic-inertia-2276/CONSUMER-READINESS.md',
        'apps/library-docs/samples/physics-anisotropic.test.mjs',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'apps/library-docs/docs/reference/physics-verification.md',
        'apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    proof = set(io.files(BASE / 'evidence'))
    proof.update(io.files(BASE / 'baseline'))
    proof.update(io.files(OUTPUT / desktop_id))
    desktop_failures = {}
    for folder in sorted(OUTPUT.iterdir()):
        p = folder / 'browser/result.json'
        if folder.is_dir() and folder.name != desktop_id and p.is_file():
            data = io.read_json(p)
            if data.get('status') == 'ANISOTROPIC_DESKTOP_NO_GO':
                proof.update(io.files(folder))
                desktop_failures[folder.name] = data
    receipts, guard_names = {}, []
    for folder in sorted(GUARDS.iterdir()):
        if folder.is_dir() and folder.name.startswith('anisotropic-'):
            io.receipt(folder / 'result.json', receipts, guard=True)
            guard_names.append(folder.name)
            proof.update(io.files(folder))
    paths = {
        'baseline': BASE / 'evidence/baseline-01/result.json',
        'capture': BASE / 'evidence/capture-01/result.json',
        'build': BASE / 'evidence/public-build-02/result.json',
        'private': BASE / 'evidence/private-01/result.json',
        'public': BASE / 'evidence/api-01/result.json',
        'failureRegression': BASE / 'evidence/failure-regression-01/result.json',
        'oracleControls': BASE / 'evidence/oracle-controls-01/result.json',
        'initialFrameAudit': BASE / 'evidence/frame-audit-01/result.json',
        'consumers': BASE / 'evidence' / consumer_id / 'result.json',
        'desktop': OUTPUT / desktop_id / 'browser/result.json',
    }
    statuses = {
        'baseline': 'ANISOTROPIC_ORIGINAL_REFUSAL_BASELINE_REPRODUCED',
        'capture': 'ANISOTROPIC_ORIGINAL_FREE_CAPTURE_AND_REFUSAL_CONFIRMED',
        'build': 'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED',
        'private': 'ANISOTROPIC_PRIVATE_SOURCE_NATIVE_20CALLS_13REFERENCES_CONFIRMED',
        'public': 'ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED',
        'failureRegression': 'ANISOTROPIC_FAILURE_RESTORE_REGRESSION_CONFIRMED',
        'oracleControls': 'ANISOTROPIC_INERTIA_REFERENCE_CONTROLS_CONFIRMED',
        'initialFrameAudit': 'ANISOTROPIC_INITIAL_FRAME_AUDIT_CONFIRMED',
        'consumers': 'ANISOTROPIC_CAD_CADMODEL_GPU_CPU_CONSUMERS_CONFIRMED',
        'desktop': 'ANISOTROPIC_DESKTOP_NUMERICAL_WORDS_AND_PIXELS_CONFIRMED',
    }
    actual = {}
    for label, p in paths.items():
        data = io.read_json(p)
        if label == 'build':
            # This preserved build receipt ends in PREPARED by design: it means
            # compiled artifacts are ready, not that a numerical run passed.
            # Authenticate the exact completed compiler chain and owner guard;
            # do not weaken the generic terminal numerical-receipt predicate.
            io.require(data['status'] == statuses[label], 'exact build artifact status')
            commands = data['commands']
            io.require([c['label'] for c in commands] == [
                'generate-source-provider', 'strict-source-nodenext', 'canonical-types',
                'canonical-root', 'generate-emitted-provider'], 'complete compiler chain')
            io.require(all(c['exit'] == 0 and c['signal'] is None and c['error'] is None
                           for c in commands), 'completed compiler commands')
            guard = GUARDS / 'anisotropic-public-build-02/result.json'
            io.receipt(guard, receipts, guard=True)
            io.require(io.read_json(guard)['status'] == 'PASS', 'actual completed build guard')
            receipts[io.relative(p)] = {'status': data['status'], **io.pin(p)}
        else:
            io.receipt(p, receipts)
        io.require(data['status'] == statuses[label], 'required actual status: ' + label)
        for key in ('failure', 'firstFailure'):
            io.require(data.get(key) is None, 'required success failure field: ' + label)
        expected_integrity = True if label in ('build', 'desktop') else 'PASS'
        io.require(data['sourceIntegrity'] == expected_integrity, 'source integrity: ' + label)
        actual[label] = data
    for g in ('source', 'native'):
        a = actual['baseline']['reports'][g]
        io.require(a['worlds'] == 2 and a['stepAttempts'] == 2 and a['acceptedSteps'] == 0 and
                   a['knownRefusals'] == 2, 'original natural refusal population')
        a = actual['capture']['reports'][g]
        io.require(a['worlds'] == 1 and a['acceptedSteps'] == 0 and a['captureThrows'] == 1 and
                   a['oldCandidateCalls'] == 1 and a['oldCandidateRefusals'] == 1,
                   'actual FREE capture population')
        a = actual['private']['reports'][g]
        io.require(a['worlds'] == 0 and a['acceptedSteps'] == 0 and a['candidateCalls'] == 20 and
                   a['referenceReplies'] == 13 and a['capturedFreeCalls'] == 1,
                   'private20/13 population')
        io.require(a['capturedReference']['certificate']['independentlyCertifiedContactPhase'] is False,
                   'captured tensor-only scope cannot become contact proof')
        a = actual['public']['reports'][g]
        io.require(a['worlds'] == 8 and a['acceptedSteps'] == 212 and a['referenceReplies'] == 8 and
                   a['passedIndependentTransitions'] == 212, 'public eight-case population')
        a = actual['failureRegression']['reports'][g]
        io.require(a['worlds'] == 7 and a['acceptedSteps'] == 82 and a['replayedSteps'] == 4 and
                   a['externalReturns'] == 78 and a['refusals'] == 4, 'failure/restore population')
        a = actual['consumers']['reports'][g]
        io.require(a['worlds'] == 2 and a['acceptedSteps'] == 16 and a['gpu']['renderDevice'] is False,
                   'CPU consumer2World16 steps only')
    controls = actual['oracleControls']
    for key, expected in {'confirmedControls':16, 'oracleCLIAttempts':16, 'analyticalHelperCalls':3,
                          'helperRestoreCalls':4, 'worldCalls':0, 'candidateCalls':0}.items():
        io.require(controls[key] == expected, 'reference controls population: ' + key)
    frame_audit = actual['initialFrameAudit']
    for key, expected in {'paidPacketAudits':16, 'paidInitialQuaternionChecks':48,
                          'negativeControls':5, 'oldOracleDiagnosticCalls':2, 'auditCalls':21,
                          'worldCalls':0, 'candidateCalls':0, 'compilerCalls':0}.items():
        io.require(frame_audit[key] == expected, 'additive initial-frame audit population: ' + key)
    desktop = actual['desktop']['actual']
    io.require(desktop['worlds'] == 3 and desktop['acceptedSteps'] == 128 and desktop['errors'] == [],
               'desktop3World128 population')
    io.require({item['caseId'] for item in desktop['results']} == {'natural-120-64','principal-spin-120-64'},
               'exact dual64 desktop cases')
    for a in desktop['results']:
        io.require(a['calls'] == 64 and a['frames'] == 65 and
                   a['firstContacts'] == {'lower':1,'upper':None} and
                   a['capture']['result']['status'] == 'CAPTURE_EQUAL' and
                   a['firstPixels']['coloredPixels'] > 100 and a['flightPixels']['changedPixels'] > 10,
                   'actual65frame word/GPU proof')
        io.require(a['capture']['result']['providerDigest'] == actual['public']['reports']['native']['providerDigest'],
                   'same actual canonical Native desktop provider')
    for p in sorted(proof):
        if p.name not in ('result.json', 'summary.json', 'report.json') or p.stat().st_size > io.LIMIT:
            continue
        data = io.read_json(p)
        if isinstance(data, dict) and isinstance(data.get('status'), str):
            receipts.setdefault(io.relative(p), {'status':data['status'], **io.pin(p),
                                                'historicalStatusPreserved':True})
    value = dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',
        baseCommit='1493071bf', dependencies=dependencies,
        scope='Natural rotated anisotropic primitive-COM tensor fix: preserved original refusal, actual FREE, new private/public reference banks, bounded CAD consumers and same-stage dual64 Native desktop',
        explicitConsumerId=consumer_id, explicitDesktopId=desktop_id,
        requiredActualReceipts=actual, selectedReceipts=receipts, preservedDesktopFailures=desktop_failures,
        providerBindings={'unchangedFromCheckpoint13Claim':False,
            'physicsTensorKernelAndGeneratedProviderChanged':True,
            'compiledProviderByteCopiesAreEvidenceNotNewNumericalCalls':True},
        qualificationBoundaries={
            'originalRefusalPerGraph':{'worlds':2,'acceptedSteps':0,'knownFirstStepRefusals':2},
            'actualOldFreeCapturePerGraph':{'worlds':1,'acceptedSteps':0,'oldCandidateRefusals':1,'identity':'UNTRUSTED_TEST_COPY'},
            'initialFrameAudit':{'paidPackets':16,'authoredInitialQuaternionChecks':48,'negativeControls':5,
                'oldOracleDiagnostics':2,'worldCalls':0,'candidateCalls':0,'paidOracleSourcesUnchanged':True},
            'privatePerGraph':{'worlds':0,'candidateCalls':20,'references':13,'capturedContactPhaseCertified':False},
            'publicPerGraph':{'worlds':8,'acceptedSteps':212,'references':8,'mainNatural':64,'mainPrincipalSpin':64,
                'matchedTimes':{'seconds':.1,'Hz':[60,120,240],'steps':[6,12,24]}},
            'failureRestorePerGraph':{'worlds':7,'acceptedSteps':82,'externalReturns':78,'replayedSteps':4,'knownRefusals':4},
            'consumersPerGraph':{'worlds':2,'acceptedSteps':16,'cadUnits':'mm','cadModelUnits':'MMGS','physicsUnits':'m-kg-s',
                'axis':'CAD_XYZ_UNCHANGED_EXPLICIT_Z_GRAVITY','gpu':'SCENE_FACADE_CPU_ONLY'},
            'desktop':{'worldsIncludingZeroStepReset':3,'acceptedSteps':128,'framesEachCase':65,
                'actualNativeFullStateCommandsAndWordsEqual':True,
                'energy':'BODY_LOCAL_ROTATIONAL_KE_WITH_INDEPENDENT_PRINCIPAL_3/208_GATE_AT_1_20_64'},
            'publicProfile':'rigid-persistent-box-v1','bodyCap':4,'upperContactQualified':False,
            'generalAnisotropicContactQualified':False,'fullTensorBRepRobotBridge':False,
            'studio':'CODE_INSPECTION_ONLY_HOLD','generalEightDynamicQualified':False,
            'olderFirstFailures':'PRESERVED_NO_SCOPE_UPGRADE','mobile':'NOT_RUN','publication':False},
        newPhysicsCalls=0, newReferenceCalls=0, receiptStatusesArePreservedNotUpgraded=True,
        selectionRecord={'guardPrefixes':['anisotropic-'],'checkpointWrapperPrefixExcluded':'stack-anisotropic-',
            'explicitConsumerId':consumer_id,'explicitPassedDesktop':desktop_id,
            'allLocalFirstFailureBanksIncluded':True,'virtualMetafileInputsPreservedWithActualSourceAliasPins':True},
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,
        archiveInputLimitBytesPerFile=io.LIMIT, selectedInputLimitBytes=io.TOTAL_LIMIT,
        externalLocalOriginalsNotInArchives={}, archives={})
    total, count = 0, 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-14-' + role.upper() + '.tar.gz')
        members, first = {}, {}
        with archive.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w|') as tar:
            for path in sorted(paths):
                item, name = io.pin(path), io.relative(path)
                if item['bytes'] > io.LIMIT:
                    value['externalLocalOriginalsNotInArchives'][name] = {
                        **item, 'notInGit': True, 'includedInArchives': False}
                    continue
                total += item['bytes']
                count += 1
                io.require(total <= io.TOTAL_LIMIT and count <= io.MEMBER_LIMIT, 'selected byte/member limit')
                mode = stat.S_IMODE(path.stat().st_mode)
                members[name] = {**item, 'mode': mode}
                entry = tarfile.TarInfo(name)
                entry.mode, entry.mtime = mode, 0
                key = item['sha256'], item['bytes'], mode
                if key in first:
                    entry.type, entry.linkname = tarfile.LNKTYPE, first[key]
                    tar.addfile(entry)
                else:
                    first[key], entry.size = name, item['bytes']
                    with path.open('rb') as stream:
                        tar.addfile(entry, stream)
                io.require(io.pin(path) == item, 'input changed while archiving: ' + name)
        value['archives'][role] = dict(file=archive.name, **io.pin(archive),
            members=members, uniqueBlobs=len(first))
    value['selectedInputBytes'], value['selectedMemberCount'] = total, count
    result = io.verify(value)
    with MANIFEST.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')
    return result


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--build',action='store_true')
    mode.add_argument('--verify',action='store_true')
    parser.add_argument('--desktop')
    parser.add_argument('--consumers')
    args=parser.parse_args()
    if args.build:
        io.require(args.desktop is not None and args.consumers is not None,
                   '--build requires explicit --desktop and --consumers IDs')
        result=build(args.consumers,args.desktop)
    else:
        io.require(args.desktop is None and args.consumers is None,
                   '--verify uses immutable manifest selections')
        result=io.verify(io.read_json(MANIFEST))
    print(json.dumps(result))
