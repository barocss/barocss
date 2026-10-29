# Second App decomposition

App remains the composition point. It owns document state, the current document reference, Open/Save/work acceptance, evaluation handoffs, Undo/Redo/Stop and central commits.

| Module | Responsibility | Kept contract |
| --- | --- | --- |
| state/useSpecificationActions.ts | Requirements, answers, assumptions, reference files and DXF drafts | Render-captured document and normal central commit |
| viewport/useViewportPicking.ts | Base bodies, instances, native faces, section caps, measurement and direct selection | Stable callback dependencies and current-value refs |
| viewport/useSectionState.ts | Committed section, live drag store and exact-result state | CPU/WebGPU subscription choices and release commit |
| viewport/useSectionEvaluation.ts | Latest section evaluation and clipped body selection | Lane cancellation, latest-wins queue and exact source ownership |
| viewport/useSectionDisplay.ts | Bounds, hatch, live clip and handles | Existing memo identities and spacing |
| viewport/useAnalysisMaps.ts | Scalar maps, GPU access fallback and mould display | Existing admission rules, lane cleanup and undefined values |
| viewport/useWorkspacePreviews.ts | Three hooks: clearance, print/CNC and PMI | Separate domain inputs, existing effects and rejection messages |

No new runtime dependency, public package API, schema, migration or rendering behavior is introduced. Existing nonserialized Open/stage A05 work and other roadmap features remain separate.
