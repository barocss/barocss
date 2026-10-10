# Reproducible source examples — #1295

Frozen Issue: https://github.com/barocss/barocss/issues/1295. Native parent `2a7c9e6ef794da5c5f3b3f17cbe282df64d91556`. Source/API remains `5f5ad866205a21510ac69552e704cc162fa253b5`.

## Result and ownership

Primary plus three transient helpers filled the four available concurrency slots. Primary added the common execution guide, navigation and setup links. CAD helper clarified source0-only playground versus source1/2 CPU targets and corrected the same-candidate diagnostic highlighting recipe. GPU helper corrected initial material failure cleanup, later accepted-state handling, named listener teardown and bounded manual caller-time sampling. Other-example helper added complete standalone HTML/entry/bundle/serve procedures for Canvas2D and Viewer, with truthful execution status and synchronous-frame expectations.

Only documentation/config/README and this app-local receipt changed. No new runtime/helper source, package source/manifest, generated public API, dependency, root/lock/workflow/policy/old CSS, product push/PR/npm/deploy or automation. No source snapshot refresh or replay of the immutable #1270 handoff.

## Actual native validation

- Node22.22.0/VitePress1.6.4, existing esbuild0.25.12/TypeScript5.9.3 reused. No installation.
- First affected build passed in26.19s; normal reference chunk-size warning retained. Visual source bundle unchanged:206895bytes,222own source inputs/0dist, matching-workspace provenance. All consumed blobs match the fixed local source.
- First docs check passed:76Markdown pages,12manifest hashes,5128built page/anchor links,9image references. `git diff --check` passed.
- Selected existing CAD CPU consumer was rerun once because the new guide now presents that exact executable command and source1/2 result interpretation. Exit0 on first execution:

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/cad-example.ts
```

Actual outputs: Curve domain[2,7], midpoint[10,0,0]mm; weighted Surface center[7.7,5.2,1]mm,289vertices/512triangles/867positions/1536indices, sampled deviation0.02878837032366707mm/certifiedfalse, IGESentity128. Source1 wall midpoint[10,0,15]mm. Source2 width100mm/height50mm/scale2 gives[50,0,50]mm;12cmwidth edit gives[60,0,60]mm. Asserted KIND,VERSION,UNIT,DIVISION_ZERO refusals. Provenance matching-workspace, eight manifests/452pinned files,222own source inputs/0dist. Drawing not executed by this consumer.

First short production browser flow passed using an isolated `manual1295` session at localhost52948: execution guide and exact CAD command→CAD language/execution-target table→guide→GPU material/lifecycle and caller-time recipe→Run examples→real ready marker, no alert. Actual result:

```json
{"guide":true,"cadExecutionTargets":true,"gpuLifecycleRecipe":true,"playgroundReady":true,"errors":[],"warnings":[],"url":"http://127.0.0.1:52948/playground"}
```

The browser clicked actual links and waited for named headings/ready state, then allowed the known deferred outline callback to flush. No source or viewport matrix was replayed. No first execution failure or repair occurred in this selected #1295 build/check/CPU/browser flow. Existing #1270 first failures remain preserved in their original receipts.

## Limits and next step

The new standalone Canvas2D/Viewer browser hosts and GPU material/time host snippets were reviewed against actual fixed-source public methods but were not executed as separate fixtures. Their pages explicitly state this. The CAD diagnostic snippet's exact span is source-backed; it was not separately executed. The selected CAD consumer proves its own asserted source1/2/refusal inputs. Existing #1270 browser pixels and other CPU receipts remain separate.

This is native completion. Sole Integration adopts the new immutable incremental child after #1270, preserving its active WIP. Exact local adoption, later currentRoot custom languages/API/emitted/packed/registry acceptance and publication are separate statuses. Final local preview is not a deployed site.
