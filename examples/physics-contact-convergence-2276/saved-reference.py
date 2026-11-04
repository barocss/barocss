"""One preregistered paid-data reference diagnostic, zero World execution."""
import hashlib,json,subprocess,sys,time
from pathlib import Path
BASE=Path(__file__).resolve().parent
PINS={'oracle.py':'88abb36b030bf2b29180c9154bdf6ceec0b1d85c4b1fb8d7def88dcf2c8d751c',
      'CONTRACT.md':'3fd28725281c2b960df76a785b5d423bd2f88d48b8f42451c7923842c58b6eba',
      'evidence/dt-01/source-two-60-0-32.json':'73cc8ffc07f98221b78ac0abdf5c88947e49795018dea390701c85c87c582234'}
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
assert len(sys.argv)==2 and sys.argv[1]=='diagnostic-01'
out=BASE/'evidence'/sys.argv[1];out.mkdir()
self_pin=sha(Path(__file__));started=time.monotonic();failure=None;calls=0;integrity='NOT_RUN'
try:
    for name,pin in PINS.items(): assert sha(BASE/name)==pin,name
    wire=(BASE/'evidence/dt-01/source-two-60-0-32.json').read_bytes();assert len(wire)<=2*1024*1024
    (out/'inputs.json').write_text(json.dumps({'pins':PINS,'selfSHA256':self_pin,'referenceCalls':1,'worldCalls':0})+'\n')
    calls+=1
    r=subprocess.run([sys.executable,'-B',str(BASE/'oracle.py')],input=wire,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=169)
    assert len(r.stdout)<=65536 and len(r.stderr)<=65536
    (out/'reference.stdout').write_bytes(r.stdout);(out/'reference.stderr').write_bytes(r.stderr)
    assert r.returncode==0 and not r.stderr and r.stdout.count(b'\n')==1
    reply=json.loads(r.stdout);assert reply['ok'] and reply['resolved'] and not reply['executionFailure'],reply
    assert reply['status']=='CONTACT_WINDOW_CONFIRMED',reply
    assert reply['certificate']['startStep']==0 and reply['certificate']['endStep']==32
    assert reply['certificate']['transitions']==32
except Exception as e: failure={'name':type(e).__name__,'message':str(e)}
finally:
    try:
        for name,pin in PINS.items(): assert sha(BASE/name)==pin,name
        assert sha(Path(__file__))==self_pin and time.monotonic()-started<170
        integrity='PASS'
    except Exception as e: failure=failure or {'name':type(e).__name__,'message':str(e)};integrity='FAIL'
    result={'status':'CONTACT_SAVED_FIRST32_REFERENCE_CONFIRMED' if failure is None else 'FIRST_FAILURE',
            'firstFailure':failure,'sourceIntegrity':integrity,'referenceCalls':calls,'worldCalls':0,'candidateCalls':0,'compilerCalls':0}
    (out/'result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
sys.exit(1 if failure else 0)
