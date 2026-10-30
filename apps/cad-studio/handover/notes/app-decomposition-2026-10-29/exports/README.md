# D327 model export extraction

Status: source extraction ready for main integration and source-only review. Types/lint/tests/native flow are **NOT_RUN by this worker**; root serializes validation. No App.tsx edits or new behavior were made by this worker.

Fixed source: `1266cdf24943acc5963bf5e346339e32c9f3da41`. Exact copy ranges and public module contract are recorded in [contract.json](contract.json). The new hook owns STEP/STL ask state and STL quality/busy/generation/pending/cancel-button ref. It receives one typed model context, existing EngineClient/fileName, the actual App doc/evaluated refs and FriendlyError notice callback. It does not import App or create replacement current-document refs.

`useModelExports` returns existing action/state names plus `clearStepAsk`, `changeStlQuality` and the cancel-button ref. `ModelExportDialogs` receives the returned controller as one domain prop. The dialog imports the controller type only; the hook has no UI component import or type cycle. Main owns App integration, clearing STEP ask during layout reset and the existing toast visibility conditions.

STL generation mismatch stays a silent return. Changed App doc/evaluated identity stays a refusal. Cancel/ask reset order, selected quality generation increment, busy focus, all-body preparation, sidecar before downloads, final current check, catch and generation-conditioned finally retain the original order. STEP faceted-body question/infill exception, browser-persisted mesh choice, quote and 3MF behavior remain as written. No new async guard or cancellation policy is introduced for those existing actions. Dialog labels/classes/roles/select options/Escape handling remain unchanged; quality update and STEP cancel delegate to the hook's equivalent named actions.

No dependency, schema, public product API or lifecycle protocol was added. Meaningful deferred-export regression tests may be assigned if review finds ambiguity, but no mirror/checksum test or broad test campaign was introduced here. Root/main own subsequent types/lint/targeted execution and actual evidence.
