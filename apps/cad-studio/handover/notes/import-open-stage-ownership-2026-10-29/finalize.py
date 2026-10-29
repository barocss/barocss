from pathlib import Path
import json,hashlib,shutil
r=Path.cwd();h=r/'apps/cad-studio/handover';n=h/'notes/import-open-stage-ownership-2026-10-29';n.mkdir(exist_ok=True);tmp=Path('/tmp/d329')
for p in tmp.iterdir():
 if p.is_file() and p.suffix in ['.txt','.json','.py']:shutil.copyfile(p,n/p.name)
for name in ['baseline-source','final-source','native-first','native-second','native-second-driver','source-drift','source-watch','normal-first']:
 shutil.copytree(tmp/name,n/name,dirs_exist_ok=True)
q={'status':'QUALIFIED_BOUNDED_IMPORT_STAGE_OWNERSHIP','baseline':'5168183e88c29d70468628b18bb91e5f7a10dbda','sourceCommit':'a7264f0e59c25580b185b814a5e4b6b3a946f2a3','productionProfile':'final-source/profile.json','productionFiles':4,'baselineUnit':{'tests':5,'pass':0,'fail':5,'skip':0,'exit':1},'intermediateFocused':[{'tests':23,'pass':23},{'tests':26,'pass':26}],'studio':{'tests':460,'pass':460,'fail':0,'skip':0,'new31Included':True},'buildIncludingTypes':{'exit':0,'existingBundlerWarningsRetained':True},'scopedLint':{'exit':0,'errors':0,'warnings':0},'existingBrowserDriverLint':{'exit':0,'errors':0,'existingWarnings':45},'sourceReview':{'model':'GPT-6.1 Sol High','mode':'SOURCE_ONLY','verdict':'PASS','restorationGitBytesVerified':True},'implementationModel':'GPT-6.1 Sol Medium','native':{'first':{'tests':7,'pass':5,'fail':2,'skip':0,'exit':1,'acceptance':'WITHHELD_SOURCE_DRIFT'},'second':{'tests':7,'pass':7,'fail':0,'skip':0,'exit':0,'serial':True},'normal':{'selected':6,'starter':1,'pass':7,'fail':0,'skip':0,'exit':0,'serial':True},'uniqueSelectedPass':13,'automaticStarter':'Separate1, not added to selected cases','boundary':'Original fulfilled File text/bytes or actual Worker reply event is held; public input/HUD/New/Cancel; finite task/frame observation. No replaced bytes/IDs/results, no OS chooser/natural failure/general operation Promise completion claim.','actualStop':'Current C returns fresh/massReady; public Undo/Redo unchanged. Original units question retries successfully after Stop.','cleanup':'Each case closes owned context/browser/server before the next; concurrency1. Native first7 and second7 are separate attempts, not cumulative coverage.'},'sourceDrift':{'observedSha256':'04a883cc8cae037b4724bb6d44358b19cab7cb8796a1263bdd82d114ee0cd0c3','frozenSha256':'d669b9138128b2684f36a3fa1fdd8c0dfd19f8f39e647f61a23c13b7143e1fda','path':'apps/cad-studio/src/App.tsx','cause':'UNKNOWN','effect':'Latest guards/recovery trigger absent; first native batch cannot qualify frozen graph. Preserve raw5P/2F and both source capsules.','restoration':'Only owned missing guards restored from exact reviewed capsule and saved in new commit, no reset/amend/rebase. Other3 source unchanged.','finalRuns':'Source metadata watch and final hash checks match all4 source paths; no changes observed. Build/types/Studio460 receipts reused on exact restored bytes, not rerun for acknowledgement.'},'intermediateFailures':{'types':'Three new fixture type errors retained in types-first.txt; complete EvalResult/BodyResult fixture metadata added.','lint':'Root native driver no-this-alias error retained in lint-first.txt; holder object preserves original Worker receiver.'},'notQualified':['All A05 async paths or version-write/linked-stall matrices','A06 sender disposal and long-tail blob GC','Native IGES/loadDirect, accepted-fit timer and project-metadata negative matrix','Full kernel/model/GPU/Viewer/browser suites','Remote CI','Performance or heap/RSS improvement','Natural OS/driver failure or binary-container byte preservation']}
(n/'qualification.json').write_text(json.dumps(q,indent=2)+'\n')
(n/'README.md').write_text('''# D329 — Imported Open and mesh-stage ownership

Late STEP/STL/OBJ/IGES/barocad/DWG work must not replace a newer document, reopen an old question, clear a newer stage or report old success/error. Every asynchronous boundary now checks its captured Open intent, document dispatch and worker session. Direct import success/fit follows successful central admission.

A private mesh controller owns question/task generations. React uses its immutable external-store snapshot. Cancel, unit/step changes, newer questions and Stop revoke old continuations. Stop invalidates work before worker restart, explicitly hands surviving questions to the new owner, and re-evaluates the current document through a stage-only trigger. It preserves Undo/Redo and the existing central D321 Stop path. Accepted fit and unmount boundaries are guarded.

## Verification

Implementation: GPT-6.1 Sol Medium. Source-only ownership review: GPT-6.1 Sol High, including restored Git/source equality. Build/types and scoped production/new-test lint pass. Full Studio: **460 PASS / 0 FAIL / 0 SKIP**, including the31 new tests. Initial real-function regression baseline: **0 PASS / 5 FAIL**. Intermediate23/26 focused passes overlap the final suite. Controller tests defer worker/blob transport; they do not certify geometry or native lifecycle.

Actual Chrome/WebGPU: seven ownership cases pass, each in sequence with its browser/context/server closed before the next. STEP text, STL bytes and barocad text held after native fulfillment cannot overwrite new C. Held actual STEP worker reply cannot overwrite C; Stop restores current readiness and public Undo/Redo. Unit dialogs close on New; diagnosis Stop keeps the original question retryable. Six existing normal flow cases plus separate starter pass in one sequential browser: units, recorded repair, mesh STEP/size controls, unsupported units, solid STEP and direct source tools. This is13 selected cases plus starter, not a whole-browser PASS.

## Preserved first native failure and source drift

The first seven-case batch returned5 PASS / 2 FAIL (Stop readiness timeouts). After the frozen build/test checkpoint, App alone changed to an earlier WIP version with the latest recovery/owner guards missing. Its hash differs from the frozen profile; the writer/cause is UNKNOWN. Root did not edit App during the run. The implementation and reviewer reported no outstanding write command; no other process was modified. Both source versions and the exact diff are retained. First native acceptance is withheld, not merged with the final PASS.

After all first-run browsers closed, root restored only the owned missing App guards from the reviewed capsule and committed the source as a7264f0e5. Other three production files stayed identical. High independently compared all four current files with frozen hashes and Git bytes. The second seven-case batch and normal flow passed with an external source-metadata watcher and final hash checks; no source change was observed. Source hashes bind provenance, not product checksum tests. Existing build/types/460 receipts apply to those exact restored source bytes.

Raw initial type/lint diagnostics, original native failures, source drift and final receipts remain unchanged in this folder. [Qualification](qualification.json) gives precise counts and exclusions. Full other-package/browser suites, remote CI, performance/heap, native IGES/accepted-fit/project negatives and wider A05 paths remain outside this gate. A06 disposal follows. No PR or release.
''')
(n/'source-review.md').write_text('''# Source-only review

Sol High reviewed all four changed production files and found no remaining actionable finding. Review covered every import await/rejection, modal/task/stage generation, Stop question handoff, current document recovery, accepted fit, unmount and repair-entry intent supersession. Central D321 Stop and queued document setters remain. After source drift, the reviewer confirmed current files equal frozen profile and commit a7264f0e5 byte-for-byte. No tests/build/browser were run by this reviewer. A06 and blob retention are outside this review.
''')
with (h/'decisions.md').open('a') as f:f.write('''\n\n## D329 — Bind nonserialized import and mesh-stage completion to current ownership (2026-10-29)

A05 followup at baseline5168183e8: actual importedFile regression tests expose five stale continuation
failures. Guard every file/loadDirect/worker/blob await and rejection by captured Open intent, document
dispatch and worker session. Only admitted direct/replacement changes emit success or accepted fit.
Mesh workflow is a private controller with immutable useSyncExternalStore snapshots and synchronous
question/task generations. Cancel/units/steps/new question/Stop revoke old work. Stop revokes before
restart, hands retryable questions to the new owner, and uses a stage-only current-model re-evaluation
trigger. It does not roll back unrelated Undo entries or change central D321 Stop semantics. Unmount
and repair entry supersede older intents. No schema/dependency/WASM/geometry policy changes.

Sol Medium implements; Sol High source-only review passes. Build/types/scoped lint pass; Studio460
includes new31 (0FAIL/0SKIP). Initial type fixture errors and root driver lint failure remain. Initial
native batch5PASS/2FAIL is withheld because App changed from frozen d669 to earlyWIP04a883 during the
run; cause UNKNOWN. Preserve both capsules/diff/raw failures. Restore only owned missing guards after
browser closure and commit a7264f0e5. High confirms all4 restored source paths equal frozen/Git bytes.
Final native7PASS/0FAIL sequential cases include public Stop Undo/Redo and retry; normal selected6 plus
starter pass sequentially. External metadata watch/final hashes show no final-run source drift. Do not
count repeats or claim whole-browser acceptance. Normal original file/event return scheduling is held;
no fabricated bytes/results, OS chooser or natural failure proof. Existing exact-source build/test
receipts are reused after byte-identical restoration.

Evidence: notes/import-open-stage-ownership-2026-10-29/qualification.json. Wider A05/version-write/linked
matrices, native IGES/fit/project negatives, A06 resources, full other-package/browser suites, remoteCI
and performance/heap remain outside scope. Normal feature push authorized; no PR/release. Next A06
sender/worker disposal. Record the owner's77-prop SceneViewport feedback as further App decomposition.
''')
with (h/'roadmap.md').open('a') as f:f.write('''\n\n### D329 nonserialized import and stage ownership — qualified (2026-10-29)

[Full evidence and source-drift boundary](notes/import-open-stage-ownership-2026-10-29/README.md) extends
existing12/O9 A05: every import continuation/rejection, modal generation, accepted fit and stage Stop
checks current ownership. Stop preserves the current doc/Undo/Redo and keeps surviving questions
retryable. Build/types/lint and Studio460(new31 included) pass. Initial native5PASS/2FAIL is withheld for
unexplained App source drift. Exact reviewed source restored and committed; final native7 and normal
selected6+starter pass in sequence with no observed final source drift. Preserve all original failures.
No full-browser/other-package/remoteCI/performance claim. Wider A05 matrices remain explicit. Next urgent
existing A06: WireSender eviction subscription, restart/dispose/error/unmount ownership and retained maps.

### Further App decomposition candidate — owner feedback, 2026-10-29

The actual SceneViewport call has77 attributes including ref (76 ordinary props),20 on-events and nine
inline callbacks. Keep this as the next App-specific structural target under existing App/workspace
maintenance: separate scene data, selection interactions, sketch editing and analysis/presentation
contracts; move each derived value and callback to its owning module. Preserve memo identities, fresh
body provenance, current refs and event ordering. Also retain command start/apply/cancel and keyboard
routing as coherent candidates. Complete active A05/A06 before optional structural changes; no new
queue or automatic whole-App acceptance from moving JSX or wrapping all props in a bag.
''')
print('D329 evidence copied and documentation finalized')
