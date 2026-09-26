---
'@barocss/browser': patch
---

Shadow DOM root mode: document that a site's own CSS (base rules such as heading fonts) does not reach a shadow root and must be shipped into it; add tests that the runtime keeps an app stylesheet inside the root (#355).
