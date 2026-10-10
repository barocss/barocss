## Pre-implementation world phase and API contract — preparation only

Source audit: immutable #1234 reference-world/global-island/position-relaxation at55879d8f and #1263 linear-solver at measureda59b0967. This appendix resolves the next adapter boundary. It is not code, a source freeze, or worldGO. Actual sole adoption remains required.

1. Original free integration and original 64-pass feature-aware velocity island run on detached working bodies. Retain original face-compatible warm start, cold edges, contact geometry and impulses.
2. New private island copies the original velocity implementation and phase guard. Replace only its old eight sequential position sweeps with a single coupled position phase. Remove the separate32-sweep relaxation call. Do not run both paths.
3. After velocity solving, inspect all36 eligible sorted pairs once with the original detector. Include every non-null detect as one row, including zero depth. Use original A-to-B normal and depth. Preserve original pair IDs/order, nine inverse masses and static floor. Do not select only old assembled/warm rows, drop edge/touch rows, or replay archived phases.
4. Call the actually adopted #1263 bounded linear interface unchanged: <=9 bodies, <=8 rows, original inverse-mass/depth bounds,256maximum masks, pivot/feasibility/objective thresholds unchanged. Compute candidate translations before modifying the working array.
5. Apply translations once to dynamic working positions only. Static floor, orientation, linear/angular velocity, mass/material and cursor remain unchanged by this stage. Validate original body movement/result limits after the full world phase. Commit bodies/cache/events/stats/time together only after every check.

### Private state and diagnostic API

Keep original private getState, step, queries, dispose, getWarmCacheStats and getGlobalContactStats. Add copied getCoupledPositionStats. Freeze its fields as integer `tests`, `hits`, `rows`, `enumeratedMasks`, `singularMasks`, `infeasibleMasks`, plus nullable `activeMask`, `maxTranslationM`, `primalViolationM`, `negativeMultiplierKgM`, `complementarityKgM2`, `stationarityKgM`. Zero initial stats and null activeMask are explicit; all numeric values finite. One accepted phase has tests36/hits=rows<=8/enumeratedMasks=2^rows. Legacy global position fields now mean positionSweeps1/positionTests36/positionHits=rows. Deprecated32-sweep projection getter is removed from the new adapter/consumer; it is not silently reported as executed. Candidate stats retain their previous accepted values on failure. Contacts still describe velocity-assembly geometry/accumulated impulses, not final loads or corrected penetration. Independent final-pose geometry supplies the quality measure.

### Error and retention boundary

Expected linear PROFILE_LIMIT/INVALID_INPUT/INFEASIBLE and nonfinite/unsafe copied translation outcomes map to original PhysicsError NUMERIC_LIMIT with separately frozen exact messages: `private coupled position profile is unsupported`, `private coupled position input is invalid`, `private coupled position constraints are infeasible`, `private coupled position result is invalid`. Original world admission/step/query/disposal messages retain original identity. An unexpected error propagates; never reclassify a harness crash as physicalNO-GO. Linear certificate/unit/cap checks precede applying positions. Full source freeze must pin mapping/messages and controlled row/error injection before execution.

### Required controls and archives

Literal detached controls cover0/1/8 rows,9-row refusal, unknown/duplicate body IDs, nonunit normal, mass/depth bounds, opposing infeasible constraints, static/static positive-depth infeasibility, nonfinite result, phase order and copy isolation. Private world control injects a typed coupled-stage refusal and proves full prior state/cache/global/warm/coupled stats and cursor retained. Original world controls remain. Freeze injection ownership and supported profile before implementation.

Actual consumer preserves original ALIGNED/OFFSET/YAW inputs and 1200-step/10-second quality gates. Persist both pre-coupled working poses/row problem/certificate and accepted final raw poses per attempted step. This allows a failed future state to be diagnosed without inferring historical cache from the final state. Record first failure and all accepted states; no successful detached state is world completion. Source/repeat/genuine compiled-original graph equality remains mandatory. Refinement/cost/Chrome only follow their original priorGO gates.
