#!/usr/bin/env python3
"""Independent exact Fraction oracle for bounded mass-weighted translations.

Translation/signed-bound/primal units: m. Inverse mass: 1/kg. Multipliers: kg*m,
not impulses. Objective/complementarity: kg*m^2. Static translations are zero.
The caller owns the 10 m translated-correction guard and nonlinear geometry.
"""

from fractions import Fraction
import json
import math
import sys


ZERO = Fraction(0)
UNIT_TOLERANCE = Fraction.from_float(1e-12)
MIN_INVERSE_MASS = Fraction.from_float(1e-6)
MAX_INVERSE_MASS = Fraction.from_float(1e6)


class ReferenceError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def require(condition, message, code="INVALID_INPUT"):
    if not condition:
        raise ReferenceError(code, message)


def binary_fraction(value, message):
    require(type(value) in (int, float), message)
    try:
        original = float(value)
    except (OverflowError, ValueError) as error:
        raise ReferenceError("INVALID_INPUT", message) from error
    require(math.isfinite(original), message)
    return Fraction.from_float(original)


def validate_problem(problem):
    # Strict owned admission only; the Fraction kernel below remains unchanged.
    invalid = "signed position reference input is invalid"
    require(type(problem) is dict and set(problem) == {"bodies", "rows"}
            and type(problem["bodies"]) is list and type(problem["rows"]) is list, invalid)
    require(len(problem["bodies"]) <= 9 and len(problem["rows"]) <= 8,
            "signed position reference admits at most nine bodies and eight rows", "PROFILE_LIMIT")
    require(len(problem["bodies"]) > 0, "signed position reference requires at least one body")
    bodies, ids = [], set()
    for body in problem["bodies"]:
        require(type(body) is dict and set(body) == {"id", "inverseMass"}, invalid)
        require(type(body["id"]) is str and body["id"] and body["id"] not in ids,
                "signed position reference body IDs must be nonempty and unique")
        ids.add(body["id"])
        mass = binary_fraction(body["inverseMass"], "signed position reference inverse mass is invalid")
        require(mass == ZERO or MIN_INVERSE_MASS <= mass <= MAX_INVERSE_MASS,
                "signed position reference inverse mass is invalid")
        bodies.append({"id": body["id"], "inverseMass": mass})
    rows = []
    for row in problem["rows"]:
        require(type(row) is dict and set(row) == {"aId", "bId", "normal", "boundM"}, invalid)
        require(type(row["aId"]) is str and type(row["bId"]) is str
                and row["aId"] in ids and row["bId"] in ids and row["aId"] != row["bId"],
                "signed position reference row endpoints are invalid")
        normal = row.get("normal")
        message = "signed position reference normal must be finite and unit length"
        require(type(normal) is list and len(normal) == 3, message)
        normal = tuple(binary_fraction(value, message) for value in normal)
        require(abs(math.hypot(*(float(value) for value in normal))-1) <= 1e-12, message)
        message = "signed position reference bound must be finite and between minus ten and ten metres"
        bound = binary_fraction(row["boundM"], message)
        require(Fraction(-10) <= bound <= Fraction(10), message)
        rows.append({"aId": row["aId"], "bId": row["bId"], "normal": normal, "boundM": bound})
    return bodies, rows


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), ZERO)


def signed_incidence(rows):
    return [{row["aId"]: tuple(-value for value in row["normal"]), row["bId"]: row["normal"]} for row in rows]


def gram_matrix(bodies, incidence):
    zero_vector = (ZERO, ZERO, ZERO)
    return [[sum((body["inverseMass"] * dot(first.get(body["id"], zero_vector), second.get(body["id"], zero_vector))
                  for body in bodies), ZERO) for second in incidence] for first in incidence]


def eliminate(matrix, rhs):
    """Exact Gauss-Jordan, first nonzero row; no Float64 pivot threshold."""
    n = len(rhs)
    augmented = [list(row)+[value] for row, value in zip(matrix, rhs)]
    pivots = []
    next_row = 0
    for column in range(n):
        pivot = next((row for row in range(next_row, n) if augmented[row][column] != ZERO), None)
        if pivot is None:
            continue
        augmented[next_row], augmented[pivot] = augmented[pivot], augmented[next_row]
        divisor = augmented[next_row][column]
        augmented[next_row] = [value/divisor for value in augmented[next_row]]
        for row in range(n):
            if row == next_row:
                continue
            multiplier = augmented[row][column]
            if multiplier != ZERO:
                augmented[row] = [value-multiplier*source for value, source in zip(augmented[row], augmented[next_row])]
        pivots.append(column)
        next_row += 1
    inconsistent = any(all(value == ZERO for value in row[:n]) and row[n] != ZERO for row in augmented)
    diagnostic = {"rank": len(pivots), "augmentedRank": len(pivots)+(1 if inconsistent else 0),
                  "consistent": not inconsistent, "pivotColumns": pivots,
                  "zeroPivotColumns": [column for column in range(n) if column not in pivots],
                  "reducedAugmented": augmented}
    if len(pivots) != n:
        return None, diagnostic
    return [augmented[row][n] for row in range(n)], diagnostic


def candidate(bodies, rows, incidence, gram, multipliers, active_mask):
    zero_vector = (ZERO, ZERO, ZERO)
    translations = []
    for body in bodies:
        correction = tuple(body["inverseMass"] * sum((value*row.get(body["id"], zero_vector)[axis]
                           for value, row in zip(multipliers, incidence)), ZERO) for axis in range(3))
        translations.append(correction)
    primal = [sum((dot(row.get(body["id"], zero_vector), correction) for body, correction in zip(bodies, translations)), ZERO)-source["boundM"]
              for row, source in zip(incidence, rows)]
    if any(value < ZERO for value in multipliers) or any(value < ZERO for value in primal):
        return None
    objective = sum((dot(correction, correction)/body["inverseMass"]/2
                     for body, correction in zip(bodies, translations) if body["inverseMass"] > ZERO), ZERO)
    certificate = {"primalViolationM": max([ZERO]+[-value for value in primal]),
                   "negativeMultiplierKgM": max([ZERO]+[-value for value in multipliers]),
                   "complementarityKgM2": max([ZERO]+[abs(value*margin) for value, margin in zip(multipliers, primal)])}
    stationarity = ZERO
    for body, correction in zip(bodies, translations):
        if body["inverseMass"] == ZERO:
            continue
        gradient = tuple(sum((value*row.get(body["id"], zero_vector)[axis] for value, row in zip(multipliers, incidence)), ZERO)
                         for axis in range(3))
        stationarity = max(stationarity, max(abs(correction[axis]/body["inverseMass"]-gradient[axis]) for axis in range(3)))
    gram_primal = [sum((entry*value for entry, value in zip(row, multipliers)), ZERO)-source["boundM"]
                   for row, source in zip(gram, rows)]
    consistency_error = max([ZERO]+[abs(first-second) for first, second in zip(primal, gram_primal)])
    return {"activeMask": active_mask, "active": [i for i in range(len(rows)) if active_mask & (1 << i)],
            "translations": translations, "lambdaKgM": multipliers, "primalMarginsM": primal,
            "objectiveKgM2": objective, "certificate": certificate,
            "stationarityResidualKgM": stationarity, "gramPrimalConsistencyM": consistency_error}


def solve_exact(problem):
    bodies, rows = validate_problem(problem)
    incidence = signed_incidence(rows)
    gram = gram_matrix(bodies, incidence)
    best, singular, infeasible_masks, feasible_masks = None, [], 0, 0
    for mask in range(1 << len(rows)):
        active = [i for i in range(len(rows)) if mask & (1 << i)]
        matrix = [[gram[i][j] for j in active] for i in active]
        values, diagnostic = eliminate(matrix, [rows[i]["boundM"] for i in active])
        if values is None:
            singular.append({"mask": mask, "active": active, **diagnostic})
            continue
        multipliers = [ZERO] * len(rows)
        for index, value in zip(active, values):
            multipliers[index] = value
        trial = candidate(bodies, rows, incidence, gram, multipliers, mask)
        if trial is None:
            infeasible_masks += 1
            continue
        feasible_masks += 1
        # Exact equality retains the first ascending mask. No objective epsilon.
        if best is None or trial["objectiveKgM2"] < best["objectiveKgM2"]:
            best = trial
    return {"bodies": bodies, "best": best, "gram": gram, "singular": singular,
            "enumeratedMasks": 1 << len(rows), "infeasibleMasks": infeasible_masks, "feasibleMasks": feasible_masks}


def rational(value):
    return f"{value.numerator}/{value.denominator}"


def numeric_tree(value, exact=False):
    if isinstance(value, Fraction):
        if exact:
            return rational(value)
        try:
            number = float(value)
        except OverflowError:
            return None
        return number if math.isfinite(number) else None
    if isinstance(value, dict):
        return {key: numeric_tree(item, exact) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [numeric_tree(item, exact) for item in value]
    return value


def evaluate(problem):
    try:
        solved = solve_exact(problem)
    except ReferenceError as error:
        return {"ok": False, "status": error.code, "code": error.code, "error": str(error), "message": str(error)}
    common = {"gram": numeric_tree(solved["gram"]), "gramExact": numeric_tree(solved["gram"], True),
              "singularMasks": [item["mask"] for item in solved["singular"]],
              "singularMaskDiagnostics": numeric_tree(solved["singular"], True),
              "infeasibleMasks": solved["infeasibleMasks"], "feasibleMasks": solved["feasibleMasks"],
              "enumeratedMasks": solved["enumeratedMasks"], "worldStepped": False}
    best = solved["best"]
    if best is None:
        return {"ok": False, "status": "INFEASIBLE", "code": "INFEASIBLE",
                "error": "exact frozen rows are infeasible", **common}
    numeric = numeric_tree(best)
    translations = [{"id": body["id"], "u": numeric_tree(correction)} for body, correction in zip(solved["bodies"], best["translations"])]
    exact_translations = [{"id": body["id"], "u": numeric_tree(correction, True)} for body, correction in zip(solved["bodies"], best["translations"])]
    return {"ok": True, "status": "SOLVED", **common,
            "activeMask": best["activeMask"], "active": best["active"], "translations": translations,
            "translationsExact": exact_translations,
            "lambdaKgM": numeric["lambdaKgM"], "lambdaExactKgM": numeric_tree(best["lambdaKgM"], True),
            "primalMarginsM": numeric["primalMarginsM"], "primalMarginsExactM": numeric_tree(best["primalMarginsM"], True),
            "objectiveKgM2": numeric["objectiveKgM2"], "objectiveExactKgM2": rational(best["objectiveKgM2"]),
            "certificate": numeric["certificate"], "certificateExact": numeric_tree(best["certificate"], True),
            "stationarityResidualKgM": numeric["stationarityResidualKgM"],
            "stationarityResidualExactKgM": rational(best["stationarityResidualKgM"]),
            "gramPrimalConsistencyM": numeric["gramPrimalConsistencyM"],
            "numericRepresentation": "null only if a finite exact rational exceeds Float64 range; exact field remains authoritative",
            "units": {"translations": "m", "lambda": "kg*m", "primal": "m", "objective": "kg*m^2"}}


def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            problem = json.loads(line)
        except json.JSONDecodeError:
            response = {"ok": False, "status": "INVALID_INPUT", "code": "INVALID_INPUT", "error": "input line is not valid JSON"}
        else:
            response = evaluate(problem)
        print(json.dumps(response, allow_nan=False, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
