---
title: Compatibility scope
description: What the 0.0.4 candidate has been compared against
---

# Tailwind compatibility scope

BaroCSS uses Tailwind-style class names. It does not claim full Tailwind CSS compatibility or a measured compatibility percentage.

## 0.0.4 candidate evidence

The candidate was compared with `tailwindcss@4.1.13` using 15 selected classes. The comparison checks generated CSS structure. A structural difference alone does not prove a visual difference. This small sample cannot measure overall coverage.

The candidate also has a Chromium browser comparison for `hover:block`, `md:block`, `mask-linear-from-50%`, and `inset-ring-2` in specific states and with specific theme values. Those four inputs matched the checked computed styles or rendered pixels. Firefox, WebKit, other themes, other class combinations, and the full Tailwind feature set were not checked.

The [fixture list and comparison method](https://github.com/barocss/barocss/blob/codex/baro-0.0.4-rc-integration/packages/barocss/docs/tailwind-compatibility.md) and [independent candidate review](https://github.com/barocss/barocss/blob/codex/baro-0.0.4-rc-integration/docs/verification/0.0.4-rc-review.md) give the test inputs and limits. These are candidate records, not a release support policy.

## Before migrating

Test the classes and browsers your application uses. Compare the generated styles in real pages, including responsive states and theme overrides. If a class emits no rule or renders differently, keep your existing CSS for that case and [report the input and observed result](https://github.com/barocss/barocss/issues).
