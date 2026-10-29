# D322 smallest actual late-Save baseline plan

Fixed source: a386c8705beda2c72d215da61a55fd6119351ca2. Actual execution is NOT_RUN at plan preparation. Only two new
test files are owned: late-save-ownership-browser.test.mjs and late-save-native-scheduler.mjs. Production remains
unchanged. Source retention is small: fixed Git baseline, five relevant runtime hashes and two exact driver gzip
capsules, original logs, key states/native bytes and necessary PNGs. No broad provenance scan is needed.

Use real current-source Studio in a fresh Chrome WebGPU/DPR1 context on secure loopback. Public UI creates a Box,
opens a uniquely named project with Keep in this browser and normally saves D322-owned.bcad. A public Render Grid
edit makes document A dirty. Arm one exact native file path, projects/d322-late-save-<uuid>/D322-owned.bcad. Save A
uses real native writable write and close; after actual native close commits, only its Promise return to production
is held. Public Render Grid edit B then differs from A, and the actual project autosave B must finish before release.
Use Model workspace for public project/active-part inspection; workspace switching changes no document.

The scheduler preserves native objects, receivers, input args and output values. It changes native close-return
schedule only. Driver inspection obtains an independently marked native root and propagates inspection-handle
scope; app native I/O is logged as production. After release, completion requires the production returned-tag
getFile and production project-root entries iterator completion, not autosave deletion. Native progress is the
completion condition; following microtask/frame turns only permit public UI commits and never determine PASS.

Before any final safe assertion, retain initial/before/held/newer-autosaved/after-release document, dirty, local
recovery, public project/active-part, direct native saved/autosave bytes+parsed contents+tags and native trace.
Private project tag ref remains NOT_EXPOSED. Expected safe behavior is: live B remains, dirty stays true and the
completed newer autosave B remains. Baseline Node FAIL at these assertions means product reproduction only when
all schedule/native checkpoints completed; setup/schedule failures are classified separately. A completed disk
Save A itself is legitimate: stale clean/autosave completion effects on newer B are the suspected defect.

One same-document case only. New/Close/switch during pending Save, other contexts/tabs, external folders, actual
crash/file loss and local-recovery deletion in a detached new document remain NOT_RUN. Close project after measured
results is cleanup only. Release owned scheduling, remove only this OPFS project namespace, verify absence and
close owned context/browser/server. No runtime edit, whole suite, new dependency, commit or push is permitted.
