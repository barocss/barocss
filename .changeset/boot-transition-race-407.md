---
"@barocss/browser": patch
---

Boot no longer animates from unstyled values. If the browser rendered a frame (or otherwise resolved styles) before `baroBoot`/`baroStart` inserted its CSS, `transition` / `transition-colors` utilities animated from the unstyled look to the final one for their duration (150 ms by default): a visible FOUC that slowed about a third of first paints in some runs (#405). Right after the first synchronous insert, boot now finishes the CSS transitions that insert started, in document and shadow-root mode. It adds no stylesheet, so nothing changes for CSP, `nonce` or `constructable`; transitions triggered later by class changes run normally.
