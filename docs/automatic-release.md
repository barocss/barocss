# BaroCSS manual npm release path

## Current gate

0.0.4 is **NO-GO**. PR #81 is a draft. No protected main setup, final main synchronization, verified npm Trusted Publisher settings, live Docs smoke check, or final PM exact-SHA/version GO has been completed. Do not run the release workflow with `publish=true`, publish npm packages, create tags or GitHub Releases, or deploy Pages as part of this draft.

## Release source and preflight

Development and version PRs stay on `develop`. After Guard and Ship accept one candidate, PM posts a comment in `barocss/barocss` with these exact lines:

```text
BAROCSS_RELEASE_READY SHA=<40-character-develop-SHA> VERSION=<version>
Guard: https://github.com/barocss/barocss/...
Ship: https://github.com/barocss/barocss/...
```

The release owner `easylogic` runs **Npm release preflight** (`npm-promote.yml`) on `develop` with that SHA, version, and comment URL. This is a read-only check. It rejects a moved candidate, a candidate behind `main`, mismatched versions, pending changesets, missing evidence, failed exact-SHA `Test and Build`, failed frozen install/check/pack/docs build, or a used npm version/tag. It does not create a branch or PR and cannot publish. If `main` is ahead, synchronize it into `develop` through a normal PR, repeat CI and reviews, and issue a new PM record for the new SHA.

The PM comment links Guard and Ship evidence. Since these records currently share the `easylogic` GitHub identity, the workflow verifies the links and exact SHA but cannot prove separate human authorship.

## Protected main PR and manual publication

1. Open a normal PR from the verified `develop` commit to `main`. Use an ordinary merge commit. `easylogic` merges the green PR after required `build` and `test` checks and resolved conversations. Do not use a GitHub App, approval-triggered workflow, auto-merge, squash, rebase, or branch-protection bypass. The selected no-App model requires the main review count to be changed to zero only after the setup PR is reviewed; strict checks and conversation resolution stay in place.
2. The merged `main` push runs `build` and `test` only. It never publishes npm. Wait for both checks and any separate Docs deployment/smoke gate before a manual npm release.
3. In **Npm release** (`npm-release.yml`), choose `main` and enter `publish=true`, the exact current main SHA, the same version in all three manifests, and the PM readiness comment URL. The default `publish=false` runs checks only. Only `easylogic` can complete a `publish=true` run. The job requires successful `build` and `test`, the protected main-only `npm` environment, and its release-enable variable.
4. Before publication, the job verifies the live main SHA, the ordinary two-parent merge from `develop`, that `easylogic` merged the PR, the exact candidate SHA/version in the PM record, Guard and Ship links, successful develop CI for that candidate, no pending changesets, all three package versions, npm/tag/Release collisions, and the retained tarballs' export/type/CDN/runtime checks. It rechecks main and the registry immediately before the first publish.
5. The job uses GitHub OIDC with Node 22.22.0, npm CLI 11.5.1, `id-token: write`, and no npm token. It publishes the validated kit, browser, and server tarballs in that order. Only after all three succeed does it create package tags and GitHub Releases at the exact main SHA. A final check requires all three npm versions, tags, and non-draft Releases.

| Event | `build`/`test` | npm publish |
| --- | --- | --- |
| PR to `main` | Run and satisfy branch protection | Never |
| Push to `main` | Run on the exact merged commit | Never |
| Manual `publish=false` on `main` | Run | Never |
| Manual `publish=true` on `main` | Must pass first | Only after all gates |
| `develop` push or preflight dispatch | `Test and Build` in `ci.yml` | Never |

## One-time repository setup

| Item | Required setting | Current evidence |
| --- | --- | --- |
| `main` protection | Strict `build` and `test`, resolved conversations, normal PR merge. Set required approvals to zero for the owner-operated no-App model after the reviewed setup PR. Never bypass checks. | The current one-review setting must remain until the protected setup PR is ready; PM owns the settings change. |
| `develop` protection | Require a PR and current `Test and Build` on the candidate SHA. | The rule requires a PR and strict `Test and Build`. |
| `npm` environment | Allow only `main`. Set `NPM_RELEASE_ENABLED=true` only after final PM GO; remove it after the run. Do not add an npm token. | PM verified the environment has a main-only branch policy. The release-enable variable is unset. |
| npm Trusted Publishers | For each of `@barocss/kit`, `@barocss/browser`, and `@barocss/server`, select GitHub Actions owner `barocss`, repository `barocss`, workflow filename `npm-release.yml`, environment `npm`, and allow direct `npm publish`. | The user reports registration, but the exact per-package fields are not verified through the public registry. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). |
| Legacy credentials/workflows | Remove the old token-based manual publish workflow and any legacy repository publish credential before the setup PR merges. | The setup PR must prove that a main push has checks only and no automatic npm publish path. |

The one-time setup must remove the legacy publish path before any Docs workflow-only or product PR is merged into `main`. A preflight can confirm GitHub OIDC issuance, but npm acceptance is only tested by an authorized actual publish. `npm whoami` is not an OIDC dry run. The live Docs/Quick Start check remains a release gate. Automatic Pages deployment from Docs changes on `main` is a separate workflow and is reviewed separately.

## Repeat runs and failure response

An already published version with complete npm packages, tags, and Releases is not republished. A partial npm publication, existing tag before npm publication, missing Release, wrong tag target, moved main, failed CI, disabled environment, or npm OIDC trust failure stops the workflow. Do not automatically retry a partial publication. Record npm versions, tags, Releases, and logs; use a separate reviewed recovery plan. npm cannot atomically publish three packages.

For 0.0.4, PR #71 already bumped the linked packages and lockfile; do not run `changeset version` again. Later changes get Changesets and a reviewed version PR on `develop`. The first actual OIDC publication is a monitored GO gate.
