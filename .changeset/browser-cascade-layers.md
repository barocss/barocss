---
"@barocss/browser": patch
---

Browser runtime now sits under the page's cascade (#208): the first `<style>` in `<head>` declares `@layer theme, base, components, utilities;` and holds preflight in `@layer base`, and generated utilities go in `@layer utilities`. Unlayered author CSS (e.g. `header { display: flex }`) now beats preflight, and a built app's own `@layer base` rules win over the injected preflight.
