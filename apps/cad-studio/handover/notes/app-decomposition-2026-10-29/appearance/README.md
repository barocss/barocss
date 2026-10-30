# D327 model appearance extraction

Status: source ready for main integration and High source-only review. Types/lint/tests/native flows are **NOT_RUN by this worker**. Only new src/viewport/useModelAppearance.ts and scoped notes were written; App was not edited.

The agreed O18-through-placeSkip App block is identical to fixed commit `1266cdf24943acc5963bf5e346339e32c9f3da41`; copy range and typed contract are in [contract.json](contract.json). The hook takes three cohesive typed contexts (model, preview, display) with no callbacks. It owns only the existing drawn-array ref gate and pure shown appearance memos, not new asynchronous state/effects.

The O18 sameMeshes gate retains the exact drawn BodyResult array while only masses change. Shown-body precedence remains drag, route preview, command preview, section then drawn. Exact-section animated offsets still map through source body keys, and all index/name lookups, proposal tint rules and placement skip sets remain unchanged. Original memo dependencies are copied verbatim. Input wrapper objects are destructured and never become dependencies. Main must pass actual original ghost/sectionExact objects and body arrays, not rebuilt subset objects; only the three original truthiness conditions become boolean input flags.

No new per-element closures were introduced: the original callbacks remain as copied, with existing sameMeshes/meshSig helpers from the source bodyResults module. No performance or identity improvement is claimed beyond preserving original behavior.

Maps and mould remain in App: GPU access hook/device callback, scalar/CPU maps, isoclines and asynchronous mould lane/effect are coupled and were not forced into a generic context. AnimatedAt calculation, section selection/clip/hatch/handles, references/gizmos and central refs/state/effects also remain with main. No geometry algorithm, dependency, product capability, heavy check, browser, commit or push was added by this worker.
