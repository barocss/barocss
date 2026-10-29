# D336 Studio source plan

Base HEAD 1fb2d11e9e4713bac3bfbc1131fc45302aa558f3. Model owner has separate direct.ts/test changes. Preserve them.

DirectPanel.run already catches operation errors before onChange and before added selection. DirectInspector maps errors to existing plain notice. No edits needed there.

App already catches loadDirect/directIGES/download errors. Extract that action to files/directExport.ts with current owner predicate after deferred loading. Reuse currentDocumentSave in App, current plain notice and existing download function. Keep default filename/MIME/bytes. No new geometry, schema, public API or disabled action. Test actual Model directIGES with trimmed, untrimmed and hidden-trim fixtures; replace only download side effect. Exercise delayed loader with real module and owner predicate to check stale completion. No test, build, typecheck or browser until root grants sole heavy gate.
