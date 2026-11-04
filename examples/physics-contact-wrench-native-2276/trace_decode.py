"""Independent bounded lossless reference decoder. No physics/candidate imports."""
import hashlib,json
MAX_EXPANDED_BYTES=16*1024*1024
MAX_SHARED_NODES=8192
MAX_REFERENCE_DEPTH=64
MAX_CANONICAL_FRAGMENTS=1000000

def fingerprint(value):
    digest=hashlib.sha256();size=0;fragments=0
    encoder=json.JSONEncoder(ensure_ascii=False,sort_keys=True,separators=(',',':'))
    for text in encoder.iterencode(value):
        data=text.encode();size+=len(data);fragments+=1
        if size>MAX_EXPANDED_BYTES or fragments>MAX_CANONICAL_FRAGMENTS:raise ValueError('Expanded canonical trace resource bound')
        digest.update(data)
    return digest.hexdigest(),size

def decode_packet(packet):
    if packet.get('format')!='physics-lossless-trace-dag-v1':raise ValueError('Required canonical trace DAG format')
    if not isinstance(packet.get('expandedCanonicalBytes'),int) or not 0<=packet['expandedCanonicalBytes']<=MAX_EXPANDED_BYTES:raise ValueError('Declared expanded trace byte bound')
    pool=packet['objects'];cache={};active=set()
    if not isinstance(pool,dict) or len(pool)>MAX_SHARED_NODES:raise ValueError('Shared trace node bound')
    def node(value,depth=0):
        if depth>MAX_REFERENCE_DEPTH:raise ValueError('Trace reference depth bound')
        if isinstance(value,list):return [node(v,depth+1) for v in value]
        if isinstance(value,dict):
            if set(value)=={'$node'}:
                key=value['$node']
                if key in cache:return cache[key]
                if key in active:raise ValueError('Cyclic trace reference')
                if key not in pool:raise ValueError('Missing trace reference')
                active.add(key);decoded=node(pool[key],depth+1);active.remove(key)
                if fingerprint(decoded)[0]!=key:raise ValueError('Trace reference hash mismatch')
                cache[key]=decoded;return decoded
            return {k:node(v,depth+1) for k,v in value.items()}
        return value
    decoded=node(packet['root'])
    root_fingerprint=fingerprint(decoded)
    if root_fingerprint[0]!=packet.get('expandedCanonicalSha256') or root_fingerprint[1]!=packet['expandedCanonicalBytes']:raise ValueError('Expanded trace root SHA256/byte accounting mismatch')
    if set(cache)!=set(pool):raise ValueError('Unreferenced trace dictionary entries')
    return decoded
