import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {here,root} from './bundle.mjs';
export const hash=b=>createHash('sha256').update(b).digest('hex');
async function files(dir){let out=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,item.name);if(item.isDirectory())out.push(...await files(p));else if(item.isFile())out.push(p);}return out;}
async function entries(paths){const out=[];for(const p of paths.sort()){const b=await readFile(p);out.push({path:relative(root,p),bytes:b.length,sha256:hash(b)});}return out;}
export async function providerClosure(){const paths=[];for(const folder of ['barocss-cad','barocss-cad-interop','barocss-gpu','barocss-viewer']){const p=resolve(root,'packages',folder);paths.push(...await files(resolve(p,'src')),resolve(p,'package.json'),resolve(p,'tsconfig.json'));if(folder==='barocss-cad')paths.push(...await files(resolve(p,'scripts')));}return entries(paths);}
export async function closure(){const paths=(await providerClosure()).map(row=>resolve(root,row.path));paths.push(...(await files(here)).filter(p=>!p.includes('/evidence/')&&!/\/(source-ledger|emitted-ledger|bundle-receipts)\.json$/.test(p)));return entries(paths);}
export async function freeze(){const rows=await closure(),report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,providerClosureSha256:hash(JSON.stringify(await providerClosure())),entries:rows,closureSha256:hash(JSON.stringify(rows))};await writeFile(resolve(here,'source-ledger.json'),JSON.stringify(report,null,2)+'\n');return report;}
if(process.argv[1]?.endsWith('/source-freeze.mjs'))console.log(JSON.stringify({...(await freeze()),entries:undefined}));
