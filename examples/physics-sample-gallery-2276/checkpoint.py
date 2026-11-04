#!/usr/bin/env python3
"""Gallery incremental checkpoint: file I/O only; Root executes after final receipts."""
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
LIB=ROOT/'examples/physics-stack-library-2276'
spec=importlib.util.spec_from_file_location('checkpoint08_io',LIB/'checkpoint-08.py')
io=importlib.util.module_from_spec(spec)
spec.loader.exec_module(io)
io.HOME=HOME
MANIFEST=HOME/'CHECKPOINT.json'
GUARDS=ROOT/'examples/physics-world-p5-2276/evidence'
OUTPUT=ROOT/'output/playwright/physics-gallery'
DEPENDENCIES={
 'CHECKPOINT-15-PREFIX.json':{'bytes':2102462,'sha256':'6b7e4b161e031cc8705be9affb004dcdd4c44d2f22aaad2b95bcdb25f404aedb'},
 'CHECKPOINT-15-PREFIX-SOURCE.tar.gz':{'bytes':423722,'sha256':'36b076b069cc202ff0d308aa457080f226b8f24e6b3305801e30d5f3ee72daae'},
 'CHECKPOINT-15-PREFIX-PROOF.tar.gz':{'bytes':10592521,'sha256':'8f0f6d2c3dd6a1569c55df14c86ab46e1c46c28965d7ab067b482877c76edc3c'},
}
IDS={'projectile':64,'elastic-box':64,'sphere-roll':64,'sphere-ccd':1,'principal-spin':64,'coupled-two':128}


def build(numeric_id,desktop_id):
    io.require(re.fullmatch(r'api-[0-9]+',numeric_id) is not None and
               re.fullmatch(r'gallery-desktop-[0-9]+',desktop_id) is not None,'explicit final IDs')
    io.require(not MANIFEST.exists(),'immutable manifest already exists')
    for role in ('SOURCE','PROOF'):
        io.require(not (HOME/(role+'.tar.gz')).exists(),'immutable archive already exists')
    dependencies={io.relative(LIB/name):io.pin(LIB/name) for name in DEPENDENCIES}
    io.require({Path(p).name:v for p,v in dependencies.items()}==DEPENDENCIES,'checkpoint15-prefix immutable triple changed')
    prior=io.read_json(LIB/'CHECKPOINT-15-PREFIX.json')
    io.require(prior['status']=='CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION','dependency status')
    receipts={}
    numeric_path=HOME/'evidence'/numeric_id/'result.json'
    desktop_path=OUTPUT/desktop_id/'browser/result.json'
    for p in (numeric_path,desktop_path):io.receipt(p,receipts)
    numeric=io.read_json(numeric_path);desktop=io.read_json(desktop_path)
    io.require(numeric['status']=='SAMPLE_GALLERY_SOURCE_NATIVE_ANALYTIC_CONFIRMED' and
               numeric['sourceIntegrity']=='PASS' and numeric['failure'] is None,'actual numerical PASS required')
    io.require(desktop['status']=='SAMPLE_GALLERY_VIEWER_HIDPI_NATIVE_PACKETS_AND_PIXELS_CONFIRMED' and
               desktop['sourceIntegrity'] is True and desktop['firstFailure'] is None,'actual desktop PASS required')
    actual=desktop['actual']
    io.require(actual['worlds']==7 and actual['acceptedSteps']==385 and actual['firstFailure'] is None and
               actual['errors']==[],'actual seven World/385 desktop population')
    io.require(actual['contextProtocol']['contextClosed'] is True and
               actual['contextProtocol']['cdpDetached'] is True and
               actual['contextProtocol']['deviceScaleFactor']==2 and
               actual['contextProtocol']['isMobile'] is False,'actual owned DPR2 context closure')
    io.require(len(actual['cases'])==6 and {c['caseId'] for c in actual['cases']}==set(IDS),'six actual cases')
    for c in actual['cases']:
        n=IDS[c['caseId']]
        io.require(c['steps']==n and c['frames']==n+1 and c['capture']['http']==200 and
                   c['capture']['result']['status']=='CAPTURE_EQUAL','full Native state/ALLword capture')
        io.require(c['initialPixels']['coloredPixels']>100 and c['finalPixels']['changedPixels']>10,
                   'actual GPU pixel thresholds')
    checks=actual['densityChecks']
    io.require({(c['width'],c['height']) for c in checks}>={(1280,800),(1440,900),(1920,1080)} and
               {c['dpr'] for c in checks}=={1,2},'actual three desktop sizes and DPR1/2')
    for c in checks:
        s=c['surface'];io.require(s['pixelWidth']<=4096 and s['pixelHeight']<=4096 and
                    s['pixelWidth']*s['pixelHeight']<=4194304,'existing native area/dimension caps')
    io.require(desktop['wholeProofBytesBeforeFinalReceipt']+65536<=16*2**20,'wholeproof16MiB')
    for graph in ('source','native'):
        a=numeric['reports'][graph]
        io.require(a['worlds']==12 and a['acceptedSteps']==770 and a['independentlyPassedSteps']==385 and
                   a['referenceReplies']==6 and a['typedRefusals']==6,'actual numerical population '+graph)
        io.require(set(a['cases'])==set(IDS),'six numerical cases '+graph)
        for case_id,n in IDS.items():
            c=a['cases'][case_id]
            io.require(c['steps']==n and c['repeatWordEqual'] is True and c['reference']['ok'] is True and
                       c['reference']['resolved'] is True and c['reference']['executionFailure'] is False,
                       'case independent acceptance/repeat '+case_id)
            desc=c['packet'];io.require(io.pin(Path(desc['path']))=={k:desc[k] for k in ('bytes','sha256')},'actual packet pin')
    neg=numeric['reports']['source']['negativeReferenceControl']
    io.require(neg['ok'] is False and neg['resolved'] is True and neg['executionFailure'] is False and
               len(neg['violations'])>0,'one actual Source observer-negative control')
    io.require(len([c for c in numeric['referenceCommands'] if c['negative']])==1 and
               all(c['exit']==0 and c['signal'] is None and c['error'] is None for c in numeric['referenceCommands']),
               'all actual reference processes closed')
    provider_path=Path(numeric['buildManifest']);provider=io.read_json(provider_path)
    old_members={**prior['archives']['source']['members'],**prior['archives']['proof']['members']}
    io.require(io.relative(provider_path) in old_members and
               io.pin(provider_path)=={k:old_members[io.relative(provider_path)][k] for k in ('bytes','sha256')},
               'actual build03 already preserved in dependency, not a fresh compile')
    for table in ('sourcePins','nativePins','currentSourcePins'):
        for name,sha in provider[table].items():
            p=(ROOT/name).resolve();io.require(io.pin(p)['sha256']==sha,'loaded provider stale '+name)
            io.require(name in old_members and old_members[name]['sha256']==sha,'provider dependency binding '+name)
    # The paid numerical run authenticated actual runtime/oracle/tool inputs before and after calls.
    frozen_path=numeric_path.parent/'inputs.json'
    for name,sha in io.read_json(frozen_path)['frozen'].items():
        io.require(io.pin((ROOT/name).resolve())['sha256']==sha,'paid executed dependency changed '+name)
    source={LIB/'checkpoint-08.py'}
    for p in io.files(HOME):
        parts=p.relative_to(HOME).parts
        if not {'evidence','baseline','output','__pycache__','node_modules'}.intersection(parts) and \
                p.name not in ('SOURCE.tar.gz','PROOF.tar.gz','CHECKPOINT.json'):
            source.add(p)
    for name in ('packages/barocss-physics/README.md','packages/barocss-physics/ROADMAP.md',
                 'apps/library-docs/docs/public/physics-evidence/api-roadmap.txt',
                 'apps/library-docs/docs/packages/physics/host-integration.md',
                 'apps/library-docs/docs/packages/physics/index.md',
                 'examples/physics-world-p5-2276/WORK-STATUS.json'):
        source.add(ROOT/name)
    proof=set(io.files(HOME/'evidence'))
    if (HOME/'baseline').is_dir():proof.update(io.files(HOME/'baseline'))
    proof.update(io.files(OUTPUT))
    guard_names=[]
    for folder in sorted(GUARDS.iterdir()):
        if folder.is_dir() and folder.name.startswith('gallery-') and not folder.name.startswith(('gallery-checkpoint-','gallery-archive-')):
            io.receipt(folder/'result.json',receipts,guard=True);proof.update(io.files(folder));guard_names.append(folder.name)
    for p in proof:
        if p.name in ('result.json','summary.json') and p.stat().st_size<=io.LIMIT:
            d=io.read_json(p)
            if isinstance(d,dict) and isinstance(d.get('status'),str):
                receipts.setdefault(io.relative(p),{'status':d['status'],**io.pin(p),'historicalStatusPreserved':True})
    value={'status':'CHECKPOINT_IO_VERIFIED_NO_PHYSICS_EXECUTION','scope':'Six bounded public samples with actual Viewer HiDPI; not full engine completion',
        'dependencies':dependencies,'explicitFinalIds':{'numeric':numeric_id,'desktop':desktop_id},
        'requiredActualReceipts':{'numeric':numeric,'desktop':desktop},'selectedReceipts':receipts,
        'qualificationBoundaries':{'eachNumericalGraph':{'worlds':12,'acceptedStepsIncludingRepeat':770,'independentlyPassedPrimarySteps':385,'references':6,'typedRefusals':6},
         'sourceObserverNegativeControls':1,'desktop':{'worldsIncludingZeroReset':7,'steps':385,'cases':6,'completeNativePacketCaptures':6,'realViewerGPU':True,'ownedDPR2':True},
         'providerReusedFromDependency15':True,'newCompilerCalls':0,'newPhysicsCalls':0,'newReferenceCalls':0,'newBrowserCalls':0,
         'historicalLongThree512':'NO_GO_PRESERVED','wholeEngineComplete':False,'mobile':'NOT_RUN','publication':False},
        'selectionRecord':{'allNewGalleryEvidenceAndBaselines':True,'allGalleryPlaywrightOutputs':True,'closedGuardNames':guard_names,'excludedSelfPrefixes':['gallery-checkpoint-','gallery-archive-']},
        'archiveInputLimitBytesPerFile':io.LIMIT,'selectedInputLimitBytes':io.TOTAL_LIMIT,'externalLocalOriginalsNotInArchives':{},'archives':{}}
    total=count=0
    for role,paths in (('source',source),('proof',proof)):
        archive=HOME/(role.upper()+'.tar.gz');members={};first={}
        with archive.open('xb') as raw,gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as zipped,tarfile.open(fileobj=zipped,mode='w|') as tar:
            for path in sorted(paths):
                item,name=io.pin(path),io.relative(path)
                if item['bytes']>io.LIMIT:
                    value['externalLocalOriginalsNotInArchives'][name]={**item,'notInGit':True,'includedInArchives':False};continue
                total+=item['bytes'];count+=1
                io.require(total<=io.TOTAL_LIMIT and count<=io.MEMBER_LIMIT,'original selected byte/member limit')
                mode=stat.S_IMODE(path.stat().st_mode);members[name]={**item,'mode':mode};entry=tarfile.TarInfo(name);entry.mode,entry.mtime=mode,0
                key=(item['sha256'],item['bytes'],mode)
                if key in first:entry.type,entry.linkname=tarfile.LNKTYPE,first[key];tar.addfile(entry)
                else:
                    first[key],entry.size=name,item['bytes']
                    with path.open('rb') as stream:tar.addfile(entry,stream)
                io.require(io.pin(path)==item,'input changed during archive '+name)
        value['archives'][role]={'file':archive.name,**io.pin(archive),'members':members,'uniqueBlobs':len(first)}
    value['selectedInputBytes'],value['selectedMemberCount']=total,count
    result=io.verify(value)
    with MANIFEST.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);g=p.add_mutually_exclusive_group(required=True)
    g.add_argument('--build',action='store_true');g.add_argument('--verify',action='store_true')
    p.add_argument('--numeric');p.add_argument('--desktop');a=p.parse_args()
    if a.build:
        io.require(a.numeric and a.desktop,'explicit --numeric and --desktop required');result=build(a.numeric,a.desktop)
    else:
        io.require(not a.numeric and not a.desktop,'verify uses immutable final IDs');result=io.verify(io.read_json(MANIFEST))
    print(json.dumps(result))
