"""Checkpoint15 PREFIX: post-repair bounded cube512/384 evidence; archive IO only."""
import argparse
import gzip
import importlib.util
import json
from pathlib import Path
import re
import stat
import tarfile

HOME=Path(__file__).resolve().parent
ROOT=HOME.parents[1]
spec=importlib.util.spec_from_file_location('checkpoint08_io',HOME/'checkpoint-08.py')
io=importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)
MANIFEST=HOME/'CHECKPOINT-15-PREFIX.json'
BASE=ROOT/'examples/physics-contact-convergence-2276'
ANISO=ROOT/'examples/physics-anisotropic-inertia-2276/evidence'
OUTPUT=ROOT/'output/playwright/contact-convergence'
GUARDS=ROOT/'examples/physics-world-p5-2276/evidence'
EXPECTED_DEPENDENCIES={'CHECKPOINT-14.json': {'bytes': 838088, 'sha256': 'c00a1494db5da05888f569d0ba7499469e968f96b29565bc74d14dc28c87154e'}, 'CHECKPOINT-14-SOURCE.tar.gz': {'bytes': 377899, 'sha256': '089b0e92d3116abdce4ccd3471cedb06a41e080c2bbb3985ace0206eaca77ca1'}, 'CHECKPOINT-14-PROOF.tar.gz': {'bytes': 5072916, 'sha256': '34226c16970002ace3eafbbfe0effb7f771ced7b3957931eb11b2a840027786d'}}


def build(dt_id,long_id,desktop_id):
    for prefix,value in [('dt-',dt_id),('long-',long_id),('contact-viewer-current-hidpi-',desktop_id)]:
        io.require(value.startswith(prefix) and re.fullmatch(r'[a-z0-9-]+',value),'explicit fresh final IDs')
    io.require(not MANIFEST.exists(),'immutable manifest exists')
    for role in ('SOURCE','PROOF'):
        io.require(not (HOME/('CHECKPOINT-15-PREFIX-'+role+'.tar.gz')).exists(),'immutable archive exists')
    dependencies={io.relative(HOME/name):io.pin(HOME/name) for name in EXPECTED_DEPENDENCIES}
    io.require({Path(name).name:item for name,item in dependencies.items()}==EXPECTED_DEPENDENCIES,
               'immutable checkpoint14 triple changed')
    prior=io.read_json(HOME/'CHECKPOINT-14.json')
    io.require(prior['status']=='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION','dependency14 status')
    source={Path(__file__).resolve(),HOME/'checkpoint-08.py',HOME/'checkpoint-15.py'}
    source.update(io.files(ROOT/'packages/barocss-physics/src'))
    for name in ('package.json','build-root.mjs','build-types.mjs','tsconfig.json','README.md','ROADMAP.md'):
        source.add(ROOT/'packages/barocss-physics'/name)
    if (ROOT/'packages/barocss-physics/scripts').is_dir():
        source.update(io.files(ROOT/'packages/barocss-physics/scripts'))
    for p in io.files(BASE):
        if not {'evidence','baseline','output','node_modules','__pycache__'}.intersection(p.relative_to(BASE).parts):
            source.add(p)
    source.update(ROOT/name for name in (
        'apps/library-docs/docs/packages/physics/host-integration.md',
        'apps/library-docs/docs/packages/physics/index.md',
        'apps/library-docs/docs/packages/physics/profiles-and-lifecycle.md',
        'apps/library-docs/docs/reference/physics-verification.md',
        'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
        'examples/physics-motion-docs-2276/check-site.mjs',
        'examples/physics-world-p5-2276/WORK-STATUS.json'))
    proof=set(io.files(BASE/'evidence'))
    proof.update(io.files(BASE/'baseline'))
    proof.update(io.files(OUTPUT))
    for name in ('public-build-03','private-02','api-02'):
        proof.update(io.files(ANISO/name))
    receipts,guard_names={},[]
    for folder in sorted(GUARDS.iterdir()):
        if folder.is_dir() and folder.name.startswith('contact-') and not folder.name.startswith(('contact-checkpoint-15-','contact-checkpoint15-')):
            io.receipt(folder/'result.json',receipts,guard=True)
            guard_names.append(folder.name)
            proof.update(io.files(folder))
    paths={
        'privateGeometry':BASE/'evidence/private-repair-03/result.json',
        'tensorPrivate':ANISO/'private-02/result.json',
        'publicApi':ANISO/'api-02/result.json',
        'initialFrames':BASE/'evidence/post-initial-01/result.json',
        'postRegression':BASE/'evidence/post-regression-01/result.json',
        'dt':BASE/'evidence'/dt_id/'result.json',
        'long':BASE/'evidence'/long_id/'result.json',
        'desktop':OUTPUT/desktop_id/'browser/result.json',
    }
    statuses={
        'privateGeometry':'PRIVATE_REPAIR_479_SOURCE_NATIVE_GEOMETRY_CONFIRMED',
        'tensorPrivate':'ANISOTROPIC_PRIVATE_SOURCE_NATIVE_20CALLS_13REFERENCES_CONFIRMED',
        'publicApi':'ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED',
        'initialFrames':'CONTACT_POST_REPAIR_INITIAL_FRAMES_CONFIRMED',
        'postRegression':'CONTACT_POST_REPAIR_FAILURE_RESTORE_REGRESSION_CONFIRMED',
        'dt':'CONTACT_DT_SOURCE_NATIVE_WINDOW_REFERENCES_CONFIRMED',
        'long':'CONTACT_CONVERGENCE_NO_GO',
        'desktop':'CONTACT_VIEWER_CURRENT_PREFIX_HIDPI_NATIVE_WINDOWS_AND_PIXELS_CONFIRMED',
    }
    actual={}
    for label,p in paths.items():
        io.receipt(p,receipts)
        d=io.read_json(p)
        io.require(d['status']==statuses[label],'required actual terminal PASS: '+label)
        for key in ('failure','firstFailure'):
            io.require(label=='long' or d.get(key) is None,'first failure on required gate: '+label)
        io.require(d['sourceIntegrity']==(True if label=='desktop' else 'PASS'),'source integrity: '+label)
        actual[label]=d
    # PREPARED means compiled artifacts, not a numerical/World PASS. Inspect all five commands directly.
    build_path=ANISO/'public-build-03/result.json'
    compiled=io.read_json(build_path)
    io.require(compiled['status']=='PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED' and
               compiled['sourceIntegrity'] is True and compiled['firstFailure'] is None,'actual build03 artifact')
    labels=['generate-source-provider','strict-source-nodenext','canonical-types','canonical-root','generate-emitted-provider']
    io.require([c['label'] for c in compiled['commands']]==labels,'exact five compiler/generator commands')
    io.require(all(c['exit']==0 and c['signal'] is None and c['error'] is None for c in compiled['commands']),
               'all five build commands closed successfully')
    receipts[io.relative(build_path)]={'status':compiled['status'],**io.pin(build_path),
        'artifactOnlyNotNumericalPass':True,'fiveSuccessfulClosedCompilerCommands':True}
    actual['build']=compiled
    for g in ('source','native'):
        a=actual['privateGeometry']['reports'][g]
        io.require(a['geometryCalls']==42 and a['referenceCalls']==3 and a['regressionCases']==20 and
                   a['originalPointRows']==32,'private geometry population')
        a=actual['tensorPrivate']['reports'][g]
        io.require(a['worlds']==0 and a['candidateCalls']==20 and a['referenceReplies']==13,'tensor private population')
        a=actual['publicApi']['reports'][g]
        io.require(a['worlds']==8 and a['acceptedSteps']==212 and a['referenceReplies']==8,'new public API population')
        a=actual['postRegression']['reports'][g]
        io.require(a['worlds']==7 and a['acceptedSteps']==82 and a['externalReturns']==78 and
                   a['replayedSteps']==4 and a['refusals']==4,'post repair failure/replay population')
        a=actual['dt']['reports'][g]
        io.require(a['worlds']==6 and a['acceptedSteps']==840 and a['stepAttempts']==840 and
                   a['passedIndependentTransitions']==840 and a['comparedAndVerifiedTransitions']==840 and
                   a['referenceReplies']==14,'actual new DT population')
        a=actual['long']['reports'][g]
        io.require(a['worlds']==2 and a['acceptedSteps']==(1001 if g=='source' else 896) and
                   a['stepAttempts']==(1002 if g=='source' else 896) and a['passedIndependentTransitions']==896 and
                   a['comparedAndVerifiedTransitions']==896 and a['referenceReplies']==9,'actual new NO_GO/qualified-prefix counts')
        for label in ('dt','long'):
            io.require(actual[label]['checkpoint32BarrierPassed'] is True,'both32 barrier: '+label)
        for name,limit in [('long-two',512),('long-three',384)]:
            c=actual['long']['reports'][g]['cases'][name]
            io.require(c['passedIndependentTransitions']==limit and c['comparedTransitions']==limit,'declared passed prefix only')
    problem=actual['long']['failure']
    io.require(problem['phase']=='source-long-three-step-490' and problem['graph']=='source' and
               problem['code']=='NUMERIC_LIMIT' and problem['message']=='frictionless island: fresh post contact normal feasibility',
               'new step490 first failure retained')
    refusal_path=BASE/'evidence'/long_id/'source-long-three-refusal-490.json'
    refusal=io.read_json(refusal_path)['data']
    io.require(refusal['ownerUnchanged'] is True and refusal['before']==refusal['after'] and
               refusal['before']['state']['stepIndex']==489 and refusal['observed']['details']['accepted']['stepIndex']==489,
               'saved actual owner retention; signed words bound by paid builder/capture')
    initial=actual['initialFrames']
    io.require(initial['paidPacketAudits']==16 and initial['initialQuaternionChecks']==48 and
               initial['worldCalls']==0 and initial['candidateCalls']==0,'new initial-frame audit16/48')
    for label in ('dt','long','publicApi','tensorPrivate'):
        io.require(Path(actual[label]['buildManifest']).resolve()==build_path.resolve(),'same actual new build03: '+label)
    desktop=actual['desktop']['actual']
    io.require(desktop['worlds']==3 and desktop['acceptedSteps']==896 and desktop['errors']==[],
               'new current-prefix desktop3World896 population')
    io.require({c['caseId'] for c in desktop['results']}=={'long-two','long-three'},'both original long cases')
    for c in desktop['results']:
        limit=512 if c['caseId']=='long-two' else 384
        count=5 if c['caseId']=='long-two' else 4
        io.require(c['calls']==limit and c['frames']==limit+1 and c['windows']==count and len(c['captures'])==count and
                   all(v['http']==200 and v['result']['status']=='CAPTURE_EQUAL' for v in c['captures']),
                   'declared current-prefix fullword native windows only')
        io.require(c['initialPixels']['coloredPixels']>100 and c['flightPixels']['changedPixels']>10,
                   'actual native-pixel observer gates')
    io.require(desktop['contextProtocol']['contextClosed'] is True and desktop['contextProtocol']['cdpDetached'] is True and
               desktop['contextProtocol']['contextOptions']['deviceScaleFactor']==2,'proved owned DPR2 closure')
    io.require(len(desktop['densityChecks'])==10 and desktop['hiDpi']['realCdpEmulation'] is True and
               desktop['hiDpi']['maxNativePixels']==4194304,'actual HiDPI controls and native budget')
    for check in desktop['densityChecks']:
        s=check['surface']
        io.require(s['pixelWidth']<=4096 and s['pixelHeight']<=4096 and
                   s['pixelWidth']*s['pixelHeight']<=4194304,'native Viewer dimension/area cap')
    for p in sorted(proof):
        if p.name not in ('result.json','summary.json','report.json') or p.stat().st_size>io.LIMIT:
            continue
        d=io.read_json(p)
        if isinstance(d,dict) and isinstance(d.get('status'),str):
            receipts.setdefault(io.relative(p),{'status':d['status'],**io.pin(p),'historicalStatusPreserved':True})
    value=dict(status='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION',baseCommit='3a7975793',dependencies=dependencies,
        scope='New current-provider fixed cube512/384 passed-prefix Viewer HiDPI with exact step490 whole-long NO_GO; not full512/512 or engine completion',
        explicitFinalIds={'dt':dt_id,'long':long_id,'desktop':desktop_id},requiredActualReceipts=actual,
        selectedReceipts=receipts,receiptStatusesArePreservedNotUpgraded=True,
        providerBindings={'unchangedFromCheckpoint14Claim':False,'faceContactKernelAndGeneratedProviderChanged':True,
            'actualCanonicalBuild03CopiesAreProofNotNewNumericalCalls':True},
        qualificationBoundaries={
            'privateGeometryEach':{'calls':42,'references':3,'regressionCases':20,'originalPointRows':32,'originalPointNumericWordsPreserved':True},
            'tensorPrivateEach':{'worlds':0,'calls':20,'references':13},
            'newPublicEach':{'worlds':8,'steps':212,'references':8},
            'postInitialAudit':{'paidPackets':16,'initialQuaternions':48,'worlds':0},
            'postRegressionEach':{'worlds':7,'acceptedSteps':82,'replayedSteps':4,'typedRefusals':4},
            'dtEach':{'worlds':6,'steps':840,'references':14},
            'longQualifiedEach':{'worlds':2,'steps':896,'references':9,'two':512,'three':384,'wholeLongStatus':'NO_GO_STEP490','sourceObservedAccepted':1001,'nativeObservedAccepted':896,'source385to489':'OBSERVED_NOT_INDEPENDENTLY_PASSED'},
            'desktop':{'worldsIncludingZeroStepReset':3,'steps':896,'frames':{'two':513,'three':385},'nativeWindows':9,
                'realOwnedDPR2':True,'maxNativePixels':4194304,'sample640OnlyDisplayObserver':True},
            'historicalLong01':'NO_GO_SOURCE_THREE479_OWNER_RETAINED','currentLong02':'NO_GO_SOURCE_THREE490_OWNER489_RETAINED','full512512UiAndCheckpoint15':'NOT_RUN_BLOCKED_NOT_WEAKENED',
            'historicalHiDpiPrefix02':'PASS_TWO512_THREE384_ONLY',
            'oldPrivate01And02ClassificationFailures':'PRESERVED_WITHOUT_STATUS_REWRITE',
            'oldHiDpi01AndProbeWrapperFailures':'PRESERVED_WITHOUT_STATUS_REWRITE',
            'full512512Qualified':False,'fixedEqualMassAlignedCubesOnly':True,'completePhysicsEngine':False,'generalMovingEight':False,
            'generalCADAssemblyContact':False,'StudioReactEquipmentManufacturing':'NO_SCOPE_UPGRADE_HOLDS_REMAIN',
            'mobile':'NOT_RUN','publication':False},
        newPhysicsCalls=0,newReferenceCalls=0,
        selectionRecord={'guardPrefixes':['contact-'],'excludedSelfWrapperPrefixes':['stack-contact-','contact-checkpoint-15-','contact-checkpoint15-'],
            'allNewContactEvidenceAndBaseline':True,'allContactPlaywrightOutputs':True,
            'anisotropicArtifacts':['public-build-03','private-02','api-02'],'buildPreparedManuallyValidated':True},
        artifactSelectionLimitIsNotPhysicsOrMemoryAdmission=True,archiveInputLimitBytesPerFile=io.LIMIT,
        selectedInputLimitBytes=io.TOTAL_LIMIT,externalLocalOriginalsNotInArchives={},archives={})
    total, count = 0, 0
    for role, paths in (('source', source), ('proof', proof)):
        archive = HOME / ('CHECKPOINT-15-PREFIX-' + role.upper() + '.tar.gz')
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


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--build',action='store_true')
    group.add_argument('--verify',action='store_true')
    parser.add_argument('--dt')
    parser.add_argument('--long')
    parser.add_argument('--desktop')
    args=parser.parse_args()
    if args.build:
        io.require(all((args.dt,args.long,args.desktop)),'--build requires explicit --dt --long --desktop final IDs')
        result=build(args.dt,args.long,args.desktop)
    else:
        io.require(not any((args.dt,args.long,args.desktop)),'--verify uses immutable manifest final IDs')
        result=io.verify(io.read_json(MANIFEST))
    print(json.dumps(result))
