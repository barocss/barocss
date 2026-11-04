# Same32-point force and moment balance

PASS for force/moment balance only. Each saved Source and strict NodeNext graph
has32 RAW original points,8 interfaces,8 dynamic bodies and48 scalar force/moment
constraints. Exact Fraction residuals are ZERO. All loads are nonnegative.
Independent free-body cumulative weights supply each interface load; its four
symmetric points each carry one quarter. Masses/gravity and actual point/normal
words are authenticated before execution. No contact/QP/World solver is called.

Executed: `python3 -B examples/physics-box-quantized-equilibrium-2276/run.py equilibrium-01`.
The guarded command exits0. Inputs, code and full exact force/moment rows are
in EVIDENCE-01.tar.gz with member hashes in EVIDENCE-ARCHIVE.json.

These are saved PRE contact points. This does NOT prove feasible geometric gaps,
complementarity, a dynamic engine solution, integration accuracy, position-work,
stable stacking or the original1200-step exit. Those remain NOT_QUALIFIED/NO_GO.
No API/body/iteration/tolerance change, old-worker resume or deployment.
