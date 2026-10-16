import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, access, symlink, readlink } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const baselineFile = resolve(app, 'evidence/public-api.json');
const currentFile = resolve(app, 'evidence/current-public-api.json');
const catalog = JSON.parse(await readFile(resolve(app, 'evidence/package-inventory.json'), 'utf8'));
const slugs = ['render','gpu','cad','cad-interop','canvas2d','viewer','physics'];
const flags = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function exportedType(map) {
  if (typeof map === 'string') return map;
  if (map.types) return map.types;
  if (map.import) return exportedType(map.import);
  if (map.default) return exportedType(map.default);
  throw new Error('Unsupported public map shape');
}
async function entriesFor(packageRecord) {
  const manifest = JSON.parse(await readFile(resolve(root, packageRecord.directory, 'package.json'), 'utf8'));
  const entries = [];
  for (const [key, map] of Object.entries(manifest.exports)) {
    let path = resolve(root, packageRecord.directory, exportedType(map));
    let provenance = 'declared development type entry';
    if (packageRecord.slug === 'render') {
      path = resolve(root, packageRecord.directory, 'src/index.d.ts');
      provenance = 'tracked public declaration for dist-default root; emitted artifact not checked';
    }
    await access(path);
    entries.push({ key, path, provenance, cssOnly: path.endsWith('.css') });
  }
  return { slug: packageRecord.slug, name: manifest.name, version: manifest.version, developmentExports: manifest.exports, publishConfig: manifest.publishConfig ?? null, entries };
}
async function ensureWorkspaceLinks() {
  const namespace = resolve(app, 'scripts/snippets/node_modules/@barocss');
  await mkdir(namespace, { recursive: true });
  for (const slug of slugs) {
    const link = resolve(namespace, slug), target = resolve(root, `packages/barocss-${slug}`);
    try { await symlink(relative(namespace, target), link, 'dir'); }
    catch (error) { if (error.code !== 'EEXIST' || resolve(namespace, await readlink(link)) !== target) throw error; }
  }
}
export function collect(packages, projectRoot) {
  const paths = packages.flatMap(p => p.entries.filter(e => !e.cssOnly).map(e => e.path));
  const options = { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true, jsx: ts.JsxEmit.ReactJSX, skipLibCheck: true, noEmit: true };
  const host = ts.createCompilerHost(options);
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    const ordinary = ts.resolveModuleName(name, containingFile, options, host).resolvedModule;
    const resolved = ordinary || ts.resolveModuleName(name, resolve(app, 'scripts/snippets/public-api.ts'), options, host).resolvedModule;
    if (name.startsWith('@barocss/') && resolved && !resolved.resolvedFileName.startsWith(root + '/')) throw new Error(`Foreign own source resolution: ${name}`);
    return resolved;
  });
  const program = ts.createProgram(paths, options, host);
  const checker = program.getTypeChecker();
  const typeAt = node => checker.typeToString(checker.getTypeAtLocation(node), node, flags);
  const returnType = node => {
    const signature = checker.getSignatureFromDeclaration(node);
    return node.type?.getText() || (signature ? checker.typeToString(checker.getReturnTypeOfSignature(signature), node, flags) : 'unknown');
  };
  const params = node => node.parameters.map(p => `${p.dotDotDotToken ? '...' : ''}${p.name.getText()}${p.questionToken || p.initializer ? '?' : ''}: ${p.type?.getText() || typeAt(p)}`).join(', ');
  const generics = node => node.typeParameters?.length ? `<${node.typeParameters.map(p => p.getText()).join(', ')}>` : '';
  const isHidden = node => node.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword) || (node.name && ts.isPrivateIdentifier(node.name));
  function signature(node, name) {
    if (ts.isFunctionDeclaration(node)) return `export function ${name}${generics(node)}(${params(node)}): ${returnType(node)};`;
    if (ts.isVariableDeclaration(node)) return `export const ${name}: ${node.type?.getText() || typeAt(node)};`;
    if (ts.isClassDeclaration(node)) {
      const members = [];
      for (const member of node.members) {
        if (isHidden(member)) continue;
        const prefix = member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) ? 'static ' : '';
        const memberName = member.name?.getText();
        if (ts.isConstructorDeclaration(member)) {
          members.push(`constructor(${params(member)});`);
          for (const p of member.parameters) {
            if (!isHidden(p) && p.modifiers?.some(m => [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(m.kind))) {
              members.push(`${p.modifiers.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword) ? 'readonly ' : ''}${p.name.getText()}${p.questionToken ? '?' : ''}: ${p.type?.getText() || typeAt(p)};`);
            }
          }
        }
        else if (ts.isMethodDeclaration(member)) members.push(`${prefix}${memberName}${member.questionToken ? '?' : ''}${generics(member)}(${params(member)}): ${returnType(member)};`);
        else if (ts.isGetAccessorDeclaration(member)) members.push(`${prefix}get ${memberName}(): ${returnType(member)};`);
        else if (ts.isSetAccessorDeclaration(member)) members.push(`${prefix}set ${memberName}(${params(member)});`);
        else if (ts.isPropertyDeclaration(member)) members.push(`${prefix}${member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword) ? 'readonly ' : ''}${memberName}${member.questionToken ? '?' : ''}: ${member.type?.getText() || typeAt(member)};`);
      }
      const heritage = node.heritageClauses?.map(h => h.getText()).join(' ') || '';
      return `export class ${name}${generics(node)}${heritage ? ' ' + heritage : ''} {\n${members.map(m => '  ' + m).join('\n')}\n}`;
    }
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) return node.getText();
    return `export ${name}: ${typeAt(node)};`;
  }
  return packages.map(p => ({ slug: p.slug, name: p.name, version: p.version, developmentExports: p.developmentExports, publishConfig: p.publishConfig, entries: p.entries.map(entry => {
    if (entry.cssOnly) return { key: entry.key, source: relative(projectRoot, entry.path), provenance: entry.provenance, symbols: [], cssOnly: true };
    const source = program.getSourceFile(entry.path);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) throw new Error(`No actual module export graph: ${entry.path}`);
    const publicSymbols = checker.getExportsOfModule(moduleSymbol);
    const targetOf = symbol => symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const symbols = publicSymbols.map(symbol => {
      const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      const declarations = target.getDeclarations() || [];
      if (!declarations.length) throw new Error(`Missing public declaration: ${p.name}/${entry.key}/${symbol.name}`);
      const signatures = declarations.filter(d => !ts.isModuleDeclaration(d)).map(d => signature(d, symbol.name));
      const location = declarations[0];
      const file = location.getSourceFile();
      return { name: symbol.name, kind: ts.SyntaxKind[location.kind], source: relative(projectRoot, file.fileName), line: file.getLineAndCharacterOfPosition(location.getStart()).line + 1, signatures, digest: hash(signatures.map(value => value.trim())) };
    }).sort((a,b) => a.name.localeCompare(b.name));
    const groups = new Map();
    const visited = new Set();
    function addGroup(path, names) {
      const source = relative(projectRoot, path);
      const group = groups.get(source) || new Set();
      names.forEach(name => group.add(name));
      if (group.size) groups.set(source, group);
    }
    for (const symbol of symbols) addGroup(resolve(projectRoot, symbol.source), [symbol.name]);
    function visit(file) {
      if (visited.has(file.fileName)) return;
      visited.add(file.fileName);
      const module = checker.getSymbolAtLocation(file);
      if (!module) return;
      const targets = new Set(checker.getExportsOfModule(module).map(targetOf));
      addGroup(file.fileName, publicSymbols.filter(symbol => targets.has(targetOf(symbol))).map(symbol => symbol.name));
      for (const statement of file.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue;
        const child = checker.getSymbolAtLocation(statement.moduleSpecifier);
        for (const declaration of child?.declarations || []) if (ts.isSourceFile(declaration)) visit(declaration);
      }
    }
    visit(source);
    return { key: entry.key, source: relative(projectRoot, entry.path), provenance: entry.provenance, symbols, groups: [...groups].map(([source,names]) => ({ source, names: [...names].sort() })).sort((a,b) => a.source.localeCompare(b.source)) };
  }) }));
}
export function delta(before, after) {
  const flatten = data => new Map(data.flatMap(p => [ [`${p.name}:manifest`, hash([p.version,p.developmentExports,p.publishConfig])], ...p.entries.flatMap(e => [[`${p.name}${e.key}:entry`, hash([e.source,e.cssOnly || false,e.groups || []])], ...e.symbols.map(s => [`${p.name}${e.key}:${s.name}`,s.digest])]) ]));
  const a = flatten(before), b = flatten(after);
  return { added: [...b.keys()].filter(k => !a.has(k)), removed: [...a.keys()].filter(k => !b.has(k)), changed: [...a.keys()].filter(k => b.has(k) && a.get(k) !== b.get(k)) };
}
async function selfTest() {
  const directory = await mkdtemp(resolve(tmpdir(), 'barocss-manual-api-'));
  try {
    const path = resolve(directory, 'index.ts');
    const fixture = [{ slug: 'fixture', name: 'fixture', version: '1', entries: [{ key: '.', path, provenance: 'temporary fixture' }] }];
    await writeFile(path, 'export function value(x: number): number { return x; }\nexport type Spaced = \'a  b\';\nclass PrivateHelper {}\nexport class Handle { constructor(public readonly id: string, private token: string) {} private hidden(): void {} public visible(x: number): string { return String(x); } }\n');
    const original = collect(fixture, directory);
    const unchanged = delta(original, collect(fixture, directory));
    await writeFile(path, 'export function value(x: string): string { return x; }\nexport type Spaced = \'a b\';\nclass PrivateHelper {}\nexport const added = 1;\nexport class Handle { constructor(public readonly id: string, private token: string) {} private hidden(): void {} public visible(x: number): string { return String(x); } }\n');
    const changed = delta(original, collect(fixture, directory));
    if (Object.values(unchanged).some(a => a.length) || !changed.changed.includes('fixture.:value') || !changed.added.includes('fixture.:added') || !changed.changed.includes('fixture.:Spaced')) throw new Error('Drift detector failed');
    const handle = original[0].entries[0].symbols.find(s => s.name === 'Handle');
    if (!handle.signatures.join('').includes('readonly id: string;') || handle.signatures.join('').includes('hidden') || original[0].entries[0].symbols.some(s => s.name === 'PrivateHelper')) throw new Error('Private declaration leaked');
    const result = { unchanged, changed, privateMembersExcluded: true, publicParameterPropertiesIncluded: true, literalWhitespacePreserved: true, fixture: 'temporary TypeScript API declarations only; no package runtime mutation' };
    await writeFile(resolve(app, 'evidence/public-api-self-test.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
export function parseArguments(args) {
  const modes = ['--check', '--check-historical', '--write', '--write-current', '--self-test'];
  if (!modes.includes(args[0])) throw new Error('Use --check, --check-historical, --write, --write-current --commit <full SHA>, or --self-test.');
  if (args[0] === '--write-current') {
    if (args.length !== 3 || args[1] !== '--commit' || !/^[a-f0-9]{40}$/.test(args[2])) throw new Error('Current API writing requires one immutable full commit SHA.');
    return { mode: args[0], commit: args[2] };
  }
  if (args.length !== 1) throw new Error('Unexpected or conflicting public API arguments.');
  return { mode: args[0] };
}
const ownedPackages = catalog.packages.filter(p => slugs.includes(p.slug));
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } }).trim(); }
function sourceTrees(commit) {
  if (!/^[a-f0-9]{40}$/.test(commit) || git(['rev-parse', '--verify', `${commit}^{commit}`]) !== commit) throw new Error('Invalid immutable API source commit.');
  return Object.fromEntries(ownedPackages.map(p => [p.directory, git(['rev-parse', `${commit}:${p.directory}`])]));
}
function assertPinnedWorkingTree(commit) {
  const trees = sourceTrees(commit);
  git(['diff', '--quiet', commit, '--', ...ownedPackages.map(p => p.directory)]);
  return trees;
}
function assertTrackedDeclarations(packages, commit) {
  const tracked = new Set(git(['ls-tree', '-r', '--name-only', commit, '--', ...ownedPackages.map(p => p.directory)]).split('\n'));
  for (const p of packages) for (const e of p.entries) {
    for (const source of [e.source, ...e.symbols.map(s => s.source), ...(e.groups || []).map(g => g.source)]) {
      if (!tracked.has(source)) throw new Error(`Declaration not tracked at source pin: ${source}`);
    }
  }
}
const historicalDigest = text => createHash('sha256').update(text).digest('hex');
export function validateCurrentBaseline(baseline, historicalText, expectedTrees) {
  const historical = JSON.parse(historicalText);
  if (baseline.typescriptVersion !== ts.version) throw new Error('Current API TypeScript version mismatch.');
  if (baseline.schema !== 'barocss-current-public-api-v1' || !/^[a-f0-9]{40}$/.test(baseline.sourceCommit)) throw new Error('Invalid current API inventory identity.');
  if (baseline.historicalSourceCommit !== historical.sourceCommit || baseline.historicalSha256 !== historicalDigest(historicalText)) throw new Error('Historical API evidence was changed.');
  if (JSON.stringify(baseline.packageTrees) !== JSON.stringify(expectedTrees)) throw new Error('Current API source pin/tree mismatch.');
  if (JSON.stringify(baseline.packages?.map(p => p.slug)) !== JSON.stringify(ownedPackages.map(p => p.slug))) throw new Error('Current API package coverage changed.');
  for (const p of baseline.packages) for (const e of p.entries) for (const s of e.symbols) {
    if (s.digest !== hash(s.signatures.map(value => value.trim()))) throw new Error(`Current API signature digest mismatch: ${p.name}:${s.name}`);
  }
  if (JSON.stringify(baseline.changesFromHistorical) !== JSON.stringify(delta(historical.packages, baseline.packages))) throw new Error('Historical-to-current API delta mismatch.');
}
async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.mode === '--self-test') { await selfTest(); return; }
  const historicalText = await readFile(baselineFile, 'utf8');
  const historical = JSON.parse(historicalText);
  let baseline, pin, trees;
  if (args.mode === '--check') {
    baseline = JSON.parse(await readFile(currentFile, 'utf8'));
    trees = sourceTrees(baseline.sourceCommit);
    validateCurrentBaseline(baseline, historicalText, trees);
    assertTrackedDeclarations(baseline.packages, baseline.sourceCommit);
    pin = baseline.sourceCommit;
  } else {
    pin = args.mode === '--write-current' ? args.commit : catalog.commit;
    trees = assertPinnedWorkingTree(pin);
    if (args.mode === '--check-historical' && historical.sourceCommit !== pin) throw new Error('Historical catalog/API source pins differ.');
  }
  await ensureWorkspaceLinks();
  const packages = collect(await Promise.all(ownedPackages.map(entriesFor)), root);
  const surface = { sourceCommit: pin, extractor: `TypeScript ${ts.version} public module exports and declarations; not a type-check or runtime execution`, packages };
  if (args.mode === '--write-current') {
    assertTrackedDeclarations(packages, pin);
    const current = { schema: 'barocss-current-public-api-v1', typescriptVersion: ts.version, ...surface, packageTrees: trees,
      historicalSourceCommit: historical.sourceCommit, historicalSha256: historicalDigest(historicalText),
      changesFromHistorical: delta(historical.packages, packages) };
    validateCurrentBaseline(current, historicalText, trees);
    await writeFile(currentFile, JSON.stringify(current, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'written', evidence: 'evidence/current-public-api.json', sourceCommit: pin, packages: packages.length,
      changesFromHistorical: Object.fromEntries(Object.entries(current.changesFromHistorical).map(([key, values]) => [key, values.length])) }));
  } else if (args.mode === '--write') {
    assertTrackedDeclarations(packages, pin);
    await writeFile(baselineFile, JSON.stringify(surface, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'written', evidence: 'evidence/public-api.json', packages: packages.length }));
  } else {
    const differences = delta((args.mode === '--check' ? baseline : historical).packages, packages);
    if (Object.values(differences).some(items => items.length)) { console.error(JSON.stringify(differences,null,2)); process.exitCode = 1; }
    else console.log(JSON.stringify({ status: 'matched', sourceCommit: pin, scope: args.mode === '--check' ? 'current API' : 'historical source snapshot', packages: packages.length,
      entries: packages.reduce((n,p) => n+p.entries.length,0), exportedOccurrences: packages.reduce((n,p) => n+p.entries.reduce((m,e) => m+e.symbols.length,0),0), extractor: ts.version }));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
