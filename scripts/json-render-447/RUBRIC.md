# Frozen scoring contract for #447

This is a preparation artifact. It authorizes no generation. Freeze the fixture, rubric, runner and provider configuration hashes before the first approved request. Reuse #446 host state, action handlers, catalog renderer and style assertions. No reference spec, scoring result, suggested repair or prior arm output enters a model context.

## Sessions and context

Use an independent conversation for every model × arm × scenario × repetition. Each conversation has initial, density, responsive and structure requests in that order. The exported system message contains exactly one arm's catalog. Send every earlier user message and the exact complete earlier assistant response on each edit. Never summarize, truncate, replace or repair this history. Preserve malformed and truncated responses verbatim. If the provider cannot accept the complete context, mark the request context-blocked and retain it in the scheduled denominator; do not make a shorter request. Provider refusal or missing output is a failed request. A subsequent edit may continue with complete history if an assistant response exists, within the approved budget. Do not invent a response to a transport failure.

Record UTF-8 input bytes, provider-counted input tokens, complete-history hash, catalog hash and prompt hash per request. Report arm catalog/token differences as a confounder; do not pad prompts to manufacture equality. The initial semantic request and all edit requests are identical across arms. Catalog capabilities and serialization length differ intentionally. Fixed and bounded catalogs enumerate all requested layouts. All 36 scenario × arm × stage cells are preregistered expressible. Do not change this label after seeing output.

The build-only control receives the same utility output bytes and host state; it has no independent generation. Freeze its CSS inventory from that session's initial output only. Later tokens must not enter its build. Control rows are paired rendering observations, not extra model requests.

## Objective anchors and order

Score each first response without a repair loop. Keep raw response, provider usage, finish reason and validation errors even if it fails. Use these checks in order:

1. **Transport/completeness:** response exists, is not refused, truncated or budget-aborted. A length-limited response fails even if a parser accepts its prefix.
2. **Spec validity:** exactly one JSON object; allowed catalog types/props/events; unique stable IDs; complete referenced children; no extra nodes, code, URLs or arbitrary utility syntax. Validation errors fail this anchor.
3. **Semantic fidelity:** exact required text, labels, select options/order, leaf order, state paths and action names. Compare to scenario requirements, independently of the generated spec. Structure adds exactly the specified help node; no other content changes.
4. **State and focus:** host edits the target once after the initial render, then retains the same renderer and store for each edit. Check DOM field value and state snapshot against that edited value. Check active input/select before the action click. A remount, reset, lost binding or lost focus fails. For initial, measure after the host interaction; there is no prior model edit to preserve.
5. **Style:** measure layout padding, row/column gap and column count at the stated viewport, against 24px/two columns initially, 12px/two columns at density, and 12px/one column at responsive/structure. Use the frozen #446 numerical tolerances. Capture immediately after render and at three animation frames. Report count of failed samples, distinguishing persistent missing style from transient changes. Do not call all failed samples flashes.
6. **Action:** click the expected button after focus/value capture; exactly one expected action and no other action must be recorded for this stage.
7. **Theme/host:** retain semantic theme colors and the unchanged host sentinel using the #446 computed-style assertions. Archive screenshots at the same viewport and stage.

A cell passes overall only when anchors 1–7 pass. If rendering cannot proceed, dependent anchors are unmeasurable, not successes. Keep their reason and the overall failure. Missing cells and harness failures are never removed from scheduled totals; identify infrastructure failures separately from model failures. Validate the scorer with a valid response, malformed JSON, forbidden property, changed binding, wrong action, missing utility and length-stop dry run before approval. Do not evaluate live output by visual preference or by exact equality to the hand-authored reference spec.

## Denominators and causal limits

Report counts by model, arm, scenario, stage and repetition. Include scheduled requests, attempted requests, complete responses, valid specs, supported requests, rendering measurements and overall passes. Primary pass rate is overall passes / all scheduled requests. Also report passes / preregistered supported requests; here both denominators are equal. Preserve unsupported, context-blocked, failed, truncated and skipped cells explicitly. A budget stop leaves the remaining scheduled cells unrun, never silently absent. Report complete successful sessions / scheduled sessions as a separate multi-turn metric.

Record every first response. No best-of selection, hidden retry, repair or post-hoc prompt change. Any approved transport retry is a separate attempt with cost and reason, never a replacement for the first response. Runtime styling results cannot establish model reasoning superiority. State/action success comes from catalog and renderer integration. The small staged pilot is descriptive; it is not a reliability, accessibility, cross-browser, payment or production-security claim. Review must inspect raw outputs, frozen scoring anchors and representative screenshots independently before a conclusion is accepted.
