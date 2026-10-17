---
"@barocss/cad": patch
---

Fillets and chamfers whose tools overlap (mitred box tops, tangent chains) apply each tool to the body in turn instead of joining the tools first: four mitred top fillets of a box evaluate in about half the time (110 → 56 ms). The finish's repeated face names are then numbered by where the faces lie (x, then y, then z), so three mitred fillets can swap two `#k` numbers against earlier results. Where a tool cannot be applied on its own (it meets the last result along an edge; a drafted wall) the tools are joined first, as before.
