"""ROOT ONLY M1: independent literal/stdlib binary64 oracle, no candidate call."""
import math
import re
import struct
import sys
from pathlib import Path
from support import HERE, authenticate, deadline, decimal, keys, load, pin, require, write

WORD = re.compile(r'[0-9a-f]{16}\Z', re.ASCII)


def integer_literal(case):
    if 'literal' in case:
        keys(case, ('id', 'literal'), 'INTEGER_SPEC_KEYS')
        return decimal(case['literal'])
    require(set(case) in ({'id', 'pow2', 'negative'}, {'id', 'ones', 'negative'}),
            'LARGE_INTEGER_SPEC_KEYS')
    require(type(case['negative']) is bool, 'INTEGER_SIGN')
    if 'pow2' in case:
        require(case['pow2'] == 8191, 'INTEGER_POWER')
        value = 1 << 8191
    else:
        require(case['ones'] == 8192, 'INTEGER_ONES')
        value = (1 << 8192) - 1  # Only M1 literal construction has this8193-bit temporary.
    return -value if case['negative'] else value


def main():
    deadline()
    require(len(sys.argv) == 2, 'USAGE: materialize.py FRESH_DIRECTORY')
    source_pins = authenticate()
    spec = load(HERE / 'bank-spec.json')
    keys(spec, ('format', 'decimals', 'words'), 'SPEC_KEYS')
    require(spec['format'] == 'p4-independent-codec-spec-v1' and
            len(spec['decimals']) == 16 and len(spec['words']) == 28, 'SPEC_COUNTS')
    request = {'op': 'codec-bank', 'decimals': [], 'words': []}
    oracle = {'format': 'p4-independent-codec-oracle-v1',
              'specPin': pin(HERE / 'bank-spec.json'), 'requestPin': None,
              'decimals': [], 'words': []}
    for index, case in enumerate(spec['decimals']):
        text = str(integer_literal(case))
        decimal(text)
        request['decimals'].append(text)
        oracle['decimals'].append({'index': index, 'id': case['id'], 'expectedText': text})
    for index, case in enumerate(spec['words']):
        keys(case, ('id', 'word', 'expected'), 'WORD_SPEC_KEYS')
        word = case['word']
        require(WORD.fullmatch(word) is not None, 'WORD_HEX')
        value = struct.unpack('>d', bytes.fromhex(word))[0]
        request['words'].append(word)
        if not math.isfinite(value):
            require(case['expected'] == 'invalid', 'LITERAL_FINITE_CLASSIFICATION')
            expected = {'inputWordHex': word, 'status': 'REJECTED_NONFINITE',
                        'reason': 'PROOF_INPUT_INVALID'}
        else:
            require(case['expected'] == 'finite', 'LITERAL_NONFINITE_CLASSIFICATION')
            numerator, denominator = value.as_integer_ratio()
            expected = {'inputWordHex': word, 'status': 'FINITE_CERTIFIED',
                        'exactQ': str(numerator) + '/' + str(denominator),
                        'rneWordHex': struct.pack('>d', value if numerator else 0.0).hex()}
        oracle['words'].append({'index': index, 'id': case['id'], 'expected': expected})
    destination = Path(sys.argv[1])
    destination.mkdir(parents=False, exist_ok=False)
    write(destination / 'requests.json', request)
    oracle['requestPin'] = pin(destination / 'requests.json')
    write(destination / 'oracle.json', oracle)
    write(destination / 'manifest.json',
          {'format': 'p4-independent-codec-manifest-v1', 'decimalCount': 16,
           'finiteWordCount': 24, 'invalidWordCount': 4, 'wordCount': 28,
           'candidateInput': 'requests.json', 'oracleOnly': 'oracle.json',
           'specPin': pin(HERE / 'bank-spec.json'), 'sourcePins': source_pins,
           'files': {name: pin(destination / name) for name in ('requests.json', 'oracle.json')},
           'candidateCalls': 0, 'WorldCalls': 0})


if __name__ == '__main__':
    main()
