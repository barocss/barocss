---
"@barocss/kit": patch
---

`content-[…]` passes the arbitrary value through like Tailwind 4.3 (`content-["x"]` → `"x"`, `content-['x']` → `'x'`, `content-[a_b]` → `a b`), and `before:`/`after:` put their default `content` first so a `content-*` utility wins.
