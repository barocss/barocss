// Run from any directory: node examples/physics-world-p0-2276/inventory.mjs [--check]
// Read-only against callers. Outputs are confined to this directory.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../..');
const own = 'examples/physics-world-p0-2276/';
const p0Paths = [own, 'packages/barocss-physics/design/'];
const base = '66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(Boolean).sort();
const patterns = [
  ['physics-token', /physics/i],
  ['public-factory', /create(?:PhysicsWorld|PhysicsScene|PhysicsReplaySession|FluidWorld|ClothWorld|CadFluidWorld|PlanarPendulum|UprightCapsuleQuery|UprightCapsuleController)|restorePhysicsReplaySession/],
  ['cad-adapter-symbol', /admitCadSurfaceProxy|assertCadProxyCurrent|cadProxyPose/],
];
const excluded = {};
const texts = new Map();
const excludedPaths = {};
const historicalFile = path => /(?:^|\/)(?:reports?|receipts?|handover|handoff)(?:\/|$)|(?:^|\/)(?:CHANGELOG|AGENTS)\.md$|(?:report|receipt|first-failure|first_failure)[^/]*\.(?:json|txt|log)$/.test(path)
  || /(?:^|\/)(?:base-tracked-ledger|source-freeze|frozen-source|manifest|recording|selected-reference|selected-states|emitted[^/]*|precode-provider-hashes|BEFORE-CODE-PROVIDERS)\.json$/.test(path);
function exclude(reason, path) { (excludedPaths[reason] ??= []).push(path); excluded[reason] = (excluded[reason] ?? 0) + 1; }
for (const path of tracked) {
  if (p0Paths.some(prefix => path.startsWith(prefix))) continue; // New P0 contract/output does not change the source baseline.
  if (/(?:^|\/)(?:evidence|[^/]*-evidence)(?:\/|$)/.test(path)) { exclude('immutable-evidence-directory', path); continue; }
  if (/(?:^|\/)(?:dist|build|coverage|node_modules|\.next|\.astro)(?:\/|$)|(?:^|\/)\.vitepress\/cache\//.test(path) || /\.(?:map|tsbuildinfo)$/.test(path)) { exclude('emitted-artifact', path); continue; }
  const data = readFileSync(resolve(root, path));
  if (/\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|mp4|webm|glb|bin|wasm|dmg)$/i.test(path) || data.includes(0)) { exclude('binary', path); continue; }
  texts.set(path, { data, text: data.toString('utf8') });
}
const selected = new Set();
const workspaceMetadata = ['package.json', 'pnpm-workspace.yaml', '.github/workflows/npm-release.yml', '.github/workflows/release.yml'];
for (const [path, { text }] of texts) {
  if (workspaceMetadata.includes(path) || /physics/i.test(path) || patterns.some(([, pattern]) => pattern.test(text))) selected.add(path);
}
// Trace local source modules, including server/build files without a literal package name.
// This resolves literal relative strings only; it deliberately does not execute modules.
const edges = [];
for (const [path, { text }] of texts) {
  if (!/\.(?:[cm]?[jt]sx?|html)$/.test(path)) continue;
  for (const match of text.matchAll(/['"]((?:\.\.?\/)[^'"\n]+)['"]/g)) {
    const raw = posix.normalize(posix.join(posix.dirname(path), match[1]));
    const candidates = [raw, raw.replace(/\.js$/, '.ts'), raw + '.ts', raw + '.mjs', raw + '.js', raw + '/index.ts'];
    const target = candidates.find(candidate => texts.has(candidate));
    if (target) edges.push({ from: path, to: target, line: text.slice(0, match.index).split('\n').length, literal: match[1] });
  }
}
// Only add files that reference selected physics modules. Do not pull arbitrary CAD/GPU dependencies in.
let changed = true;
while (changed) {
  changed = false;
  for (const edge of edges) if (selected.has(edge.to) && !selected.has(edge.from)) { selected.add(edge.from); changed = true; }
}
function domain(path, text) {
  if (/fluid-cad|cad-fluid|fluid\/cad/.test(path + ' ' + text)) return 'fluid-cad';
  if (/cloth/.test(path + ' ' + text)) return 'cloth';
  if (/fluid/.test(path + ' ' + text)) return 'fluid';
  if (/pendulum|PlanarPendulum/.test(path + ' ' + text)) return 'reduced-pendulum-reference';
  if (/character|CapsuleController/.test(path + ' ' + text)) return 'capsule-controller-reference';
  if (/capsule-query|capsule-sweep|UprightCapsuleQuery/.test(path + ' ' + text)) return 'capsule-query';
  if (/replay|cad-proxy|CadSurfaceProxy|cadProxyPose/.test(path + ' ' + text)) return 'recording-cad';
  return 'rigid-or-shared';
}
function classify(path, line) {
  const role = domain(path, line);
  const slice = ['fluid', 'cloth', 'fluid-cad'].includes(role) ? 'P5' : role === 'recording-cad' ? 'P2 (P1 build dependency)' : 'P1';
  const immutable = historicalFile(path);
  if (immutable) return { classification: 'immutable-evidence', role, slice: 'preserve', operation: 'preserve', plan: 'Preserve historical source text and recorded results. Do not rewrite for a new API.' };
  const sharedMetadata = workspaceMetadata.includes(path) || path.startsWith('.github/workflows/') || path === 'pnpm-lock.yaml';
  if (sharedMetadata) return { classification: 'live-first-party-caller-tooling-or-docs', role: 'workspace-package-discovery-and-build', slice: 'P1/P2/P5 affected build', operation: 'verify-mapping-under-existing-owner', plan: 'Verify mapping and affected build. Change shared CI/root/workspace/lock metadata only under its existing owner. No broad update or publication is authorized.' };
  if (path.startsWith('packages/barocss-physics/src/')) return { classification: 'canonical-implementation-or-type', role, slice, operation: role === 'reduced-pendulum-reference' ? 'move-to-reference' : 'update', plan: role === 'reduced-pendulum-reference' ? 'Move the reduced ODE to a named reference entry; preserve its equations and receipts. It does not qualify rigid hinges.' : role.startsWith('capsule-') ? 'Keep query and controller roles explicit. Adapt accepted-state access only where needed; do not promote the controller reference to rigid dynamics.' : 'Update canonical implementation/types in the assigned slice. P1 must preserve the root signature or migrate every root consumer including replay atomically.' };
  const direct = /@barocss\/physics|barocss-physics|create(?:Physics|Fluid|Cloth|CadFluid|PlanarPendulum|UprightCapsule)|restorePhysicsReplaySession|admitCadSurfaceProxy|assertCadProxyCurrent|cadProxyPose/.test(line);
  const code = /\.(?:[cm]?[jt]sx?|html|json)$/.test(path);
  const research = path.startsWith('examples/') && /reference|diagnostic|audit|nogo|stack-solver|contact-boundary/.test(path);
  const harness = code && (direct || /(?:^|\/)(?:run|setup|entry|browser-entry|compiled-contract|source-contract|public-consumer|server)\.[^.]+$/.test(path));
  if (research) return { classification: 'research-reference-needing-freeze-or-adapt', role, slice, operation: harness ? 'adapt-harness' : 'freeze-reference-provider', plan: harness ? 'Adapt only the import/signature or build harness in its assigned slice. Freeze fixture, oracle, tolerance, first failure and numerical phase order.' : 'Preserve this reference provider, fixture, data or research prose at its frozen hash. It is not an active caller edit. Preserve its old runtime dependency in immutable history if needed.' };
  const computedMapping = code && /physics/.test(path) && /entryPoints|importmap|symlink|barocss-.*(?:\+|\$)|['"]physics['"]/.test(line);
  if (!direct && !computedMapping) return { classification: 'incidental-no-direct-call', role, slice: 'preserve', operation: 'preserve', plan: 'Pure mention or supporting file; no direct Physics API dependency is established by this lexical record. Preserve.' };
  return { classification: 'live-first-party-caller-tooling-or-docs', role, slice, operation: 'update', plan: /\.(?:md|mdx)$/.test(path) ? 'Update current API prose/examples with the assigned slice. Preserve HOLD, NO_GO, numerical limits and first failures.' : 'Update this active caller, source/emitted probe, local build mapping or API contract in the same bounded slice. Preserve all fixture inputs and numerical gates.' };
}
const files = [...selected].sort().map(path => {
  const { data, text } = texts.get(path);
  const matches = (historicalFile(path) ? [] : text.split('\n')).flatMap((line, index) => {
    const kinds = patterns.filter(([, pattern]) => pattern.test(line)).map(([name]) => name);
    if (workspaceMetadata.includes(path) && /packages|apps|build|check|publish|test|type-check|lint|workspace|pnpm/.test(line)) kinds.push('workspace-build-discovery');
    if (!kinds.length) return [];
    const syntax = /\bimport\s*\(/.test(line) ? 'dynamic-import-or-probe' : /\b(?:import|export)\b.*(?:from|['"])/.test(line) ? 'static-import-export-or-text' : /importmap|alias|entryPoints|new URL|resolve\(|join\(|symlink/.test(line) ? 'mapping-or-computed-path' : /\bcreate\w+\s*\(/.test(line) ? 'factory-call-definition-or-sample' : 'text-or-metadata';
    const directDependency = /\.(?:md|mdx|txt)$/.test(path) ? (/@barocss\/physics|create(?:Physics|Fluid|Cloth|CadFluid|PlanarPendulum|UprightCapsule)/.test(line) ? 'api-prose' : 'lexical-mention')
      : /\bimport\s*\(|\bfrom\s*['"]|^\s*import\s*['"]/.test(line) ? 'import-or-import-probe'
      : /alias|entryPoints|importmap|symlink|barocss-.*(?:\+|\$)|['"]physics['"]/.test(line) ? 'mapping-candidate'
      : /\b(?:createPhysicsWorld|createFluidWorld|createClothWorld|createCadFluidWorld|createPhysicsReplaySession|restorePhysicsReplaySession|createPhysicsScene|createPlanarPendulum|createUprightCapsuleQuery|createUprightCapsuleController|admitCadSurfaceProxy|cadProxyPose|assertCadProxyCurrent)\s*\(/.test(line) ? 'call-or-definition'
      : 'lexical-mention';
    return [{ line: index + 1, text: line.slice(0, 600), ...(line.length > 600 ? { fullLineSha256: sha256(line), fullLineCharacters: line.length, textTruncated: true } : {}), kinds, syntax, directDependency, ...classify(path, line) }];
  });
  const ownEdges = edges.filter(edge => edge.from === path && selected.has(edge.to));
  if (!matches.length) matches.push({ line: 1, text: text.split('\n')[0].slice(0, 600), kinds: [historicalFile(path) ? 'immutable-file-not-current-callsite' : 'physics-path-or-local-reference-closure'], syntax: 'support-file', ...classify(path, text.slice(0, 600)) });
  const aggregate = key => [...new Set(matches.map(match => match[key]).filter(Boolean))].sort();
  const classifications = aggregate('classification'), roles = aggregate('role'), slices = aggregate('slice'), operations = aggregate('operation');
  return { path, sha256: sha256(data), bytes: data.length, classification: classifications.length === 1 ? classifications[0] : 'mixed', classifications, roles, slices, operations, matches, localLiteralEdges: ownEdges };
});
const pkg = JSON.parse(texts.get('packages/barocss-physics/package.json').text);
const entries = Object.entries(pkg.exports).map(([subpath, workspace]) => {
  const path = 'packages/barocss-physics/' + workspace.import.replace(/^\.\//, '');
  const { data, text } = texts.get(path);
  return { subpath, workspace, published: pkg.publishConfig.exports[subpath], path, sha256: sha256(data), exports: text.split('\n').flatMap((line, index) => /\bexport\b/.test(line) ? [{ line: index + 1, text: line }] : []) };
});
const seed = JSON.parse(readFileSync(resolve(root, 'examples/physics-motion-docs-2276/evidence/api-callsite-inventory.json')));
const classes = {};
for (const file of files) for (const match of file.matches) classes[match.classification] = (classes[match.classification] ?? 0) + 1;
const concreteCallsites = {};
for (const file of files) {
  if (!/\.(?:[cm]?[jt]sx?|html)$/.test(file.path) || (file.path.startsWith('packages/barocss-physics/src/') && !/replay-session\.ts$/.test(file.path))) continue;
  for (const match of file.matches) {
    if (!['import-or-import-probe', 'call-or-definition'].includes(match.directDependency) || !['update', 'adapt-harness'].includes(match.operation)) continue;
    const text = match.text;
    const group = /fluid-cad|CadFluid/.test(text) ? 'P5 CAD-fluid' : /createFluidWorld|\/fluid(?:[.'"/]|$)/.test(text) ? 'P5 fluid' : /createClothWorld|\/cloth(?:[.'"/]|$)/.test(text) ? 'P5 cloth' : /Replay|PhysicsScene|\/replay/.test(text) ? 'P2 replay (P1 build dependency)' : /cad-proxy|CadSurfaceProxy|cadProxyPose|assertCadProxyCurrent/.test(text) ? 'P2 CAD-proxy' : /PlanarPendulum/.test(text) ? 'P1 reduced-pendulum reference migration' : /UprightCapsule/.test(text) ? 'P1 capsule query/controller roles' : /@barocss\/physics|barocss-physics|createPhysicsWorld/.test(text) ? 'P1 root' : null;
    if (group) (concreteCallsites[group] ??= []).push({ path: file.path, line: match.line, operation: match.operation, text });
    if (/createPhysicsWorld|@barocss\/physics['"]|barocss-physics\/src\/index/.test(text) && group !== 'P1 root') (concreteCallsites['P1 root'] ??= []).push({ path: file.path, line: match.line, operation: match.operation, text });
  }
}
const report = {
  schema: 1, work_id: 'physics-world-p0-2276', artifact_type: 'bounded-caller-inventory', status: 'ready_for_build', owner_role: 'independent-physics-algorithm-work', source_request: 'freeze direct migration scope without compatibility paths', last_updated: '2026-11-02', baseline: base,
  searchPatterns: patterns.map(([name, pattern]) => ({ name, source: pattern.source, flags: pattern.flags })),
  selectedPathRules: ['physics in path (case-insensitive)', 'explicit workspaceMetadata', 'reverse literal-relative-reference closure'],
  workspaceMetadata,
  excludedNewP0Prefixes: p0Paths,
  concreteCallsites,
  factoryExportRemovalPlan: [
    { slice: 'P1', paths: ['packages/barocss-physics/src/index.ts'], operation: 'move-reduced-pendulum-export-to-reference', preserve: 'Capsule query/controller roles remain separate; preserve rigid signatures or migrate replay and every root caller together.' },
    { slice: 'P2', paths: ['packages/barocss-physics/src/replay.ts', 'packages/barocss-physics/src/replay-session.ts'], operation: 'replace-old-recording-factory-exports-with-common-World-recording-contract', preserve: 'The current root/replay graph stays buildable in P1; no late P2 fix for a broken root signature.' },
    { slice: 'P5', paths: ['packages/barocss-physics/src/fluid.ts', 'packages/barocss-physics/src/cloth.ts', 'packages/barocss-physics/src/fluid-cad.ts'], operation: 'remove-obsolete-domain-runtime-factory-exports', preserve: 'Introduce common-World model equivalents and update active callers in the same slice. Keep kernels and immutable fixtures.' },
    { slice: 'P1/P2/P5', paths: ['packages/barocss-physics/package.json'], operation: 'update-owned-workspace-and-published-export-maps', preserve: 'No compatibility engine, publication or shared root metadata edit.' },
  ],
  historicalFilePolicy: 'Historical report/receipt/handover files and named source-freeze/ledger/recording/selected-state artifacts are retained as hashed immutable file records with a line-1 anchor, not counted as current callsites. Lines longer than 600 characters use a preview plus full-line SHA-256.',
  scope: 'Current tracked working-tree text, all paths/extensions; case-insensitive physics token, named public factories and CAD adapter symbols; physics path files and reverse literal-relative-reference closure. Bounded lexical inventory, not runtime reachability proof.',
  reproducibility: 'node examples/physics-world-p0-2276/inventory.mjs --check; no timestamp or current HEAD dependence; excludes own P0 directory before counting. Re-run generator after intentional caller or ROADMAP edits.',
  boundaries: ['No runtime API or caller is changed by this inventory.', 'No arbitrary computed string, external consumer, ignored/untracked file, generated artifact body, runtime loader, or reflection completeness is claimed.', 'Literal relative strings are conservative edges and can be data or comments. Syntax labels identify candidates, not AST execution proof.', 'Historical evidence directories are excluded and immutable. Historical reports outside those directories are classified preserve.', 'P1 root signature changes require replay and all root consumers to build in that same slice; P2 cannot defer a root/replay type mismatch.', 'P2 recording/CAD and P5 cloth/fluid/CAD-fluid migrations retain their independent physical qualification limits.', 'Capsule queries and controller references have separate roles. Reduced pendulum must move to a reference entry and cannot substitute for rigid hinge gates.', 'HOLD, NO_GO, tolerances, original fixtures, first failures and historical receipts stay unchanged.'],
  corpus: { trackedOutsideP0Directories: tracked.filter(path => !p0Paths.some(prefix => path.startsWith(prefix))).length, scannedTextFiles: texts.size, selectedFiles: files.length, matchedLines: Object.values(classes).reduce((a, b) => a + b, 0), unclassifiedMatches: 0, excludedCounts: excluded, excludedPaths },
  previousSeed: { path: 'examples/physics-motion-docs-2276/evidence/api-callsite-inventory.json', fileCount: seed.fileCount, missingFromCurrentSelection: seed.files.filter(file => !selected.has(file.path)).map(file => file.path), additionalFiles: files.filter(file => !seed.files.some(old => old.path === file.path)).map(file => file.path) },
  classificationCounts: classes,
  package: { path: 'packages/barocss-physics/package.json', sha256: sha256(texts.get('packages/barocss-physics/package.json').data), main: pkg.main, types: pkg.types, scripts: pkg.scripts, dependencies: pkg.dependencies, publishConfig: pkg.publishConfig, entries },
  manualDynamicFindings: [
    { paths: ['examples/physics-character-viewer/setup.mjs', 'examples/physics-cloth-viewer/setup.mjs', 'examples/physics-capsule-query-scene/setup.mjs', 'examples/physics-character-public-reference/setup.mjs', 'examples/physics-character-reference/setup.mjs', 'examples/physics-character-controller-reference/setup.mjs', 'examples/physics-character-lookahead-reference/setup.mjs', 'examples/physics-error-entry/setup.mjs'], finding: 'Workspace links compute barocss- plus each name. Physics is a list member. Keep the setup mapping and package export resolution in the migration.' },
    { paths: ['examples/physics-viewer-scene/server.mjs', 'examples/physics-cad-scene/server.mjs'], finding: 'esbuild entryPoints use new URL with a local app.js; the water viewer server also loads ../physics-scene/fluid-viewer/app.js. These servers are callers through their entry graph although the server need not import a Physics factory.' },
    { paths: ['apps/library-docs/samples/run.mjs'], finding: 'Source alias maps @barocss/physics to packages/barocss-physics/src. This proves source consumption only. Published export-map probes remain separate.' },
  ].map(finding => ({ ...finding, locations: finding.paths.map(path => ({ path, sha256: sha256(texts.get(path).data), lines: texts.get(path).text.split('\n').flatMap((line, i) => /physics|barocss-|entryPoints|new URL|alias/i.test(line) ? [{ line: i + 1, text: line }] : []) })) })),
  files,
};
const json = JSON.stringify(report, null, 2) + '\n';
const concreteSummary = Object.entries(concreteCallsites).map(([group, rows]) => {
  const byPath = new Map();
  for (const row of rows) {
    const value = byPath.get(row.path) ?? { lines: [], operations: new Set() };
    value.lines.push(row.line); value.operations.add(row.operation); byPath.set(row.path, value);
  }
  return `### ${group}\n\n${byPath.size} files; ${rows.length} lexical import/call candidates.\n\n| File | Lines | Fixed operation |\n|---|---|---|\n${[...byPath].map(([path, value]) => `| ${path} | ${[...new Set(value.lines)].join(', ')} | ${[...value.operations].join(', ')} |`).join('\n')}`;
}).join('\n\n');
const md = `---\nwork_id: physics-world-p0-2276\nartifact_type: bounded-caller-inventory\nstatus: ready_for_build\nowner_role: independent-physics-algorithm-work\nsource_request: freeze direct migration scope without compatibility paths\nlast_updated: 2026-11-02\n---\n\n# Physics P0 caller and export inventory

Baseline: \`${base}\`. Runtime changes are NOT_RUN.

Run \`node examples/physics-world-p0-2276/inventory.mjs --check\`. Each selected file has SHA-256 and one-based match lines in callers.json. Both new P0 artifact directories are excluded. Regenerate after intentional ROADMAP edits.

${report.scope}

${files.length} selected files; ${report.corpus.matchedLines} classified lines or immutable/support-file anchors. Zero unclassified records applies only to this lexical corpus. It is not proof of a complete reachable runtime graph. All ${seed.fileCount - report.previousSeed.missingFromCurrentSelection.length}/${seed.fileCount} old seed paths remain selected.

## Classification counts

${Object.entries(classes).map(([name, count]) => `- ${name}: ${count} records.`).join('\n')}

File classes, roles, slices and operations are aggregated from actual line records. Mixed files retain all values. The full file list is in callers.json. A pure mention has operation preserve. A reference provider has operation freeze-reference-provider. An executable reference harness has operation adapt-harness. Active direct callers have operation update. Shared CI/root/workspace metadata has operation verify-mapping-under-existing-owner.

## Excluded corpus

${Object.entries(excluded).map(([reason, count]) => `- ${reason}: ${count} tracked files.`).join('\n')}

Exact excluded paths and counts are in callers.json. VitePress cache is an emitted artifact. Historical evidence remains immutable. Named historical ledgers, source freezes, recordings and selected-state files outside evidence directories have hashed immutable anchors. They are not current callsite counts. Long lines use a 600-character preview and a full-line hash.

## Migration rules

${report.boundaries.map(value => `- ${value}`).join('\n')}

P1 keeps the root signature while it separates internals, or changes the root and every root consumer together. Replay is a real root consumer. P2 changes recording and CAD boundaries after that buildable step. P5 changes cloth, fluid and CAD-fluid factories and their active callers together. Preserve numerical fixtures and frozen reference providers. Adapt only affected harness signatures and imports. Verify shared build mappings; change them only under their existing owner.

## Public entries and fixed export operations

| Subpath | Workspace import | Published import | Assigned slice |
|---|---|---|---|
${entries.map(entry => `| ${entry.subpath} | ${entry.workspace.import} | ${entry.published.import} | ${entry.subpath === '.' ? 'P1' : /fluid|cloth/.test(entry.subpath) ? 'P5' : 'P2; root/replay build dependency in P1'} |`).join('\n')}

${report.factoryExportRemovalPlan.map(row => `- ${row.slice}: ${row.operation} in ${row.paths.map(path => '`' + path + '`').join(', ')}. ${row.preserve}`).join('\n')}

Root also exports the reduced planar pendulum, upright capsule query and upright capsule controller. Keep the two capsule roles explicit. Move the reduced ODE to a reference entry; it cannot qualify rigid hinge dynamics.

## Concrete direct caller candidates

These tables select code/HTML import, import-probe and named call candidates with a fixed update or adapt-harness operation. They omit pure prose, data and frozen providers. They remain lexical candidates; execution proof is separate. The JSON keeps exact candidate lines and complete file aggregates, including mixed root, replay and CAD dependencies.

${concreteSummary}

## Computed paths inspected

${report.manualDynamicFindings.map(finding => `- ${finding.paths.map(path => '`' + path + '`').join(', ')}: ${finding.finding}`).join('\n')}
`;
for (const [name, content] of [['callers.json', json], ['callers.md', md]]) {
  if (process.argv.includes('--check')) {
    if (readFileSync(resolve(out, name), 'utf8') !== content) throw new Error(`${name} is stale; regenerate inventory before checking`);
  } else writeFileSync(resolve(out, name), content);
}
console.log(JSON.stringify({ result: 'PASS', mode: process.argv.includes('--check') ? 'check' : 'generate', files: files.length, lines: report.corpus.matchedLines, excluded, unclassified: 0, seedMissing: report.previousSeed.missingFromCurrentSelection }));
