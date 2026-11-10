import errno
import json
import os
from pathlib import Path
import pty
import select
import subprocess
import sys
import time


challenge, options_json, *command = sys.argv[1:]
options = json.loads(options_json)
master, slave = pty.openpty()
child = subprocess.Popen(command, stdin=slave, stderr=slave, stdout=subprocess.PIPE)
os.close(slave)


def read():
    try:
        return os.read(master, 4096)
    except OSError as error:
        if error.errno == errno.EIO:
            return b""
        raise


try:
    deadline, prompt = time.monotonic() + 20, b""
    while b"> " not in prompt and time.monotonic() < deadline:
        if select.select([master], [], [], 0.2)[0]:
            chunk = read()
            if not chunk:
                break
            prompt += chunk
    if ('Type "' + challenge + '" to continue.').encode() not in prompt:
        raise RuntimeError(prompt.decode(errors="replace"))
    sys.stderr.buffer.write(prompt)
    for extra in options.get("beforeAnswer", []):
        subprocess.run(extra, check=True, stdout=sys.stderr, timeout=30)
    record = Path(options["unchangedRecord"]) if "unchangedRecord" in options else None
    before = record.read_bytes() if record else None
    entries = sorted(record.parent.iterdir()) if record else None
    os.write(master, (options.get("answer", challenge) + "\n").encode())
    stdout, _ = child.communicate(timeout=25)
    while select.select([master], [], [], 0)[0]:
        chunk = read()
        if not chunk:
            break
        sys.stderr.buffer.write(chunk)
    if record and (record.read_bytes() != before or sorted(record.parent.iterdir()) != entries):
        raise RuntimeError("The declined decision changed the run record or writer entries.")
    sys.stdout.buffer.write(stdout)
    sys.exit(child.returncode)
finally:
    if child.poll() is None:
        child.kill()
        child.wait()
    os.close(master)
