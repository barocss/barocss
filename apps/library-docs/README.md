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
