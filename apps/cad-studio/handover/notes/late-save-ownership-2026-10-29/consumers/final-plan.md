# D322 final actual consumer plan

Status: **NOT_RUN**. Production repair, final source hashes/types/lint and root execution approval are required. The two baseline runs and their exact capsules remain immutable. No additional actual run is authorized yet.

Use three isolated fresh Chrome WebGPU/DPR1 contexts and separately named owned native OPFS project namespaces. Reuse the original native close-return scheduler. Each case first normally saves a real UI-authored Box, then creates document A through a public Render edit and holds Save A after actual native close has committed the unchanged bytes.

| Case | Public action while Save A return is held | Pre-release completion | Safe final assertions |
| --- | --- | --- | --- |
| Same document | Render edit B | Complete native autosave document equals B | Original assertions stay: live B, dirty true, completed autosave B retained; native saved A remains valid |
| New document | New part, create a new Box with different dimensions, assign a new name | Actual local recovery document and name equal the new document | New document/name/body and dirty state remain; new recovery remains; old project part is not attached to the new document |
| Closed project | Public Close project | Public UI shows no active project or part | Old project, active part, document list, metadata and version log do not reappear; completed native saved A is preserved |

Before release, persist the actual current document, dirty indicator, local recovery, public project/active-part/document/version UI, native saved bytes and relevant native autosave bytes. Persist the same fields after release before semantic assertions. Observe only private debug document/body inspection and native scheduling; do not stage App state, documents, tags, callback results or geometry.

Same-document completion requires native close return, actual production returned-tag getFile AND actual Save project refresh completion. This session remains valid, so tag read alone could precede late clear/refresh/App completion. New/Close completion must not require refresh: a correct stale-session repair may deliberately skip it. Require their selected original native close return and actual production returned-tag getFile where that unchanged adapter route still reads it. Native progress establishes that the original write returned; following microtask/frame turns only allow the resumed caller and UI commit to settle. Confirm the final production continuation before execution and report any unexposed completion boundary honestly. An elapsed-time threshold, absent refresh, deletion or arbitrary delay is never a success oracle.

Retain only exact final helper/driver capsule, raw run log, core before/held/after receipt, actual bytes and needed PNGs. Use separate final run directories. Keep the baseline Node product FAIL and the first driver schedule FAIL distinct from repaired-source results. Preserve original same-document assertions without weakening them. Native tag observations do not expose the private project tag ref.

Whole suites, extra matrix cases, tabs/processes, external folders, crash or real user-file-loss claims are outside this consumer plan. Only owned namespace/context/browser/server are cleaned. No production edit, new dependency, commit or push.

After the same-document original after-A snapshot and original safe assertions, perform one normal public Save B. Require its new native close/tag/refresh completion, dirty false, actual native saved document B and no native save/conflict error. This checks same-path tag advancement without a new case or reopen. A physical autosave checkpoint with identical saved B bytes may remain; no deletion requirement is added.
