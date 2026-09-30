# Local library delivery (#470)

## Delivered scope

The existing private `@barocss/render` package now builds ESM JavaScript and exports declarations
for `Renderer`, `validateSpec` and `classesFor`. Source remains in `packages/barocss-render`.
React is external. The screen validator and renderer implementation bytes are unchanged; this
adds a build/consumer boundary, not another component catalog or model protocol.

A separate local consumer contains only package metadata/dist, its authored application example
and links to installed third-party React assets. It imports the package root exports, not repository
JSX or research-only scripts. The default ESM smoke test runs without a browser. The focused consumer
verification additionally uses already installed TypeScript/React types/Chromium; no downloads.

The example is a small application component with the existing five registrations, name state,
save callback, validation error list and last-valid-spec handling. It has no server, model caller,
revision manager or research framework. Reuse the existing loopback mock/replay hosts when those
behaviors are needed.

## Reproducible evidence

The focused suite passed **3/3**, with no skipped tests:

- TypeScript resolves the built root declarations and checks the actual example. Negative checks
  reject unsupported layout choices, state binding, action and component type.
- The browser bundles the package root from the isolated consumer. Its input list is limited to
  the copied built package/application and installed third-party assets. It renders the authored
  profile form, measures generated grid/padding classes through the existing BaroCSS browser runtime,
  changes name to Bea and dispatches the host's save snapshot. Invalid JSON data is rejected and
  the last valid screen/input remain. Another complete screen update retains that input. Page errors
  and external requests are zero. An authored screenshot and bundler metadata are retained privately.
- A separate Node ESM program imports `@barocss/render` by its package export, with no JSX compiler,
  source directory or research scripts. It checks all three exports and structured invalid-input errors.

The private consumer report records `candidateCommit`, `worktreeClean`, built artifact hashes,
`source: authored-profile-form`, `modelCalls: 0` and the named checks. A final clean-candidate run
binds this evidence to the exact commit submitted for Review; post-merge evidence names the merge
commit separately. Artifact hashes describe authored local build data, not any captured user/model
response. Exact paths, commit and Review are recorded on the Issue to avoid a self-referential source hash.

```sh
NODE=/Users/user/Library/pnpm/nodejs/22.19.0/bin/node
export REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration
export REACT_ROOT=/Users/user/.barocss-ai/v3/wt/issue-446/scripts/json-render-446/scratch/jr
export REACT_TYPES_ROOT=/Users/user/github/ai-based/abs
export PW_DIR=/Users/user/github/ai-based/abs/node_modules/.pnpm/playwright-core@1.60.0/node_modules/playwright-core
"$NODE" packages/barocss-render/build.mjs
"$NODE" --test packages/barocss-render/tests/consumer.test.mjs
"$NODE" /Users/user/.barocss-ai/v3/integration/node_modules/eslint/bin/eslint.js \
  --config /Users/user/.barocss-ai/v3/integration/eslint.config.mjs \
  packages/barocss-render/build.mjs packages/barocss-render/src/index.d.ts \
  packages/barocss-render/examples/profile-form.tsx packages/barocss-render/tests/consumer.test.mjs
git diff --check
```

Scoped lint passes without warnings. Both progressive freeze checks remain unchanged. The existing
three published packages' local pack/export/type/import check also passes against their retained
integration builds; no published runtime change belongs to this task. The pack tool's child pnpm
requires the pinned Node on PATH; an initial system-Node mismatch was resolved with a per-command
PATH, without changing global configuration.

Initial consumer test assertions were corrected to include React DOM's installed scheduler dependency
and distinguish a bundler source-label comment from an actual source import. The final bundle still
contains no research implementation inputs; no runtime or safety contract was relaxed.

## Historical evidence is preserved

Current #458 freeze verification intentionally fails because its source list binds the old package
README. The sole changed frozen source is `packages/barocss-render/README.md`; the new README
accurately describes built exports/types and replaces the old source-JSX claim. No frozen plan,
claim, launch allowance or raw output is rewritten.

Historical corpus verification passes at retained clean baseline
`3d325f146a92a263b78bd0864ef489c44664cadd` in the #469 worktree: 18 valid responses and two ceiling
slots. That source checksum is historical evidence, not a reason to keep current documentation stale.
The unchanged original/current progressive plans still pass at this new candidate. This package
build inherits no previous live-run ACCEPT or authority.

The [#469 result](../../scripts/barocss-render-progressive/RESULT-469.md) ended the paid/progressive
measurement stage with no accepted new model/UI sample. New consumer evidence uses authored
form-compatible data and establishes local build/API behavior only. It is separate from historical
actual responses, synthetic replay and native startup failures.

## Limits and integration

Package remains `private: true`, version `0.0.0-private-prototype`, ESM-only and without a stable-API
promise. Types express shapes; runtime graph/ID/text bounds still require `validateSpec`. The host
owns component HTML, state, error handling, last valid screen, actions, CSS runtime startup and any
model transport. This task neither implements live model/session compatibility nor authorizes
publication, registry setup, release or deployment. No Changeset is appropriate for this private package.

Independent exact Review precedes serial local develop integration. The Issue closure records the
accepted source commit, Review, no-ff merge and post-integration focused checks.
