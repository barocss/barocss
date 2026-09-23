# BaroCSS automated release path

## Current gate

0.0.4 is **NO-GO**. [PM holds PR #71](https://github.com/barocss/barocss/pull/71#issuecomment-5789060900) until `BrowserRuntime.removeClass()` removes injected CSS and Guard verifies the fix. No release-ready record exists. Do not dispatch promotion, merge `main`, or publish packages while this gate is open.

## What starts a release

PM posts one comment in `barocss/barocss` after Guard and Ship evidence is complete. The comment must contain these exact lines, with the full current `develop` SHA and the same version in all three package manifests:

```text
BAROCSS_RELEASE_READY SHA=<40-character-develop-SHA> VERSION=<version>
Guard: https://github.com/barocss/barocss/...
Ship: https://github.com/barocss/barocss/...
```

The **Npm promotion** workflow is then dispatched on `develop` by `easylogic` with `candidate_sha`, `expected_version`, and that comment URL. This explicit dispatch is the PM GO signal. Ordinary `develop` pushes do not start promotion. The preflight rejects a moved `develop` head, a candidate behind `main`, mismatched versions, pending changesets, missing evidence, failed CI on that exact SHA, failed frozen install/check/pack/docs build, or an already used npm version/tag. If `main` is not an ancestor of the candidate, PM first uses an ordinary PR to bring `main` into `develop`, then repeats CI and issues a new SHA-specific GO. The pinned promotion branch is never updated to fix this condition.

The comment is a PM attestation that Guard and Ship accepted the exact tree. GitHub currently uses the same `easylogic` identity for those work records, so the workflow validates evidence links but cannot prove that two different people wrote them. The `main` PR still needs an independent GitHub approval under branch protection.

## GitHub Actions sequence

1. **Promotion preflight:** checkout the selected SHA, confirm the current `develop` head and its successful `Test and Build` push run, then run frozen install, `pnpm check`, package tarball checks, docs build, and npm/tag/Release collision checks. No write token or npm token is available to this job.
2. **Pinned PR:** mint a short-lived GitHub App token after preflight. Confirm that `main` requires an approving review, up-to-date `build` and `test` checks, and resolved conversations. Create `release/promote-<version>-<sha>` at the selected SHA, open its PR to `main`, and enable ordinary GitHub auto-merge. A changed existing ref or PR fails. No `--admin` option is used.
3. **Protected main:** the PR runs the `build` and `test` jobs named by the existing `main` protection rule. `build` covers type check, lint, package builds, pack/export checks, and docs build. `test` runs the test suite. GitHub merges only after its independent review and required checks. The promotion source remains pinned even if `develop` moves later.
4. **Same main commit:** the App-created merge causes the `main` push CI to run. Its `publish` job calls **Npm release** only after both `build` and `test` succeed on that main SHA. The release job rechecks the PM comment and associated promotion PR, its approved candidate SHA, the two-parent merge commit, package versions, changesets, npm versions, tags, Releases, and the packaged output again.
5. **npm:** only an unpublished three-package version enters the `npm` environment. `NPM_RELEASE_ENABLED=true`, a live `NPM_TOKEN`, an unchanged `main` SHA, and a second registry check are required before Changesets publishes. The action creates package tags and GitHub Releases. A final check requires all three npm versions, tags pointing to that main SHA, and non-draft Releases.

The App token is necessary for an unattended chain. GitHub says `GITHUB_TOKEN`-created PR workflows can wait for extra approval and pushes made with `GITHUB_TOKEN` normally do not start another workflow. [GitHub trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). GitHub's [auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request) still waits for required reviews and checks.

## One-time repository setup

| Item | Required setting | Current evidence |
| --- | --- | --- |
| `main` protection | Keep one independent review, strict `build` and `test` checks, and conversation resolution. Never bypass. | The rule has these settings now, but current CI does not emit `build`/`test` on main until this change is merged. |
| `develop` protection | Require `Test and Build` on the selected SHA. PM must not issue GO for a blocked or failed candidate. | `Test and Build` is required; the live rule also has `requiresApprovingReviews=true` with count 0, which can still block PRs. |
| GitHub App | Install on this repository with Metadata read, Administration read, Contents write, Pull requests write. Set `BARO_PROMOTION_APP_CLIENT_ID` repository variable and `BARO_PROMOTION_APP_PRIVATE_KEY` secret. Do not grant branch-protection bypass. | Not configured or verified. The App token is minted for one job and revoked afterward. |
| `npm` environment | Create `npm`, allow only `main`, set environment variable `NPM_RELEASE_ENABLED=true`, and store `NPM_TOKEN` as an **environment secret**. Do not require a per-run reviewer; PM dispatch plus main review are the human gates. Remove the repository-level token after migration. | Environment does not exist. A repository secret named `NPM_TOKEN` exists, but its value and rights are unknown. |
| npm rights | Token owner can publish all three `@barocss/*` packages. The granular token must allow direct publish and meet npm 2FA rules. Confirm package selection and expiry in npm settings. | `npm whoami` in CI proves login only; it cannot prove package-specific publish permission without publishing. [npm token settings](https://docs.npmjs.com/creating-and-viewing-access-tokens/). |

The environment variable makes an absent or unconfigured `npm` environment fail before any publish command. Set it only on that environment. A manual **Npm release** dispatch on `main` checks the version and npm token but never publishes. It is a credential dry-run after this workflow is present on `main`; running it still needs the user's separate authorization during the current 0.0.4 hold.

`main` and `develop` currently diverge: `main` has its own merge commit. A release-ready `develop` commit does not yet contain `main`. Main's strict up-to-date rule would block a pinned PR, so this history must be synchronized through the normal review path before any PM GO. The workflow checks ancestry twice and stops without changing the candidate SHA.

## Versioning and repeat runs

For 0.0.4, PR #71 already bumps the three linked packages and lockfile; do not run `changeset version` again. Later changes get changesets, then a reviewed version PR. PM dispatches promotion only after the version PR and acceptance evidence are on the selected `develop` SHA.

An already published version with complete tags and Releases skips publication. A partial npm publication, existing tag for an unpublished version, missing Release, wrong tag target, stale `develop` or `main`, failed CI, absent App credentials, or failed npm authentication stops the workflow. Re-running does not automatically publish the remaining packages. Record registry state and repair each missing artifact with a separate reviewed recovery plan. npm cannot atomically publish three packages.

The current path uses the existing token. Moving to [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) needs each package to trust the exact GitHub workflow and environment, Node 22.14+ and npm CLI 11.5.1+, and an end-to-end test of Changesets/pnpm OIDC behavior. Do not remove the token until that separate change passes.
