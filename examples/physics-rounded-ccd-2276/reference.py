#!/usr/bin/env python3
"""Independent finite-feature rounded-box sweep oracle. Python stdlib only."""
import argparse
import hashlib
import itertools
import json
import math
import struct
import sys
import time
from decimal import Context, Decimal, ROUND_CEILING, ROUND_FLOOR, localcontext
from fractions import Fraction as BaseFraction
from pathlib import Path

CAP = 2_000_000
COUNTS = {"fractionOperations": 0, "decimalOperations": 0,
          "integerSquareDetectionCalls": 0, "intervalSqrtConstructions": 0,
          "endpointDecimalSqrtOperations": 0, "featureCandidates": 0,
          "cases": 0}
START = time.monotonic()
FLAGS = {}
RADICALS = {}


def tick(key, count=1):
    COUNTS[key] += count
    limit = {"fractionOperations": CAP, "decimalOperations": CAP,
             "integerSquareDetectionCalls": 640, "intervalSqrtConstructions": 640,
             "endpointDecimalSqrtOperations": 1280, "featureCandidates": 736,
             "cases": 16}[key]
    if COUNTS[key] > limit:
        raise Failure("RESOURCE", key)
    if time.monotonic() - START > 170:
        raise Failure("RESOURCE", "170-second internal deadline")


class Failure(Exception):
    def __init__(self, gate, detail):
        self.gate, self.detail = gate, str(detail)
        super().__init__(f"{gate}: {detail}")


class F(BaseFraction):
    """Count scalar arithmetic, comparisons and conversions; bound integer size."""
    def __new__(cls, numerator=0, denominator=None):
        tick("fractionOperations")
        result = super().__new__(cls, numerator, denominator)
        if max(result.numerator.bit_length(), result.denominator.bit_length()) > 4096:
            raise Failure("RESOURCE", "Fraction integer exceeds 4096 bits")
        return result

    def _op(self, name, other):
        tick("fractionOperations")
        result = getattr(super(), name)(other)
        return F(result) if isinstance(result, BaseFraction) else result

    def __add__(self, x): return self._op("__add__", x)
    def __radd__(self, x): return self + x
    def __sub__(self, x): return self._op("__sub__", x)
    def __rsub__(self, x): return F(x) - self
    def __mul__(self, x): return self._op("__mul__", x)
    def __rmul__(self, x): return self * x
    def __truediv__(self, x): return self._op("__truediv__", x)
    def __rtruediv__(self, x): return F(x) / self
    def __neg__(self): return F(-self.numerator, self.denominator)
    def __abs__(self): return F(abs(self.numerator), self.denominator)
    def __pow__(self, x): return self._op("__pow__", x)
    def __lt__(self, x): return self._op("__lt__", x)
    def __le__(self, x): return self._op("__le__", x)
    def __gt__(self, x): return self._op("__gt__", x)
    def __ge__(self, x): return self._op("__ge__", x)
    def __eq__(self, x): return self._op("__eq__", x)
    __hash__ = BaseFraction.__hash__


def sign(x):
    return 1 if x > 0 else -1 if x < 0 else 0


def raw_float(value):
    if not isinstance(value, dict) or set(value) != {"$f64le"}:
        raise Failure("SCHEMA", "expected one raw $f64le scalar")
    word = value["$f64le"]
    if not isinstance(word, str) or len(word) != 16:
        raise Failure("SCHEMA", "invalid f64 word")
    try:
        number = struct.unpack("<d", bytes.fromhex(word))[0]
    except (ValueError, struct.error) as error:
        raise Failure("SCHEMA", error) from error
    if not math.isfinite(number):
        raise Failure("FINITE", word)
    return number


def scalar(value):
    return F(raw_float(value))


def vector(value):
    if not isinstance(value, list) or len(value) != 3:
        raise Failure("SCHEMA", "expected three-vector")
    return [scalar(x) for x in value]


def encoded_f(value):
    return [hex(value.numerator), hex(value.denominator)]


def decoded_f(value):
    return F(int(value[0], 16), int(value[1], 16))


def decimal_f(value, precision, rounding):
    tick("decimalOperations", 3)
    with localcontext(Context(prec=precision, rounding=rounding,
                              Emin=-999999, Emax=999999)) as ctx:
        result = Decimal(value.numerator) / Decimal(value.denominator)
        record_flags(ctx, precision)
        return result


def record_flags(ctx, precision):
    FLAGS.setdefault(str(precision), set()).update(
        flag.__name__ for flag, raised in ctx.flags.items() if raised)


def sqrt_bounds(value, precision):
    cached = RADICALS.setdefault(value, {})
    if precision in cached:
        return cached[precision]
    tick("intervalSqrtConstructions")
    result = []
    for rounding, direction in ((ROUND_FLOOR, -1), (ROUND_CEILING, 1)):
        arg = decimal_f(value, precision, rounding)
        with localcontext(Context(prec=precision, rounding=rounding,
                                  Emin=-999999, Emax=999999)) as ctx:
            tick("endpointDecimalSqrtOperations")
            tick("decimalOperations", 2)
            # Decimal sqrt is correctly rounded to nearest, irrespective of mode.
            # One adjacent representable value brackets that rounded result.
            near = arg.sqrt()
            endpoint = near.next_minus() if direction < 0 else near.next_plus()
            record_flags(ctx, precision)
        result.append(F(endpoint))
    if result[0] < 0 or result[0] ** 2 > value or result[1] ** 2 < value:
        raise Failure("ENCLOSURE", "directed sqrt square check")
    cached[precision] = result
    return result


class Root:
    def __init__(self, a, b, c, branch=0, rational=None, radical=None):
        self.a, self.b, self.c = a, b, c
        self.branch, self.rational, self.radical = branch, rational, radical
        self.intervals = {}

    def linear_sign(self, p, q):
        """Exact sign of p+q*t, including equality at patch boundaries."""
        if self.rational is not None:
            return sign(p + q * self.rational)
        u, v = 2 * self.a * p - q * self.b, q * self.branch
        if not v:
            return sign(u)
        if not u or sign(u) == sign(v):
            return sign(v)
        comparison = sign(u ** 2 - v ** 2 * self.radical)
        return sign(u) * comparison

    def same(self, other):
        if self.rational is not None or other.rational is not None:
            return (self.rational is not None and other.rational is not None
                    and self.rational == other.rational)
        return (self.branch == other.branch and self.a * other.b == other.a * self.b
                and self.a * other.c == other.a * self.c)

    def enclosure(self, precision):
        if precision not in self.intervals:
            if self.rational is not None:
                bounds = [self.rational, self.rational]
            else:
                # Both roots of the same quadratic reuse these certificates.
                coarse = sqrt_bounds(self.radical, 80)
                fine = sqrt_bounds(self.radical, 120)
                if not coarse[0] <= fine[0] <= fine[1] <= coarse[1]:
                    raise Failure("ENCLOSURE", "sqrt nesting")
                lo, hi = sqrt_bounds(self.radical, precision)
                if self.branch < 0:
                    lo, hi = -hi, -lo
                bounds = [(-self.b + lo) / (2 * self.a),
                          (-self.b + hi) / (2 * self.a)]
            result = [decimal_f(bounds[0], precision, ROUND_FLOOR),
                      decimal_f(bounds[1], precision, ROUND_CEILING)]
            width = F(result[1]) - F(result[0])
            if width > F(1, 10 ** (precision - 15)):
                raise Failure("ENCLOSURE", "root width")
            self.intervals[precision] = result
        return self.intervals[precision]

    def proof(self):
        coarse, fine = self.enclosure(80), self.enclosure(120)
        if not (F(coarse[0]) <= F(fine[0]) <= F(fine[1]) <= F(coarse[1])):
            raise Failure("ENCLOSURE", "120-digit enclosure not inside 80")
        return {"polynomial": [encoded_f(x) for x in (self.a, self.b, self.c)],
                "branch": self.branch,
                "rational": encoded_f(self.rational) if self.rational is not None else None,
                "t80": [str(x) for x in coarse], "t120": [str(x) for x in fine]}


def polynomial_roots(a, b, c):
    if not a:
        if not b:
            return [], "IDENTITY" if not c else "CONSTANT_NONZERO"
        return [Root(a, b, c, rational=-c / b)], "LINEAR"
    if a < 0:
        a, b, c = -a, -b, -c
    discriminant = b ** 2 - 4 * a * c
    if discriminant < 0:
        return [], "NEGATIVE_DISCRIMINANT"
    tick("integerSquareDetectionCalls", 2)
    n, d = math.isqrt(discriminant.numerator), math.isqrt(discriminant.denominator)
    if n * n == discriminant.numerator and d * d == discriminant.denominator:
        s = F(n, d)
        values = [(-b - s) / (2 * a)]
        if s:
            values.append((-b + s) / (2 * a))
        return [Root(a, b, c, rational=x) for x in values], "RATIONAL"
    return [Root(a, b, c, k, radical=discriminant) for k in (-1, 1)], "IRRATIONAL"


def geometry(case):
    start, end, half = (vector(case[k]) for k in ("start", "end", "half"))
    radius = scalar(case["radius"])
    if radius <= 0 or any(x <= 0 for x in half):
        raise Failure("SCHEMA", "positive radius and half extents required")
    return start, end, half, radius


def reference(case):
    RADICALS.clear()
    tick("cases")
    start, end, half, radius = geometry(case)
    velocity = [end[i] - start[i] for i in range(3)]
    gaps = [max(abs(start[i]) - half[i], F(0)) for i in range(3)]
    initial = sum((x ** 2 for x in gaps), F(0))
    base = {"id": case["id"], "inputSha256": digest(case),
            "initialDistanceSquared": encoded_f(initial), "ledger": []}
    if initial <= radius ** 2:
        base["classification"] = "INITIAL_DISCRETE_OWNED"
        return base
    candidates = []
    # A feature is a nonempty subset of fixed coordinates and their signs.
    # Sizes 1, 2, 3 give 6 face patches, 12 edge cylinders, 8 vertex spheres.
    for size in (1, 2, 3):
        for axes in itertools.combinations(range(3), size):
            for signs in itertools.product((-1, 1), repeat=size):
                fixed = dict(zip(axes, signs))
                feature = ",".join(f"{i}:{fixed[i]:+}" for i in axes)
                constraints = []
                for i in range(3):
                    if i in fixed:
                        constraints.append((fixed[i] * start[i] - half[i],
                                            fixed[i] * velocity[i]))
                    else:
                        constraints.extend(((half[i] - start[i], -velocity[i]),
                                            (half[i] + start[i], velocity[i])))
                if size == 1:
                    i = axes[0]
                    a, b = F(0), velocity[i]
                    c = start[i] - fixed[i] * (half[i] + radius)
                else:
                    offsets = [start[i] - fixed[i] * half[i] for i in axes]
                    a = sum((velocity[i] ** 2 for i in axes), F(0))
                    b = 2 * sum((offsets[k] * velocity[i]
                                 for k, i in enumerate(axes)), F(0))
                    c = sum((x ** 2 for x in offsets), F(0)) - radius ** 2
                roots, kind = polynomial_roots(a, b, c)
                if kind == "IDENTITY":
                    # Contact plateau: intersect all linear patch restrictions
                    # exactly. Its first closed feasible point is a rational root.
                    lo, hi = F(0), F(1)
                    for p, q in constraints:
                        if q > 0: lo = max(lo, -p / q)
                        elif q < 0: hi = min(hi, -p / q)
                        elif p < 0: hi = F(-1)
                    if lo <= hi:
                        roots = [Root(a, b, c, rational=lo)]
                if not roots:
                    base["ledger"].append([feature, kind])
                for index, root in enumerate(roots):
                    tick("featureCandidates")
                    tests = [(F(0), F(1)), (F(1), F(-1))] + constraints
                    rejected = next((j for j, (p, q) in enumerate(tests)
                                     if root.linear_sign(p, q) < 0), None)
                    row = [feature, index, "VALID" if rejected is None else "REJECT", rejected]
                    base["ledger"].append(row)
                    if rejected is None:
                        candidates.append((root, feature, row))
    if not candidates:
        base["classification"] = "MISS"
        return base
    selected = candidates[0]
    ordering = []
    for contender in candidates[1:]:
        root, previous = contender[0], selected[0]
        if root.same(previous):
            contender[2][2] = "EXACT_DUPLICATE"
            ordering.append([contender[1], contender[2][1], selected[1], selected[2][1], 0, "EXACT_IDENTITY"])
            continue
        if root.rational is not None:
            order = -previous.linear_sign(-root.rational, F(1))
        elif previous.rational is not None:
            order = root.linear_sign(-previous.rational, F(1))
        else:
            rl, rh = map(F, root.enclosure(120))
            pl, ph = map(F, previous.enclosure(120))
            order = -1 if rh < pl else 1 if ph < rl else 0
            if not order:
                raise Failure("UNRESOLVED", "nonidentical irrational root intervals overlap")
        ordering.append([contender[1], contender[2][1], selected[1], selected[2][1], order,
                         "EXACT_RATIONAL_SIGN" if root.rational is not None or previous.rational is not None else "DISJOINT_120"])
        if order < 0:
            selected = contender
    root, feature, row = selected
    proof = root.proof()
    normals = {}
    for precision in (80, 120):
        tlo, thi = map(F, root.enclosure(precision))
        bounds = []
        for i in range(3):
            side = (1 if root.linear_sign(start[i] - half[i], velocity[i]) > 0 else
                    -1 if root.linear_sign(-start[i] - half[i], -velocity[i]) > 0 else 0)
            if not side:
                lo = hi = F(0)
            else:
                ends = [(start[i] + velocity[i] * t - side * half[i]) / radius
                        for t in (tlo, thi)]
                lo, hi = min(ends), max(ends)
            pair = [decimal_f(lo, precision, ROUND_FLOOR),
                    decimal_f(hi, precision, ROUND_CEILING)]
            if F(pair[1]) - F(pair[0]) > F(1, 10 ** (precision - 15)):
                raise Failure("ENCLOSURE", "normal width")
            bounds.append([str(x) for x in pair])
        normals[str(precision)] = bounds
    for coarse, fine in zip(normals["80"], normals["120"]):
        if not F(Decimal(coarse[0])) <= F(Decimal(fine[0])) <= F(Decimal(fine[1])) <= F(Decimal(coarse[1])):
            raise Failure("ENCLOSURE", "normal nesting")
    base.update(classification="HIT", feature=feature, selected=proof, normal=normals,
                ordering=ordering,
                radicals=[{"value": encoded_f(value),
                           "sqrt80": [encoded_f(x) for x in bounds[80]],
                           "sqrt120": [encoded_f(x) for x in bounds[120]]}
                          for value, bounds in RADICALS.items()],
                earliestPolicy="all feature roots exact-domain filtered; rational ordering exact; irrational disjoint or exact proportional duplicate")
    return base


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def owned_size(value, seen=None):
    """Logical Python-owned live DATA, including integer payloads and containers."""
    seen = set() if seen is None else seen
    if id(value) in seen: return 0
    seen.add(id(value))
    total = sys.getsizeof(value)
    if isinstance(value, dict):
        total += sum(owned_size(k, seen) + owned_size(v, seen) for k, v in value.items())
    elif isinstance(value, (list, tuple, set)):
        total += sum(owned_size(v, seen) for v in value)
    elif isinstance(value, BaseFraction):
        total += owned_size(value.numerator, seen) + owned_size(value.denominator, seen)
    return total


def load(path, maximum=1048576):
    if Path(path).stat().st_size > maximum:
        raise Failure("RESOURCE", "input byte cap")
    return json.loads(Path(path).read_text())


def write(path, value, maximum=1048576):
    output = json.dumps(value, separators=(",", ":"), sort_keys=True) + "\n"
    if len(output.encode()) > maximum:
        raise Failure("RESOURCE", "output byte cap")
    if owned_size(value) + sys.getsizeof(output) + 2 * 1048576 > 8388608:
        raise Failure("RESOURCE", "logical live DATA plus scratch reserve")
    Path(path).write_text(output)


def audit(observed, bank):
    expected = bank["cases"]
    records = observed.get("cases", [])
    if len(records) != len(expected) or len(records) > 16:
        raise Failure("SCHEMA", "observed/bank population")
    results = []
    tolerance = F(1, 10 ** 12)
    for actual, ref in zip(records, expected):
        point = actual.get("id", "MISSING_ID")
        try:
            if actual.get("id") != ref["id"]:
                raise Failure("ORDER", "case identifier")
            canonical = {k: actual[k] for k in ("id", "start", "end", "half", "radius")}
            if digest(canonical) != ref["geometrySha256"]:
                raise Failure("INPUT", "geometry words differ from bank")
            hit = actual.get("hit")
            wanted = ref["classification"]
            if actual.get("classification", wanted if hit is None else "HIT") != wanted:
                raise Failure("CLASSIFICATION", wanted)
            if (hit is not None) != (wanted == "HIT"):
                raise Failure("CLASSIFICATION", wanted)
            if hit is not None:
                t = scalar(hit["fraction"])
                if not 0 <= t <= 1:
                    raise Failure("DOMAIN", "strict native fraction outside [0,1]")
                for endpoint in ref["selected"]["t120"]:
                    if abs(t - F(Decimal(endpoint))) > tolerance:
                        raise Failure("TOI", "absolute error exceeds 1e-12")
                start, end, half, radius = geometry(actual)
                if "unbiasedCenterLocal" in actual:
                    center = vector(actual["unbiasedCenterLocal"])
                else:
                    # Reproduce the explicitly frozen separate binary64 ops.
                    native_t = raw_float(hit["fraction"])
                    center = [F(raw_float(actual["start"][i]) +
                                (raw_float(actual["end"][i]) - raw_float(actual["start"][i])) * native_t)
                              for i in range(3)]
                distance = sum((max(abs(center[i]) - half[i], F(0)) ** 2 for i in range(3)), F(0))
                if distance > (radius + tolerance) ** 2:
                    raise Failure("WITNESS", "unbiased native center exceeds r+1e-12m")
                normal = vector(hit["normalLocal"])
                axis_reference = [tuple(F(Decimal(x)) for x in pair)
                                  for pair in ref["normal"]["120"]]
                axial = all(lo == hi for lo, hi in axis_reference) and any(
                    abs(lo) == 1 for lo, hi in axis_reference)
                if abs(sum((n ** 2 for n in normal), F(0)) - 1) > tolerance:
                    raise Failure("NORMAL_NORM", "squared norm error exceeds 1e-12")
                for i, n in enumerate(normal):
                    lo, hi = map(lambda x: F(Decimal(x)), ref["normal"]["120"][i])
                    if any(abs(n - endpoint) > tolerance for endpoint in (lo, hi)):
                        raise Failure("NORMAL_COMPONENT", f"component {i}")
                    if (lo > 0 and n < 0) or (hi < 0 and n > 0):
                        raise Failure("NORMAL_OUTWARD", f"component {i}")
                    if lo == hi and abs(lo) == 1 and n != lo:
                        raise Failure("NORMAL_AXIS", f"component {i} must be exact")
                    if axial and n != lo:
                        raise Failure("NORMAL_AXIS", f"axial component {i} must be exact")
                results.append({"id": point, "status": "PASS", "classification": wanted,
                                "distanceSquared": encoded_f(distance)})
            else:
                results.append({"id": point, "status": "PASS", "classification": wanted})
        except Failure as error:
            return {"status": "FAIL", "firstFailedPoint": point, "gate": error.gate,
                    "detail": error.detail, "cases": results}
    return {"status": "PASS", "cases": results}


def build_bank(data):
    cases = data["cases"]
    if len(cases) != 16:
        raise Failure("SCHEMA", "frozen bank requires exactly 16 cases")
    proofs = []
    for case in cases:
        try:
            certificate = reference(case)
            if certificate["classification"] != case["expectedClass"]:
                raise Failure("CLASSIFICATION", "frozen expected class differs")
            certificate["geometrySha256"] = digest({k: case[k] for k in
                ("id", "start", "end", "half", "radius")})
            encoded = json.dumps(certificate, separators=(",", ":"))
            if len(encoded.encode()) > 32768:
                raise Failure("RESOURCE", "per-case proof exceeds 32768 bytes")
            proofs.append(certificate)
            if owned_size((data, proofs, certificate, encoded)) + 2 * 1048576 > 8388608:
                raise Failure("RESOURCE", "logical live roots plus scratch reserve")
        except Failure as error:
            error.point = case["id"]
            error.detail = case["id"] + ": " + error.detail
            raise
    return {"status": "PASS", "schema": "rounded-box-feature-bank-v1", "cases": proofs,
            "inputSha256": digest(data)}


def contexts():
    return {"precisions": [80, 120], "Emin": -999999, "Emax": 999999,
            "clamp": 0, "capitals": 1,
            "traps": ["InvalidOperation", "DivisionByZero", "Overflow"],
            "rootRounding": ["ROUND_FLOOR", "ROUND_CEILING"],
            "sqrtRounding": "nearest then adjacent endpoint; exact squared validation",
            "flags": {k: sorted(v) for k, v in FLAGS.items()}}


def emit(value):
    value["counts"] = dict(COUNTS)
    output = json.dumps(value, separators=(",", ":"), sort_keys=True)
    if len(output.encode()) > 8192:
        raise Failure("RESOURCE", "server response exceeds 8192 bytes")
    sys.stdout.write(output + "\n")
    sys.stdout.flush()


def serve(data, bank_path):
    if Path(bank_path).exists():
        raise Failure("OWNERSHIP", "server bank path must be fresh")
    bank = build_bank(data)
    bank["counts"], bank["contexts"] = dict(COUNTS), contexts()
    write(bank_path, bank)
    emit({"status": "READY_BANK", "caseCount": 16, "bankSha256": digest(bank),
          "contexts": contexts()})
    accepted = 0
    while True:
        line = sys.stdin.buffer.readline(8194)
        if not line:
            if accepted != 32:
                emit({"status": "FAIL_CASE", "firstFailedPoint": "EOF",
                      "gate": "POPULATION", "detail": "expected 16 source and 16 native accepted cases",
                      "accepted": accepted})
                return 1
            return 0
        if len(line) > 8192 or not line.endswith(b"\n"):
            raise Failure("RESOURCE", "server input line exceeds 8192 bytes or lacks newline")
        if accepted >= 32:
            raise Failure("POPULATION", "more than 32 candidate audits")
        request = json.loads(line)
        actual = request["case"]
        ref = bank["cases"][accepted % 16]
        report = audit({"cases": [actual]}, {"cases": [ref]})
        if owned_size((data, bank, request, actual, report, line)) + 2 * 1048576 > 8388608:
            raise Failure("RESOURCE", "server logical live DATA plus scratch reserve")
        if report["status"] != "PASS":
            report["status"] = "FAIL_CASE"
            emit(report)
            return 1
        accepted += 1
        emit({"status": "PASS_CASE", "id": actual["id"], "accepted": accepted,
              "classification": ref["classification"], "audit": report["cases"][0]})
        del request, actual, report, line


def main():
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--build-bank", action="store_true")
    mode.add_argument("--audit", action="store_true")
    mode.add_argument("--serve", action="store_true")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    parser.add_argument("--bank")
    args = parser.parse_args()
    point = "INPUT"
    try:
        data = load(args.input)
        if args.serve:
            if not args.bank:
                raise Failure("SCHEMA", "--bank is required for --serve")
            return serve(data, args.bank)
        if not args.output:
            raise Failure("SCHEMA", "--output is required outside --serve")
        if args.build_bank:
            result = build_bank(data)
        else:
            if not args.bank:
                raise Failure("SCHEMA", "--bank is required for --audit")
            bank = load(args.bank)
            if bank.get("status") != "PASS":
                raise Failure("SCHEMA", "bank has no PASS")
            result = audit(data, bank)
        result["counts"] = COUNTS
        result["contexts"] = contexts()
        write(args.output, result)
        return 0 if result["status"] == "PASS" else 1
    except (Failure, KeyError, ValueError, TypeError) as error:
        result = {"status": "FAIL", "firstFailedPoint": getattr(error, "point", point),
                  "gate": error.gate if isinstance(error, Failure) else "SCHEMA",
                  "detail": str(error), "counts": COUNTS}
        if args.serve:
            result["status"] = "FAIL_CASE"
            emit(result)
        elif args.output:
            write(args.output, result, 16384)
        return 1


if __name__ == "__main__":
    sys.exit(main())
