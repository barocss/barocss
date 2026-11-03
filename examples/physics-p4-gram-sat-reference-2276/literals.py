"""Frozen dyadic body descriptors; ROOT executes only during M3 or audit."""
import copy
from fractions import Fraction
import math
import re
import struct
from support import keys, need


def value(desc, depth=0):
    need(depth <= 4, 'DYADIC_DESCRIPTOR_DEPTH')
    if type(desc) is str:
        need(re.fullmatch(r'-?[0-9]{1,3}(?:/[1-9][0-9]{0,2})?', desc) is not None,
             'SMALL_FROZEN_DYADIC_LITERAL')
        result = Fraction(desc)
    else:
        need(type(desc) is dict and len(desc) == 1, 'DYADIC_DESCRIPTOR')
        kind, operands = next(iter(desc.items()))
        if kind == 'pow2':
            need(type(operands) is int and -50 <= operands <= 0, 'DYADIC_EXPONENT')
            result = Fraction(1, 1 << -operands)
        else:
            need(kind in ('add', 'sub') and type(operands) is list and len(operands) == 2,
                 'DYADIC_OPERATION')
            a, b = (value(x, depth + 1) for x in operands)
            result = a + b if kind == 'add' else a - b
    need(abs(result.numerator).bit_length() <= 64 and result.denominator.bit_length() <= 64 and
         result.denominator & (result.denominator - 1) == 0, 'BOUNDED_EXACT_DYADIC')
    return result


def vector(items, size):
    need(type(items) is list and len(items) == size, 'DESCRIPTOR_VECTOR')
    result = []
    for item in items:
        q = value(item)
        native = float(q)
        need(math.isfinite(native) and Fraction.from_float(native) == q, 'EXACT_BINARY64_LITERAL')
        result.append(native)
    return result


def requests(spec):
    keys(spec, ('format', 'defaults', 'cases'), 'SPEC_KEYS')
    need(spec['format'] == 'p4-independent-gram-spec-v1' and len(spec['cases']) == 9, 'FIXED_NINE_CASES')
    defaults = spec['defaults']
    keys(defaults, ('positionM', 'halfExtentsM', 'orientation'), 'DEFAULT_KEYS')
    result = []
    for index, case in enumerate(spec['cases']):
        if 'reverseOf' in case:
            keys(case, ('id', 'reverseOf'), 'REVERSE_CASE_KEYS')
            need(index == 8 and case['reverseOf'] == 6, 'FIXED_ORDER_REVERSE')
            result.append({'a': copy.deepcopy(result[6]['b']), 'b': copy.deepcopy(result[6]['a'])})
            continue
        keys(case, ('id', 'a', 'b'), 'BODY_CASE_KEYS')
        pair = {}
        for side in ('a', 'b'):
            overrides = case[side]
            need(type(overrides) is dict and set(overrides) <= set(defaults), 'BODY_OVERRIDE_KEYS')
            body = {**defaults, **overrides}
            pair[side] = {'id': side, 'kind': 'dynamic',
                          'shape': {'kind': 'box', 'halfExtentsM': vector(body['halfExtentsM'], 3)},
                          'positionM': vector(body['positionM'], 3),
                          'orientation': vector(body['orientation'], 4)}
        result.append(pair)
    return result


def input_words(request):
    return {side: {field: [struct.pack('<d', x).hex() for x in values]
                   for field, values in (('positionM', body['positionM']),
                                         ('orientation', body['orientation']),
                                         ('halfExtentsM', body['shape']['halfExtentsM']))}
            for side, body in request.items()}
