# Model005 execution — actual OPFS overlap observed

This is the later authorized execution of the prepared command. The original preparation.json, notes.md, next-command.txt and prior Model004 artifacts remain unchanged.

Command: `sh /Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/harness/model-browser-overlap-run.sh`.

Author source verification: HEAD73c6085171f7d9b6931c395917742211f0266cbb. Both handleStore.ts and store.ts Git blobs and working-byte SHA-256 values match frozen5463. No dirty diff for these paths. source-verification.json records exact evidence. D317 STEP changes are outside this probe.

Exactly one shared heavy acquisition granted after0s at load9.24, slot1/3. Owning shell83957 released through EXIT trap. Gate/build/probe/release exit codes:0/0/0/0. No retry, install, product edit, Git mutation, issue or external message. Build input resolution PASS:154 inputs; every product input inside frozen snapshot. First build/browser/harness execution failure: NONE. One console resource404 remains in original output; requested resource URL was not captured, so no cause is claimed. pageErrors=[]; no rerun was performed to remove the404.

Native browser: Chrome156.0.8078.48, secure context true at owned loopback origin http://127.0.0.1:54145. Fresh ephemeral context and unique OPFS subdirectory cad-audit-model005-0df27eb3-ab3a-478a-b451-fc47ced78743. `createWritable()` received zero arguments, matching production; both actual native streams admitted before either write/close. Each stream's observed mode property was`siloed`; this is a measured property of this run, not an inferred portable default. No explicit mode profile ran.

Serial control: PASS. Original tag8-1793248486687; first write fulfilled with19-1793248486692. Serial stale write rejected withSTORAGE_CHANGED. Readback remained`serial-first-longer`.

Overlap: both writes expected8-1793248486694. Validation reads precede native createWritable calls. Native admissions are events5 and6. A writes and closes first (close fulfilled event10), fulfills with8-1793248486697; readback observes`writer-A`. B writes and closes next (close fulfilled event16), fulfills with14-1793248486697; final bytes are UTF-8`writer-B-later` ([119,114,105,116,101,114,45,66,45,108,97,116,101,114]). B did not receiveSTORAGE_CHANGED. Original output captures byte arrays, tags, settlements, stream properties, event sequence and times.

Evidence boundary: actual native OPFS IO and unchanged production handleStore, with an audit barrier that delays only return from already admitted native createWritable calls. Native write/close/abort methods retain their native receivers; no stream or filesystem behavior is faked. This proves a controlled native-OPFS conditional-write conflict-protection gap. Natural Studio/UI overlap, two actual tabs, external programs and physical external-folder overwrite are NOT_RUN. No separate atomic-CAS/linearizability guarantee is asserted.

Cleanup: original result saved before removal. Only the named audit OPFS directory was removed; fresh context, owned browser and owned in-process server closed. cleanup.json records all four completed operations. No broad process kill or user folder access.

Suggestion for parent review: ISSUE_CANDIDATE limited to overlapping OPFS handleStore writes using the same expected tag, both reporting success and B replacing A despite the store's changed-file refusal text. Do not title or present it as a real-folder/user-data-loss reproduction or universal atomic-CAS failure. External delivery stays with parent after dedup and independent review.

Original execution receipt.json hashes original outputs and exact exits. preparation.json SHA-256 remains6ec7b693186d23b1f555b3d2f281c301eaaaf6b4e1aff936daf79ffc6ecb94cd.
