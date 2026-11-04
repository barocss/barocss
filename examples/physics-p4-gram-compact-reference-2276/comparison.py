"""Closed path traversal; no V3 rewrite, subtree deletion or wildcard skip."""
from intervals import FIELDS
from support import need, same


def escape(key):
    return key.replace('~', '~0').replace('/', '~1')


class Comparison:
    def __init__(self, validated):
        self.validated = validated
        self.expected = {'/referenceProtocol', '/reference/arithmetic',
                         '/reference/proofCounters', '/reference/proofAuthority',
                         '/reference/witnessProvenance', '/reference/counters',
                         '/metrics/maxCertifiedSatWidthM'}
        self.renames = set()
        for phase in ('prePairs', 'hypPairs'):
            for i in range(36):
                base = '/reference/' + phase + '/' + str(i) + '/satCertificateV3'
                self.renames.add(base)
                self.expected.update((base + '/protocol', base + '/enclosureAlgorithm'))
                for field in FIELDS:
                    for endpoint in ('low', 'high', 'precision'):
                        self.expected.add(base + '/numericIntervals/' + field + '/' + endpoint)
        need(self.expected == set(validated), 'ALL_CONCRETE_EXCEPTIONS_VALIDATED')
        need(len(self.expected) == 1447 and len(self.renames) == 72, 'FIXED_METADATA_CENSUS')
        self.record_paths = {p.rsplit('/', 1)[0] for p in self.renames}
        self.consumed, self.mapped = set(), set()
        self.physical_leaves = 0

    def use(self, path):
        need(path in self.expected and path not in self.consumed, 'DUPLICATE_OR_UNKNOWN_EXCEPTION:' + path)
        self.consumed.add(path)

    def walk(self, a, b, path=''):
        if path in self.expected:
            self.use(path)
            return
        if type(a) is dict and type(b) is dict:
            if path == '/reference':
                need(set(a) == (set(b) - {'counters'}) | {'proofCounters', 'proofAuthority', 'witnessProvenance'},
                     'CLOSED_REFERENCE_METADATA_KEYS')
                for key in ('proofCounters', 'proofAuthority', 'witnessProvenance', 'counters'):
                    self.use(path + '/' + key)
                keys = set(a) & set(b)
            elif path in self.record_paths:
                need(set(a) == (set(b) - {'satCertificateV2'}) | {'satCertificateV3'}, 'BIJECTIVE_CERTIFICATE_RENAME')
                new = path + '/satCertificateV3'
                self.mapped.add(new)
                self.walk(a['satCertificateV3'], b['satCertificateV2'], new)
                keys = set(a) & set(b)
            elif path in self.renames:
                need(set(a) == set(b) | {'enclosureAlgorithm'}, 'CLOSED_NEW_CERTIFICATE_KEYS')
                self.use(path + '/enclosureAlgorithm')
                keys = set(b)
            else:
                need(set(a) == set(b), 'CLOSED_KEYS:' + path)
                keys = set(a)
            for key in sorted(keys):
                self.walk(a[key], b[key], path + '/' + escape(key))
        elif type(a) is list and type(b) is list:
            need(len(a) == len(b), 'ARRAY_LENGTH:' + path)
            for i, (left, right) in enumerate(zip(a, b)):
                self.walk(left, right, path + '/' + str(i))
        else:
            same(a, b, path)
            self.physical_leaves += 1

    def result(self):
        need(self.expected == self.consumed and self.renames == self.mapped, 'UNCONSUMED_EXCEPTION_OR_RENAME')
        return {'physicalLeavesCompared': self.physical_leaves,
                'concreteExceptionsValidated': len(self.expected),
                'concreteExceptionsConsumed': len(self.consumed),
                'certificateRenamesDescended': len(self.mapped),
                'unconsumedExceptions': [], 'consumedConcretePaths': sorted(self.consumed),
                'normalization': False, 'subtreeExclusion': False}
