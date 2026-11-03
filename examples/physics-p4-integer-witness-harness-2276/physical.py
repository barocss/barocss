"""Whole physical payload comparison with a closed, reviewed metadata declaration."""
import struct


def compare(actual, saved, metadata):
    """Paths are explicit JSON pointers. No wildcard, field inference or normalization."""
    changed = set(metadata['replace'])
    added = set(metadata['add'])
    removed = set(metadata['remove'])
    if len(changed) != len(metadata['replace']) or len(added) != len(metadata['add']) or len(removed) != len(metadata['remove']):
        raise ValueError('DUPLICATE_METADATA_DECLARATION')
    declared = changed | added | removed
    if any(not path.startswith('/') or '*' in path for path in declared):
        raise ValueError('EXPLICIT_METADATA_PATH_REQUIRED')
    for path in declared:
        if any(other != path and other.startswith(path + '/') for other in declared):
            raise ValueError('OVERLAPPING_METADATA_PATHS')
    observed, leaves, words = set(), 0, 0

    def walk(a, b, path):
        nonlocal leaves, words
        if path in changed:
            observed.add(path)
            return
        if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None:
            if type(a) is not type(b) or a != b:
                raise ValueError('PHYSICAL_VALUE:' + path)
        elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
            if struct.pack('<d', a) != struct.pack('<d', b):
                raise ValueError('PHYSICAL_F64_WORD:' + path)
            words += 1
        elif isinstance(a, dict) and isinstance(b, dict):
            for key in sorted(set(a) | set(b)):
                child = path + '/' + key.replace('~', '~0').replace('/', '~1')
                if key not in b:
                    if child not in added:
                        raise ValueError('UNDECLARED_ADDED_FIELD:' + child)
                    observed.add(child)
                elif key not in a:
                    if child not in removed:
                        raise ValueError('UNDECLARED_REMOVED_FIELD:' + child)
                    observed.add(child)
                else:
                    walk(a[key], b[key], child)
            return
        elif isinstance(a, list) and isinstance(b, list):
            if len(a) != len(b):
                raise ValueError('PHYSICAL_ARRAY_LENGTH:' + path)
            for index, (left, right) in enumerate(zip(a, b)):
                walk(left, right, path + '/' + str(index))
            return
        elif type(a) is not type(b) or a != b:
            raise ValueError('PHYSICAL_VALUE:' + path)
        leaves += 1

    walk(actual, saved, '')
    if observed != declared:
        raise ValueError('UNUSED_METADATA_DECLARATION:' + ','.join(sorted(declared - observed)))
    return dict(status='PASS_WHOLE_RETAINED_PHYSICAL_PAYLOAD', physicalLeaves=leaves,
                float64Words=words, declaredMetadataPaths=sorted(observed), normalization=False,
                authority='SAVED_POSITION_V2_COLD_QP_REPLY',
                metadataAuthority='ROOT_REVIEWED_EXPLICIT_ALGORITHM_METADATA_ONLY')


WORLD_METADATA = {
    'replace': ['/referenceProtocol', '/reference/arithmetic'],
    'add': ['/reference/proofCounters', '/reference/proofAuthority', '/reference/witnessProvenance'],
    'remove': ['/reference/counters'],
}


def compare_world(actual, saved, request):
    if actual.get('referenceProtocol') != 'p4-position-witness-v1':
        raise ValueError('WORLD_PROTOCOL')
    reference = actual['reference']
    if reference['arithmetic'] != 'guarded exact witness; one fraction-free factorization; all-row KKT':
        raise ValueError('WORLD_ARITHMETIC')
    if reference['proofAuthority'] != 'exact-global-KKT-with-untrusted-native-basis':
        raise ValueError('WORLD_PROOF_AUTHORITY')
    if reference['witnessProvenance'] != {'source': 'request.result.basisRows', 'trusted': False,
                                        'usedAsSearchSeed': False, 'basisRows': request['result']['basisRows']}:
        raise ValueError('WORLD_WITNESS_PROVENANCE')
    if not isinstance(reference['proofCounters'], dict):
        raise ValueError('WORLD_PROOF_COUNTERS_REQUIRED')
    return compare(actual, saved, WORLD_METADATA)
