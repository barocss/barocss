# O7 legacy fixtures

Documents saved by the pre-O7 code: integration e4ba3c579 plus the outer lane's O8, 2026-10-23. At that point the fastener sizes, casting rules and enclosure variants were still built in. Each file is a normal Save (`encodeStudioFile`) and uses one built-in table. **Never re-save or regenerate them.** They stand for what people already have on disk.

| file | built-in use |
|------|--------------|
| `fasteners-in-part.bcad` | A hex bolt M6 × 30 with washer and nut, and a countersunk M5 × 16, made in the part by the fastener command. The `made` values name the size; threads and edit steps come from the catalogue. |
| `fasteners-instances.bcad` | Four socket screws M6 × 20 and a hex bolt M8 × 30, each placed as a part of its own. Instance docs; BOM lines. |
| `tapped-holes-milled.bcad` | Tapped holes from the hole command: M6 blind 12, M3 through, M10 blind 15, in al6061 for cnc-milling. The drill comes from the catalogue's `tap`; CAM reads the tap drill. |
| `drawing-holes.bcad` | A drawing laid out by `auto_dimension`, with `accept_tolerances`. Holes: Ø6.6 ×4, a tapped M6, Ø5.5 and Ø9. The position tolerances come from the ISO 273 clearances and are stored in the drawing. |
| `die-casting-zinc.bcad` | Die casting in zamak3, drafted 0.75°. Read against the die-casting profile's thresholds. |
| `sand-casting-a356.bcad` | Sand casting in a356, drafted 2.5°, with a machined top face and a gate. Read against the sand-casting thresholds and allowances. |
| `enclosure-parts.bcad` | Enclosure library parts on a 2.5 mm plate: a screw boss M3 and a PCB standoff M2.5. |

`expected.json` records what each file opened to at that code; `test/o7-legacy.test.ts` checks it. It covers:
- bodies;
- threads and fastener edit steps;
- the drawing: suggestions, issues and dimensions, its stored tolerances, and the suggestions with those tolerances taken off;
- tapped holes;
- machining and manufacturing rules;
- the BOM.

**Since O7 these files are the equivalence oracle.** That is the owner's decision of 2026-10-23: the studio is unreleased, so the schema tracks the latest and nothing is migrated.
- With the sample rows loaded as the person loads them (`samples/rows`, through `withSampleRows`), each file must open to exactly `expected.json`. The sample rows give what the built-in values gave.
- Without rows, each file reads as having no data: no fastener thread or edit steps, no tap drill, and every position tolerance an estimate.

Rewriting `expected.json` (`UPDATE_O7_EXPECTED=1`) needs a decision record.
