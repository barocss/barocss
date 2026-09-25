---
"@barocss/browser": patch
---

Browser preflight no longer overrides the page's own CSS (#208): the first `<style>` in `<head>` declares `@layer theme, base, components, utilities;` and holds preflight in `@layer base`. Unlayered author CSS (e.g. `header { display: flex }`) now beats preflight, and a built app's own `@layer base` rules win over the injected preflight. Utilities stay unlayered, so they still override preflight.
