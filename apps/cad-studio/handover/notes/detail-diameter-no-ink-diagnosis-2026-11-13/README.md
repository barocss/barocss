# D948 — distinguish a cropped-out Detail arc from a missing source circle

2026-11-13 · P2 rows 11 and 16 · SMALL diagnosis repair · [#2322](https://github.com/barocss/barocss/issues/2322)

- **FAIL on the parent** D946's native point-contact-only crop retained the bore in the parent Top view but reported that the measured circle was no longer in the part.
- **PASS** If a Detail diameter's exact circular reference is absent from the clipped projection, resolve it against the parent only to choose the diagnostic. The parent supplies no dimension value or anchor. Studio now reports “No drawable circular arc of the referenced edge remains in this detail.” The authored reference remains and actual SVG/DXF omit the annotation.
- **PASS** The D942 suppression and deletion regression passed again. Suppression retained the actual missing-source diagnostic and both formats omitted the annotation. Explicit deletion removed the two dependent dimensions. First Undo restored each original document and SVG.
- **PASS** Model 31/31, Studio roundtrip 4/4, both type checks, driver syntax and diff check.
- **NOT_RUN** Studio project-store Save/Open for this issue, explicit precision overrides, production build, full suites, PDF and mobile. #2322 remains open pending the project-store and display coverage. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
