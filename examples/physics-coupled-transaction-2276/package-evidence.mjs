// Post-result byte packaging only. Never imports an active build/helper/World/observer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,extname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2]??'01';assert(/^[a-z0-9-]{1,32}$/.test(id),'Fresh archive suffix');
const hash=b=>createHash('sha256').update(b).digest('hex'),pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:hash(b)};},files=new Set(),required={},external={};
function add(path,expected){const real=realpathSync(path);assert(real.startsWith(root+'/'),'Workspace file escaped checkout');const got=pin(real);if(expected)assert.deepEqual(got,expected,'Frozen input drift '+path);files.add(real);return got;}
function walk(path){for(const e of readdirSync(path,{withFileTypes:true})){assert(!e.isSymbolicLink(),'Archive source symlink refused');const p=resolve(path,e.name);if(e.isDirectory())walk(p);else if(!/^(?:SOURCE|PROOF)-.*\.tar\.gz$/.test(e.name)&&!/^EVIDENCE-ARCHIVE(?:-.*)?\.json$/.test(e.name))add(p);}}
const executed=JSON.parse(readFileSync(resolve(home,'evidence/source-01/summary.json')));assert.equal(executed.status,'EXECUTED_NO_GO_COUPLED_TRANSACTION');assert.equal(executed.firstFailure.phase,'serializeOneFrame');
walk(home);
for(const name of ['AUTHOR-FREEZE-01.json']){const freeze=JSON.parse(readFileSync(resolve(home,name)));for(const[p,v]of Object.entries(freeze.files)){const path=isAbsolute(p)?p:resolve(root,p);if(path.startsWith(root+'/')){add(path,v);required[relative(root,path)]=v;}else external[p]=v;}}
// Preserve the complete prior static controls and first cone failure, without nested archives.
walk(resolve(root,'examples/physics-coupled-contact-2276'));
const cone=resolve(root,'examples/physics-persistent-cone-2276');for(const e of readdirSync(cone,{withFileTypes:true})){const p=resolve(cone,e.name);if(e.isDirectory())walk(p);else if(!e.name.endsWith('.tar.gz')&&!e.name.startsWith('EVIDENCE-ARCHIVE'))add(p);}
for(const n of ['freeze-01','source-01']){const p=resolve(root,'examples/physics-world-p5-2276/evidence','coupled-transaction-'+n),r=JSON.parse(readFileSync(resolve(p,'result.json')));assert.equal(r.processClosed,true);assert.equal(r.ownedGroupPresentAtFinalization,false);walk(p);}add(resolve(root,'examples/physics-world-p5-2276/command-run.mjs'));
// All actual frozen runtime inputs are required; external installed tools are metadata only.
for(const name of ['evidence/freeze-01/frozen.json']){const f=JSON.parse(readFileSync(resolve(home,name)));for(const[p,v]of Object.entries(f.files)){const path=isAbsolute(p)?p:resolve(root,p);if(path.startsWith(root+'/')){add(path,v);required[relative(root,path)]=v;}else external[p]=v;}}
const source={},proof={};for(const p of [...files].sort()){const n=relative(root,p);let isProof=n.includes('/evidence/')&&!n.includes('/evidence/build-')&&!n.split('/').some(v=>v==='stage'||v==='emitted');if(['.ts','.mts','.js','.mjs','.py'].includes(extname(p))&&!p.endsWith('.test.mjs'))isProof=false;if(p===resolve(home,'README.md')||p===resolve(home,'RESULTS.md')||p===resolve(home,'RESULTS.json'))isProof=true;(isProof?proof:source)[n]=pin(p);}
const sourceName=`SOURCE-${id}.tar.gz`,proofName=`PROOF-${id}.tar.gz`,indexName=id==='01'?'EVIDENCE-ARCHIVE.json':`EVIDENCE-ARCHIVE-${id}.json`;for(const n of [sourceName,proofName,indexName])assert(!existsSync(resolve(home,n)),'Never overwrite '+n);
// Python is used for standard-library tar/gzip IO ONLY. No runtime source is
// imported and no numerical interpreter/helper/reference/observer is launched.
const archiveCode=String.raw`
import sys,json,tarfile,io,gzip,hashlib,math
from pathlib import Path
x=json.loads(sys.stdin.read());root=Path(x['root']);home=Path(x['home'])
def prepare(name,members):
 targets={};links={};headers=0
 for n,v in members.items():
  key=(v['bytes'],v['sha256']);info=tarfile.TarInfo(n);info.size=v['bytes'];info.mtime=(root/n).stat().st_mtime
  if key in targets:links[n]=targets[key];info.type=tarfile.LNKTYPE;info.linkname=targets[key];info.size=0
  else:targets[key]=n
  headers+=len(info.tobuf(format=tarfile.PAX_FORMAT))+512*math.ceil(info.size/512)
 return dict(name=name,members=members,links=links,forecast=math.ceil((headers+1024)/10240)*10240)
a=prepare(x['sourceName'],x['source']);b=prepare(x['proofName'],x['proof'])
# Forecast both before writing either archive; fail closed on size.
for p in [a,b]:
 if p['forecast']>16777216:raise ValueError('Archive forecast exceeds fixed uncompressed16MiB: '+p['name'])
print(json.dumps(dict(status='FORECAST_BOTH_WITHIN_CAP_BEFORE_ARCHIVE_WRITES',archives=[dict(name=p['name'],bytes=p['forecast']) for p in [a,b]])),file=sys.stderr)
if x.get('forecastOnly'):
 print(json.dumps(dict(forecastOnly=True,archives=[dict(file=p['name'],uncompressedTarBytes=p['forecast'],files=len(p['members']),hardlinks=len(p['links'])) for p in [a,b]],recoverableInputs=x['requiredCount'])));sys.exit(0)
def create(p):
 buf=io.BytesIO();members=p['members'];links=p['links']
 with tarfile.open(fileobj=buf,mode='w',format=tarfile.PAX_FORMAT) as t:
  for n in [n for n in members if n not in links]+list(links):
   info=t.gettarinfo(root/n,arcname=n)
   if n in links:info.type=tarfile.LNKTYPE;info.linkname=links[n];info.size=0;t.addfile(info)
   else:
    with (root/n).open('rb') as f:t.addfile(info,f)
 data=buf.getvalue()
 if len(data)>16777216:raise ValueError('Actual archive exceeds cap; no retuning')
 path=home/p['name']
 with gzip.open(path,'xb') as f:f.write(data)
 seen=0
 with tarfile.open(path,'r:gz') as t:
  for m in t:
   raw=t.extractfile(m).read();got=dict(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
   if got!=members[m.name]:raise ValueError('Archive member differs '+m.name)
   seen+=1
 if seen!=len(members):raise ValueError('Archive member count')
 return dict(file=p['name'],archivePin=dict(bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()),logicalFileCount=seen,logicalPayloadBytes=sum(v['bytes'] for v in members.values()),storedPayloadBytes=sum(v['bytes'] for n,v in members.items() if n not in links),uncompressedTarBytes=len(data),capBytes=16777216,allMemberReadbackHashesVerified=True,standardTarHardlinkMap=links,members=members)
print(json.dumps(dict(archives=[create(a),create(b)])))
`;
const response=execFileSync(process.env.ARCHIVE_PYTHON??'python3',['-c',archiveCode],{input:JSON.stringify({root,home,sourceName,proofName,source,proof,forecastOnly:process.argv.includes('--forecast'),requiredCount:Object.keys(required).length}),encoding:'utf8',maxBuffer:8*1024*1024});const parsed=JSON.parse(response);if(parsed.forecastOnly){console.log(response);process.exit(0);}const archives=parsed.archives;
const locations=new Map();for(const a of archives)for(const[n,v]of Object.entries(a.members))if(!locations.has(v.bytes+':'+v.sha256))locations.set(v.bytes+':'+v.sha256,{archive:a.file,member:n});
const recovery={};for(const[n,v]of Object.entries(required)){const location=locations.get(v.bytes+':'+v.sha256);assert(location,'Missing frozen closure '+n);recovery[n]={...v,...location};}
for(const[n,v]of Object.entries({...source,...proof}))assert.deepEqual(pin(resolve(root,n)),v,'Source changed during packaging '+n);
const aggregate=archives.reduce((s,a)=>s+a.uncompressedTarBytes,0),index={format:'coupled-transaction-source-proof-archive-index',version:1,status:'VERIFIED_PRESERVED_FIRST_TRANSACTION_OBSERVATION_NO_GO',archives,perArchiveUncompressedLimitBytes:16777216,aggregateUncompressedTarBytes:aggregate,aggregateBelow16MiB:aggregate<=16777216,aggregateGateClaim:'No aggregate qualification gate; actual sum reported explicitly',frozenWorkspaceInputRecoveryMap:recovery,externalInstalledToolPins:external,externalToolBinariesEmbedded:false,reconstruction:'Extract both archives together; every required workspace author/build pin has an exact archive/member location. Copy stored bytes to the named original root-relative path when needed; no source/data is synthesized. Standard tar hardlink targets precede links and every logical member hash is read back.',originalConeFailure:'PRESERVED_NOT_RELABELED',initialBuildToolFailure:'PRESERVED_PRECOMPILER_NO_GO',transaction:'NO_GO_POST_DISPOSE_OBSERVATION_EQUALITY',hiddenBPreDisposePrivateAndPublic:'NOT_RETAINED_NOT_PROVEN',nativeDeserializationRestoreParity:'NOT_RUN_AFTER_FIRST_FAILURE',packagingScriptOutsideInitialActiveAuthorFreeze:true,packagingWorldCalls:0,packagingCompilerHelperReferenceObserverBrowserRuns:0,production:'NOT_RUN',warm:'NOT_RUN',performance:'NOT_RUN',promotion:'BLOCKED'};
writeFileSync(resolve(home,indexName),JSON.stringify(index,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:index.status,index:indexName,archives:archives.map(a=>({name:a.file,uncompressedTarBytes:a.uncompressedTarBytes,sha256:a.archivePin.sha256,files:a.logicalFileCount,hardlinks:Object.keys(a.standardTarHardlinkMap).length})),aggregateUncompressedTarBytes:aggregate,recoverableWorkspacePins:Object.keys(recovery).length}));
