# Paired-roof Body split Manual checkpoint

- Scope: app-only Manual guide and CAD API/examples/sidebar discovery under #1247, documenting #1575
- Base: `e7629701c61a8a878f7a742aab2af37a570f21e5`; public root/source inspected at that commit
- Native evidence reused: https://github.com/barocss/barocss/issues/1575#issuecomment-6116691027. No split builder, split validator or native demo was executed for this documentation task
- Guide covers complete whole/middle public result inputs, exact child options, two closed outputs, shared native cut/opposite effective uses, pointwise partition, fixture-only volume equality, ownership, diagnostics, cost and verified 8 MiB / 16 MiB envelopes
- Runtime: Node v22.23.3, `--max-old-space-size=2048`; checks sequential, no parallel heavy builds
- Fresh disk admission: 787,214,336 bytes before compile-only check; 778,813,440 before successful build; 704,913,408 before full docs check. Each exceeds 500,000,000 bytes; build estimate 120,000,000 bytes plus 128 MiB reserve fits
- PASS: `node --max-old-space-size=2048 apps/library-docs/scripts/check-paired-roof-body-split.mjs`. Checks the exact guide block against public root types, no emit or native execution
- PASS: `NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @barocss/library-docs build`. Initial attempt lacked the ignored local vitepress executable shim; repaired the dependency link and reran successfully. Existing large-chunk warning remains
- PASS: `node --max-old-space-size=2048 apps/library-docs/scripts/check-docs.mjs`: 114 pages, 727 internal links, 57 image assets, 4 downloads, 45 preset anchors; manifest hashes matched
- PASS: built guide content and CAD API route inspected; `git diff --check`
- No package/native changes, generated native fixtures, UI/codec/GPU/Loader qualification, deployment or publication
