# D833 — Qualify the old reader boundary for a fixed linear pattern span

P1, rows 08 and 16. SMALL verification for [#2386](https://github.com/barocss/barocss/issues/2386). [D453](../body-pattern-spread-2026-11-03/README.md) and [D480](../part-transform-extraction-2026-11-03/README.md) already qualify the spacing-controlled lifecycle on their retained inputs. D832 qualifies current fractional count refusal with a named pitch. This decision checks two synthetic file representations against the pre-span reader at the recorded parent.

| Result | Check |
| --- | --- |
| PASS | The legacy `linear-pattern` reader accepts a synthetic extra `span: 90` field. With a 10 mm-wide seed and 30 mm pitch, Count 4 yields a 90 mm first-to-last translation and 100 mm overall width. Count 6 keeps that pitch, moves the last solid to 150 mm and makes the overall width 160 mm. The extra field stays at 90 and has no authority. This rules out an optional field on the existing kind for backward compatibility. |
| PASS | The pre-span desktop reader explicitly refuses the synthetic `linear-span-pattern` feature with the same schema and feature ID. The accepted model, native result, selection, dirty state and history stay exact. First Undo and Redo restore Count 4 and Count 6, with 32 and 48 native corners and 1920 and 2880 mm³. |
| PASS | The develop reader source also rejects unknown feature kinds. Root reviewed the actual desktop refusal. Driver syntax, 22 focused Model tests, Model types and diff check pass. |
| NOT_RUN | A reader that supports total span, actual develop Studio, builds, full suites, mobile and other browsers. |

Use a distinct Model feature kind to identify fixed span. Store one authoritative span and derive the native spacing as span / (count − 1). The existing provider can retain its feature identity, names and geometry rules. D834 will implement and verify the bounded Model and Studio Open/edit path. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digest](qualification.json).
