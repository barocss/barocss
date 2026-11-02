# Desktop driver correction

First render01 FAIL is preserved: Unexpected end of JSON input after1initialcheck on minimum-miss. Actual World had accepted1correctMISS step, no page/console error. The driver read innerText from a closed contact-state details panel, which returns an empty visible string. Original scene, driver, raw browser report and screenshot are retained in evidence/render-first-failure-01.

Before parsing the displayed JSON, revised driver opens the actual details summary with a click. It still checks visible text against the full accepted public contact state. No numerical criterion, pixel gate, UI data, engine source or physical input changes. Current preview bundle is reused unchanged. A fresh render02 receipt is required.
