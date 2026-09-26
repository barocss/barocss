---
"@barocss/kit": patch
---

Custom theme keys resolve to their own namespace on utility roots shared with colours (#338): `border-*`, `outline-*`, `ring-*`, `ring-offset-*`, `divide-x/y-*`, `decoration-*` and `stroke-*` use `borderWidth`, `outlineWidth`, `ringWidth`, `ringOffsetWidth`, `divideWidth`, `textDecorationThickness` and `strokeWidth` keys instead of emitting a colour var. A key in both follows Tailwind 4.3.3: the colour wins on border/outline/ring/text/stroke; the shadow, inset/text/drop shadow, ring-offset width and decoration thickness win on their roots. Adds functional `ring-offset-<colour|width>`.
