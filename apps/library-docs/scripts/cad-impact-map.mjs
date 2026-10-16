// Small, read-only impact map. A mapped page is a REVIEW TARGET, never proof that
// its content is stale, that a public API changed, or that a browser test passed.
export const mappings = Object.freeze([
  { prefix: 'packages/barocss-cad/src/modeling', docs: ['docs/packages/cad/modeling.md', 'docs/packages/cad/quickstart.md', 'docs/packages/cad/capabilities.md'] },
  { prefix: 'packages/barocss-cad/src/feature-', docs: ['docs/packages/cad/capabilities.md', 'docs/packages/cad/modeling.md'] },
  { prefix: 'packages/barocss-cad/src/boolean-', docs: ['docs/packages/cad/capabilities.md', 'docs/packages/cad/guides.md'] },
  { prefix: 'packages/barocss-cad/src/index.ts', docs: ['docs/packages/cad/api.md'] },
  { prefix: 'packages/barocss-cad/package.json', docs: ['docs/packages/cad/index.md'] },
  { prefix: 'packages/barocss-cad-interop/src/', docs: ['docs/packages/cad-interop/guides.md'] },
  { prefix: 'apps/library-docs/docs/packages/cad/', docs: ['docs/packages/cad/index.md'] },
]);

export function impactForPaths(paths) {
  if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string' || !path || path.includes('\\') || path.includes('..') || path.startsWith('/'))) throw Error('Expected repository-relative POSIX file paths');
  const changes = [...new Set(paths)].sort();
  const impacts = [], unmapped = [];
  for (const file of changes) {
    if (!/^(packages\/barocss-cad(?:-interop)?\/|apps\/library-docs\/docs\/packages\/cad\/)/.test(file)) continue;
    // Longest matching prefix is authoritative; a broad prefix does not hide a specific contract.
    const match = mappings.filter(item => file.startsWith(item.prefix)).sort((a,b) => b.prefix.length-a.prefix.length)[0];
    if (!match) unmapped.push(file);
    else impacts.push({ source: file, documentation: [...match.docs], status: 'review-required-not-proven-stale' });
  }
  return { schema: 1, changedPaths: changes.length, impacts, unmapped, reviewed: false, nativeExecuted: false, browserExecuted: false };
}
