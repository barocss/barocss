"""Root-only bounded file copy of the actual built private runtime closure."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
HOME = Path(__file__).resolve().parent
NODE = '/Users/user/.volta/tools/image/node/22.19.0/bin/node'
PARSER = r"""
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const [root,dist]=process.argv.slice(1),tool=require.resolve('typescript',{paths:[root]}),ts=require(tool);
const pending=[path.join(dist,'stack/prepare-step.js'),path.join(dist,'validation.js')],graph={};
while(pending.length){
 const file=path.resolve(pending.pop()),relative=path.relative(dist,file);
 if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('runtime import outside dist');
 if(Object.hasOwn(graph,relative))continue;
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.ESNext,true,ts.ScriptKind.JS),imports=[];
 function visit(node){
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){
   if(!ts.isStringLiteral(node.moduleSpecifier))throw Error('nonliteral module specifier');
   imports.push(node.moduleSpecifier.text);
  }
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){
   if(node.arguments.length!==1||!ts.isStringLiteral(node.arguments[0]))throw Error('computed dynamic import');
   imports.push(node.arguments[0].text);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);graph[relative]=[...new Set(imports)].sort();
 for(const name of graph[relative]){
  if(!name.startsWith('.'))throw Error('external runtime import: '+name);
  pending.push(path.resolve(path.dirname(file),name));
 }
}
process.stdout.write(JSON.stringify({graph,typescript:tool}));
"""

def pin(path):
    path = Path(path)
    assert path.is_file() and not path.is_symlink(), str(path)
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(65536):
            h.update(block)
    return dict(bytes=path.stat().st_size, sha256=h.hexdigest())

def main():
    assert len(sys.argv) == 3, 'fresh output path and actual build receipt required'
    out, build_path = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    build = json.loads(build_path.read_text())
    assert build['status'] == 'PASS' and build['processClosed'] is True
    assert build['command'][-2:] == ['--run', 'build:library']
    assert build['cwd'] == str(ROOT / 'packages/barocss-physics')
    run = HOME / 'evidence/run-02'
    assert json.loads((run / 'result.json').read_text())['status'] == 'PASS_BOUNDED_EXACT_STATIONARY_PACKAGE_STACK_PHASE'
    qualified = json.loads((run / 'frozen-before.json').read_text())
    dist = ROOT / 'packages/barocss-physics/dist'
    source = ROOT / 'packages/barocss-physics/src'
    out.mkdir(parents=True, exist_ok=False)
    parsed = subprocess.run([NODE, '-e', PARSER, str(ROOT), str(dist)], check=True,
                            capture_output=True, text=True, timeout=30)
    assert not parsed.stderr and len(parsed.stdout.encode()) <= 2**21
    parsed = json.loads(parsed.stdout)
    graph, files, sources = parsed['graph'], {}, {}
    seen = {dist / name for name in graph}
    def copy(original, target):
        before = pin(original)
        target = out / target
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, target)
        assert pin(original) == before == pin(target)
        files[target.relative_to(out).as_posix()] = before
    for path in sorted(seen):
        relative = path.relative_to(dist)
        assert path.stat().st_size <= 2**21
        original = source / relative.with_suffix('.ts') if relative.suffix == '.js' else source / relative
        item = pin(original)
        assert qualified[str(original) ] == item['sha256'], 'source changed since actual phase pass'
        sources[original.relative_to(ROOT).as_posix()] = item
    for path in sorted(seen):
        copy(path, Path('canonical-provider/dist') / path.relative_to(dist))
    copy(ROOT / 'packages/barocss-physics/package.json', Path('canonical-provider/package.json'))
    native = run / 'native-modules'
    helpers = {
        'examples/physics-rigid-contact-reference/fixtures.mjs': 'examples/physics-rigid-contact-reference/fixtures.mjs',
        'examples/physics-stack-solver-2276/verification.js': 'examples/physics-stack-solver-2276/verification.js',
        'examples/physics-stack-library-2276/io.mjs': 'examples/physics-stack-stationary-library-2276/io.mjs',
        'examples/physics-stack-stationary-library-2276/witness-wire.mjs': 'examples/physics-stack-stationary-library-2276/witness-wire.mjs',
        'package.json': 'package.json',
    }
    for target, origin in helpers.items():
        copy(native / origin, Path('test-helpers') / target)
    provider = [dict(path=k, sha256=v['sha256']) for k, v in files.items() if k.startswith('canonical-provider/')]
    digest = hashlib.sha256(json.dumps(provider, separators=(',', ':')).encode()).hexdigest()
    value = dict(status='COPIED_ACTUAL_CANONICAL_BUILD14_STATIONARY_CLOSURE_NO_NUMERICAL_EXECUTION',
        providerDigest=digest, aggregateAlgorithm='SHA256_UTF8_COMPACT_JSON_ORDERED_ARRAY_OF_PATH_AND_SHA256_PROVIDER_ONLY',
        providerCodeFiles=len(seen), providerMetadataFiles=1, helperFiles=len(helpers),
        provider=str((out / 'canonical-provider').relative_to(ROOT)),
        native=str((out / 'test-helpers').relative_to(ROOT)),
        buildReceipt=str(build_path.relative_to(ROOT)), buildReceiptPin=pin(build_path),
        libraryQualification=str((run / 'result.json').relative_to(ROOT)),
        libraryQualificationPin=pin(run / 'result.json'), sources=sources,
        importGraph=graph, files=files, physicsCalls=0, publicAPI=False, full1200=False,
        parser='TypeScript AST runtime import/export/call nodes only; JSDoc import types excluded',
        parserTools={NODE:pin(NODE),parsed['typescript']:pin(parsed['typescript'])},
        helperAlias='New qualified IO bytes copied unchanged to established helper path; no formula/import transformation')
    (out / 'provenance.json').write_text(json.dumps(value, indent=2)+'\n')
    print(json.dumps(dict(status=value['status'], providerDigest=digest,
        providerCodeFiles=len(seen), provenance=pin(out / 'provenance.json'))))

if __name__ == '__main__':
    main()
