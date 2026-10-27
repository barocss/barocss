// R7.6: deterministic source inventory plus the preserved R7.1 human report.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PACKAGES, CORE_ANCHORS, LIMITS, EXCEPTIONS, issue, compareText, slash,
  readExportMap, expandExports, validateExceptions, canonicalJSON, checkInventory,
} from './api-inventory-policy.mjs';

export function diskIO() {
  return {
    read(file) { try { return readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return undefined; throw e; } },
    files(directory) {
      const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === 'node_modules' || entry.name === '.git') return [];
        const p = join(dir, entry.name);
        if (entry.isSymbolicLink()) throw new Error('Unsupported symbolic link during public-source discovery: ' + slash(relative(directory, p)));
        return entry.isDirectory() ? walk(p) : entry.isFile() ? [p] : [];
      });
      return walk(directory).sort(compareText);
    },
  };
}
const inside = (root, file) => { const r = relative(root, file); return r === '' || (r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r)); };

export function collectApiInventory({ repo, ts, io = diskIO() }) {
  repo = resolve(repo);
  const issues = [], packages = [], targets = [];
  const add = (rule, message, details) => issues.push(issue(rule, message, details));
  for (const pkg of PACKAGES) {
    const packageRoot = join(repo, pkg.directory);
    let manifest, files;
    try {
      const text = io.read(join(packageRoot, 'package.json'));
      if (text === undefined) throw new Error('package.json is missing');
      manifest = JSON.parse(text);
      files = io.files(packageRoot).map(f => slash(relative(packageRoot, f)));
    } catch (error) { add('EX001', error.message, { package: pkg.name }); continue; }
    if (manifest.name !== pkg.name) { add('EX001', 'Package identity mismatch', { package: pkg.name, actual: manifest.name }); continue; }
    const map = readExportMap(manifest.exports, pkg.name);
    issues.push(...map.issues);
    const expanded = expandExports({ packageName: pkg.name, entries: map.entries, files });
    issues.push(...expanded.issues);
    packages.push({ package: pkg.name, entries: map.entries });
    for (const target of expanded.targets) targets.push({ ...target, absolute: join(packageRoot, target.file) });
  }
  const isScript = file => ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'].some(ext => file.endsWith(ext));
  const roots = [...new Set(targets.filter(t => isScript(t.file)).map(t => t.absolute))].sort(compareText);
  const options = {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true,
    resolveJsonModule: true, allowJs: true, checkJs: false, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  };
  const host = ts.createCompilerHost(options);
  const fallbackRead = host.readFile.bind(host), fallbackExists = host.fileExists.bind(host);
  const libDir = dirname(ts.getDefaultLibFilePath(options));
  const allowFallback = file => !io.virtual || inside(libDir, file);
  const read = file => io.read(resolve(file)) ?? (allowFallback(resolve(file)) ? fallbackRead(file) : undefined);
  host.readFile = read;
  host.fileExists = file => io.read(resolve(file)) !== undefined || (allowFallback(resolve(file)) && fallbackExists(file));
  host.getSourceFile = (file, languageVersion) => {
    const text = read(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion, true);
  };
  host.getCurrentDirectory = () => repo;
  if (io.virtual) {
    const all = io.files(repo);
    host.directoryExists = dir => inside(libDir, dir) ? ts.sys.directoryExists(dir) : all.some(f => inside(resolve(dir), f));
    host.getDirectories = dir => [...new Set(all.filter(f => inside(resolve(dir), f)).map(f => relative(dir, f).split(sep)[0]).filter(Boolean))];
    host.realpath = file => resolve(file);
  }
  const program = ts.createProgram(roots, options, host), checker = program.getTypeChecker();
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
  const origin = file => {
    file = resolve(file);
    for (const pkg of PACKAGES) {
      const base = join(repo, pkg.directory);
      if (inside(base, file)) return { package: pkg.name, file: slash(relative(base, file)) };
    }
    if (inside(libDir, file)) return { package: 'typescript', file: 'lib/' + slash(relative(libDir, file)) };
    const parts = slash(file).split('/'), n = parts.lastIndexOf('node_modules');
    if (n >= 0 && parts[n + 1]) {
      const length = parts[n + 1].startsWith('@') ? 2 : 1;
      return { package: parts.slice(n + 1, n + 1 + length).join('/'), file: parts.slice(n + 1 + length).join('/') };
    }
    throw new Error('Unbound declaration origin outside source/dependency roots');
  };
  function portableImport(specifier) {
    if (!isAbsolute(specifier)) return specifier;
    const o = origin(specifier);
    return o.package + ':' + o.file;
  }
  function printPortable(node) {
    if (!node) throw new Error('Cannot represent full public type');
    // Only TypeScript import-type module arguments change. Ordinary string literals keep their meaning.
    const transform = ts.transform(node, [context => {
      const visit = n => {
        if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument) && ts.isStringLiteral(n.argument.literal)) {
          const old = n.argument.literal.text, next = portableImport(old);
          if (next !== old) n = ts.factory.updateImportTypeNode(n,
            ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(next)),
            n.attributes, n.qualifier, n.typeArguments, n.isTypeOf);
        }
        return ts.visitEachChild(n, visit, context);
      };
      return n => ts.visitNode(n, visit);
    }]);
    try { return printer.printNode(ts.EmitHint.Unspecified, transform.transformed[0], undefined); }
    finally { transform.dispose(); }
  }
  // [] is an exact tuple type. The TS builder rejects it unless explicitly enabled,
  // including when it occurs inside a public property, union or rest signature.
  // This permits that syntax; it does not enable IgnoreErrors or an approximate fallback.
  const publicTypeNodeFlags = ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.AllowEmptyTuple;
  function typeShape(type, expandAlias = false) {
    const node = checker.typeToTypeNode(type, undefined, publicTypeNodeFlags
      | (expandAlias ? ts.NodeBuilderFlags.InTypeAlias : 0));
    if (!node) throw new Error('TypeScript typeToTypeNode refused full public type');
    return printPortable(node);
  }
  function signatureShape(signature, kind) {
    const node = checker.signatureToSignatureDeclaration(signature, kind, undefined, publicTypeNodeFlags);
    if (!node) throw new Error('TypeScript signatureToSignatureDeclaration refused full public signature');
    return printPortable(node);
  }
  const publicDeclaration = declaration => !(ts.getCombinedModifierFlags(declaration) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected))
    && !(declaration.name && ts.isPrivateIdentifier(declaration.name));
  const partsOf = type => type.isUnionOrIntersection() ? type.types : [type];
  const callable = type => partsOf(type).some(t => t.getCallSignatures().length > 0 || t.getConstructSignatures().length > 0
    || (['Function', 'CallableFunction', 'NewableFunction'].includes(t.symbol?.name)
      && t.symbol.declarations?.some(d => inside(libDir, d.getSourceFile().fileName))));
  function members(type) {
    const rows = new Map();
    for (const part of partsOf(type)) for (const property of checker.getPropertiesOfType(part)) {
      const declarations = (property.declarations ?? []).filter(publicDeclaration);
      if (!declarations.length) continue;
      const declaration = declarations[0], value = checker.getTypeOfSymbolAtLocation(property, declaration);
      const kind = declarations.some(ts.isGetAccessorDeclaration) ? 'getter'
        : declarations.some(ts.isSetAccessorDeclaration) ? 'setter'
        : declarations.some(d => ts.isMethodDeclaration(d) || ts.isMethodSignature(d)) ? 'method'
        : callable(value) ? 'callback' : 'property';
      const row = { name: property.name, kind, optional: !!(property.flags & ts.SymbolFlags.Optional), readonly: declarations.some(d => !!(ts.getCombinedModifierFlags(d) & ts.ModifierFlags.Readonly)), type: typeShape(value) };
      if (value.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) row.notProven = 'any/unknown property; JSON and callability are not certified';
      rows.set(JSON.stringify(row), row);
    }
    return [...rows.values()].sort((a, b) => compareText(a.name, b.name) || compareText(a.kind, b.kind) || compareText(a.type, b.type));
  }
  function indexSignatures(type) {
    const rows = new Map();
    for (const part of partsOf(type)) for (const index of checker.getIndexInfosOfType(part)) {
      const row = { key: typeShape(index.keyType), type: typeShape(index.type), readonly: !!index.isReadonly, callable: callable(index.type) };
      if (index.type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) row.notProven = 'any/unknown index value; JSON and callability are not certified';
      rows.set(JSON.stringify(row), row);
    }
    return [...rows.values()].sort((a, b) => compareText(a.key, b.key) || compareText(JSON.stringify(a), JSON.stringify(b)));
  }
  function resolvedSymbol(exported) {
    return exported?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  }
  const rawSpace = symbol => (symbol?.flags & (ts.SymbolFlags.Type | ts.SymbolFlags.Namespace) ? 1 : 0)
    | (symbol?.flags & ts.SymbolFlags.Value ? 2 : 0);
  function moduleStatements(symbol) {
    return (symbol.declarations ?? []).flatMap(declaration => {
      if (ts.isSourceFile(declaration)) return [...declaration.statements];
      return ts.isModuleDeclaration(declaration) && declaration.body && ts.isModuleBlock(declaration.body) ? [...declaration.body.statements] : [];
    });
  }
  function moduleAt(specifier) {
    const symbol = checker.getSymbolAtLocation(specifier);
    return symbol && resolvedSymbol(symbol);
  }
  function aliasSpace(symbol, route, seen = new Set()) {
    if (!symbol || seen.has(symbol)) return 0;
    if (!(symbol.flags & ts.SymbolFlags.Alias)) return rawSpace(symbol);
    const nextSeen = new Set(seen).add(symbol);
    let mask = 0;
    for (const declaration of symbol.declarations ?? []) {
      let typeOnly = !!declaration.isTypeOnly, source, name;
      if (ts.isExportSpecifier(declaration)) {
        const statement = declaration.parent.parent;
        typeOnly ||= statement.isTypeOnly;
        source = statement.moduleSpecifier && moduleAt(statement.moduleSpecifier);
        name = (declaration.propertyName ?? declaration.name).text;
      } else if (ts.isImportSpecifier(declaration)) {
        typeOnly ||= declaration.parent.parent.isTypeOnly;
        source = moduleAt(declaration.parent.parent.parent.moduleSpecifier);
        name = (declaration.propertyName ?? declaration.name).text;
      } else if (ts.isImportClause(declaration)) {
        source = moduleAt(declaration.parent.moduleSpecifier); name = 'default';
      } else if (ts.isNamespaceImport(declaration)) typeOnly ||= declaration.parent.isTypeOnly;
      else if (ts.isNamespaceExport(declaration)) typeOnly ||= declaration.parent.isTypeOnly;
      const underlying = source && name ? publicSpace(source, name, route)
        : aliasSpace(checker.getImmediateAliasedSymbol(symbol), route, nextSeen);
      // A type-only value/namespace can still be named by a public type query.
      mask |= typeOnly && underlying ? 1 : underlying;
    }
    return mask;
  }
  function publicSpace(module, name, route = []) {
    if (route.some(item => item.module === module && item.name === name)) return 0;
    const next = [...route, { module, name }];
    const exported = checker.getExportsOfModule(module).find(symbol => symbol.name === name);
    if (!exported) return 0;
    const direct = module.exports?.get(exported.escapedName);
    if (direct) return aliasSpace(direct, next);
    let mask = 0;
    if (name !== 'default') for (const statement of moduleStatements(module)) {
      if (!ts.isExportDeclaration(statement) || statement.exportClause || !statement.moduleSpecifier) continue;
      const source = moduleAt(statement.moduleSpecifier);
      const inherited = source ? publicSpace(source, name, next) : 0;
      mask |= statement.isTypeOnly && inherited ? 1 : inherited;
    }
    return mask;
  }
  const spaceName = mask => {
    if (!mask) throw new Error('Public export space could not be resolved');
    return mask === 3 ? 'type+value' : mask === 2 ? 'value' : 'type';
  };
  function kindOf(declaration, type) {
    if (ts.isClassDeclaration(declaration)) return 'class';
    if (ts.isInterfaceDeclaration(declaration)) return 'interface';
    if (ts.isTypeAliasDeclaration(declaration)) return 'type';
    if (ts.isEnumDeclaration(declaration)) return 'enum';
    if (ts.isModuleDeclaration(declaration) || ts.isSourceFile(declaration)) return 'namespace';
    return callable(type) ? 'function' : 'const';
  }
  const publicReferenceRanges = [];
  function checkTypeReferences(declaration, details) {
    if (ts.isSourceFile(declaration) || ts.isModuleDeclaration(declaration)) return; // Exported namespace children are described separately.
    const visit = node => {
      if (ts.isBlock(node) || ts.isModuleBlock(node) || (node !== declaration && !publicDeclaration(node))) return;
      const reference = ts.isTypeReferenceNode(node) ? node.typeName
        : ts.isTypeQueryNode(node) ? node.exprName : ts.isExpressionWithTypeArguments(node) ? node.expression : null;
      if (reference || ts.isImportTypeNode(node)) publicReferenceRanges.push({ file: node.getSourceFile(), start: node.pos, end: node.end });
      if (reference) {
        const symbol = checker.getSymbolAtLocation(reference);
        if (!symbol || !(resolvedSymbol(symbol)?.declarations?.length)) add('EX003', 'Unresolved name in a public type declaration', { ...details, name: reference.getText() });
      }
      if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        const target = ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)
          ? ts.resolveModuleName(argument.literal.text, node.getSourceFile().fileName, options, host).resolvedModule : undefined;
        const symbol = node.qualifier && checker.getSymbolAtLocation(node.qualifier);
        if (!target || (node.qualifier && !resolvedSymbol(symbol)?.declarations?.length)) {
          add('EX003', 'Unresolved public import type', { ...details, name: node.getText() });
        }
      }
      // Initializers and executable bodies do not define a declared public signature.
      ts.forEachChild(node, child => { if (child !== node.initializer && child !== node.body) visit(child); });
    };
    visit(declaration);
  }
  function declarationSignature(declaration) {
    const result = { kind: ts.SyntaxKind[declaration.kind] };
    if (declaration.typeParameters?.length) result.typeParameters = declaration.typeParameters.map(printPortable);
    if (declaration.heritageClauses?.length) result.heritage = declaration.heritageClauses.map(printPortable);
    if (ts.isTypeAliasDeclaration(declaration)) result.definition = printPortable(declaration.type);
    return result;
  }
  function describe(exported, exposure, ancestors = new Set()) {
    const symbol = resolvedSymbol(exported), declarations = symbol?.declarations;
    if (!declarations?.length) throw new Error('Public export has no resolved declaration');
    const declaration = declarations[0];
    const namedType = symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class | ts.SymbolFlags.Enum);
    const type = namedType ? checker.getDeclaredTypeOfSymbol(symbol) : checker.getTypeOfSymbolAtLocation(symbol, declaration);
    for (const item of declarations) checkTypeReferences(item, exposure);
    const own = origin(declaration.getSourceFile().fileName);
    const owners = [];
    for (let d = declaration.parent; d && !ts.isSourceFile(d); d = d.parent) if (d.name && ts.isIdentifier(d.name)) owners.unshift(d.name.text);
    const name = declaration.name && (ts.isIdentifier(declaration.name) || ts.isStringLiteral(declaration.name))
      ? declaration.name.text : exposure.exportName;
    const kind = kindOf(declaration, type);
    const shape = { type: typeShape(type, !!(symbol.flags & ts.SymbolFlags.TypeAlias)) };
    shape.declarationSignatures = declarations.filter(publicDeclaration).map(declarationSignature);
    if (['interface', 'type', 'class'].includes(kind)) {
      shape.members = members(type); shape.indexSignatures = indexSignatures(type);
    }
    const calls = type.getCallSignatures();
    if (calls.length) shape.callSignatures = calls.map(s => signatureShape(s, ts.SyntaxKind.FunctionType));
    if (kind === 'class') {
      shape.bases = (checker.getBaseTypes(type) ?? []).map(base => typeShape(base));
      const constructorType = checker.getTypeOfSymbolAtLocation(symbol, declaration);
      shape.constructSignatures = constructorType.getConstructSignatures().filter(s => !s.declaration || publicDeclaration(s.declaration)).map(s => signatureShape(s, ts.SyntaxKind.ConstructorType));
      shape.staticMembers = members(constructorType).filter(m => m.name !== 'prototype');
      shape.abstract = !!(ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Abstract);
      shape.role = shape.bases.some(b => b === 'Error' || b.endsWith('.Error')) ? 'Error-observed' : 'resource-or-facade-NOT_PROVEN';
    }
    if (declarations.some(d => ts.isModuleDeclaration(d) || ts.isSourceFile(d))) {
      if (ancestors.has(symbol)) shape.namespaceReference = { ...own, name: [...owners, name].join('.') };
      else {
        const next = new Set(ancestors).add(symbol);
        shape.namespaceExports = [...checker.getExportsOfModule(symbol)].sort((a, b) => compareText(a.name, b.name)).map(child => {
          const info = describe(child, { ...exposure, exportName: exposure.exportName + '.' + child.name }, next);
          return { exportName: child.name, space: spaceName(publicSpace(symbol, child.name)), target: info.target, shape: info.shape };
        });
      }
    }
    return { symbol, declaration, type, target: { ...own, name: [...owners, name].join('.'), kind }, shape };
  }
  // Resolve every re-export edge, including edges which would otherwise yield zero symbols.
  const visited = new Set();
  const graph = file => {
    file = resolve(file);
    if (visited.has(file)) return;
    visited.add(file);
    const sf = program.getSourceFile(file);
    if (!sf) { add('EX003', 'Public source is absent from compiler graph', { file: slash(relative(repo, file)) }); return; }
    for (const statement of sf.statements) if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const specifier = statement.moduleSpecifier;
      if (!ts.isStringLiteral(specifier)) { add('EX003', 'Unsupported re-export module expression'); continue; }
      const target = ts.resolveModuleName(specifier.text, file, options, host).resolvedModule;
      if (!target) add('EX003', 'Unresolved public re-export module', { file: slash(relative(repo, file)), module: specifier.text });
      else graph(target.resolvedFileName);
    }
  };
  for (const file of roots) graph(file);
  for (const diagnostic of program.getSyntacticDiagnostics()) add('EX003', ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), {
    file: diagnostic.file ? slash(relative(repo, diagnostic.file.fileName)) : null, code: diagnostic.code,
  });
  // Ambiguous star/named re-exports must not disappear into a partial checker result.
  for (const diagnostic of program.getSemanticDiagnostics()) if ([2305, 2306, 2308, 2459, 2724].includes(diagnostic.code)
    && diagnostic.file?.statements.some(n => ts.isExportDeclaration(n) && diagnostic.start >= n.pos && diagnostic.start < n.end)) {
    add('EX003', ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), { file: slash(relative(repo, diagnostic.file.fileName)), code: diagnostic.code });
  }
  const exposures = new Map(), anchorRows = new Map();
  for (const entry of targets) {
    const common = { package: entry.package, subpath: entry.subpath };
    if (!isScript(entry.file)) {
      const key = JSON.stringify([entry.package, entry.subpath, null, 'asset']);
      const row = exposures.get(key) ?? { ...common, exportName: null, space: 'asset', variants: [] };
      row.variants.push({ conditions: [entry.conditions], target: { package: entry.package, file: entry.file, kind: 'asset' } });
      exposures.set(key, row); continue;
    }
    const sf = program.getSourceFile(entry.absolute), moduleSymbol = sf && checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) { add('EX003', 'Public script has no module symbol', { ...common, file: entry.file }); continue; }
    for (const exported of [...checker.getExportsOfModule(moduleSymbol)].sort((a, b) => compareText(a.name, b.name))) {
      const details = { ...common, exportName: exported.name };
      try {
        const info = describe(exported, details);
        const space = spaceName(publicSpace(moduleSymbol, exported.name));
        const key = JSON.stringify([entry.package, entry.subpath, exported.name, space]);
        const observedRole = entry.package === '@barocss/cad' && entry.subpath === '.' && CORE_ANCHORS.includes(exported.name) ? 'core-result-anchor'
          : entry.subpath === './api' ? 'facade-exposure; immutability NOT_PROVEN'
          : entry.package === '@barocss/cad' && entry.subpath === './internal/native-si-mass' ? 'explicit-native-exposure; numeric units NOT_PROVEN'
          : entry.package === '@barocss/cad-model' && entry.subpath === './robot/native/duty' && exported.name === 'readDuty' ? 'explicit-native-readDuty; numeric units NOT_PROVEN'
          : 'unclassified-observed; no policy exemption';
        const row = exposures.get(key) ?? { ...details, space, observedRole, variants: [] };
        const variant = row.variants.find(v => JSON.stringify(v.target) === JSON.stringify(info.target) && JSON.stringify(v.shape) === JSON.stringify(info.shape));
        if (variant) variant.conditions.push(entry.conditions);
        else row.variants.push({ conditions: [entry.conditions], target: info.target, shape: info.shape });
        exposures.set(key, row);
        if (entry.package === '@barocss/cad' && entry.subpath === '.' && CORE_ANCHORS.includes(exported.name)) {
          const direct = members(info.type), bad = direct.filter(m => m.kind !== 'property');
          const indexes = indexSignatures(info.type), callableIndexes = indexes.filter(index => index.callable);
          const uninspectable = info.type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown);
          const callableRoot = partsOf(info.type).some(t => t.getCallSignatures().length || t.getConstructSignatures().length);
          const classRoot = ts.isClassDeclaration(info.declaration);
          if (bad.length || callableIndexes.length || uninspectable || callableRoot || classRoot) add('DA001', 'Core result anchor contains callable/accessor members or is not inspectable data', { ...details, members: bad, callableIndexes, uninspectable: !!uninspectable, callableRoot, classRoot });
          anchorRows.set(exported.name, { exportName: exported.name, target: info.target, directMembers: direct, indexSignatures: indexes, rule: 'DA001', nestedJSON: 'NOT_PROVEN' });
        }
      } catch (error) { add('EX003', error.message, details); }
    }
  }
  // Restrict name/module diagnostics to traversed public types and explicit re-exports.
  for (const diagnostic of program.getSemanticDiagnostics()) if ([2304, 2307, 2503, 2694].includes(diagnostic.code)
    && publicReferenceRanges.some(range => range.file === diagnostic.file && diagnostic.start >= range.start && diagnostic.start < range.end)) {
    add('EX003', ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), { file: slash(relative(repo, diagnostic.file.fileName)), code: diagnostic.code });
  }
  for (const anchor of CORE_ANCHORS) if (!anchorRows.has(anchor)) add('DA001', 'Required core result anchor is missing or unresolved', { package: '@barocss/cad', module: '.', exportName: anchor });
  // Anchor declarations are checked once through the core exposure. Aliasing cannot grant a waiver.
  const data = {
    schemaVersion: 1, policyVersion: 1, typescriptVersion: ts.version,
    packageExports: packages.sort((a, b) => compareText(a.package, b.package)),
    exposures: [...exposures.entries()].sort(([a], [b]) => compareText(a, b)).map(([, value]) => value),
    coreResultChecks: [...anchorRows.values()].sort((a, b) => compareText(a.exportName, b.exportName)),
  };
  return { data, issues, notProven: LIMITS };
}

export function writeExpected(collection, file) {
  const failures = [...collection.issues, ...validateExceptions(EXCEPTIONS)];
  if (failures.length) return { status: 'FAIL', issues: failures, notProven: LIMITS };
  writeFileSync(file, canonicalJSON(collection.data), { flag: 'wx' });
  return { status: 'GENERATED_FOR_REVIEW', file, notProven: LIMITS };
}

async function main(argv) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  let repo = resolve(scriptDir, '../../..');
  const repoAt = argv.indexOf('--repo');
  if (repoAt >= 0) {
    if (!argv[repoAt + 1]) throw new Error('--repo requires a directory');
    repo = resolve(argv[repoAt + 1]); argv.splice(repoAt, 2);
  }
  const ts = createRequire(join(repo, 'package.json'))('typescript');
  if (argv[0] === '--check' || argv[0] === '--write-expected') {
    const collection = collectApiInventory({ repo, ts });
    let result;
    if (argv[0] === '--write-expected') {
      if (argv.length !== 2) throw new Error('--write-expected requires one NEW output file for review');
      result = writeExpected(collection, resolve(argv[1]));
    } else {
      if (argv.length !== 1) throw new Error('--check takes no output arguments');
      let expected;
      try { expected = JSON.parse(readFileSync(join(scriptDir, 'api-inventory.expected.json'), 'utf8')); }
      catch (error) { collection.issues.push(issue('IV001', 'Cannot read expected inventory', { reason: error.message })); }
      result = checkInventory(collection, expected);
    }
    (result.status === 'FAIL' ? console.error : console.log)(JSON.stringify(result, null, 2));
    if (result.status === 'FAIL') process.exitCode = 1;
    return;
  }
  if (argv[0]?.startsWith('--') && argv[0] !== '--report') throw new Error('Unknown inventory mode');
  const destination = argv[0] === '--report' ? argv[1] : argv[0];
  if ((argv[0] === '--report' && argv.length > 2) || (argv[0] !== '--report' && argv.length > 1)) throw new Error('Unexpected report arguments');
  await writeHumanReport({ repo, ts, out: resolve(destination ?? join(tmpdir(), 'barocss-api-inventory')) });
}

// The human R7.1 report remains a separate observational path, not the --check oracle.
export async function writeHumanReport({ repo, ts, out }) {
  const tsFiles = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? tsFiles(p) : /\.ts$/.test(n) && !/\.d\.ts$/.test(n) ? [p] : []; });
  const PACKAGES = [
    { name: '@barocss/cad', root: 'packages/barocss-cad/src', entries: ['index.ts', 'api/index.ts'] },
    { name: '@barocss/cad-model', root: 'packages/barocss-cad-model/src', entries: null },
    { name: '@barocss/gpu', root: 'packages/barocss-gpu/src', entries: ['index.ts', 'viewer/index.ts', 'api/index.ts'] },
  ];
  for (const p of PACKAGES) p.files = (p.entries ?? tsFiles(join(repo, p.root)).map(f => relative(join(repo, p.root), f)).sort()).map(e => join(repo, p.root, e));

  const program = ts.createProgram(PACKAGES.flatMap(p => p.files), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, resolveJsonModule: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [],
  });
  const checker = program.getTypeChecker();

  // ——— reading one export
  const short = (s, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const typeText = t => short(checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType).replace(/import\("[^"]*"\)\./g, ''));
  const isErrorClass = type => { for (let t = type, k = 0; t && k < 12; k++) { if (t.symbol?.name === 'Error') return true; const b = checker.getBaseTypes(t); t = b?.[0]; } return false; };
  const declOf = sym => sym.declarations?.[0];
  /** Whether a declaration is in one of the packages' own sources (not TypeScript's lib: a string union's or a tuple's methods). */
  const ownSource = d => !d.getSourceFile().isDeclarationFile && d.getSourceFile().fileName.startsWith(join(repo, 'packages'));
  /** A type's members you call: declared methods (`massProperties(…)`) apart from function-valued properties (callbacks, `onX: () => …`). */
  function callables(type) {
    const methods = [], callbacks = [];
    for (const p of checker.getPropertiesOfType(type)) {
      const d = declOf(p); if (!d || !ownSource(d)) continue;
      if (ts.isMethodSignature(d) || ts.isMethodDeclaration(d)) methods.push(p.name);
      else if (checker.getTypeOfSymbolAtLocation(p, d).getCallSignatures().length) callbacks.push(p.name);
    }
    return { methods, callbacks };
  }
  const callableProps = type => { const c = callables(type); return [...c.methods, ...c.callbacks]; };
  /** What a parameter's type is: a class instance, a document or JSON value (an object type with no methods), a function, an array, a primitive, or other. */
  function paramClass(type) {
    if (type.getCallSignatures().length) return 'function';
    if (checker.isArrayType?.(type) || checker.isTupleType?.(type)) return 'array';
    if (type.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.BigIntLike)) return 'primitive';
    const target = type.isUnion() ? type.types.find(t => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))) ?? type : type;
    const d = target.symbol && declOf(target.symbol);
    if (d && ts.isClassDeclaration(d)) return 'class instance';
    if (target.flags & ts.TypeFlags.Object) return callableProps(target).length ? 'object with methods' : 'document/JSON';
    return 'other';
  }
  /** How a function fails, from its own body: thrown Error classes, bracketed [CODE] strings, or a typed result in its return type. */
  function failure(node, returnType) {
    const text = node.getText(), out = [];
    const thrown = [...new Set([...text.matchAll(/throw new ([A-Z][A-Za-z0-9]*)/g)].map(m => m[1]))];
    if (thrown.length) out.push(`throws ${thrown.join(', ')}`);
    const codes = [...new Set([...text.matchAll(/[`'"]\[([A-Z][A-Z0-9_]{3,})\]/g)].map(m => m[1]))];
    const rt = typeText(returnType);
    if (codes.length && /string/.test(rt)) out.push(`returns [CODE] string (${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ', …' : ''})`);
    else if (codes.length) out.push(`[CODE] in its messages (${codes.slice(0, 4).join(', ')}${codes.length > 4 ? ', …' : ''})`);
    if (/\berror\b\??:|\bok: (true|false)|\bisError\b|\bproblems?\b\??:/.test(rt)) out.push('typed result');
    return out.length ? out : ['none seen'];
  }
  function functionEntry(name, sym, decl, sigNode) {
    const type = checker.getTypeOfSymbolAtLocation(sym, decl), sig = type.getCallSignatures()[0];
    if (!sig) return null;
    const params = sig.getParameters().map(p => { const t = checker.getTypeOfSymbolAtLocation(p, sigNode ?? decl); return { name: p.name, type: typeText(t), class: paramClass(t) }; });
    const ret = sig.getReturnType();
    return { kind: 'function', params, firstParam: params[0]?.class ?? 'none', returns: typeText(ret), fails: failure(sigNode ?? decl, ret) };
  }
  function entryOf(name, exported) {
    const sym = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported, decl = declOf(sym);
    if (!decl) return { kind: 'unknown' };
    if (ts.isFunctionDeclaration(decl)) return functionEntry(name, sym, decl, decl) ?? { kind: 'function' };
    if (ts.isClassDeclaration(decl)) {
      const type = checker.getDeclaredTypeOfSymbol(sym), error = isErrorClass(type);
      const methods = decl.members.filter(m => (ts.isMethodDeclaration(m) || ts.isGetAccessor(m)) && !(ts.getCombinedModifierFlags(m) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) && m.name && !m.name.getText().startsWith('#')).map(m => m.name.getText());
      const fields = decl.members.filter(m => ts.isPropertyDeclaration(m) && !(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Readonly)).length;
      return { kind: 'class', error, stateful: !error && (fields > 0 || methods.length > 0), methods };
    }
    if (ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl)) {
      const type = checker.getDeclaredTypeOfSymbol(sym), parts = (type.isUnion() ? type.types : [type]).map(callables);
      const methods = [...new Set(parts.flatMap(c => c.methods))], callbacks = [...new Set(parts.flatMap(c => c.callbacks))];
      return { kind: ts.isInterfaceDeclaration(decl) ? 'interface' : 'type', ...(methods.length ? { resultWithMethods: methods } : {}), ...(callbacks.length ? { callbacks } : {}) };
    }
    if (ts.isEnumDeclaration(decl)) return { kind: 'enum' };
    if (ts.isVariableDeclaration(decl)) {
      const init = decl.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return { ...(functionEntry(name, sym, decl, init) ?? { kind: 'function' }), const: true };
      return { kind: 'const', type: typeText(checker.getTypeOfSymbolAtLocation(sym, decl)) };
    }
    if (ts.isModuleDeclaration(decl) || ts.isSourceFile(decl)) return { kind: 'namespace' };
    return { kind: ts.SyntaxKind[decl.kind] };
  }

  // ——— the inventory
  const inventory = [], byDeclaration = new Map();
  for (const p of PACKAGES) for (const file of p.files) {
    const sf = program.getSourceFile(file), msym = sf && checker.getSymbolAtLocation(sf);
    if (!msym) continue;
    const module = p.entries ? (file.endsWith('index.ts') && relative(join(repo, p.root), file) === 'index.ts' ? p.name : `${p.name}/${relative(join(repo, p.root), file).replace(/\/index\.ts$|\.ts$/g, '')}`) : `${p.name}/${relative(join(repo, p.root), file).replace(/\.ts$/, '')}`;
    for (const e of checker.getExportsOfModule(msym)) {
      if (e.name === 'default' && !declOf(e)) continue;
      // (One entry a declaration: a re-export, from another entry or module of the package, adds its module to `alsoFrom`.)
      const target = e.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(e) : e, d = declOf(target);
      const key = d ? `${p.name}|${d.getSourceFile().fileName}|${d.pos}|${e.name}` : `${p.name}|${module}|${e.name}`;
      const seen = byDeclaration.get(key);
      if (seen) { (seen.alsoFrom ??= []).push(module); continue; }
      const entry = { package: p.name, module, name: e.name, ...entryOf(e.name, e) };
      byDeclaration.set(key, entry); inventory.push(entry);
    }
  }

  // ——— the summaries
  const VERBS = new Set(('accept add admit align analyse analyze apply approve assemble attach auto bind blend bridge build bundle '
    + 'cancel cap capture carry cast change check chain choose clamp classify clear clip close collect combine commit compare compile '
    + 'compose compute confirm connect convert copy count create crease cut decide decimate decode deduce define delete derive describe '
    + 'detect diagnose diff dispatch distribute draw drop edit emit encode ensure erode estimate evaluate expand explode export extend '
    + 'extract extrude fill filter find finish fit fix flatten flip fold format generate get grow guess hash hatch hide hollow import infer '
    + 'insert inset inspect instantiate integrate intersect invert is join keep label lay layout lift list load locate lookup lower make '
    + 'map mark match measure merge mesh mirror mix move name nest normalize offset open orient pack pad parse patch pick pin place plan '
    + 'plot pose prepare preview probe project propose prune push put query read rebase rebuild receive reconcile record reduce refine '
    + 'refuse register reject relax remap remove rename render reorder repair replace replay report resample reset resolve restore '
    + 'reverse revolve rotate round run sample save scale scan score section seed select send separate serialize serve set sew shell '
    + 'show shrink simplify size sketch slice snap solve sort split stamp start step stitch store strip subdivide subtract suggest '
    + 'summarize sweep take tessellate test thicken thread tick to toggle trace track transform translate traverse trim triangulate turn '
    + 'type undo union unique unwrap update upgrade use validate verify visit walk weld with wrap write').split(' '));
  const firstWord = name => (/^[a-z]+/.exec(name) ?? [''])[0];
  const patternOf = name => /Of$/.test(name) ? '…Of (a noun of its argument)' : /Problem$/.test(name) ? '…Problem (a validator returning a reason or null)' : /^(is|has|can|should)[A-Z]/.test(name) ? 'predicate' : 'noun';
  const CONCEPTS = { mass: /mass|inertia/i, bounds: /bounds|bbox|box(?!ed)|extent/i, export: /^export|Export|write[A-Z]|encode/, evaluate: /^evaluate|Evaluat/, tessellate: /tessellat|mesh(?!Clearance)/i, revision: /revision|digest|sha256|hash/i, step: /step(?![a-z])|Step[A-Z]?/, stl: /stl/i, dxf: /dxf/i, validate: /^validate|Problem$|^check[A-Z]/, refusal: /Error$|refus/i };

  const byPackage = {};
  for (const p of PACKAGES) {
    const rows = inventory.filter(e => e.package === p.name), kinds = {};
    for (const r of rows) { const k = r.kind === 'function' && r.const ? 'function (const)' : r.kind; kinds[k] = (kinds[k] ?? 0) + 1; }
    byPackage[p.name] = {
      modules: new Set(rows.map(r => r.module)).size, exports: rows.length, kinds,
      resultsWithMethods: rows.filter(r => r.resultWithMethods).map(r => ({ module: r.module, name: r.name, methods: r.resultWithMethods })),
      withCallbacks: rows.filter(r => r.callbacks && !r.resultWithMethods).map(r => ({ module: r.module, name: r.name, callbacks: r.callbacks })),
      errorClasses: rows.filter(r => r.kind === 'class' && r.error).map(r => ({ module: r.module, name: r.name })),
      statefulClasses: rows.filter(r => r.kind === 'class' && r.stateful).map(r => ({ module: r.module, name: r.name, methods: r.methods })),
      notVerbFirst: rows.filter(r => r.kind === 'function' && !VERBS.has(firstWord(r.name))).map(r => ({ module: r.module, name: r.name, pattern: patternOf(r.name) })),
      firstParam: rows.filter(r => r.kind === 'function').reduce((m, r) => ({ ...m, [r.firstParam]: (m[r.firstParam] ?? 0) + 1 }), {}),
      fails: rows.filter(r => r.kind === 'function').reduce((m, r) => { for (const f of r.fails) { const k = f.replace(/ \(.*$/, '').replace(/^throws .*/, 'throws'); m[k] = (m[k] ?? 0) + 1; } return m; }, {}),
    };
  }
  const concepts = Object.fromEntries(Object.entries(CONCEPTS).map(([c, re]) => {
    const hits = inventory.filter(e => re.test(e.name) && (e.kind === 'function' || e.kind === 'class' || e.resultWithMethods));
    const pkgs = new Set(hits.map(h => h.package));
    return [c, { packages: [...pkgs], exports: hits.map(h => ({ package: h.package, module: h.module, name: h.name, kind: h.kind, ...(h.params ? { signature: `(${h.params.map(p => `${p.name}: ${p.class}`).join(', ')}) → ${short(h.returns, 80)}` } : {}), ...(h.resultWithMethods ? { methods: h.resultWithMethods } : {}) })) }];
  }).filter(([, v]) => v.packages.length > 1));

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'api-inventory.json'), JSON.stringify({ generated: new Date().toISOString(), packages: byPackage, concepts, inventory }, null, 1) + '\n');

  // ——— the Markdown report
  const md = ['# Public API inventory (R7.1)', '', 'Generated by `apps/library-docs/scripts/api-inventory.mjs` with the TypeScript compiler API. How a function fails is read from its own body only, so throws through a helper are not counted.', ''];
  md.push('## Per package', '', '| Package | Modules | Exports | function | function (const) | class | interface | type | const | other |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [n, s] of Object.entries(byPackage)) { const k = s.kinds, other = Object.entries(k).filter(([x]) => !['function', 'function (const)', 'class', 'interface', 'type', 'const'].includes(x)).reduce((a, [, v]) => a + v, 0); md.push(`| ${n} | ${s.modules} | ${s.exports} | ${k.function ?? 0} | ${k['function (const)'] ?? 0} | ${k.class ?? 0} | ${k.interface ?? 0} | ${k.type ?? 0} | ${k.const ?? 0} | ${other} |`); }
  md.push('', '### What a function takes first, and how it fails', '', '| Package | First parameter | How it fails |', '|---|---|---|');
  for (const [n, s] of Object.entries(byPackage)) md.push(`| ${n} | ${Object.entries(s.firstParam).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} | ${Object.entries(s.fails).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
  for (const [n, s] of Object.entries(byPackage)) {
    md.push('', `## ${n}`, '', `### Results with methods (${s.resultsWithMethods.length})`, '');
    for (const r of s.resultsWithMethods) md.push(`- \`${r.name}\` (${r.module}): ${r.methods.map(m => `\`${m}\``).join(', ')}`);
    md.push('', `### Types with callback properties, not methods (${s.withCallbacks.length})`, '', s.withCallbacks.slice(0, 40).map(r => `\`${r.name}\``).join(', ') + (s.withCallbacks.length > 40 ? `, … ${s.withCallbacks.length - 40} more` : '') || '—');
    md.push('', `### Error classes (${s.errorClasses.length})`, '', s.errorClasses.map(r => `\`${r.name}\``).join(', ') || '—');
    md.push('', `### Stateful classes (${s.statefulClasses.length})`, '');
    for (const r of s.statefulClasses) md.push(`- \`${r.name}\` (${r.module}): ${r.methods.slice(0, 12).map(m => `\`${m}\``).join(', ')}${r.methods.length > 12 ? ', …' : ''}`);
    const groups = {};
    for (const r of s.notVerbFirst) (groups[r.pattern] ??= []).push(r);
    md.push('', `### Functions not verb-first (${s.notVerbFirst.length})`, '');
    for (const [pattern, rows] of Object.entries(groups)) md.push(`- **${pattern}** (${rows.length}): ${rows.slice(0, 40).map(r => `\`${r.name}\``).join(', ')}${rows.length > 40 ? `, … ${rows.length - 40} more` : ''}`);
  }
  md.push('', '## Concepts across packages', '');
  for (const [c, v] of Object.entries(concepts)) {
    md.push(`### ${c} (${v.packages.join(', ')})`, '');
    for (const e of v.exports.slice(0, 30)) md.push(`- \`${e.name}\` (${e.module}, ${e.kind})${e.signature ? `: \`${e.signature}\`` : ''}${e.methods ? `: methods ${e.methods.join(', ')}` : ''}`);
    if (v.exports.length > 30) md.push(`- … ${v.exports.length - 30} more`);
    md.push('');
  }
  writeFileSync(join(out, 'api-inventory.md'), md.join('\n') + '\n');
  console.log(JSON.stringify({ out, packages: Object.fromEntries(Object.entries(byPackage).map(([n, s]) => [n, { exports: s.exports, kinds: s.kinds }])) }));
}


if (process.argv[1] && basename(process.argv[1]) === 'api-inventory.mjs' && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
