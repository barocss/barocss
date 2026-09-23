# BaroCSS automated release path

## Current gate

0.0.4 is **NO-GO**. [PR #77](https://github.com/barocss/barocss/pull/77) merged the automatic promotion foundation into `develop`, but the tokenless npm path and the live Quick Start correction are still release gates. No release-ready SHA/version record exists. Do not dispatch promotion, merge a release PR into `main`, or publish packages until PM issues a new exact-SHA GO.

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
2. **Pinned PR:** mint a short-lived GitHub App token after preflight. Confirm that `main` requires an approving review, up-to-date `build` and `test` checks, and resolved conversations. Create `release/promote-<version>-<sha>` at the selected SHA and open its PR to `main` **without auto-merge armed**. A changed existing ref or PR fails. No `--admin` option is used.
3. **Owner approval and protected main:** Mento gives `easylogic` the PR link and pinned SHA. `easylogic` submits one Approve review on that exact commit. The `pull_request_review` workflow runs trusted code from the default `develop` branch. It requires that the candidate is still the **current develop HEAD**, and rechecks the live review, PM record, exact candidate CI, main ancestry, npm/tag state, and main protection. It uses an App token and `--match-head-commit` to arm ordinary auto-merge for only that SHA. Another reviewer, a stale review, a dismissed approval, a changed PR head, or any intervening `develop` push cannot arm it. The PR runs the `build` and `test` jobs named by the `main` protection rule. GitHub merges only after the owner review, current checks, and resolved conversations. If `develop` moves, PM verifies a new candidate and issues a new exact-SHA GO.
4. **Same main commit:** the App-created merge causes the direct **Npm release** workflow (`npm-release.yml`) to run on `main`. Its `build` and `test` jobs supply the protected checks on both the promotion PR and the main push. Only a successful main push can start `publish`, which independently rechecks the PM comment, App-authored promotion PR, latest `easylogic` approval on the candidate SHA, two-parent merge, package versions, changesets, registry, tags, Releases, and validated tarballs.
5. **npm:** the main-only `npm` environment requires `NPM_RELEASE_ENABLED=true`. The publish job uses GitHub OIDC with Node 22.22.0, npm CLI 11.5.1, `id-token: write`, and no npm token. It publishes the three validated tarballs in kit/browser/server order with explicit `npm publish`. Only after all three succeed does it create tags and GitHub Releases at the exact main SHA. A final check requires all three npm versions, tags, and non-draft Releases. A partial publication stops automatic retry.

| Event | `build`/`test` | `publish` |
| --- | --- | --- |
| PR to `main` | Run and satisfy branch protection | Skipped |
| `main` push | Run on the exact merged commit | Runs only after both pass and all release gates pass |
| `develop` push or dispatch | `Test and Build` in `ci.yml` only | Unreachable |

The App token is necessary for an unattended chain. GitHub says `GITHUB_TOKEN`-created PR workflows can wait for extra approval and pushes made with `GITHUB_TOKEN` normally do not start another workflow. [GitHub trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). GitHub supports a [`pull_request_review` submitted trigger](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#running-a-workflow-when-a-pull-request-is-approved); the arm job checks the reviewer again before using secrets. GitHub's [auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request) still waits for required reviews and checks.

## One-time repository setup

| Item | Required setting | Current evidence |
| --- | --- | --- |
| `main` protection | Keep one independent review, strict `build` and `test` checks, and conversation resolution. Never bypass. | The setup PR first supplies these contexts from `ci.yml`; the promotion candidate moves them to direct `npm-release.yml` before its PR can merge. |
| `develop` protection | Require a PR and current `Test and Build` on the selected SHA. PM must not issue GO for a blocked or failed candidate. | The rule requires a PR and strict `Test and Build`. Approving reviews and Pages deployment are not required. |
| GitHub App | Install on this repository with Metadata read, Administration read, Contents write, Pull requests write. Set `BARO_PROMOTION_APP_CLIENT_ID` repository variable and `BARO_PROMOTION_APP_PRIVATE_KEY` secret. Do not grant branch-protection bypass. | Not configured or verified. The App token is minted for one job and revoked afterward. |
| `npm` environment | Create `npm`, allow only `main`, and set environment variable `NPM_RELEASE_ENABLED=true` only for the release gate. Do not add an npm publish token. The PM dispatch and protected main review are the human gates. | The environment is not configured. The existing repository `NPM_TOKEN` must be removed; the OIDC publish job never reads it. |
| npm Trusted Publishers | For each of `@barocss/kit`, `@barocss/browser`, and `@barocss/server`, select GitHub Actions owner `barocss`, repository `barocss`, workflow filename `npm-release.yml`, environment `npm`, and allow direct `npm publish`. Verify the settings in each package's npm UI. | The user reports registration, but the exact per-package fields cannot be confirmed through the public registry. An OIDC issuance check does not prove npm will accept a publish. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). |

The environment variable makes an absent or unconfigured `npm` environment fail before any publish command. The one-time setup workflow checks App access and GitHub OIDC claims without publishing. npm authenticates through OIDC only during `npm publish`, so `npm whoami` is not a valid dry run. Verify the package-specific npm settings before PM GO.

[PR #79](https://github.com/barocss/barocss/pull/79) synchronized the prior `main` merge commit into `develop` at `846b14b5b6a8a3ed31432dd6ed194f3e14900e81`. After the one-time main setup PR merges, synchronize that new main commit into `develop` through an ordinary PR, repeat exact-head CI and Guard/Ship review, and issue a new PM SHA-specific GO. The promotion branch remains pinned.

## Versioning and repeat runs

For 0.0.4, PR #71 already bumps the three linked packages and lockfile; do not run `changeset version` again. Later changes get changesets, then a reviewed version PR. PM dispatches promotion only after the version PR and acceptance evidence are on the selected `develop` SHA.

An already published version with complete tags and Releases skips publication. A partial npm publication, existing tag for an unpublished version, missing Release, wrong tag target, stale `develop` or `main`, failed CI, absent App credentials, disabled environment, or npm OIDC trust failure stops the workflow. Re-running does not automatically publish the remaining packages. Record registry state and repair each missing artifact with a separate reviewed recovery plan. npm cannot atomically publish three packages.

The release path uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) through direct `npm-release.yml` main push jobs. Each package tarball must contain `repository.url` for `barocss/barocss`; the same validated tarballs are published with npm CLI 11.5.1. The one-time OIDC preflight proves GitHub token issuance and environment claims only. No real npm trust exchange is possible without an authorized publish, so the first publication remains a monitored GO gate.
