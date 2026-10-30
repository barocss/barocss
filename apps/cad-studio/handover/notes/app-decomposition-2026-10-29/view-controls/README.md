# D327 view/display controls extraction

Status: source ready for main integration and source-only review. Types/lint/native flow are **NOT_RUN by this worker**. Only new src/ui/ViewDisplayControls.tsx and scoped notes were written; App integration is main-owned.

The full original corner-right Profiler/div is extracted as one typed leaf, including legends, preview display controls, section bar, view buttons, explode and selection/snap controls. Copy range and domain props are in [contract.json](contract.json). Existing values/setters are grouped by model, view, display, section, analysis and picking; viewport/corner refs and the existing explode ValueStore are passed directly. No new context/framework/state/effect or memo optimization is introduced.

DOM/classes/aria and original row/stack order remain unchanged. The same static onBlockRender function and Profiler id remain in the leaf. The exact cornerRight ref still reaches its original div. Viewport commands read the current ref when clicked. Section startup still clears selection with the shared emptySel object, clears face pick, then computes/sets the original Y section in that order. Existing CAD mode/failure/isolation attributes and reason text, analysis/map cycles and reset order, theme/AO/ortho, pick/snap browser storage and explode subscription remain as written.

Only setDisplayModeFailure(null) is delegated as the single clearDisplayModeFailure domain action before setDisplayMode. Main provides that exact callback. No callback behavior, unit, algorithm or support rule changes. Root/main own final checks and actual verification; no heavy command, browser, commit or push ran here. This is the last assigned implementation extraction, with no additional domain work proposed.
