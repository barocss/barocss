import ts from 'typescript';
import { declarationAnchor, repairSourceLinks } from './source-links.mjs';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, access, symlink, readlink } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const baselineFile = resolve(app, 'evidence/public-api.json');
const catalog = JSON.parse(await readFile(resolve(app, 'evidence/package-inventory.json'), 'utf8'));
const slugs = ['render','gpu','cad','cad-interop','canvas2d','viewer','physics','cad-editor','render-editor'];
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
function collect(packages, projectRoot) {
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
function delta(before, after) {
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
if (process.argv.includes('--self-test')) { await selfTest(); }
else {
  await ensureWorkspaceLinks();
  const packages = collect(await Promise.all(catalog.packages.filter(p => slugs.includes(p.slug)).map(entriesFor)), root);
  const surface = { sourceCommit: catalog.commit, extractor: `TypeScript ${ts.version} public module exports and declarations; not a type-check or runtime execution`, packages };
  if (process.argv.includes('--write')) {
    const ownedPackages = catalog.packages.filter(p => slugs.includes(p.slug)).map(p => p.directory);
    execFileSync('git', ['diff', '--quiet', catalog.commit, '--', ...ownedPackages], { cwd: root });
    const trackedAtPin = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', catalog.commit, '--', ...ownedPackages], { cwd: root, encoding: 'utf8' }).trim().split('\n'));
    for (const p of packages) for (const e of p.entries) {
      for (const source of [e.source, ...e.symbols.map(s => s.source)]) {
        if (!trackedAtPin.has(source)) throw new Error(`Declaration not tracked at source pin: ${source}`);
      }
    }
    await writeFile(baselineFile, JSON.stringify(surface, null, 2) + '\n');
    for (const p of packages) {
      const lines = ['---','outline: 2','---',`# ${p.name} public signatures`,'',`Package version: \`${p.version}\`. Declaration snapshot: \`${catalog.commit.slice(0,12)}\`.`, '', 'Use [task API guidance](./api), [examples](./examples) and [limits](./limits) for semantics, ownership, errors and lifecycle. These signatures come from actual public entry exports. They do not prove execution or general support beyond those guides. Unannotated returns/types are inferred by the source checker; peer type-checking and emitted declaration equivalence did not run. Private/protected members and implementation bodies are excluded.',''];
      const seenNames = new Map(), firstAnchors = new Map();
      for (const e of p.entries) for (const symbol of e.symbols) {
        const base = symbol.name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        const occurrence = seenNames.get(base) || 0;
        symbol.anchor = base + (occurrence ? '-' + occurrence : '');
        seenNames.set(base, occurrence + 1);
        if (!firstAnchors.has(symbol.name)) firstAnchors.set(symbol.name, symbol.anchor);
      }
      const groups = new Map();
      for (const e of p.entries) for (const group of e.groups || []) {
        const names = groups.get(group.source) || new Set();
        group.names.forEach(name => names.add(name)); groups.set(group.source, names);
      }
      lines.push('## Public declaration groups', '', 'Choose a public declaration group. File paths and the exact local commit are provenance; no unavailable GitHub URL is required.', '');
      for (const [source,names] of [...groups].sort(([a],[b]) => a.localeCompare(b))) {
        lines.push(`### ${source.split('/').at(-1)} {#${declarationAnchor(source)}}`, '', `Local source: \`${source}\` at \`${catalog.commit}\`.`, '', [...names].map(name => `[${name}](#${firstAnchors.get(name)})`).join(' · '), '');
      }
      for (const e of p.entries) {
        const importName = p.name + (e.key === '.' ? '' : e.key.slice(1));
        lines.push(`## ${importName}`, '', `Entry: \`${e.source}\`. ${e.provenance}.`, '');
        if (e.cssOnly) { lines.push('Stylesheet entry. It has no JavaScript symbol namespace.', ''); continue; }
        for (const s of e.symbols) {
          lines.push(`### ${s.name} {#${s.anchor}}`, '', `<details><summary>Show ${s.kind} signature</summary>`, '', '```ts', s.signatures.join('\n'), '```', '', '</details>', '', `Local declaration: \`${s.source}:${s.line}\` at \`${catalog.commit.slice(0,12)}\`.`, '');
        }
      }
      lines.push('Local declaration paths and SHA record provenance. GitHub source links are exposed only when that exact commit is confirmed remotely. Reference extraction is not a registry, tarball, emitted-JS or browser acceptance result.', '');
      await writeFile(resolve(app, `docs/packages/${p.slug}/reference.md`), lines.join('\n'));
    }
    console.log(JSON.stringify(await repairSourceLinks(surface)));
  } else if (process.argv.includes('--check')) {
    const baseline = JSON.parse(await readFile(baselineFile, 'utf8'));
    const differences = delta(baseline.packages, surface.packages);
    if (Object.values(differences).some(items => items.length)) { console.error(JSON.stringify(differences,null,2)); process.exitCode = 1; }
    else console.log(JSON.stringify({ status: 'matched', packages: packages.length, entries: packages.reduce((n,p) => n+p.entries.length,0), exportedOccurrences: packages.reduce((n,p) => n+p.entries.reduce((m,e) => m+e.symbols.length,0),0), extractor: ts.version }));
  } else throw new Error('Use --write, --check or --self-test. Review semantic changes before regenerating.');
}
