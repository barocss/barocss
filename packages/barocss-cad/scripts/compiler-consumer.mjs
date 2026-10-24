import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Real archive consumer. No checkout module stands in for a packed public API. */
export async function verifyCompilerConsumer(context) {
  const root = context?.root ?? resolve(import.meta.dirname, '../../..');
  const packageRoot = resolve(import.meta.dirname, '..');
  const sourceManifest = JSON.parse(readFileSync(join(packageRoot,'package.json'),'utf8'));
  const packedFilename = `${sourceManifest.name.replace(/^@/,'').replace('/','-')}-${sourceManifest.version}.tgz`;
  const require = context?.require ?? createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
  const scratch = context?.temp ?? mkdtempSync(join(tmpdir(), 'cad-compiler-consumer-'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  try {
    if (!context) execFileSync('pnpm', ['pack', '--pack-destination', scratch], {cwd:packageRoot,stdio:'pipe'});
    const archive = context?.archive ?? join(scratch, packedFilename);
    const destination = context?.destination ?? join(scratch, 'node_modules/@barocss/cad');
    if (!context) {
      mkdirSync(destination, {recursive:true});
      execFileSync('tar', ['-xzf',archive,'-C',destination,'--strip-components=1']);
    }
    const manifest = JSON.parse(readFileSync(join(destination,'package.json'),'utf8'));
    assert.equal(manifest.name, sourceManifest.name);
    assert.equal(manifest.version, sourceManifest.version);
    assert.equal(manifest.private, sourceManifest.private);
    assert.equal(manifest.dependencies, undefined);
    for(const module of ['parser','compiler','legacy-diagnostics'])for(const extension of ['js','d.ts']) {
      assert.equal(existsSync(join(destination,'dist',module+'.'+extension)),false,'Removed compiler artifact was packed');
    }
    const sources = [
      readFileSync(join(root,'examples/cad-nurbs/compiler-curve-v0.css'),'utf8'),
      readFileSync(join(root,'examples/cad-nurbs/compiler-extrusion-v1.css'),'utf8'),
    ];
    // Existing source3 fixture from pure-quantity-functions-demo.mjs; literals unchanged.
    const functionSource = [
      '/* 설계 π: preserve complete original Source, CRLF and odd literals. */',
      '@model quantity_functions {',
      'version: 3; length-unit: mm;',
      '@function #scaleLength(value: length, factor: scalar = 2): length { return: $value * $factor; }',
      '@function #half(value: length): length { return: scaleLength(value: $value, factor: .5); }',
      '@parameter #width { type: length; value: 10 cm; }',
      '@parameter #height { type: length; value: scaleLength(value: half(value: $width)); }',
      '@parameter #depth { type: length; value: scaleLength(factor: .25, value: $width); }',
      '@curve #untouched_curve { type:nurbs; degree:2; knots:[-2.000,-2,-2,3,3.0,3]; control-points:[[-0,2,1],[3,4,2],[6,2,1]]; weights:[1,2,1]; }',
      '@curve #profile { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[$width,0,0]]; weights:[1,1]; }',
      '@extrude #wall { curve:#profile; vector:[0,$depth,$height]; }',
      '@surface #untouched_surface { type:nurbs; degree-u:1; degree-v:1; knots-u:[0.000,0,1,1.00]; knots-v:[-1,-1,2,2]; control-points:[[[2,3,-0],[2,5,1]],[[4,3,2],[4,5,4]]]; weights:[[1,2],[3,4]]; }',
      '/* Keep Ω and every unrelated original coefficient. */', '}', ''
    ].join('\r\n');
    const runtime = `import assert from 'node:assert/strict';
import {compileCadModel,evaluateSurface,exportIGES} from '@barocss/cad';
const sources=${JSON.stringify(sources)};
const functionSource=${JSON.stringify(functionSource)};
const three=compileCadModel(functionSource,{sourceVersion:3});assert.equal(three.ok,true,JSON.stringify(three.diagnostics));assert.equal(three.ir.schemaVersion,3);assert.equal(three.ir.sourceVersion,3);assert.equal(three.model.version,0);
const unsupported=compileCadModel(functionSource,{sourceVersion:4});assert.equal(unsupported.ok,false);assert.equal(unsupported.diagnostics[0].code,'OPTIONS');
const driven=${JSON.stringify(readFileSync(join(root,'examples/cad-nurbs/parameter-line-v2.css'),'utf8'))};
const two=compileCadModel(driven,{sourceVersion:2});assert.equal(two.ok,true);assert.equal(two.ir.schemaVersion,2);assert.equal(two.ir.parameters[0].value,100);assert.equal(two.model.objects[1].controlPoints[1][1][2],100);
assert.equal(compileCadModel(driven.replace('10 cm','12cm'),{sourceVersion:2}).model.objects[0].controlPoints[1][0],120);
const zero=compileCadModel(sources[0],{sourceVersion:0});assert.equal(zero.ok,true);
assert.equal(zero.model.version,0);assert.equal(zero.model.objects[0].id,'arc');assert.ok(Object.is(zero.model.objects[0].controlPoints[0][1],-0));
const one=compileCadModel(sources[1],{sourceVersion:1});assert.equal(one.ok,true);
assert.equal(one.ir.schema,'barocss-cad-ir');assert.equal(one.ir.schemaVersion,1);assert.equal(one.ir.sourceVersion,1);assert.equal(one.model.version,0);
assert.equal(one.constructions.length,1);assert.deepEqual(one.constructions[0].vector,[0,0,30]);
assert.deepEqual(one.ir.dependencies.map(d=>[d.fromId,d.toId,d.kind]),[['wall','arc','curve-input']]);
assert.deepEqual(one.model.objects.map(o=>o.id),['wall','arc']);
const p=evaluateSurface(one.model.objects[0],.5,.5);assert.ok(Math.hypot(p[0]-Math.sqrt(50),p[1]-Math.sqrt(50),p[2]-15)<1e-9);
assert.equal(exportIGES(one.model,['wall']).report.objects[0].entity,128);
const bad=compileCadModel(sources[1].replace('curve: #arc','curve: #missing'),{sourceVersion:1});assert.equal(bad.ok,false);assert.equal(bad.diagnostics[0].code,'REFERENCE');assert.equal(bad.model,undefined);
for(const options of [{sourceVersion:3},{sourceVersion:0,target:'iges'},{sourceVersion:1,profile:'AP214'}])assert.equal(compileCadModel(sources[0],options).ok,false);
const old=compileCadModel(sources[1],{sourceVersion:1});one.ir.nodes[1].geometry.controlPoints[0][0]=70;one.constructions[0].vector[2]=90;
assert.deepEqual(compileCadModel(sources[1],{sourceVersion:1}),old);
`;
    writeFileSync(join(scratch,'compiler-runtime.mjs'),runtime);
    execFileSync(process.execPath,[join(scratch,'compiler-runtime.mjs')],{stdio:'inherit'});
    writeFileSync(join(scratch,'compiler-types.ts'), `import {compileCadModel} from '@barocss/cad';
import type {CadCompileOptions,CadCompileResult,CadDiagnostic,CadModelAst,CadModelIR} from '@barocss/cad';
const options:CadCompileOptions={sourceVersion:1}; const result:CadCompileResult=compileCadModel('',options);
if(result.ok){const ast:CadModelAst=result.ast;const ir:CadModelIR=result.ir;const version:0=result.model.version;if(ir.schemaVersion===1){const schemaVersion:1=ir.schemaVersion;void schemaVersion;}void[ast,version];}
else {const first:CadDiagnostic=result.diagnostics[0];const severity:'error'=first.severity;const line:number=first.range.line;void[severity,line];}
const source2:CadCompileResult=compileCadModel('',{sourceVersion:2});
if(source2.ok&&source2.ir.schemaVersion===2){const version:2=source2.ir.sourceVersion;const parameters=source2.ir.parameters;const bindings=source2.ir.bindings;void[version,parameters,bindings];}
const source3:CadCompileResult=compileCadModel(${JSON.stringify(functionSource)},{sourceVersion:3});
if(source3.ok&&source3.ir.schemaVersion===3){const version:3=source3.ir.sourceVersion;void version;}
// @ts-expect-error Source version4 is not an implemented language.
compileCadModel('',{sourceVersion:4});
// @ts-expect-error Exchange formats belong to native adapters.
compileCadModel('',{sourceVersion:0,target:'iges'});
`);
    execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022',
      '--module','NodeNext','--moduleResolution','NodeNext',join(scratch,'compiler-types.ts')],{cwd:scratch,stdio:'inherit'});
    const api = context?.api ?? await import(pathToFileURL(join(destination,'dist/index.js')).href);
    const values = sources.map((source,index) => api.compileCadModel(source,{sourceVersion:index}));
    assert.ok(values.every(value=>value.ok));
    for(const name of ['parseModel','compileConstruction','CadSyntaxError','ConstructionSyntaxError'])assert.equal(Object.hasOwn(api,name),false);
    const record = {archiveSHA256:hash(readFileSync(archive)),indexSHA256:hash(readFileSync(join(destination,'dist/index.js'))),
      sources:sources.map(source=>hash(source)),producer:'Actual extracted public @barocss/cad ESM/types archive',
      sourceVersions:[0,1],schema:'barocss-cad-ir',schemaVersion:1,nativeVersion:0};
    if (process.env.BAROCSS_CAD_COMPILER_EVIDENCE) {
      const evidence = resolve(process.env.BAROCSS_CAD_COMPILER_EVIDENCE); mkdirSync(evidence,{recursive:true});
      writeFileSync(join(evidence,'consumer-report.json'),JSON.stringify(record,null,2)+'\n');
      for(let index=0;index<values.length;index++) writeFileSync(join(evidence,`compiled-v${index}.json`),JSON.stringify(values[index],null,2)+'\n');
    }
    console.log('Packed CAD compiler ESM/types, AST/IR/native ownership and native adapters passed');
    return record;
  } finally {if (!context) rmSync(scratch,{recursive:true,force:true});}
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await verifyCompilerConsumer();
