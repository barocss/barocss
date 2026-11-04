"""Frozen literal expansion only; no oracle generation or GCD solver."""
from support import decimal, require


def operand(desc):
    require(isinstance(desc, dict) and len(desc) == 1, 'LITERAL_DESCRIPTOR')
    kind, value = next(iter(desc.items()))
    if kind == 'int':
        return decimal(value)
    if kind in ('pow2', 'ones'):
        require(type(value) is int and 0 <= value <= 8192, 'LITERAL_SHIFT')
        number = 1 << value  # Literal expansion alone permits this 8193-bit temporary.
        if kind == 'ones':
            number -= 1
    elif kind == 'scaledPow2':
        require(isinstance(value, list) and len(value) == 2, 'LITERAL_SCALE')
        factor, exponent = value
        require(type(factor) is int and abs(factor) <= 5 and type(exponent) is int
                and 0 <= exponent <= 8191, 'LITERAL_SCALE_BOUND')
        require(abs(factor).bit_length() + exponent <= 8192, 'LITERAL_PRE_SHIFT')
        number = factor << exponent
    elif kind == 'product':
        require(isinstance(value, list) and len(value) == 2, 'LITERAL_PRODUCT')
        require(all(type(x) is int and abs(x) <= 1000000009 for x in value),
                'LITERAL_PRODUCT_BOUND')
        number = value[0] * value[1]
    elif kind == 'fib':
        require(type(value) is int and 0 <= value <= 11001, 'LITERAL_FIB_INDEX')
        a, b = 0, 1
        for _ in range(value):
            require(max(a.bit_length(), b.bit_length()) + 1 <= 8193,
                    'LITERAL_FIB_PRE_ADD')
            a, b = b, a + b
        number = a
    else:
        raise ValueError('UNKNOWN_LITERAL')
    require(abs(number).bit_length() <= 8192, 'LITERAL_FINAL_BIT_CAP')
    return number

