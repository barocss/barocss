# BaroCSS library documentation portal

Private VitePress1.6.4 application under #1247/#1248. It preserves the existing CSS site and release pins. Source content snapshot: `5f5ad866205a21510ac69552e704cc162fa253b5`.

Use Node22+. After the workspace's normal dependency setup:

```sh
pnpm --filter @barocss/library-docs dev --host 127.0.0.1
pnpm --filter @barocss/library-docs build
pnpm --filter @barocss/library-docs preview --host 127.0.0.1
node apps/library-docs/scripts/check-docs.mjs
node apps/library-docs/scripts/run-snippet.mjs
```

The native checkpoint reuses actual `/Users/user/.barocss-ai/v3/integration/node_modules/vitepress`1.6.4 through an ignored app-local node_modules link. No dependency installation or root lock edit is part of this delta. Root workspace already covers apps/*. Integration alone adds the importer for `vitepress:^1.6.4`, using its existing1.6.4 resolution; root scripts need no change. Root esbuild^0.25.9 supplies the selected API probe (actual reused0.25.12).

The source material probe creates ignored app-local GPU/CAD dependency links and uses esbuild's ordinary node-module search path for the transitive CAD dependency. It compiles, validates and lowers a real material and checks unsupported syntax refusal. It does not draw pixels or verify all exports. Documentation build, source API execution, compiled package acceptance, local integration and registry/site publication are separate stages.

`evidence/package-inventory.json` freezes all12 actual manifest versions/maps/hashes. The checker refuses manifest drift; review changes before refreshing a snapshot. Native build/browser/snippet receipts record actual results and first failures. No deployment or Pages configuration is included.

## Public API reference and maintenance

Each of the nine newer sections has a complete public signature reference resolved through actual manifest entries. Root TypeScript^5.9.2 supplies extraction (actual reused5.9.3); no new dependency is required. Render uses its tracked src/index.d.ts as declaration provenance for a dist-default runtime, not a fabricated source entry.

```sh
node apps/library-docs/scripts/public-api.mjs --check
node apps/library-docs/scripts/public-api.mjs --self-test
# After review of actual source contracts, regenerate the baseline and pages:
node apps/library-docs/scripts/public-api.mjs --write
```

Extraction follows actual re-exports with ignored app-local workspace links and ordinary TypeScript dependency search. It refuses undeclared/missing symbol provenance and any own package resolution outside this native root. Public names/signatures/version/complete export maps are compared; added/removed/changed groups fail. Private/protected members and bodies are excluded. Public constructor parameter properties are included. This is declaration documentation, not emitted artifact equivalence, runtime/type-check acceptance or semantic drift proof. Behavior/error/ownership changes can require manual page review even when signatures stay identical. No schedule/automation is installed.

Before `--write`, the extractor verifies the nine tracked package trees against the explicit source pin and requires declaration paths to exist at that pin. A later source snapshot needs deliberate inventory/pin and semantic review; the writer does not silently retag new source. Module README drift is separately tracked in [#1260](https://github.com/barocss/barocss/issues/1260).

The source-link receipt confirms the fixed commit is local-only (actual GitHub422). Handwritten API source groups link to generated site-local public declaration anchors. Other local repository paths are provenance text. `node apps/library-docs/scripts/source-links.mjs --check` rejects unavailable fixed-SHA GitHub links; `--write` repairs known public groups after regeneration. Never substitute moving main/develop or push product code to make a provenance URL work. Recheck the exact remote commit before marking its availability receipt true.
