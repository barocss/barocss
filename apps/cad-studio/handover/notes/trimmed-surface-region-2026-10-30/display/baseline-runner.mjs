import {build} from 'esbuild';
import {execFileSync,spawnSync} from 'node:child_process';
const root=process.cwd();
await build({entryPoints:[`${root}/packages/barocss-cad-model/test/direct-display-domain.test.ts`],outfile:'/tmp/d341-display/baseline-test-bundle.mjs',bundle:true,platform:'node',format:'esm',target:'node22',plugins:[{name:'immutable-pre-fix-display',setup(b){b.onLoad({filter:/barocss-cad-model\/src\/engine\/(direct|trim)\.ts$/},args=>({contents:execFileSync('git',['show',`ecab49052:${args.path.slice(root.length+1)}`],{encoding:'utf8'}),loader:'ts',resolveDir:args.path.slice(0,args.path.lastIndexOf('/'))}));}}]});
const result=spawnSync(process.execPath,['--test','/tmp/d341-display/baseline-test-bundle.mjs'],{stdio:'inherit'});process.exitCode=result.status;
