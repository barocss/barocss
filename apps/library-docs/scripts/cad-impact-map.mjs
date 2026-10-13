// Small, read-only impact map. A mapped page is a REVIEW TARGET, never proof that
// its content is stale, that a public API changed, or that a browser test passed.
export const mappings = Object.freeze([
  { prefix: 'packages/barocss-cad/src/modeling', docs: ['docs/packages/cad/modeling.md', 'docs/packages/cad/quickstart.md', 'docs/packages/cad/capabilities.md', 'docs/packages/cad-editor/feature-coverage.md'] },
  { prefix: 'packages/barocss-cad/src/feature-', docs: ['docs/packages/cad/capabilities.md', 'docs/packages/cad/modeling.md', 'docs/packages/cad-editor/feature-coverage.md'] },
  { prefix: 'packages/barocss-cad/src/boolean-', docs: ['docs/packages/cad/capabilities.md', 'docs/packages/cad/guides.md', 'docs/packages/cad-editor/feature-coverage.md'] },
  { prefix: 'packages/barocss-cad/src/index.ts', docs: ['docs/packages/cad/api.md'] },
  { prefix: 'packages/barocss-cad/package.json', docs: ['docs/packages/cad/index.md'] },
  { prefix: 'packages/barocss-cad-editor/src/react/modeling-editor.tsx', docs: ['docs/packages/cad-editor/first-model.md', 'docs/packages/cad-editor/quickstart.md', 'docs/packages/cad-editor/feature-coverage.md'] },
  { prefix: 'packages/barocss-cad-editor/src/modeling-file.ts', docs: ['docs/packages/cad-editor/first-model.md'] },
  { prefix: 'packages/barocss-cad-editor/src/', docs: ['docs/packages/cad-editor/guides.md', 'docs/packages/cad-editor/limits.md', 'docs/packages/cad-editor/feature-coverage.md'] },
  { prefix: 'apps/cad-editor/src/app.tsx', docs: ['docs/packages/cad-editor/first-model.md', 'docs/packages/cad-editor/index.md', 'docs/packages/cad-editor/feature-coverage.md'] },
  { prefix: 'packages/barocss-cad-interop/src/', docs: ['docs/packages/cad-interop/guides.md'] },
  { prefix: 'packages/barocss-render-editor/src/', docs: ['docs/packages/render-editor/guides.md'] },
  { prefix: 'apps/library-docs/docs/packages/cad/', docs: ['docs/packages/cad/index.md'] },
  { prefix: 'apps/library-docs/docs/packages/cad-editor/', docs: ['docs/packages/cad-editor/index.md'] },
]);

export function impactForPaths(paths) {
  if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string' || !path || path.includes('\\') || path.includes('..') || path.startsWith('/'))) throw Error('Expected repository-relative POSIX file paths');
  const changes = [...new Set(paths)].sort();
  const impacts = [], unmapped = [];
  for (const file of changes) {
    if (!/^(packages\/barocss-cad(?:-editor|-interop)?\/|apps\/cad-editor\/|packages\/barocss-render-editor\/|apps\/library-docs\/docs\/packages\/cad(?:-editor)?\/)/.test(file)) continue;
    // Longest matching prefix is authoritative; a broad prefix does not hide a specific contract.
    const match = mappings.filter(item => file.startsWith(item.prefix)).sort((a,b) => b.prefix.length-a.prefix.length)[0];
    if (!match) unmapped.push(file);
    else impacts.push({ source: file, documentation: [...match.docs], status: 'review-required-not-proven-stale' });
  }
  return { schema: 1, changedPaths: changes.length, impacts, unmapped, reviewed: false, nativeExecuted: false, browserExecuted: false };
}
