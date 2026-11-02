# G1b linear residual check repair M02

Author-only narrow repair, authorized by parent after preserving candidate04dd/ReadyM01 at commit8dcc03e1f. No numerical or runtime call is authorized.

Before the source edit, fix the check as follows. For each existing direct3x3 solve, use the unchanged original matrix A, right-hand side b and computed correction delta. Form r=A*delta-b in row/column order and check

`|r|inf <= 64*2^-52*max(1,|A|inf*|delta|inf+|b|inf)`.

All terms are dimensionless because the nonlinear variable is scaled momentum p. The left side, scale and bound must be finite. This is a direct residual/backward-error check of the actual computed linear correction, not another solve, a rank certificate or a replacement for the final nonlinear residual/physical gates. On failure throw canonical NUMERIC_LIMIT before updating the Newton guess.

The private solver returns its Vec3 plus the computed residualMaximum/residualBound. The caller exposes those two existing scalar values at the existing test-only G1B_NEWTON_UPDATE site. This retains exactly108 update records/graph and the original595-record bounded observer population; no new public export/hook or nominal observer event is added. A comment-only G1B_LINEAR_RESIDUAL_FAILURE site inside the error branch permits recording the actual failed residual/bound before canonical throw. It adds0 normal records and at most1 failed-prefix record, inside the unchanged640 ceiling. The source-stage owner must include the two scalars in each update record and its existing<=128-node/record charge. No cap, stage, iteration, call or physical tolerance changes.

Candidate operations are source-authored only. The initial plan above was written before editing the candidate. The final source hash and syntax-only check are recorded in CANDIDATE-READY-M02.json. The old source/Ready remains immutable history. No candidate module, coefficient/fixture conversion, matrix solve, reference, build or World was executed during this repair.
