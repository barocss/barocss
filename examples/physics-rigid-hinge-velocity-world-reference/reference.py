#!/usr/bin/env python3
"""Selected cold six-stage HINGE2 independent JSONL reference.

Imports only own wire/derivation/observation modules and unchanged adopted
independent Python parents. No candidate, World, Physics or native solver.
"""
import json
import sys

sys.dont_write_bytecode = True
from world_schema import admit, InputError, Unresolved, M, P
from world_derivation import derive
from world_observation import precision, compare

JSON_MESSAGE = "hinge world reference line must be valid JSON"
INPUT_MESSAGE = "hinge world reference input is invalid"


def protocol(code, message):
    return {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED", "metrics":None, "reference":None, "violations":[], "error":{"code":code, "message":message}}


def evaluate(value):
    request, source, pair_inputs = admit(value)
    # No actual output/attempt frame is read by either independent derivation.
    low, low_models, _ = derive(request, source, pair_inputs, 80)
    high, high_models, parent_inputs = derive(request, source, pair_inputs, 120)
    prec = precision(low, high, low_models, high_models)
    if not prec["algebraResolved"] or not prec["scalarResolved"]:
        return {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED", "metrics":None, "reference":P.public(high), "violations":["independent World precision or model is unresolved"], "error":None}
    try:
        metrics, violations = compare(request, high, parent_inputs, prec)
    except Unresolved as caught:
        return {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED", "metrics":None, "reference":P.public(high), "violations":[str(caught)], "error":None}
    status = "MISMATCH" if violations else "PRODUCER_REFUSAL" if high["expectedRefusal"] is not None else "RETURN"
    return {"ok":not violations, "resolved":True, "executionFailure":False, "referenceStatus":status, "metrics":metrics, "reference":P.public(high), "violations":violations, "error":None}


def main():
    for encoded in sys.stdin.buffer:
        try:
            line = encoded.decode("utf-8", errors="strict")
            value = json.loads(line, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (json.JSONDecodeError, ValueError, UnicodeError):
            result = protocol("REFERENCE_JSON", JSON_MESSAGE)
        else:
            try:
                result = evaluate(value)
            except (InputError, M.ReferenceInputError, P.ReferenceInputError, P.POSE.ReferenceInputError, P.OLD.ReferenceInputError):
                result = protocol("REFERENCE_INPUT", INPUT_MESSAGE)
            except (Unresolved, M.ReferenceUnresolved) as caught:
                result = {"ok":False, "resolved":False, "executionFailure":True, "referenceStatus":"UNRESOLVED", "metrics":None, "reference":None, "violations":[str(caught)], "error":None}
        # Unexpected reference faults remain real process failures. The selected
        # root IPC stores raw request/stdout/stderr and actual exit/partial EOF.
        print(json.dumps(result, allow_nan=False, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
