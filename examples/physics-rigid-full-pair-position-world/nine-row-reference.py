"""Cold nine-row 512-mask cross-check, distinct from LP/primal-QP search."""
import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("nine_exact_arithmetic_1399",Path(__file__).with_name("full-pair-reference.py"))
F = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(F)


def evaluate(problem):
    r = F.Arithmetic()
    try:
        model = F.decode(problem,r,9)
        F.need(model["m"] == 9)
        a,b,d,m = model["a"],model["b"],model["d"],model["m"]
        best = None;singular = 0;rejected = 0;qualified = 0
        for mask in range(512):
            active = [i for i in range(m) if mask & (1 << i)]
            if F.rank([a[i] for i in active],d,r) != len(active):
                singular += 1;continue
            gram = [[r.total(r.mul(r.mul(a[i][j],model["inverse"][j]),a[k][j]) for j in range(d)) for k in active] for i in active]
            local = F.eliminate(gram,[b[i] for i in active],r) if active else []
            if any(x < 0 for x in local):
                rejected += 1;continue
            lam = [F.ZERO]*m
            for i,x in zip(active,local):
                lam[i] = x
            u = [r.mul(model["inverse"][j],r.total(r.mul(a[i][j],lam[i]) for i in range(m))) for j in range(d)]
            if any(x < 0 for x in F.margins(model,u,r)):
                rejected += 1;continue
            margins,obj,cert = F.certificate(model,u,lam,r);qualified += 1
            if best is None or obj < best["objectiveKgM2"]:
                best = F.pack(model,u,lam,margins,obj,cert,active,r)
            elif obj == best["objectiveKgM2"]:
                F.need(u == [component for body in best["translations"] if body["id"] in model["columns"] for component in body["u"]])
        report = {"enumeratedMasks":512,"singularMasks":singular,"rejectedMasks":rejected,"qualifiedMasks":qualified,"counters":dict(r.counters)}
        if best is None:
            return {"referenceStatus":"INFEASIBLE","maskCrosscheck":report}
        best["maskCrosscheck"] = report
        best["counters"] = dict(r.counters)
        return best
    except F.ResourceError as error:
        return {"referenceStatus":error.status,"reason":error.reason,"counters":error.counters}
