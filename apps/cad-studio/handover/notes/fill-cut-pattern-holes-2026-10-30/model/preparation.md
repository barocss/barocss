# D345 Model integration source preparation

Status: SOURCE_PREPARED_RUNTIME_NOT_RUN. High owns Kernel source/build/focused gates and the sole heavy slot. This lane has not run tests, types, lint, build, Studio or browser.

Owned repository changes are engine/fillFeaturePattern.ts, only the two fill-feature-pattern product strings in app/commands.ts, and new test/fill-feature-pattern-holes.test.ts under packages/barocss-cad-model. doc.ts already imports FillFeaturePatternRegion from the shared Kernel API and is unchanged. No App, other command, editFields, schema, migration, dependency or D344 source changed.

The exact old helper is /tmp/d345-model/fillFeaturePattern-before.ts. Its SHA256 is bce31ee96e3fc0c386240df265ff03dd46bfcbd50932e6c23b9401738df9c94f. The frozen old helper rejects all source sketch holes. This is a source baseline; a runtime baseline override probe remains NOT_RUN until root assigns capacity.

Capture now reads own data descriptors for node kind, source plane, nested line kind/start, coordinates and simple parameter references. Accessors are rejected without invoking them. Hole and outer arrays must be dense with no extra keys. Hole count is bounded before descriptor enumeration; each ring is bounded, then aggregate outer plus holes <=16 is checked before reading segment coordinates or calling shared exact qualification. Core remains the topology and finite numeric admission authority.

Model source SketchNode.holes:[] creates no region.holes property. A raw mask with explicit holes:[] remains invalid under root's fixed contract. The older plan recommendation to canonicalize raw empty holes is superseded. Other regions, on/association, suppressed source, non-worldXY source and arcs remain unsupported. The picker uses the same descriptor capture and does not read source kind via a getter.

Commands copy explains total16 and reference-point-only hole exclusion while retaining original cut. It does not claim full-tool containment or clipping. Existing reselect/editor fields use the same snapshot helper and need no change.

Six proposed tests cover actual profileOf rectangle+rectangle+triangle output, owned parameter-resolved mask, the independent7-to9-cell/cut/moment oracle, source edit independence and explicit editor reselect, actual command atomicity, native file/wire/flatten/nested/suppressed admission, raw empty-hole rejection, source geometry guards, zero getter calls and aggregate early refusal. High executed the independent plan oracle first; its oracle-second.json confirms the canonical7/9 outputs. The initial oracle's equivalent unreduced-fraction assertion failure remains High-owned evidence.

Studio driver source preparation follows verified Model runtime. Existing D335 actual sketch controls and new-source profileOf producer are mapped; no browser execution or source App hook is authorized here. Planned new driver path is apps/cad-studio/test/fill-cut-pattern-holes-browser.mjs after root's Model-path gate. Actual GUI authoring must create a standalone worldXY outer plus two line holes; metadata cannot be substituted for authored shapes. Use one Chrome/serial contexts, existing UI actions, source caps and readonly observation hooks only.

No commit/push. Existing D344 proof and performance files remain frozen.
