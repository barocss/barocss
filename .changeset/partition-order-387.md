---
"@barocss/browser": patch
---

Rule order across the default 50-rule partitions now matches the single-sheet order: an overflow partition is inserted right after the previous one instead of after the category partitions, so e.g. `shadow-[…var(--x)]` and `shadow-md` resolve as they do in one sheet.
