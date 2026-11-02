# General rotation method review

Static review only. Numerical qualification is NOT_RUN until the parent execution freeze.
Earlier HOLD, NO_GO, tolerances, and first failures remain in force.

For free motion, set `p=Lbody/s`, `D=s/I`, with a scale-safe
`s=2*norm(Lbody)`. Then `norm(p)=1/2`. The Euler field is
`f_i=(D_k-D_j)*p_j*p_k`. On `abs(p_i)<=1`, its infinity-norm
Jacobian bound is `2*max(abs(D_i-D_j))`. The midpoint residual Jacobian
therefore differs from identity by at most `abs(stageDt)*maxDiff`.
The proposed subdivision rule makes this at most 1/4, including negative
composition stages. Guard every fixed Newton iterate and midpoint in that
box. Repeated principal moments do not invalidate these equations. Equal
moments reduce to uniform world rotation.

For forced motion, use the exact world momentum `L(t)=LpostImpulse+tau*t`.
Use the raw stage quaternion in its derivative and the homogeneous proper
rotation matrix in `omega=R*I^-1*R^T*L(t)`. Gragg modified midpoint with an
even substep count needs endpoint smoothing
`(z_n+z_(n-1)+h_sub*f(t_end,z_n))/2`. Without that expression, the required
even inverse-substep expansion is not established. The Neville table uses
`((n_k/n_(k-j))^2-1)` in column `j`. For `n=[2,4,6,8]`, its diagonal has
order eight and costs 24 RHS evaluations per macrostep. Normalize only that
diagonal result. Use an a priori subdivision bound, without retries.

The reference below uses independent body momentum and rotation-matrix ODEs,
directed Decimal80/120 Taylor32 enclosures, and the complete degree64 defect.
It does not use candidate stages or candidate trajectories. It merges
commuting monomials before interval evaluation and removes exact zero terms.
The frozen study reuses the authenticated old JT endpoint at dtBase/2 and
adds 22 windows per precision, each dtBase/4. Six matched times span
6*dtBase (nominal 0.1 s). The historical seed work is reported separately.
