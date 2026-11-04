"""Root-only ONE saved request; original physical serializer, separate stats."""
import json
from pathlib import Path
import sys
import candidate


def main():
    if len(sys.argv) != 4:
        raise ValueError('probe.py REQUEST FRESH_REPLY FRESH_STATS')
    candidate.authenticate()
    request_path, reply_path, stats_path = map(Path, sys.argv[1:])
    raw = request_path.read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('PROBE_INPUT_BOUND')
    request = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    prepared = candidate.PreparedReference(candidate.load_original('probe_original_world'))
    module = prepared.install()
    reply = module.evaluate(request)
    physical = (json.dumps(reply, allow_nan=False, separators=(',', ':')) + '\n').encode()
    if len(physical) > 2 * 1024 * 1024:
        raise ValueError('PROBE_REPLY_BOUND')
    with reply_path.open('xb') as stream:
        stream.write(physical)
    stats = {'status': 'ROOT_EXECUTED_PREPARED_PROBE', 'requestPin': candidate.pin(request_path),
             'replyPin': candidate.pin(reply_path), 'preparation': prepared.last_stats,
             'functionsRestored': not prepared.active,
             'WorldCalls': 0, 'coldReferenceCalls': 1,
             'fullP4Qualification': False, 'resourceQualification': False}
    with stats_path.open('x') as stream:
        json.dump(stats, stream, indent=2, allow_nan=False)
        stream.write('\n')


if __name__ == '__main__':
    main()
