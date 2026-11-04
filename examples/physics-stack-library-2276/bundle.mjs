// Build tool only; Root executes through the single guarded runner.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [root,entry,out]=process.argv.slice(2),require=createRequire(resolve(root,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('esbuild')));
const result=await build({absWorkingDir:root,entryPoints:[entry],bundle:true,platform:'node',format:'esm',target:'node22',outfile:resolve(out,'source.mjs'),metafile:true,logLevel:'silent'});
const {writeFileSync}=await import('node:fs');
writeFileSync(resolve(out,'source-metafile.json'),JSON.stringify(result.metafile,null,2)+'\n');
