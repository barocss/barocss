# First canonical-copy source review

The first IO copy completes and retains all required runtime modules, but its
regex import scanner also counts JSDoc import types. It includes the unused
full-pair-types.js and therefore does not establish an exact runtime closure.
No candidate import, solver or physical test occurred in that IO operation.

Keep canonical-stationary-01, its original provenance and the actual successful
IO guard unchanged. The exact-closure interpretation is NOT_QUALIFIED.
The original scanner remains in baseline/capture-canonical-regex-v1.py.
Use a new TypeScript AST scanner and fresh canonical-stationary-02. It visits
only runtime import/export/call nodes and records its installed parser tool.
No extra file is a fallback or execution path. No physical criterion changes.
