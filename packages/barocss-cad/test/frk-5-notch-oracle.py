# Independent oracles for the FRk5 notch conformance cases (no kernel code): closed forms for the V notch, Gauss-Legendre
# for the hole saw. Branch: a round tube ro 15, ri 13 along z from 0 to 300; the cut removes z < h(x, y).
import math, numpy as np
ro, ri, L = 15.0, 13.0, 300.0
A = math.pi * (ro**2 - ri**2)
# V: h = d - k|x|, k = cot(angle/2); d - k*ro >= 0 for d 20, angle 90.
def v_case(d, angle):
    k = 1 / math.tan(math.radians(angle) / 2)
    absx = 4 / 3 * (ro**3 - ri**3)            # ∫∫|x| dA over the annulus
    x2 = math.pi / 4 * (ro**4 - ri**4)          # ∫∫x² dA
    V = A * L - (d * A - k * absx)
    h2 = d * d * A - 2 * d * k * absx + k * k * x2
    Mz = 0.5 * (L * L * A - h2)
    return V, Mz / V
# Hole saw: a cylinder of radius R along y (transverse), its axis at z = 0 offset e in x: removed z < sqrt(R² - (x - e)²)
# over the annulus. Polar Gauss-Legendre over r and θ.
def hs_case(R, e):
    xr, wr = np.polynomial.legendre.leggauss(64); xt, wt = np.polynomial.legendre.leggauss(256)
    V = Mz = 0.0
    for a, b in [(ri, ro)]:
        for i in range(64):
            r = (b - a) / 2 * xr[i] + (b + a) / 2; w1 = wr[i] * (b - a) / 2
            for j in range(256):
                t = math.pi * xt[j] + math.pi; w = w1 * wt[j] * math.pi * r
                x = r * math.cos(t); h = math.sqrt(R * R - (x - e)**2)
                V += w * (L - h); Mz += w * (L * L - h * h) / 2
    return V, Mz / V
print('V notch d20 a90', '%.10f %.10f' % v_case(20, 90))
print('holesaw R26 e0', '%.10f %.10f' % hs_case(26, 0))
