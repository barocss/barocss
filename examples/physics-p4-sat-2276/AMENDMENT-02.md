# Candidate rounding termination amendment — authored, NOT_RUN

The first actual run remains NO_GO. micro-01 stopped at ALIGNED1/PRE b0/floor:
7 pair stages and42 saved words were verified; the eighth returned interval
failed the unchanged independent observer's strict rounding-cell check.
Both interval endpoints rounded to word0011363cbd52463f, but the interval
touched a halfway boundary. Equal endpoint words alone were insufficient for
the observer's stricter certificate. This is the preserved first failure.

Before source modification, all seven original files were checked against
FREEZE-01.json by bytes and SHA256 and copied verbatim into
evidence/micro-01/source-snapshot, with that freeze file. No numerical module
was imported or executed for preservation. Original summary/pair logs and
authority files remain unchanged.

Candidate termination now additionally requires its entire outward interval
to lie STRICTLY inside the nearest-even cell of ITS OWN proposed binary64
word. Adjacent words come from that candidate word. The candidate computes
their exact dyadic halfway bounds and performs metered integer comparisons.
It does not read saved expected words, observer results or authority values.
The independent Fraction observer is unchanged.

If this stricter candidate condition fails, continue only through the original
frozen precision table64/128/256/512/1024/2048. There is no new precision,
retry, epsilon, altered tie policy, fallback or relaxed observer gate. Exact
values on a halfway boundary can remain UNRESOLVED after the fixed table.
All added integer arithmetic is charged to the same total2M operation and
16384-bit bounds. Population,180s external/170s internal guard and output
limits remain unchanged. Parent freezes revision02 before a fresh micro-02;
author has performed no new candidate or numerical execution.
