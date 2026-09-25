---
"@barocss/browser": patch
---

Add opt-in `skipExisting` runtime option: classes already defined by the page's own same-origin stylesheets (e.g. a Tailwind build) are not regenerated, so the runtime injects only what the build is missing.
