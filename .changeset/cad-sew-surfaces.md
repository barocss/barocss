---
"@barocss/cad": minor
---

New `sew` part feature and `sewSolid`: open NURBS surfaces joined along their natural edges into one closed solid. Corners and edges within a tolerance meet, the faces are turned to agree and outward, a surface's pole side is left out, and the faces keep their exact surfaces. An open set, a non-manifold edge or a one-sided shell is refused with the edges and surfaces at fault.
