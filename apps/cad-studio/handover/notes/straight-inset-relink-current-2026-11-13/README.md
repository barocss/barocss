# D920 — verify straight-face inset re-link on the current Studio

2026-11-13 · SMALL · P1 rows 07, 09 and 16 · [#2324](https://github.com/barocss/barocss/issues/2324) remains open.

The existing [D870](../associative-inset-source-replacement-2026-11-13/README.md) command replaces the source of a healthy v1 inset. Its first scope is one earlier exact native straight planar face, a separate explicit application target, and one independent terminal Extrude. [D868](../associative-inset-open-admission-2026-11-13/README.md) and [D869](../associative-inset-target-delete-2026-11-13/README.md) cover failed Open and target deletion. The lost-binding file stays outside the accepted document. Damaged-file repair is deferred pending an intake design.

## Verification

- **PASS** Current desktop Studio previewed the replacement from `n1.top` to `n3.top`, kept the separate application target `n1`, and preserved the accepted model until Apply. Cancel, selecting the existing source, a blank draft, and held replies after a new pick or same-ID File Open retained the current work.
- **PASS** Apply, exact Undo and Redo, Save, fresh File Open and post-open source width edit passed. The native ring volumes were 960.0000000000016, 1280.0000000000011 and 1343.9999999999977 mm³, with independent values 960, 1280 and 1344 mm³. Native volume and coordinate tolerance was 1e-8. The two source solids stayed exact through re-link, and the explicit source width edit then changed only the intended second stock. The file was 2581 bytes.
- **PASS** 22 Model and 44 Studio focused tests, driver syntax and diff check.
- **NOT_RUN** Current execution of successful source resolution followed by a downstream Extrude refusal, a supported nonaxial replacement, damaged-file repair, whole suites and mobile.

The next verification exercises a candidate whose planar inset resolves but whose dependent extrusion fails. The browser must retain the existing accepted document and expose the refusal. No new geometry admission is part of that check.

[Commands and receipt hashes](qualification.json).
