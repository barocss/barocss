# D827 — Verify the remaining named Hole options

P1, rows 07, 12 and 16. SMALL verification of D826. Actual Studio saves through, counterbore and countersink presets on the first part's top face. Each new hole uses the second part's right face at local center (25, 6) mm. Both documents reuse the same local feature IDs.

| Result | Check |
| --- | --- |
| FAIL | The first driver assumed Open clears Undo. Existing successful Open is one history entry. The corrected check uses actual first Undo and Redo to verify the opened and prior documents. |
| FAIL | The second driver did not observe the expected failed preview for the oversized through-hole control. The corrected driver holds the real native refusal for a blind hole at Depth 0. |
| PASS | Actual Use and Apply produce a Ø6 through hole, a Ø6 pilot with Ø10 × 2 mm counterbore, and a Ø6 pilot with Ø10 countersink. All retain the new face n1.side1 and center. The three native volumes are 13269.0266447077, 13168.4956797928 and 13222.9499524919 mm³, respectively. Independent checks cover mass, centroid, inward native walls, closed shell and rim positions. The counterbore has its annular shoulder at X88. The countersink keeps the owned conical surface and its two distinct radii. |
| PASS | Each Apply is one history entry. The counterbore retains its through pilot and child recess after its preset is deleted. Actual Save, Close and fresh Open restore the exact 956-byte file. Editing the child depth to 3 mm keeps the original pilot and moves the shoulder to X87. |
| PASS | A held native refusal cannot replace the new valid preview. Held successes with queued Enter cannot commit after Open, a different command or New. First Undo and Redo match the actual document replacements. Hole without a selected face gives the existing explicit reason. |
| PASS | An incompatible local store disables the preset controls. A manual Ø6 through hole still previews and applies. The incompatible bytes stay exact. D826's blind path passes again on the final driver. |
| PASS | Studio 16/16 and Model 9/9 focused tests, both driver syntax checks, diff check, root visual review and Sol High geometry review. The final desktop flows have zero page errors, console errors and downloads. |
| NOT_RUN | Concurrent tabs, full suites, mobile and other browsers. |

[D826](../named-hole-options-2026-11-12/README.md) and this decision qualify the four supported preset types and storage, scope, history and persistence behavior in [#2379](https://github.com/barocss/barocss/issues/2379). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
