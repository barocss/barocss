#!/usr/bin/env python3
"""Pure Decimal kinematics for recorded, held contact rows.

Coordinates and arms are metres. Angular velocity is rad/s. Relative velocity
and residuals are m/s. Functions use the caller's Decimal context. Recorded
normals are never normalized or repaired. Body positions are validated, but a
held row uses its stored arms until the caller explicitly constructs a new row.
"""

import argparse
from decimal import Decimal, localcontext
import json
import math


ZERO = Decimal(0)


def dec(value):
    """Preserve a finite Decimal, or decode an original finite binary float."""
    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ValueError("expected a finite Decimal")
        return value
    if type(value) not in (int, float):
        raise ValueError("expected a finite int, float, or Decimal; bool is invalid")
    try:
        original = float(value)
    except (ValueError, OverflowError) as error:
        raise ValueError("number cannot be decoded as a finite original float") from error
    if not math.isfinite(original):
        raise ValueError("expected a finite original float")
    return Decimal.from_float(original)


def vector(values):
    if not isinstance(values, (list, tuple)) or len(values) != 3:
        raise ValueError("expected three numeric vector components")
    return tuple(dec(value) for value in values)


def cross(a, b):
    a, b = vector(a), vector(b)
    return (a[1]*b[2] - a[2]*b[1],
            a[2]*b[0] - a[0]*b[2],
            a[0]*b[1] - a[1]*b[0])


def dot(a, b):
    a, b = vector(a), vector(b)
    return sum((x*y for x, y in zip(a, b)), ZERO)


def sub(a, b):
    a, b = vector(a), vector(b)
    return tuple(x-y for x, y in zip(a, b))


def make_row(point, normal, center_a, center_b):
    point, normal = vector(point), vector(normal)
    return {"point": point, "normal": normal,
            "armA": sub(point, center_a), "armB": sub(point, center_b)}


def _row_vectors(row):
    if not isinstance(row, dict):
        raise ValueError("row must be an object")
    try:
        return tuple(vector(row[field]) for field in ("point", "normal", "armA", "armB"))
    except KeyError as error:
        raise ValueError(f"missing row field: {error.args[0]}") from error


def _body_vectors(body):
    if not isinstance(body, dict):
        raise ValueError("body must be a copied PhysicsBodyState object")
    try:
        return tuple(vector(body[field]) for field in ("positionM", "velocityMps", "angularVelocityRadps"))
    except KeyError as error:
        raise ValueError(f"missing body field: {error.args[0]}") from error


def _relative_velocity(arm_a, arm_b, velocity_a, angular_a, velocity_b, angular_b):
    rotation_a, rotation_b = cross(angular_a, arm_a), cross(angular_b, arm_b)
    return tuple(vb+rb-va-ra for va, ra, vb, rb in zip(velocity_a, rotation_a, velocity_b, rotation_b))


def point_relative_velocity(row, body_a, body_b):
    _, _, arm_a, arm_b = _row_vectors(row)
    _, velocity_a, angular_a = _body_vectors(body_a)
    _, velocity_b, angular_b = _body_vectors(body_b)
    return _relative_velocity(arm_a, arm_b, velocity_a, angular_a, velocity_b, angular_b)


def normal_velocity(row, body_a, body_b):
    _, normal, _, _ = _row_vectors(row)
    return dot(normal, point_relative_velocity(row, body_a, body_b))


def tangent_speed(row, body_a, body_b):
    """Use the recorded source operation u - n(n dot u), with no repair."""
    _, normal, _, _ = _row_vectors(row)
    relative = point_relative_velocity(row, body_a, body_b)
    normal_speed = dot(normal, relative)
    tangent = tuple(value - axis*normal_speed for value, axis in zip(relative, normal))
    return dot(tangent, tangent).sqrt()


def complementarity_residual(normal_speed, normal_impulse):
    speed, impulse = dec(normal_speed), dec(normal_impulse)
    return abs(speed) if impulse > ZERO else max(ZERO, -speed)


def decomposition(oldrow, newrow, a0, b0, a1, b1):
    """J1*v1-J0*v0 = J0*(v1-v0) + (J1-J0)*v1; retain signed error."""
    _, old_normal, arm_a, arm_b = _row_vectors(oldrow)
    _row_vectors(newrow)
    _, va0, wa0 = _body_vectors(a0)
    _, vb0, wb0 = _body_vectors(b0)
    _, va1, wa1 = _body_vectors(a1)
    _, vb1, wb1 = _body_vectors(b1)
    initial = normal_velocity(oldrow, a0, b0)
    held_final = normal_velocity(oldrow, a1, b1)
    final = normal_velocity(newrow, a1, b1)
    velocity_term = dot(old_normal, _relative_velocity(
        arm_a, arm_b, sub(va1, va0), sub(wa1, wa0), sub(vb1, vb0), sub(wb1, wb0)))
    geometry_term = final - held_final
    total = final - initial
    return {"initial": initial, "final": final, "velocityTerm": velocity_term,
            "geometryTerm": geometry_term, "total": total,
            "identityError": velocity_term + geometry_term - total}


def self_check():
    controls = []

    def body(position=(0, 0, 0), velocity=(0, 0, 0), angular=(0, 0, 0)):
        return {"positionM": list(position), "velocityMps": list(velocity), "angularVelocityRadps": list(angular)}

    def record(name, actual, expected):
        actual, expected = dec(actual), dec(expected)
        controls.append({"control": name, "actual": str(actual), "expected": str(expected),
                         "absoluteError": str(abs(actual-expected)), "passed": actual == expected})

    for precision in (80, 120):
        with localcontext() as context:
            context.prec = precision
            prefix = f"decimal{precision}:"
            static = body()
            row = make_row([1, 0, 0], [0, 1, 0], [0, 0, 0], [0, 0, 0])
            closing = body(velocity=(3, -4, 0))
            record(prefix + "linear_closing_sign", normal_velocity(row, static, closing), -4)
            record(prefix + "static_body_and_tangent_speed", tangent_speed(row, static, closing), 3)
            rotating = body(angular=(0, 0, 2))
            record(prefix + "rotation_cross_product_sign", normal_velocity(row, static, rotating), 2)
            reverse = make_row([1, 0, 0], [0, -1, 0], [0, 0, 0], [0, 0, 0])
            record(prefix + "normal_sign_reversal", normal_velocity(reverse, static, rotating), -2)
            shifted = body(position=(Decimal(".25"), 0, 0), angular=(0, 0, 2))
            fresh = make_row([1, 0, 0], [0, 1, 0], static["positionM"], shifted["positionM"])
            record(prefix + "held_arm_ignores_current_center_translation", normal_velocity(row, static, shifted), 2)
            record(prefix + "refreshed_arm_changes_normal_velocity", normal_velocity(fresh, static, shifted), Decimal("1.5"))
            terms = decomposition(row, fresh, static, rotating, static, shifted)
            record(prefix + "translation_only_velocity_term", terms["velocityTerm"], 0)
            record(prefix + "translation_only_geometry_term", terms["geometryTerm"], Decimal("-.5"))
            faster = body(position=(Decimal(".25"), 0, 0), angular=(0, 0, 4))
            terms = decomposition(row, fresh, static, rotating, static, faster)
            record(prefix + "combined_velocity_term", terms["velocityTerm"], 2)
            record(prefix + "combined_geometry_term", terms["geometryTerm"], -1)
            record(prefix + "combined_total", terms["total"], 1)
            record(prefix + "decomposition_identity_error", terms["identityError"], 0)
            normal_shifted = body(position=(0, Decimal(".25"), 0), angular=(0, 0, 2))
            normal_fresh = make_row([1, 0, 0], [0, 1, 0], static["positionM"], normal_shifted["positionM"])
            record(prefix + "normal_translation_preserves_normal_row", normal_velocity(normal_fresh, static, normal_shifted), 2)
            record(prefix + "normal_translation_changes_tangent_arm", tangent_speed(normal_fresh, static, normal_shifted), Decimal(".5"))
            record(prefix + "positive_impulse_closing_residual", complementarity_residual(-2, Decimal(".5")), 2)
            record(prefix + "positive_impulse_separating_residual", complementarity_residual(2, Decimal(".5")), 2)
            record(prefix + "zero_impulse_closing_residual", complementarity_residual(-2, 0), 2)
            record(prefix + "zero_impulse_separating_residual", complementarity_residual(2, 0), 0)
            nonunit = make_row([1, 0, 0], [0, 2, 0], [0, 0, 0], [0, 0, 0])
            record(prefix + "recorded_normal_is_not_normalized", normal_velocity(nonunit, static, rotating), 4)
            record(prefix + "float_conversion_is_exact", dec(.1) - Decimal.from_float(.1), 0)
            record(prefix + "caller_precision_is_preserved", context.prec, precision)

    invalid_values = (True, "0.1", float("nan"), float("inf"), Decimal("NaN"), object())
    for index, value in enumerate(invalid_values):
        try:
            dec(value)
            rejected = False
        except ValueError:
            rejected = True
        record(f"invalid_numeric_{index}_rejected", int(rejected), 1)
    for index, values in enumerate(([1, 2], "123", [0, True, 0])):
        try:
            vector(values)
            rejected = False
        except ValueError:
            rejected = True
        record(f"invalid_vector_{index}_rejected", int(rejected), 1)
    passed = all(control["passed"] for control in controls)
    return {"result": "PASS" if passed else "FAIL", "controls": controls}, 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-check", action="store_true", required=True)
    parser.parse_args()
    result, exit_code = self_check()
    print(json.dumps(result, allow_nan=False))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
