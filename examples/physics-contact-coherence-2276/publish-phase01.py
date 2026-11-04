#!/usr/bin/env python3
"""Bounded phase01 source/proof publication checkpoint; file I/O only."""
import argparse,gzip,importlib.util,json,stat,tarfile
from pathlib import Path
HOME=Path(__file__).resolve().parent
ROOT=HOME.parents[1]
spec=importlib.util.spec_from_file_location('io08',ROOT/'examples/physics-stack-library-2276/checkpoint-08.py')
io=importlib.util.module_from_spec(spec);spec.loader.exec_module(io);io.HOME=HOME
MANIFEST=HOME/'PUBLISH-01.json'
EXPECTED={'private-03':'PRIVATE_CONTACT_COHERENCE_SOURCE_NATIVE_CONFIRMED','build-01':'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED','tensor-01':'ANISOTROPIC_PRIVATE_SOURCE_NATIVE_20CALLS_13REFERENCES_CONFIRMED','public-01':'COHERENCE_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED','initial-01':'COHERENCE_AUTHORED_INITIAL_FRAMES_CONFIRMED','owner-01':'COHERENCE_OWNER_REPLAY_AND_UNKNOWN_IDENTITY_CONFIRMED','dt-01':'COHERENCE_DT_SOURCE_NATIVE_WINDOW_REFERENCES_CONFIRMED','long-01':'COHERENCE_LONG512_SOURCE_NATIVE_WINDOW_REFERENCES_CONFIRMED','gallery-01':'SAMPLE_GALLERY_SOURCE_NATIVE_ANALYTIC_CONFIRMED'}
def build():
 io.require(not MANIFEST.exists(),'immutable output exists')
 receipts={}
 for name,status in EXPECTED.items():
  p=HOME/'evidence'/name/'result.json';d=io.read_json(p)
  io.require(d['status']==status and d.get('failure') is None and d.get('firstFailure') is None and d['sourceIntegrity'] in (True,'PASS'),'actual prerequisite '+name)
  receipts[io.relative(p)]={**io.pin(p),'status':d['status']}
 for name,w,n,r in [('dt-01',6,840,14),('long-01',2,1024,10)]:
  d=io.read_json(HOME/'evidence'/name/'result.json')
  for g in ('source','native'):
   v=d['reports'][g];io.require((v['worlds'],v['acceptedSteps'],v['passedIndependentTransitions'],v['comparedAndVerifiedTransitions'],v['referenceReplies'])==(w,n,n,n,r),'full fixed population '+name+g)
 d=io.read_json(HOME/'evidence/long1024-01/result.json');io.require(d['status']=='COHERENCE_THREE1024_NO_GO' and d['failure'] is not None,'preserved866failure')
 for g,a,p in [('source',896,768),('native',768,768)]:
  v=d['reports'][g];io.require((v['acceptedSteps'],v['passedIndependentTransitions'])==(a,p),'failed horizon counters')
 receipts[io.relative(HOME/'evidence/long1024-01/result.json')]={**io.pin(HOME/'evidence/long1024-01/result.json'),'status':d['status']}
 b=io.read_json(HOME/'evidence/build-01/result.json')
 for name,sha in b['currentSourcePins'].items():io.require(io.pin(ROOT/name)['sha256']==sha,'paid production unchanged '+name)
 for id in ('coherence-publish-doc-example-01','coherence-publish-docbuild-01','coherence-publish-docsite-01'):
  p=ROOT/'examples/physics-world-p5-2276/evidence'/id/'result.json';d=io.read_json(p);io.require(d['status']=='PASS' and d['processClosed'] and not d['timedOut'],'closed docs command '+id);receipts[io.relative(p)]={**io.pin(p),'status':d['status']}
 source=set(io.files(ROOT/'packages/barocss-physics/src'))
 source.update(ROOT/'packages/barocss-physics'/n for n in ('package.json','tsconfig.json','build-root.mjs','build-types.mjs','README.md','ROADMAP.md'))
 source.update(ROOT/n for n in ('apps/library-docs/docs/public/physics-evidence/api-roadmap.txt','apps/library-docs/docs/packages/physics/index.md','examples/physics-world-p5-2276/WORK-STATUS.json'))
 for p in io.files(HOME):
  rel=p.relative_to(HOME)
  if not {'evidence','baseline','output','__pycache__','node_modules'}.intersection(rel.parts) and 'exact' not in p.name.lower() and p.name not in ('checkpoint.py','PUBLISH-01.json') and not p.name.endswith('.tar.gz'):source.add(p)
 proof=set(io.files(HOME/'evidence'))|set(io.files(HOME/'baseline'))
 old=ROOT/'examples/physics-anisotropic-inertia-2276/evidence/coherence-tensor-01'
 proof.update(io.files(old))
 guards=ROOT/'examples/physics-world-p5-2276/evidence'
 for folder in sorted(guards.iterdir()):
  if folder.is_dir() and folder.name.startswith('coherence-') and not folder.name.startswith(('coherence-publish-archive-','coherence-checkpoint-','coherence-archive-')):
   io.require((folder/'result.json').exists(),'guard must be closed '+folder.name);proof.update(io.files(folder))
 dependency_names=['examples/physics-stack-library-2276/'+n for n in ('CHECKPOINT-15-PREFIX.json','CHECKPOINT-15-PREFIX-SOURCE.tar.gz','CHECKPOINT-15-PREFIX-PROOF.tar.gz')]+['examples/physics-sample-gallery-2276/'+n for n in ('CHECKPOINT.json','SOURCE.tar.gz','PROOF.tar.gz')]
 value={'format':'physics-contact-coherence-phase01-publication-v1','status':'TWO_THREE512_PASS_EXTENDED866_NO_GO','baseCommit':'df8db73d2920f10206639434800211669cba3a7b','productionKernelSha':'b064c35dbbbfec85ce91f6140adc9e98fb0efeac754ce65768a69c56ae910880','desktop':'CURRENT_PROVIDER_NOT_RUN','exactSuccessor':'NOT_ADOPTED_SEPARATE_BRANCH','wholeEngineComplete':False,'holds':'UNCHANGED','mobile':False,'deployment':False,'receipts':receipts,'dependencies':{p:io.pin(ROOT/p) for p in dependency_names},'externalLocalOriginalsNotInArchives':{},'archives':{}}
 total=count=0
 for role,paths in [('source',source),('proof',proof)]:
  archive=HOME/('PUBLISH-01-'+role.upper()+'.tar.gz');members={};first={}
  with archive.open('xb') as raw,gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as z,tarfile.open(fileobj=z,mode='w|') as tar:
   for p in sorted(paths):
    item=io.pin(p);name=io.relative(p);io.require(item['bytes']<=io.LIMIT,'perfile16MiB '+name);total+=item['bytes'];count+=1;io.require(total<=io.TOTAL_LIMIT and count<=io.MEMBER_LIMIT,'512MiB/50000 member bound')
    mode=stat.S_IMODE(p.stat().st_mode);members[name]={**item,'mode':mode};entry=tarfile.TarInfo(name);entry.mode=mode;entry.mtime=0;key=(item['sha256'],item['bytes'],mode)
    if key in first:entry.type=tarfile.LNKTYPE;entry.linkname=first[key];tar.addfile(entry)
    else:
     first[key]=name;entry.size=item['bytes']
     with p.open('rb') as stream:tar.addfile(entry,stream)
    io.require(io.pin(p)==item,'changed while archiving '+name)
  value['archives'][role]={'file':archive.name,**io.pin(archive),'members':members,'uniqueBlobs':len(first)}
 value['selectedInputBytes']=total;value['selectedMemberCount']=count
 result=io.verify(value)
 with MANIFEST.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group(required=True);g.add_argument('--build',action='store_true');g.add_argument('--verify',action='store_true');a=p.parse_args()
 print(json.dumps(build() if a.build else io.verify(io.read_json(MANIFEST))))
