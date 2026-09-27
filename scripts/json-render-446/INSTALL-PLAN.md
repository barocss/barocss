# #446 pinned dependency install record and replay prerequisites

The owner approved this isolated, pinned dependency installation and deterministic replay via V3 Planner on 2026-09-27. Paid model calls remain unapproved. Registry metadata was read before approval; the pinned package tarballs were installed only after approval. No browser download or model request occurred.

## Reusable local assets

- The #376 `scratch/jr` and `scratch/a2` installs and their bundles are absent in all checked BaroCSS worktrees. Neither `@json-render/core` nor `@json-render/react` has an installed copy or tarball entry in the checked local npm cache.
- A separate existing workspace has `playwright-core@1.60.0` at `<existing-playwright-project>/node_modules/playwright-core`. Its `browsers.json` specifies Chromium revision `1223`, browser version `148.0.7778.96`.
- The matching installed Chromium executable is `/path/to/existing/chromium-148`. The executable reports `Google Chrome for Testing 148.0.7778.96`. Reuse these read-only; do not install another browser unless this executable fails the approved replay.
- The local BaroCSS package manifests specify browser/kit `0.11.1` and Tailwind CSS `4.3.3`. The root package manifest specifies esbuild `^0.25.9`; an actual runner must record the resolved version and build artifact SHA, not infer them from a range.

## Exact direct package pins

The official [json-render source at `c2600d7`](https://github.com/vercel-labs/json-render/tree/c2600d73908ed505e6d726f5b6f969ba8f597ce7/packages) declares core/react package version `0.21.0`; this source commit is capability documentation, not proof that npm tarballs contain identical files. Separately, npm registry metadata for the published React `0.21.0` package says it depends on core `0.21.0` and declares React `^19.2.3` as a peer. The published core package depends on Zod `^4.3.6` and declares Zod `^4.0.0` as a peer. Pin the direct versions below so these ranges cannot float during this experiment.

| Package | Exact version | npm registry `dist.integrity` |
| --- | --- | --- |
| `@json-render/core` | `0.21.0` | `sha512-vysEbTjO1y8mEgAsp0tztRyaWCkNsBrG8MhAqbndGK3qmMXjMRdCNtk21+AQRNKdRelFGVAwBgtUNW8tfjQlsw==` |
| `@json-render/react` | `0.21.0` | `sha512-z/fZg0L8fJe2dnnQjWkmMw409iBclSWcOqdjoBy8eLHeBr/7F7VipzkY1CfgA2Fa5uW+zxZ54OvWMtdDcsp/yg==` |
| `react` | `19.2.3` | `sha512-Ku/hhYbVjOQnXDZFv2+RibmLFGwFdeeKHFcOTlrt7xplBnya5OGn/hIRDsqDiSUcfORsDC7MPxwork8jBwsIWA==` |
| `react-dom` | `19.2.3` | `sha512-yELu4WmLPw5Mr/lmeEpox5rw3RETacE++JgHqQzd2dg+YbJuat3jH4ingc+WPZhxaoFzdv9y33G+F7Nl5O0GBg==` |
| `zod` | `4.3.6` | `sha512-rftlrkhHZOcjDwkGlnUtZZkvaPHCsDATp4pGpuOOMDaTdDDXF91wuVDJoWoPsKX/3YPQ5fHuF3STjcYyKr+Qhg==` |
| existing `playwright-core` | `1.60.0` | `sha512-9bW6zvX/m0lEbgTKJ6YppOKx8H3VOPBMOCFh2irXFOT4BbHgrx5hPjwJYLT40Lu+4qtD36qKc/Hn56StUW57IA==` (registry metadata; local installed file integrity still needs independent check) |

## Executed installation commands

Run from the isolated #446 worktree with Node.js 22.22.0. `scratch/` is ignored by Git. These commands create no product dependency or root lockfile changes. The successful install used the task-specific cache shown here:

```sh
mkdir -p scripts/json-render-446/scratch/jr
cat > scripts/json-render-446/scratch/jr/package.json <<'JSON'
{"private":true,"name":"json-render-446-research","version":"0.0.0","dependencies":{"@json-render/core":"0.21.0","@json-render/react":"0.21.0","react":"19.2.3","react-dom":"19.2.3","zod":"4.3.6"}}
JSON
npm_config_cache=/private/tmp/barocss-446-npm-install-cache /path/to/node-22.22.0/bin/node /path/to/node-22.22.0/lib/node_modules/npm/bin/npm-cli.js install --prefix scripts/json-render-446/scratch/jr --ignore-scripts --no-audit --no-fund
JR_ROOT="$PWD/scripts/json-render-446/scratch/jr" PW_DIR=/path/to/existing/playwright-core-project /path/to/node-22.22.0/bin/node scripts/json-render-446/check.mjs
```

The first install attempt could not write to the default home npm cache (`EACCES`); the same pinned install succeeded with the task-specific `/private/tmp` cache shown above. `evidence/package-lock.json` and `package-lock.sha256` preserve the resolved direct/transitive integrities; `npm-tree.json`, `environment.json`, and `preflight-after-install.json` record the installed tree, browser hash and successful dependency detection. The source commit and npm tarballs are separate provenance; byte-for-byte equivalence is not claimed. The exact browser replay command was added to #446 before running it. `evidence/replay.json` and 48 screenshots now contain the measured result. Do not use `--force`, change the repository root lockfile, or treat a successful preflight as a rendered result. A paid model run remains a separate, unapproved step.
