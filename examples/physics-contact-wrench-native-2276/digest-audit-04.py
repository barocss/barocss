"""Files-only correction: validate every identity before the old-provider map."""
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import json
import re
import sys

from trace_decode import decode_packet

HOME = Path(__file__).resolve().parent
OLD = HOME.parent / 'physics-contact-wrench-producer-2276/evidence/producer-01'


def need(value, message):
    if not value:
        raise ValueError(message)


def mapped(value, expected, count):
    if isinstance(value, list):
        return [mapped(item, expected, count) for item in value]
    if isinstance(value, dict):
        output = {}
        for key, item in value.items():
            if key == 'providerDigest':
                need(item == expected, 'UNEXPECTED_PROVIDER_DIGEST')
                count[0] += 1
                output[key] = 'VALIDATED_OWN_PROVIDER'
            else:
                output[key] = mapped(item, expected, count)
        return output
    return value


def main():
    ids = sys.argv[1:]
    need(len(ids) == 4 and all(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', x) for x in ids),
         'source native prior-parity fresh-audit IDs required')
    source, native, parity, out = (HOME / 'evidence' / name for name in ids)
    out.mkdir()
    result = dict(status='NOT_COMPLETED', WorldCalls=0, candidateCalls=0,
                  geometryCalls=0, packets=[], firstFailure=None)
    try:
        archive = json.loads((HOME / 'EVIDENCE-ARCHIVE.json').read_text())
        prior_bytes = (parity / 'result.json').read_bytes()
        key = 'examples/physics-contact-wrench-native-2276/evidence/' + ids[2] + '/result.json'
        need(sha256(prior_bytes).hexdigest() == archive['members'][key]['sha256'],
             'Authenticated prior parity receipt changed')
        prior = json.loads(prior_bytes)
        need(prior['status'] == 'PASS_FULL_PRIVATE_SOURCE_NATIVE_AND_SAVED_SOURCE_PARITY',
             'Prior bounded parity prerequisite')
        identities = prior['providerIdentities']
        expected = [identities[k] for k in ('amendedSource', 'amendedNative', 'qualifiedOriginal')]
        need(expected[0] == expected[1] and expected[0] != expected[2], 'Distinct identities')
        totals = [0, 0, 0]
        need(prior['matchedPackets'] == len(prior['packets']) == 22, 'Frozen packet population')
        for row in prior['packets']:
            values, counts = [], []
            for index, (folder, label) in enumerate(zip((source, native, OLD),
                                                       ('source', 'native', 'qualifiedSource'))):
                data = (folder / row['name']).read_bytes()
                need(len(data) == row[label]['bytes'] and sha256(data).hexdigest() == row[label]['sha256'],
                     'Authenticated physical packet changed: ' + row['name'])
                value = json.loads(data)
                if value.get('format') == 'physics-lossless-trace-dag-v1':
                    value = decode_packet(value)
                count = [0]
                normal = mapped(value, expected[index], count)
                values.append((value, normal))
                counts.append(count[0])
                totals[index] += count[0]
            need(values[0][0] == values[1][0], 'New Source/Native raw packet mismatch')
            need(values[0][1] == values[2][1], 'Validated-provider-only old comparison mismatch')
            result['packets'].append(dict(name=row['name'], validatedDigestOccurrences=counts))
        need(all(totals), 'Actual identity occurrence coverage')
        negative = []
        for bad in ('sha256:' + '0' * 64, expected[2]):
            synthetic = dict(recording=dict(finalState=dict(identity=dict(providerDigest=bad))))
            try:
                mapped(deepcopy(synthetic), expected[0], [0])
            except ValueError as error:
                need(str(error) == 'UNEXPECTED_PROVIDER_DIGEST', 'Specific identity rejection')
                negative.append('REJECTED_UNEXPECTED_NESTED_IDENTITY')
            else:
                raise ValueError('Synthetic nested corruption was masked')
        result.update(status='PASS_VALIDATED_PROVIDER_ONLY_FULL_PACKET_AUDIT',
                      validatedDigestOccurrences=totals, matchedPackets=22,
                      syntheticNegativeControls=negative,
                      source=sha256(Path(__file__).read_bytes()).hexdigest(),
                      priorReceiptSha256=sha256(prior_bytes).hexdigest(),
                      correction='Old mapper replaced arbitrary providerDigest values. Every actual value is now checked before mapping; old files and results unchanged.',
                      physicalReruns=0, actualCorruptionFound=False,
                      normalization='NONE between new graphs; validated own providerDigest ONLY against old Source')
    except Exception as error:
        result.update(status='FAIL_PROVIDER_DIGEST_DATA_AUDIT',
                      firstFailure=dict(type=type(error).__name__, message=str(error)))
    data = (json.dumps(result, indent=2) + '\n').encode()
    need(len(data) <= 1024 * 1024, 'Audit receipt byte cap')
    with (out / 'result.json').open('xb') as stream:
        stream.write(data)
    print(json.dumps({k: result.get(k) for k in ('status', 'firstFailure', 'matchedPackets',
                                                 'validatedDigestOccurrences', 'syntheticNegativeControls')}))
    return int(result['firstFailure'] is not None)


if __name__ == '__main__':
    sys.exit(main())
