---
"@barocss/browser": patch
---

Remove a utility `<style>` segment once rule GC empties it, so the number of `<style>` elements stays bounded in long-running pages (#440).
