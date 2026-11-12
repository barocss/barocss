# D828 — Find exact overlaid straight sketch segments

P1, rows 09, 15 and 16. FEATURE. Find overlaid lines inspects the current Select-tool sketch. It groups ordinary rectangle and straight polygon segments by both authored local endpoints. Reverse directions and signed zero match. Each result keeps the source shape, segment, direction and existing ID when present. The scan is read-only and uses no distance tolerance. It stops beyond 4,096 shapes and segments or 256 matching occurrences.

| Result | Check |
| --- | --- |
| PASS | Actual Studio draws two adjacent 10 mm rectangles and finds one group among eight straight segments. The two rows retain opposite directions from (14, 6) to (14, 16) mm. Mouse and keyboard select each source. The highlight matches its projected endpoints within 1 CSS pixel before and after zoom. |
| PASS | Scan and highlight preserve the accepted document, existing sketch graphics, selection, dirty state and history. Escape and Close scan remove only the diagnostic. |
| PASS | Plane offset 3 mm and a geometry edit both retire the old report and mark. Moving the edge produces zero groups. Restoring it recovers one group on a new scan. A file Open retires the prior draft report. |
| PASS | A separate stored rectangle has zero groups. Finish keeps its exact sketch and four side tags. Extrude 2 creates a valid native 60 mm³ solid with all four named walls. First Undo and Redo are exact. Save, Close and fresh Open restore the 588-byte document with no scan data. |
| PASS | Focused checks cover exact reverse and signed-zero equality, repeated and absent IDs, partial overlap, near misses, endpoint contact, crossing, invalid and curved input, open/closed edges and both budgets. Studio 38/38, type check, scoped lint, production build, syntax, diff check and root visual review pass. Both desktop runs have zero page errors, console errors and downloads. |
| NOT_RUN | Actual stored-side identification in a matching group, mixed excluded shapes in desktop, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2392](https://github.com/barocss/barocss/issues/2392) remains open for the remaining desktop identity and retirement checks. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
