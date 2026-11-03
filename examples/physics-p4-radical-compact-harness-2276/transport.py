"""Transport JSON only; no candidate arithmetic imports."""
import json
from bounds import require, retained_size, REPLY_BYTES

def read_json(path, cap=REPLY_BYTES, retained=()):
    require(path.stat().st_size <= cap, 'JSON_FILE_LIMIT:' + str(path))
    raw = path.read_bytes()
    # Conservative syntax-token reservation before json.loads. No numerical decoding here.
    tokens, depth, in_string, escape, atom = 0, 0, False, False, False
    for byte in raw:
        if in_string:
            if escape:
                escape = False
            elif byte == 92:
                escape = True
            elif byte == 34:
                in_string = False
            continue
        if byte == 34:
            tokens += 1
            in_string, atom = True, False
        elif byte in (123, 91):
            tokens += 1
            depth += 1
            require(depth <= 128, 'JSON_DEPTH_PREALLOCATION')
            atom = False
        elif byte in (125, 93):
            depth -= 1
            atom = False
        elif byte in (9, 10, 13, 32, 44, 58):
            atom = False
        elif not atom:
            tokens += 1
            atom = True
    reserve = tokens * 256 + len(raw) * 8 + 8 * 1024 * 1024
    require(retained_size(*retained) + reserve <= 24 * 1024 * 1024, 'JSON_FULL_CONTEXT_PREALLOCATION')
    value = json.loads(raw)
    retained_size(raw, value, *retained)
    return value

