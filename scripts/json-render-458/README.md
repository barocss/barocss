# Issue 458 saved-response pilot preparation

This directory contains the frozen 24-cell plan, strict validator, serial capture harness, independent scoring, official json-render browser replay, and a read-only loopback viewer. It uses three synthetic scenarios and two catalog arms. `liveTransport` throws before process launch because the installed Codex CLI has no verified pre-dispatch no-tools boundary. The current artifacts and tests are preparation only; no model response has been collected.

## CLI-free verification

Run from the repository root:

```sh
node --test scripts/json-render-458/*.test.mjs
node scripts/json-render-458/capture.mjs --stub --output /private/tmp/baro-458-stub-NEW
```

The output directory must not exist before capture. Set the three browser environment variables above while running `node --test scripts/json-render-458/replay.test.mjs` to exercise the lost-focus fault regression in the installed browser. It contains a manifest, 24 scheduled rows, and one immutable raw final per attempted stub call. Malformed, truncated, schema, quota, timeout, and missing-usage stub modes are covered by tests. `frozen-plan.json` binds the contract sources and imported #446 fixtures and bundle by SHA-256. `freeze.mjs` checks that binding.

Browser replay requires already installed packages, with no download:

```sh
JR_ROOT=/absolute/path/to/pinned/json-render-project \
PW_DIR=/absolute/path/to/existing/playwright-core-project \
CHROME=/absolute/path/to/installed/chromium \
REPO_DEPS_ROOT=/absolute/path/to/barocss-dependencies \
node scripts/json-render-458/replay.mjs \
  --capture /private/tmp/baro-458-stub-NEW \
  --output /private/tmp/baro-458-replay-NEW
```

`REPO_DEPS_ROOT` may be omitted when this checkout has `esbuild`. The replay verifies the frozen capture, reads only saved responses, validates each spec before the browser, serves fixed local assets on an ephemeral loopback port, and writes `report.json` plus desktop/narrow screenshots to a new output directory. The bounded arm passes validated pixel values through CSS custom properties into fixed host rules. It never invokes Codex. A fresh replay directory can be used to correct replay or scoring defects without a new generation attempt.

View the saved results locally:

```sh
node scripts/json-render-458/viewer.mjs \
  --capture /private/tmp/baro-458-stub-NEW \
  --replay /private/tmp/baro-458-replay-NEW
```

The command prints a random tokenized `127.0.0.1` URL. The viewer accepts GET only, serves bound report data and allowlisted screenshots, escapes captured text, and offers no generation or arbitrary file endpoint. Stop it with Ctrl-C. Do not deploy it.

## Live gate

`--live` always fails before dispatch in this preparation commit. Review's preparation-only ACCEPT is not pre-live authorization. A future exact commit would need an enforceable pre-dispatch tool isolation boundary, independent Review ACCEPT, and a separately frozen plan before any call. Do not remove the hard block or call `runCodex` directly. See [RUBRIC.md](RUBRIC.md) for denominators and [SYNTHETIC-FINDINGS.md](SYNTHETIC-FINDINGS.md) for the local stub replay result.

## Direct API preparation

The direct Responses API run packet is in [API-RUN-PACKET.md](API-RUN-PACKET.md). Its implemented command requires exact owner approval, a reviewed clean commit, private output, and project credentials before network dispatch. No API call has been made. The CLI hard block remains.
