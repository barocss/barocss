import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Real archive consumer. No checkout module stands in for a packed public API. */
export async function verifyCompilerConsumer(context) {
  const root = context?.root ?? resolve(import.meta.dirname, '../../..');
  const packageRoot = resolve(import.meta.dirname, '..');
  const require = context?.require ?? createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
  const scratch = context?.temp ?? mkdtempSync(join(tmpdir(), 'cad-compiler-consumer-'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    if (!context) execFileSync('pnpm', ['pack', '--pack-destination', scratch], {cwd:packageRoot,stdio:'pipe'});
    const archive = join(scratch, 'barocss-cad-0.0.0-private-experimental.tgz');
    const destination = context?.destination ?? join(scratch, 'node_modules/@barocss/cad');
    if (!context) {
      mkdirSync(destination, {recursive:true});
      execFileSync('tar', ['-xzf',archive,'-C',destination,'--strip-components=1']);
    }
    const manifest = JSON.parse(readFileSync(join(destination,'package.json'),'utf8'));
    assert.equal(manifest.private, true);
    assert.equal(manifest.dependencies, undefined);
    const sources = [
      readFileSync(join(root,'examples/cad-nurbs/compiler-curve-v0.css'),'utf8'),
      readFileSync(join(root,'examples/cad-nurbs/compiler-extrusion-v1.css'),'utf8'),
    ];
    const runtime = `import assert from 'node:assert/strict';
import {compileCadModel,parseModel,compileConstruction,evaluateSurface,exportIGES} from '@barocss/cad';
const sources=${JSON.stringify(sources)};
const native=m=>({name:m.name,version:m.version,lengthUnit:m.lengthUnit,objects:m.objects});
const zero=compileCadModel(sources[0],{sourceVersion:0});assert.equal(zero.ok,true);
assert.deepEqual(zero.model,native(parseModel(sources[0])));assert.ok(Object.is(zero.model.objects[0].controlPoints[0][1],-0));
const one=compileCadModel(sources[1],{sourceVersion:1});assert.equal(one.ok,true);
assert.equal(one.ir.schema,'barocss-cad-ir');assert.equal(one.ir.schemaVersion,1);assert.equal(one.ir.sourceVersion,1);assert.equal(one.model.version,0);
assert.deepEqual(one.model,compileConstruction(sources[1]).model);assert.deepEqual(one.constructions,compileConstruction(sources[1]).constructions);
assert.deepEqual(one.ir.dependencies.map(d=>[d.fromId,d.toId,d.kind]),[['wall','arc','curve-input']]);
assert.deepEqual(one.model.objects.map(o=>o.id),['wall','arc']);
const p=evaluateSurface(one.model.objects[0],.5,.5);assert.ok(Math.hypot(p[0]-Math.sqrt(50),p[1]-Math.sqrt(50),p[2]-15)<1e-9);
assert.equal(exportIGES(one.model,['wall']).report.objects[0].entity,128);
const bad=compileCadModel(sources[1].replace('curve: #arc','curve: #missing'),{sourceVersion:1});assert.equal(bad.ok,false);assert.equal(bad.diagnostics[0].code,'REFERENCE');assert.equal(bad.model,undefined);
for(const options of [{sourceVersion:2},{sourceVersion:0,target:'iges'},{sourceVersion:1,profile:'AP214'}])assert.equal(compileCadModel(sources[0],options).ok,false);
const old=compileCadModel(sources[1],{sourceVersion:1});one.ir.nodes[1].geometry.controlPoints[0][0]=70;one.constructions[0].vector[2]=90;
assert.deepEqual(compileCadModel(sources[1],{sourceVersion:1}),old);
`;
    writeFileSync(join(scratch,'compiler-runtime.mjs'),runtime);
    execFileSync(process.execPath,[join(scratch,'compiler-runtime.mjs')],{stdio:'inherit'});
    writeFileSync(join(scratch,'compiler-types.ts'), `import {compileCadModel} from '@barocss/cad';
import type {CadCompileOptions,CadCompileResult,CadDiagnostic,CadModelAst,CadModelIR} from '@barocss/cad';
const options:CadCompileOptions={sourceVersion:1}; const result:CadCompileResult=compileCadModel('',options);
if(result.ok){const ast:CadModelAst=result.ast;const ir:CadModelIR=result.ir;const version:0=result.model.version;const schemaVersion:1=ir.schemaVersion;void[ast,version,schemaVersion];}
else {const first:CadDiagnostic=result.diagnostics[0];const severity:'error'=first.severity;const line:number=first.range.line;void[severity,line];}
// @ts-expect-error Source version2 is a separately gated language.
compileCadModel('',{sourceVersion:2});
// @ts-expect-error Exchange formats belong to native adapters.
compileCadModel('',{sourceVersion:0,target:'iges'});
`);
    execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022',
      '--module','NodeNext','--moduleResolution','NodeNext',join(scratch,'compiler-types.ts')],{stdio:'inherit'});
    const api = context?.api ?? await import(pathToFileURL(join(destination,'dist/index.js')).href);
    const values = sources.map((source,index) => api.compileCadModel(source,{sourceVersion:index}));
    assert.ok(values.every(value=>value.ok));
    const record = {archiveSHA256:hash(readFileSync(archive)),indexSHA256:hash(readFileSync(join(destination,'dist/index.js'))),
      sources:sources.map(source=>hash(source)),producer:'Actual extracted public @barocss/cad ESM/types archive',
      sourceVersions:[0,1],schema:'barocss-cad-ir',schemaVersion:1,nativeVersion:0};
    if (process.env.BAROCSS_CAD_COMPILER_EVIDENCE) {
      const evidence = resolve(process.env.BAROCSS_CAD_COMPILER_EVIDENCE); mkdirSync(evidence,{recursive:true});
      writeFileSync(join(evidence,'consumer-report.json'),JSON.stringify(record,null,2)+'\n');
      for(let index=0;index<values.length;index++) writeFileSync(join(evidence,`compiled-v${index}.json`),JSON.stringify(values[index],null,2)+'\n');
    }
    console.log('Packed CAD compiler ESM/types, AST/IR/native ownership and unchanged adapters passed');
    return record;
  } finally {if (!context) rmSync(scratch,{recursive:true,force:true});}
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await verifyCompilerConsumer();
