# Issue 458 scoring contract

This is an exploratory pilot. A cell is one scheduled scenario, arm, and stage. Six sessions contain four ordered cells each. Both arms use the same semantic request and structured output envelope. The output must be complete JSON for every stage. There is no repair, retry, or post-output prompt change.

## Denominators

- **Scheduled:** always 24 cells. A skipped cell stays in this denominator.
- **Attempted:** a durable reservation exists before the transport starts. A failed or ambiguous invocation still counts.
- **Expressible:** the frozen catalog marks 21 cells expressible and the final variable-arm edit for each scenario unexpressible. This classification precedes all responses.
- **Valid response:** strict envelope and spec schema pass, including the ID tree, bindings, safe class tokens, numeric ranges, action name, and literal text checks.
- **Semantic preservation:** every fixture node retains its literal content, options, action, and binding. This check is separate from schema validity.
- **Request satisfaction:** for an expressible cell, all required style values match and the response does not claim `cannotExpress`. The score is false when the response is invalid, semantically changed, or missing.
- **Correct abstention:** for an unexpressible cell, `cannotExpress=true`, the complete spec equals the preceding accepted spec, and semantics remain valid. It does not count as request satisfaction.
- **JSON session chain:** the current cell and every earlier stage in its session met request satisfaction or correct abstention. A broken earlier stage makes all later chain results false, even if a later JSON object is locally valid. Failed or ambiguous transport cannot earn success from a valid-looking final response.
- **Full session:** the JSON chain and every browser replay stage preserve state, focus, action, DOM order, host/theme style and approved layout without visible overflow. A browser failure poisons later full-session results. Correct abstention does not need to meet the unsupported new style request.
- **Browser replay:** saved validated specs mount/update in the official json-render React renderer. State, focus immediately after an update, action count, node order, host style, computed styles, and screenshots are measured at 1280×900 and 390×844. Any browser error or external request is recorded.
- **Visible overflow:** page scroll width, layout right edge, and child scroll dimensions are checked. This is a measurable signal; human screenshot review records visual overlap and legibility separately.

Style values use an absolute 0.01 tolerance in JSON-derived scoring and 0.5 CSS pixel in browser computed style. Browser style checks compare the frozen requested state even for an unexpressible edit, so three honest abstentions are expected style failures. They are reported separately. A browser-only style pass never repairs a failed schema, semantic check, or session chain. The local viewer displays raw requests and finals, recorded usage/exit/time, screenshots, and every failure.

All summary claims must say whether evidence is synthetic or live. This rubric does not claim general model quality, provider superiority, a production API, or a price bound. A 24-invocation cap is not a token or dollar cap.
