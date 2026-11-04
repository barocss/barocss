"""Raw one-apply binding plus explicitly reused OLD integer SAT geometry."""
import copy
from fractions import Fraction
import math
import struct
from support import need, same

FIELDS = (('positionM', 3), ('velocityMps', 3), ('orientation', 4), ('angularVelocityRadps', 3))


def exact(value):
    need(type(value) in (int, float) and math.isfinite(value), 'FINITE_NATIVE_GEOMETRY')
    return Fraction.from_float(float(value))


def text(value):
    return str(value.numerator) + '/' + str(value.denominator)


def restore(bodies, word_hex):
    need(type(bodies) is list and len(bodies) == 9 and type(word_hex) is str and
         len(word_hex) == 1872, 'ORIGINAL_RAW_FRAME_LAYOUT')
    raw = bytes.fromhex(word_hex)
    values = struct.unpack('<117d', raw)
    need(all(math.isfinite(x) for x in values), 'FINITE_RAW_FRAME')
    result = copy.deepcopy(bodies)
    offset = 0
    for body in result:
        for field, length in FIELDS:
            decoded = list(values[offset:offset + length])
            # Existing JSON may not retain historical signed zero; raw bytes
            # alone define these13 authoritative represented state scalars.
            need(body[field] == decoded, 'RAW_JSON_NUMERIC_CORRESPONDENCE')
            body[field] = decoded
            offset += length
    return result, raw


def bind(request, reply):
    pre, pre_raw = restore(request['preBodies'], request['preRawHex'])
    hyp, hyp_raw = restore(request['hypBodies'], request['hypRawHex'])
    native = request['result']['translations']
    need(len(native) == 9 and [b['id'] for b in pre] == [b['id'] for b in hyp] ==
         [b['id'] for b in native], 'ONE_APPLY_BODY_ORDER')
    deltas, roundoff, decoded = [], [], {}
    for i, (before, after, delta) in enumerate(zip(pre, hyp, native)):
        same({k: v for k, v in before.items() if k != 'positionM'},
             {k: v for k, v in after.items() if k != 'positionM'}, 'HELD_BODY_FIELDS/' + before['id'])
        if before['inverseMass'] == 0:
            need(pre_raw[i * 104:(i + 1) * 104] == hyp_raw[i * 104:(i + 1) * 104], 'STATIC_RAW_COPY')
            target = before['positionM']
        else:
            need(len(delta['u']) == 3, 'NATIVE_TRANSLATION_SIZE')
            target = [a + b for a, b in zip(before['positionM'], delta['u'])]
        same(target, after['positionM'], 'NATIVE_BINARY64_ADD_ONCE/' + before['id'])
        change = [exact(b) - exact(a) for a, b in zip(before['positionM'], after['positionM'])]
        error = [a - exact(b) for a, b in zip(change, delta['u'])]
        decoded[before['id']] = change if before['inverseMass'] else [Fraction(0)] * 3
        deltas.append({'id': before['id'], 'uExact': [text(x) for x in change], 'u': [float(x) for x in change]})
        roundoff.append({'id': before['id'], 'errorExactM': [text(x) for x in error], 'errorM': [float(x) for x in error]})
    reference = reply['reference']
    same(reference['actualDecodedDelta'], deltas, 'DECODED_DELTA')
    same(reference['additionRoundoff'], roundoff, 'NATIVE_ADDITION_ROUNDOFF')
    margins = []
    for row in request['problem']['rows']:
        value = sum((decoded[row['bId']][i] - decoded[row['aId']][i]) * exact(row['normal'][i]) for i in range(3)) - exact(row['boundM'])
        margins.append(text(value))
    same(reference['actualDecodedRowMarginsExactM'], margins, 'ACTUAL_DECODED_ALL_ROW_MARGINS')
    need(reference['oneApplyBasis'] == 'original PRE plus independently checked native u; binary64 add once; static raw copy' and
         reference['nonpenetrationChecked'] is True, 'ONE_APPLY_AUTHORITY')
    for key in ('heldBitsMatch', 'roundedFinalMatches', 'staticBitsMatch', 'stageReached'):
        need(reply['metrics'][key] is True, 'ONE_APPLY_METRIC/' + key)
    return pre, hyp


def pairs(request):
    rows = request['rowSelections']
    need(len(rows) == 36, 'FULL_PAIR_CENSUS')
    found = set()
    for i, row in enumerate(rows):
        a, b = row['aIndex'], row['bIndex']
        need(row['rowIndex'] == i and type(a) is int and type(b) is int and 0 <= a < b < 9,
             'ORIGINAL_PAIR_ORDER')
        need((a, b) not in found, 'DUPLICATE_PAIR')
        found.add((a, b))
    need(len(found) == 36, 'ALL_NINE_CHOOSE_TWO_PAIRS')
    return rows
