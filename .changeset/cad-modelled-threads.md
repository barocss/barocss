---
"@barocss/cad": minor
---

Modelled ISO metric threads: a part's `thread` feature (and `threadSolid`) builds a threaded rod, a hex head bolt or a hex nut with a threaded bore as one faceted solid (ISO 68-1 basic profile on a helix, 7.5° × P/12 facets) with no Boolean; `isoThreadRadius` gives the profile. Mesh solids' faces are named `<id>.facet<k>`, and the hidden-line projection draws the joints between facets within 20° only where they are the outline. Building a B-rep no longer spreads every coedge into one call (a large solid overflowed a worker's stack).
