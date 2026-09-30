# BaroCSS manual npm release path

## Published release and next candidate

Version 0.4.0 was published from `main` commit `9d0ab73176593cb06f65f48e173bb66020b724ee`. All three npm packages, tags, and GitHub Releases were independently verified. The original publish run failed its final check while npm was still processing the registry records; do not rerun it or republish 0.4.0. [PM's completion record](https://github.com/barocss/barocss/pull/92#issuecomment-5793372228) and [the verification record](https://github.com/barocss/barocss/pull/92#issuecomment-5793362713) document the outcome. Use the steps below for a **new** version only.

## Current V3 release candidate

Planner owns release scope and checkpoint decisions. Execute implements and integrates local tasks.
Review independently accepts medium/high-risk exact commits. Task integration is local; only a
reviewed checkpoint and a separate Changesets version PR reach remote `develop`. See
[the V3 handoff](../tools/ai-v3/HANDOFF.md).

The next planned release includes `@barocss/kit`, `@barocss/browser`, `@barocss/server`, and the first
experimental `@barocss/render`, coordinated at 0.12.0. This is a plan, not a published-version claim.
Run Changesets version only in the reviewed version step. Pending changesets block publication.
Public checkpoint/version branches start from the accepted remote checkpoint; private local research
ancestors are not pushed. Preserve original historical baselines and private artifacts locally.

After the exact public candidate passes independent Review, full `pnpm check`, four-package
`check-packages.mjs`, Docs build and public-boundary checks, Planner records:

```text
BAROCSS_RELEASE_READY SHA=<40-character-develop-SHA> VERSION=<version>
Packages: @barocss/kit @barocss/browser @barocss/server @barocss/render
Guard: https://github.com/barocss/barocss/issues/<id>#issuecomment-<review>
Ship: https://github.com/barocss/barocss/issues/<id>#issuecomment-<pack-check>
Render: https://github.com/barocss/barocss/issues/<id>#issuecomment-<render-check>
```

`Guard:` and `Ship:` are retained wire fields from the existing release workflow. They mean the
current **Review** acceptance and **Execute** pack/check evidence; they do not create separate
legacy roles or gates. `Render:` links an owner-posted packed-consumer record with this exact line:

```text
BAROCSS_RENDER_READY SHA=<same-develop-SHA> VERSION=<same-version>
```

The record must describe the isolated packed ESM/type consumer and the artifact verification.
The workflow checks the exact line and owner identity, not the prose's technical conclusions;
independent Review must judge those conclusions before release readiness. All records currently
share the `easylogic` GitHub identity, so links alone cannot prove independent authorship.

Before the main PR, confirm main is an ancestor of the candidate, package identities/versions match,
packed dependencies resolve correctly, no changesets remain, and the new npm version/tags are unused.
Recheck the PR head and live develop SHA immediately before merge. Changed commits need fresh
verification, Review and readiness records.

```sh
gh api repos/barocss/barocss/branches/develop --jq '.commit.sha'
gh api repos/barocss/barocss/compare/main...develop --jq '{ahead_by, behind_by}'
gh pr view PR_NUMBER --repo barocss/barocss --json headRefOid --jq '.headRefOid'
```

The compare result requires `behind_by: 0` and positive `ahead_by`. Reviewed source promotion to
main and staged Pages deployment may proceed after the source, independent Review and required CI
gates pass. Actual npm publication remains blocked until Planner resolves the first renderer
package's authentication and Trusted Publisher setup.

## Protected main PR and manual publication

1. Merge the reviewed public `develop` candidate to protected `main` through a normal two-parent PR
   merged by the owner. Required `build`/`test`, conversation resolution and exact SHA/ancestry gates
   apply. No App, auto-merge or protection bypass.
2. Main push runs build/test only. Wait for those checks and separate Docs deployment/smoke evidence.
3. The manual **Npm release** workflow defaults to `publish=false`. Only owner-dispatched
   `publish=true` on `main` with exact main SHA, version and readiness URL can enter publication.
4. Before publication, the workflow verifies live protected main, the ordinary develop merge,
   previous-main ancestry, owner merge, exact four-package/renderer readiness, successful develop
   CI, no pending changesets, four manifest identities/versions, and npm/tag/Release collisions.
   Retained tarballs pass isolated export/type/license/runtime checks. Recheck main and registry
   immediately before the first publish.
5. Publish the validated **render, kit, browser, server** tarballs in that order using GitHub OIDC,
   Node 22.22.0, npm 11.5.1 and `id-token: write`, without an npm token. Render goes first so its
   first-package trust failure cannot advance the existing packages. This ordering is not atomic.
   Only after all four succeed, create all four tags/Releases at exact main. Final verification
   requires all four npm versions, exact tags and non-draft Releases.

| Event | build/test | npm publication |
| --- | --- | --- |
| PR/push to main | Required | Never |
| Manual publish=false | Required | Never |
| Manual publish=true on main | Required | Only after every gate |
| develop push | Test and Build | Never |

## First renderer publication and Docs staging

The existing three packages have published versions. `@barocss/render` is a new npm package; an
absent registry entry is not proof of Trusted Publisher readiness. npm's
[trust command prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/#prerequisites)
require an existing package. The owner/Planner must resolve the permitted first-publication setup;
Execute does not authenticate, bootstrap, add a token fallback or publish in this preparation task.
A failed or partial publication requires a separate reviewed recovery decision, never an automatic
resume or republish. OIDC token issuance and `npm whoami` do not prove npm publication acceptance.

The website's render guide/API are explicitly staged. Pages may deploy these staged Docs before
npm publication after the source, Review and CI gates pass. Existing installation/CDN snippets continue
using `published-version.json` (currently 0.11.2). After independent four-package publication checks,
promote that marker, replace the staged renderer notice with the verified install version, rebuild
Docs and verify live installation links. Do not claim an unpublished renderer version is available.

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

An already published version with complete npm packages, tags, and Releases is not republished. The final check waits up to five minutes for npm registry processing. A partial npm publication, existing tag before npm publication, missing Release, wrong tag target, moved main, failed CI, disabled environment, or npm OIDC trust failure stops the workflow. Do not automatically retry a partial publication. Record npm versions, tags, Releases, and logs; use a separate reviewed recovery plan. npm cannot atomically publish four packages.

Recheck packed internal dependencies and npm version collisions at each final candidate SHA. Do not run an unreviewed `changeset version` step.
