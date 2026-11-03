"""Fixed synthetic leaf/intermediate roles. No physics or benchmark imports."""
import json
import os
from pathlib import Path
import sys
import time

PROTOCOL = 'stack-cpu-synthetic-v1'
SPIN_NS = dict(clean=20000000, grandchild=80000000, error=5000000,
               geometry=10000000, position0=10000000, position1=10000000)


def identity(role, kind='leaf'):
    return dict(protocol=PROTOCOL, kind=kind, role=role, pid=os.getpid(),
                ppid=os.getppid(), pgid=os.getpgrp(), children=[], allReaped=True)


def spin(target):
    start = time.process_time_ns(); value = 0
    while time.process_time_ns() - start < target:
        value = (value + 1) % 65521
    return value


def main():
    if len(sys.argv) != 2:
        return 90
    role = sys.argv[1]
    if role == 'parent':
        from collect import collect
        observed = collect('grandchild')
        record = identity('reaped-grandchild', 'parent')
        record['allReaped'] = observed['reaped'] and observed['pipeEof']
        record['children'] = observed['records']
        record['childWaitComplete'] = observed['reaped']
        record['childExitCode'] = observed['exitCode']
        record['childCpuStatus'] = observed['qualification']['status']
        record['childWait4CpuUs'] = observed['wait4Usage']
        print(json.dumps(record, separators=(',', ':')), flush=True)
        return 0 if observed['qualification']['status'] == 'CPU_COMPLETE' else 91
    if role == 'wait':
        # Pinned leaf branch: no spawn path after its no-descendant identity.
        print(json.dumps(identity(role), separators=(',', ':')), flush=True)
        sys.stdin.buffer.read(1)
        return 92  # A normal stdin close is not the expected timeout control.
    if role not in SPIN_NS:
        return 93
    spin(SPIN_NS[role])
    print(json.dumps(identity(role), separators=(',', ':')), flush=True)
    return 7 if role == 'error' else 0


if __name__ == '__main__':
    raise SystemExit(main())
