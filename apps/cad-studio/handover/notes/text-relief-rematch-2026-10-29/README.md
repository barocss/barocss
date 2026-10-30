# D296 follow-up: edit-time text relief face references — 2026-10-29

The existing `text-relief` node was registered for signature capture/open verification but omitted from
`engine/rematch.ts`'s edit-time named-face registry. An upstream edit could therefore skip its renamed,
ambiguous or removed selected-cap reference. Add that existing kind to the shared face registry.
No document kind, schema, public API or native geometry algorithm is added.

Two matcher integration tests use an actual box body with authored replacement names. They prove the
registry is visited, a unique cap is renamed and marked, ambiguous/missing matches refuse, source documents
remain unchanged and literal font/text metadata remain exact. These are bounded matcher fixtures, not an
actual native topology-renaming or browser flow. Existing complete tests exercise their original paths.

Before the one-line repair both new tests fail (0/2), with the unchanged original output in
`first-failure.txt`: `0 !== 2` and `error: 'ambiguous'`. After repair, focused53/53, Model type check and
changed lint pass. Complete Node22.19.0 Model1824/1824 (225281.689292 ms) and Studio365/365
(23673.303125 ms) pass. Complete result summaries are adjacent; original full logs remain at
`/tmp/barocss-text-relief-rematch-{model,studio}-full.log`.

The source base is739978a27 plus the one registry line and this new test file. Concurrent private native-wrap
source/moment/assembly work is not qualified by these Model/Studio results. Kernel geometry is unchanged by
this correction. No new browser run, native-renaming product flow or GPU matrix was run. D296's original
browser36/37 keeps its earlier runtime scope. No push, PR or release.

The first attempted test-file write was rejected by automatic approval review because it might overwrite
an existing test. Read-only inspection confirmed that path did not exist. Exclusive creation (`open('x')`)
then guaranteed preservation and was approved; there is no remaining permission block.
