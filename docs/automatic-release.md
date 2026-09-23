# BaroCSS manual npm release path

## Published release and next candidate

Version 0.4.0 was published from `main` commit `9d0ab73176593cb06f65f48e173bb66020b724ee`. All three npm packages, tags, and GitHub Releases were independently verified. The original publish run failed its final check while npm was still processing the registry records; do not rerun it or republish 0.4.0. [PM's completion record](https://github.com/barocss/barocss/pull/92#issuecomment-5793372228) and [the verification record](https://github.com/barocss/barocss/pull/92#issuecomment-5793362713) document the outcome. Use the steps below for a **new** version only.

## Release candidate review

Development and version PRs stay on `develop`. After Guard and Ship accept one candidate, PM posts a comment in `barocss/barocss` with these exact lines:

```text
BAROCSS_RELEASE_READY SHA=<40-character-develop-SHA> VERSION=<version>
Guard: https://github.com/barocss/barocss/...
Ship: https://github.com/barocss/barocss/...
```

Before the main PR, the release owner and PM review the exact current `develop` SHA. Confirm that `main` is an ancestor of that SHA (`behind_by=0` and `ahead_by>0` for `main...develop`), the exact SHA passed develop's `Test and Build`, Guard and Ship accepted that SHA, the three package versions and packed internal dependencies match, no changesets remain, and the version and tags are unused. Record the SHA, version, and evidence in the PM comment. If `main` is ahead, synchronize it into `develop` through a normal PR, repeat CI and reviews, and issue a new PM record for the new SHA. Recheck the PR head against the current `develop` SHA immediately before the owner merges it. A moved head needs new evidence and a new PM record.

Use these read-only GitHub checks for the final merge review; the PR head, current `develop` head, and PM record must name the same full SHA:

```sh
gh api repos/barocss/barocss/branches/develop --jq '.commit.sha'
gh api repos/barocss/barocss/compare/main...develop --jq '{ahead_by, behind_by}'
gh pr view PR_NUMBER --repo barocss/barocss --json headRefOid --jq '.headRefOid'
```

Replace `PR_NUMBER` with the release PR number. The compare result must have `behind_by: 0` and `ahead_by` greater than zero.

The PM comment links Guard and Ship evidence. Since these records currently share the `easylogic` GitHub identity, the publication workflow verifies the links and exact SHA but cannot prove separate human authorship.

## Protected main PR and manual publication

1. Open a normal PR from the reviewed current `develop` commit to `main`. Use an ordinary merge commit. `easylogic` merges the green PR after required `build` and `test` checks, resolved conversations, and the final candidate SHA/ancestry review above. Do not use a GitHub App, approval-triggered workflow, auto-merge, squash, rebase, or branch-protection bypass. The selected no-App model has zero required approvals; strict checks and conversation resolution remain in place.
2. The merged `main` push runs `build` and `test` only. It never publishes npm. Wait for both checks and any separate Docs deployment/smoke gate before a manual npm release.
3. In **Npm release** (`npm-release.yml`), choose `main` and enter `publish=true`, the exact current main SHA, the same version in all three manifests, and the PM readiness comment URL. The default `publish=false` runs checks only. Only `easylogic` can complete a `publish=true` run. The job requires successful `build` and `test` and the protected main-only `npm` environment.
4. Before publication, the job verifies the live main SHA, the ordinary two-parent merge from `develop`, that `easylogic` merged the PR, the exact candidate SHA/version in the PM record, Guard and Ship links, successful develop CI for that candidate, no pending changesets, all three package versions, npm/tag/Release collisions, and the retained tarballs' export/type/CDN/runtime checks. It rechecks main and the registry immediately before the first publish.
5. The job uses GitHub OIDC with Node 22.22.0, npm CLI 11.5.1, `id-token: write`, and no npm token. It publishes the validated kit, browser, and server tarballs in that order. Only after all three succeed does it create package tags and GitHub Releases at the exact main SHA. A final check requires all three npm versions, tags, and non-draft Releases.

| Event | `build`/`test` | npm publish |
| --- | --- | --- |
| PR to `main` | Run and satisfy branch protection | Never |
| Push to `main` | Run on the exact merged commit | Never |
| Manual `publish=false` on `main` | Run | Never |
| Manual `publish=true` on `main` | Must pass first | Only after all gates |
| `develop` push | `Test and Build` in `ci.yml` | Never |

## One-time repository setup

| Item | Required setting | Current evidence |
| --- | --- | --- |
| `main` protection | Strict `build` and `test`, resolved conversations, normal PR merge. Zero required approvals for the owner-operated no-App model. Never bypass checks. | PR #87 merged with the checks in place. Required approvals are zero, strict checks and conversation resolution remain enabled, and admin enforcement is enabled. |
| `develop` protection | Require a PR and current `Test and Build` on the candidate SHA. | The rule requires a PR and strict `Test and Build`. |
| `npm` environment | Allow only `main`. Require the owner's explicit manual `publish=true` input and exact release evidence. Do not add an npm token. | PM verified the environment has a main-only branch policy. |
| npm Trusted Publishers | For each of `@barocss/kit`, `@barocss/browser`, and `@barocss/server`, use GitHub Actions owner `barocss`, repository `barocss`, workflow filename `npm-release.yml`, and allow direct `npm publish`. The npm-side environment name is optional; the GitHub `npm` environment remains main-only. | Mento checked these fields in npm UI for all three packages. The npm-side environment name is blank. OIDC publication succeeded for 0.4.0. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). |
| Legacy credentials/workflows | Keep the old token-based manual publish workflow and any legacy repository publish credential removed. | PR #87 removed the old main publish path. PR #88 synchronized that state into `develop`. The repository Actions secret-name list was empty at the 0.4.0 release, and npm accepted the OIDC publication. |

The one-time setup removed the legacy publish path before Docs or product changes reached `main`. The authorized 0.4.0 publish confirmed npm OIDC acceptance. `npm whoami` is not an OIDC dry run. The live Docs/Quick Start check remains a release gate. Automatic Pages deployment from Docs changes on `main` is a separate workflow and is reviewed separately.

## Repeat runs and failure response

An already published version with complete npm packages, tags, and Releases is not republished. The final check waits up to five minutes for npm registry processing. A partial npm publication, existing tag before npm publication, missing Release, wrong tag target, moved main, failed CI, disabled environment, or npm OIDC trust failure stops the workflow. Do not automatically retry a partial publication. Record npm versions, tags, Releases, and logs; use a separate reviewed recovery plan. npm cannot atomically publish three packages.

Recheck packed internal dependencies and npm version collisions at each final candidate SHA. Do not run an unreviewed `changeset version` step.
