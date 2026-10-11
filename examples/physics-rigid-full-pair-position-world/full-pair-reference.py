#!/usr/bin/env python3
"""Cold independent exact elastic LP and primal QP; no producer imports.

All36 inequalities remain in the problem. Exact Fraction arithmetic is guarded
before intermediate products/sums and after reduction. No native basis, lambda,
translation, warm seed, memo or floating pivot tolerance defines the optimum.
"""
from fractions import Fraction
import math

ZERO = Fraction(0)
ONE = Fraction(1)
INPUT_MESSAGE = "full-pair world reference request is invalid"


class InputError(ValueError):
    pass


class ResourceError(ValueError):
    def __init__(self,status,reason,counters):
        super().__init__(reason)
        self.status,self.reason,self.counters = status,reason,dict(counters)


def need(value):
    if not value:
        raise InputError(INPUT_MESSAGE)


def finite(value):
    need(type(value) in (int,float))
    try:
        result = float(value)
    except OverflowError:
        raise InputError(INPUT_MESSAGE) from None
    need(math.isfinite(result))
    return result


def keys(value,names):
    need(type(value) is dict and set(value) == set(names))


def rational(value):
    return str(value.numerator)+"/"+str(value.denominator)


def parse_rational(value):
    need(type(value) is str and "/" in value)
    parts = value.split("/");need(len(parts) == 2)
    try:
        numerator,denominator = int(parts[0]),int(parts[1])
    except ValueError:
        raise InputError(INPUT_MESSAGE) from None
    need(denominator > 0 and numerator.bit_length() <= 8192 and denominator.bit_length() <= 8192)
    result = Fraction(numerator,denominator)
    need(rational(result) == value)
    return result


class Arithmetic:
    def __init__(self):
        self.counters = {"lpPivots":0,"qpTransitions":0,"rankTests":0,"factorizations":0,"primalRowTests":0,"peakRationalBits":0}

    def fail(self,status,reason):
        raise ResourceError(status,reason,self.counters)

    def check(self,value):
        peak = max(value.numerator.bit_length(),value.denominator.bit_length())
        self.counters["peakRationalBits"] = max(self.counters["peakRationalBits"],peak)
        if peak > 8192:
            self.fail("REFERENCE_BIT_LIMIT","reducedRationalBits")
        return value

    def product_bound(self,a,b):
        if a and b and a.bit_length()+b.bit_length() > 16385:
            self.fail("REFERENCE_BIT_LIMIT","intermediateIntegerBits")

    def make(self,numerator,denominator):
        if denominator == 0:
            self.fail("REFERENCE_WORK_LIMIT","zero-divisor")
        if max(numerator.bit_length(),denominator.bit_length()) > 16385:
            self.fail("REFERENCE_BIT_LIMIT","intermediateIntegerBits")
        return self.check(Fraction(numerator,denominator))

    def binary(self,value):
        return self.check(Fraction.from_float(finite(value)))

    def add(self,a,b):
        if a == 0:
            return self.check(b)
        if b == 0:
            return self.check(a)
        self.product_bound(a.numerator,b.denominator);self.product_bound(b.numerator,a.denominator)
        self.product_bound(a.denominator,b.denominator)
        left_bits = a.numerator.bit_length()+b.denominator.bit_length()
        right_bits = b.numerator.bit_length()+a.denominator.bit_length()
        if max(left_bits,right_bits)+1 > 16385:
            self.fail("REFERENCE_BIT_LIMIT","intermediateIntegerBits")
        return self.make(a.numerator*b.denominator+b.numerator*a.denominator,a.denominator*b.denominator)

    def neg(self,a):
        return self.check(Fraction(-a.numerator,a.denominator))

    def sub(self,a,b):
        return self.add(a,self.neg(b))

    def mul(self,a,b):
        if not a or not b:
            return ZERO
        self.product_bound(a.numerator,b.numerator);self.product_bound(a.denominator,b.denominator)
        return self.make(a.numerator*b.numerator,a.denominator*b.denominator)

    def div(self,a,b):
        if not b:
            self.fail("REFERENCE_WORK_LIMIT","zero-divisor")
        if not a:
            return ZERO
        self.product_bound(a.numerator,b.denominator);self.product_bound(a.denominator,b.numerator)
        return self.make(a.numerator*b.denominator,a.denominator*b.numerator)

    def total(self,values):
        result = ZERO
        for value in values:
            result = self.add(result,value)
        return result

    def dot(self,a,b):
        return self.total(self.mul(x,y) for x,y in zip(a,b))

    def count(self,key):
        if key in ("lpPivots","qpTransitions") and self.counters[key] >= 4096:
            self.fail("REFERENCE_WORK_LIMIT",key)
        self.counters[key] += 1


def decode(problem,arithmetic,max_rows=36):
    keys(problem,("bodies","rows"))
    need(type(problem["bodies"]) is list and 1 <= len(problem["bodies"]) <= 9 and type(problem["rows"]) is list and len(problem["rows"]) <= max_rows)
    bodies = [];ids = set();columns = {};inverse = []
    for body in problem["bodies"]:
        keys(body,("id","inverseMass"));need(type(body["id"]) is str and body["id"] and body["id"] not in ids)
        ids.add(body["id"]);mass = finite(body["inverseMass"]);need(mass == 0 or 1e-6 <= mass <= 1e6)
        fraction = arithmetic.binary(mass)
        bodies.append({"id":body["id"],"inverseMass":fraction})
        if mass:
            columns[body["id"]] = len(inverse);inverse.extend([fraction]*3)
    a,b,rows = [],[],[]
    for row in problem["rows"]:
        keys(row,("aId","bId","normal","boundM"))
        need(type(row["aId"]) is str and type(row["bId"]) is str and row["aId"] in ids and row["bId"] in ids and row["aId"] != row["bId"])
        need(type(row["normal"]) is list and len(row["normal"]) == 3)
        normal = [finite(x) for x in row["normal"]];need(abs(math.hypot(*normal)-1) <= 1e-12)
        bound = finite(row["boundM"]);need(-10 <= bound <= 10)
        normal = [arithmetic.binary(x) for x in normal];bound = arithmetic.binary(bound)
        coefficients = [ZERO]*len(inverse)
        for name,sign in ((row["aId"],-1),(row["bId"],1)):
            if name in columns:
                for axis in range(3):
                    coefficients[columns[name]+axis] = arithmetic.neg(normal[axis]) if sign < 0 else normal[axis]
        a.append(coefficients);b.append(bound);rows.append({**row,"normal":tuple(normal),"boundM":bound})
    return {"bodies":bodies,"rows":rows,"a":a,"b":b,"inverse":inverse,"columns":columns,"d":len(inverse),"m":len(rows)}


def eliminate(matrix,rhs,r):
    """Independent first-nonzero exact elimination, never floating pivot policy."""
    r.count("factorizations")
    n = len(rhs)
    if not n:
        return []
    work = [list(row)+[value] for row,value in zip(matrix,rhs)]
    for column in range(n):
        pivot = next((i for i in range(column,n) if work[i][column] != 0),None)
        if pivot is None:
            r.fail("REFERENCE_WORK_LIMIT","dependent-equality-block")
        work[column],work[pivot] = work[pivot],work[column]
        for i in range(column+1,n):
            if not work[i][column]:
                continue
            factor = r.div(work[i][column],work[column][column])
            for j in range(column,n+1):
                work[i][j] = r.sub(work[i][j],r.mul(factor,work[column][j]))
    result = [ZERO]*n
    for i in range(n-1,-1,-1):
        tail = r.total(r.mul(work[i][j],result[j]) for j in range(i+1,n))
        result[i] = r.div(r.sub(work[i][n],tail),work[i][i])
    return result


def rank(rows,d,r):
    r.count("rankTests")
    work = [list(row) for row in rows];current = 0
    for column in range(d):
        pivot = next((i for i in range(current,len(work)) if work[i][column]),None)
        if pivot is None:
            continue
        work[current],work[pivot] = work[pivot],work[current]
        for i in range(current+1,len(work)):
            if work[i][column]:
                factor = r.div(work[i][column],work[current][column])
                for j in range(column,d):
                    work[i][j] = r.sub(work[i][j],r.mul(factor,work[current][j]))
        current += 1
        if current == len(work):
            break
    return current


def margins(model,u,r):
    result = []
    for row,bound in zip(model["a"],model["b"]):
        r.count("primalRowTests");result.append(r.sub(r.dot(row,u),bound))
    return result


def farkas(model,weights,r):
    need(len(weights) == model["m"])
    total = r.total(weights)
    if total <= 0:
        r.fail("REFERENCE_WORK_LIMIT","invalid-farkas-sum")
    weights = [r.div(x,total) for x in weights]
    dynamic_dot = [r.total(r.mul(weights[i],model["a"][i][j]) for i in range(model["m"])) for j in range(model["d"])]
    bound_dot = r.dot(weights,model["b"])
    if any(x < 0 for x in weights) or any(dynamic_dot) or bound_dot <= 0 or r.total(weights) != ONE:
        r.fail("REFERENCE_WORK_LIMIT","uncertified-infeasibility")
    return {"weights":[rational(x) for x in weights],"sumWeights":"1/1","dynamicDot":[rational(x) for x in dynamic_dot],"boundDotM":rational(bound_dot)}


def phase_one(model,r):
    d,m = model["d"],model["m"]
    if not m or max(model["b"]) <= 0:
        return [ZERO]*d,None
    t_id = 2*d;variables = 2*d+1+m
    k = next(i for i,x in enumerate(model["b"]) if x == max(model["b"]))
    source = [list(row)+[r.neg(x) for x in row]+[ONE]+[Fraction(-int(i == j)) for j in range(m)] for i,row in enumerate(model["a"])]
    table = []
    for i,row in enumerate(source):
        if i == k:
            table.append(row+[model["b"][i]])
        else:
            table.append([r.sub(x,y) for x,y in zip(source[k],row)]+[r.sub(model["b"][k],model["b"][i])])
    basis = [t_id if i == k else t_id+1+i for i in range(m)]
    while True:
        t_row = next((i for i,v in enumerate(basis) if v == t_id),None)
        objective = table[t_row][-1] if t_row is not None else ZERO
        if objective == 0:
            values = [ZERO]*variables
            for i,var in enumerate(basis):
                values[var] = table[i][-1]
            u = [r.sub(values[j],values[d+j]) for j in range(d)]
            if any(x < 0 for x in margins(model,u,r)):
                r.fail("REFERENCE_WORK_LIMIT","phase-I-feasibility")
            return u,None
        entering = None
        for j in range(variables):
            if j in basis:
                continue
            reduced = r.sub(ONE if j == t_id else ZERO,table[t_row][j] if t_row is not None else ZERO)
            if reduced < 0:
                entering = j;break
        if entering is None:
            weights = [r.neg(table[t_row][t_id+1+j]) for j in range(m)]
            return None,farkas(model,weights,r)
        possible = [(r.div(table[i][-1],table[i][entering]),basis[i],i) for i in range(m) if table[i][entering] > 0]
        if not possible:
            r.fail("REFERENCE_WORK_LIMIT","phase-I-unbounded")
        _,_,leaving = min(possible)
        r.count("lpPivots")
        pivot = table[leaving][entering]
        pivot_row = [r.div(x,pivot) for x in table[leaving]]
        new_table = []
        for i,row in enumerate(table):
            if i == leaving:
                new_table.append(pivot_row)
            else:
                factor = row[entering]
                new_table.append([r.sub(x,r.mul(factor,y)) for x,y in zip(row,pivot_row)])
        table = new_table;basis[leaving] = entering
        if any(row[-1] < 0 for row in table):
            r.fail("REFERENCE_WORK_LIMIT","phase-I-negative-basic")


def certificate(model,u,lam,r):
    full = margins(model,u,r)
    stationarity = [r.sub(r.div(u[j],model["inverse"][j]),r.total(r.mul(model["a"][i][j],lam[i]) for i in range(model["m"]))) for j in range(model["d"])]
    complementarity = [r.mul(x,y) for x,y in zip(lam,full)]
    if any(x < 0 for x in full) or any(x < 0 for x in lam) or any(stationarity) or any(complementarity):
        r.fail("REFERENCE_WORK_LIMIT","exact-KKT-failed")
    objective = r.div(r.total(r.div(r.mul(x,x),inverse) for x,inverse in zip(u,model["inverse"])),Fraction(2))
    return full,objective,{"primalViolationM":"0/1","negativeMultiplierKgM":"0/1","complementarityKgM2":"0/1","stationarityKgM":"0/1"}


def phase_two(model,u,r):
    a,b,d = model["a"],model["b"],model["d"]
    tight = [i for i,x in enumerate(margins(model,u,r)) if x == 0]
    working = []
    for i in tight:
        if rank([a[j] for j in working]+[a[i]],d,r) == len(working)+1:
            working.append(i)
    stationary_seen = set()
    h = [r.div(ONE,x) for x in model["inverse"]]
    while True:
        r.count("qpTransitions")
        if working:
            size = d+len(working)
            block = [[ZERO]*size for _ in range(size)]
            rhs = [r.neg(r.mul(h[j],u[j])) for j in range(d)]+[ZERO]*len(working)
            for j in range(d):
                block[j][j] = h[j]
            for i,row_id in enumerate(working):
                for j,value in enumerate(a[row_id]):
                    block[j][d+i] = r.neg(value);block[d+i][j] = value
            solved = eliminate(block,rhs,r);p,local_lambda = solved[:d],solved[d:]
        else:
            p,local_lambda = [r.neg(x) for x in u],[]
        if not any(p):
            negative = [row_id for row_id,value in zip(working,local_lambda) if value < 0]
            if not negative:
                lam = [ZERO]*model["m"]
                for row_id,value in zip(working,local_lambda):
                    lam[row_id] = value
                full,obj,cert = certificate(model,u,lam,r)
                return u,lam,full,obj,cert,working
            state = tuple(working)
            if state in stationary_seen:
                r.fail("REFERENCE_WORK_LIMIT","cycle")
            stationary_seen.add(state);working.remove(min(negative));working.sort()
            continue
        full = margins(model,u,r);blockers = []
        for i,row in enumerate(a):
            if i in working:
                continue
            direction = r.dot(row,p)
            if direction < 0:
                ratio = r.div(full[i],r.neg(direction))
                if ratio <= ONE:
                    blockers.append((ratio,i))
        alpha,blocker = min(blockers) if blockers else (ONE,None)
        if alpha < 0:
            r.fail("REFERENCE_WORK_LIMIT","negative-primal-step")
        u = [r.add(x,r.mul(alpha,y)) for x,y in zip(u,p)]
        if blocker is not None:
            if rank([a[i] for i in working]+[a[blocker]],d,r) != len(working)+1:
                r.fail("REFERENCE_WORK_LIMIT","dependent-blocker")
            working.append(blocker);working.sort()
        if any(x < 0 for x in margins(model,u,r)):
            r.fail("REFERENCE_WORK_LIMIT","primal-step-feasibility")


def solve_exact(problem):
    r = Arithmetic()
    try:
        model = decode(problem,r)
        if not model["m"]:
            u = [ZERO]*model["d"];lam = []
            return pack(model,u,lam,[],ZERO,{key:"0/1" for key in ("primalViolationM","negativeMultiplierKgM","complementarityKgM2","stationarityKgM")},[],r)
        u,witness = phase_one(model,r)
        if witness is not None:
            return {"referenceStatus":"INFEASIBLE","infeasibilityCertificate":witness,"dynamicDof":model["d"],"counters":dict(r.counters)}
        u,lam,full,obj,cert,working = phase_two(model,u,r)
        return pack(model,u,lam,full,obj,cert,working,r)
    except ResourceError as error:
        return {"referenceStatus":error.status,"reason":error.reason,"counters":error.counters}


def pack(model,u,lam,full,obj,cert,working,r):
    translations = []
    for body in model["bodies"]:
        if body["id"] in model["columns"]:
            base = model["columns"][body["id"]];value = u[base:base+3]
        else:
            value = [ZERO,ZERO,ZERO]
        translations.append({"id":body["id"],"u":value})
    return {"referenceStatus":"SOLVED","translations":translations,"lambdaKgM":lam,"primalMarginsM":full,"objectiveKgM2":obj,
        "certificateExact":cert,"basisRows":working,"basisRank":len(working),"dynamicDof":model["d"],"counters":dict(r.counters),
        "infeasibilityCertificate":None,"uniqueActiveSetClaimed":False,"arithmetic":"guarded exact Fraction; cold elastic LP then primal QP"}


def numeric(value):
    if isinstance(value,Fraction):
        try:
            result = float(value)
        except OverflowError:
            return None
        return result if math.isfinite(result) else None
    if type(value) is dict:
        return {key:numeric(item) for key,item in value.items()}
    if type(value) in (list,tuple):
        return [numeric(item) for item in value]
    return value


def exact_tree(value):
    if isinstance(value,Fraction):
        return rational(value)
    if type(value) is dict:
        return {key:exact_tree(item) for key,item in value.items()}
    if type(value) in (list,tuple):
        return [exact_tree(item) for item in value]
    return value


def published(result):
    out = numeric(result)
    if result["referenceStatus"] == "SOLVED":
        out.update(translationsExact=exact_tree(result["translations"]),lambdaExactKgM=exact_tree(result["lambdaKgM"]),
            primalMarginsExactM=exact_tree(result["primalMarginsM"]),objectiveExactKgM2=rational(result["objectiveKgM2"]))
    out["numericRepresentation"] = "null denotes finite exact rational outside Float64; exact fields remain authoritative"
    return out
