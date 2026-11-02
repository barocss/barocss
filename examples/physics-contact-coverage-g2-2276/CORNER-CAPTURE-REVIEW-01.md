# G2 corner capture: ordinary static review 01

Status: **BLOCKED_BEFORE_RUNTIME** for the I/O/provenance items below. This review does not judge the closest-point oracle or the geometric contact result.

Reviewed source bytes:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `corner-capture.mjs` | 10750 | `4f932ef8c3caa66a84cda0120ae98a92153bb4a8096655be9135ba3f4a5132d3` |
| `CORNER-PROPOSAL-01.json` | 3779 | `fbb9af67a436c93777077e2e30dc5f47117d030c6470bddde1f91f9d390cdf95` |
| `CORNER-INPUT-01.json` | 3422 | `65e82b0165c0c09ebbb435a99d0b1fe877d0dd7c75d7cd99b19ed61bd25d618f` |
| `CORNER-CAPTURE-AUTHOR-01.json` | 1289 | `5266469249c201ca6c2004fa3694e4b60836d061b4d2b0d3e3558a0d138a6d2e` |

No provider module was evaluated. No fixture was converted. No build, helper, reference, or World call ran. The existing Node syntax receipt was read; syntax was not repeated. Only this review file was authored. G1 files, G2 providers, capture code, inputs, and prior author receipts remain unchanged.

1. **Bind the native prerequisite to the exact source capture and input.** At `corner-capture.mjs:99–102`, the runner authenticates a witness file and checks only `status === NECESSARY_CONTACT_WITNESS_PASS_ONLY`. It then authenticates `freeze.input` independently. It does not verify that the witness authenticated this input, this source capture, or the frozen source producer. Thus a PASS witness for different bytes can open the native gate. Before native runtime, freeze an explicit witness schema containing input and source-capture pins, authenticate those artifacts, and require the input pin to equal `freeze.input`. Preserve the original source failure and do not permit native after source NO_GO. This is a provenance requirement; it changes no physical gate.

2. **Preserve the actual build-child failure and bound the close wait.** At lines114–132, `build-command.json` is written only after the `close` promise succeeds. Nonzero exit, signal, overflow, spawn error, or timeout skip that receipt, so the final result loses the actual PID/exit/signal/EOF/timer/log prefix. The10s timer sends SIGKILL but the pending close wait has no cleanup deadline if an inherited pipe remains open. Record start/PID and bounded logs/exit/EOF in a finally path. Add a bounded cleanup outcome or explicitly delegate owned-group cleanup to the frozen parent guard and report incomplete closure as UNKNOWN. Do not report a normal child close merely because the guard can later terminate the group. No new child or numerical call is needed.

3. **Enforce the declared internal deadline before each helper call.** `time()` runs at line143 and again at line160. The calls at146,148,155 do not each check the30s deadline. In particular, a slow admission or intervening file write can let the next helper begin after the phase deadline. Call the existing deadline check immediately before each counted admitModel/admitCcd/sweepSphere attempt. The unchanged parent180s guard remains separate. This changes no helper population.

4. **Require actual executable pins, not only authenticate whichever pins are supplied.** Lines89–90 authenticate `freeze.toolFiles` entries and compare the requested Node path with `process.execPath`, but do not require `toolFiles[tools.node]` or `toolFiles[tools.esbuildBinary]`. A validly hashed freeze can therefore omit an actual executable pin and still reach the build. Require both actual paths to have byte/SHA records and absolute paths before use. Alternatively, a separately pinned parent freeze validator must enforce this exact mandatory key set; that validator and obligation must be part of the execution proof. No tool execution was done in this review.

The ordinary source path otherwise has the intended narrow shape: one global literal conversion on the source path; native reuses saved F64 words; actual internal `admitModel` supplies bodies; actual `admitCcd` selects the static-box profile; actual `sweepSphere` receives the prescribed candidate endpoint. The helper code is not replaced. The source/meta closure must contain only own src files, and the emitted/meta closure only own dist files, before module evaluation. Every discovered input is checked against the freeze and outputs cannot retain external imports. The emitted capture is explicitly a bundle of actual dist helper modules, not a public-root or World proof.

The shallow candidate retains some previous-body fields. The actual frozen `sweepSphere` source only reassigns candidate.positionM; the saved admitted-body image and local/original pair images are checked after the call. This is an intentional internal-helper capture boundary, not detached public-state qualification. Its counters distinguish attempts and returns; control flow has one call to each helper per executed graph and no retry. World calls are0.

Resource statements remain limited to owned payload/artifacts. The raw input file, provider, and metafile have declared fixed limits; provider/metafile limits are checked before import. Build/evidence totals are checked after capture. The8MiB payload statement is not a measured process heap/RSS bound, and this review does not convert it into one. The parent execution freeze must include the actual installed tool closure and the existing owned-process-group outer guard. No runtime PASS is granted by this source review.

Required next step: parent resolves the four ordinary items in a new preserved revision, then freezes actual source/native/tool/witness inputs. Independent High geometry/oracle review remains pending. **STOP: no source edits or execution are authorized by this review.**
