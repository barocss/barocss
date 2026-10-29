import json,hashlib,pathlib,platform
from fractions import Fraction
p=pathlib.Path('/tmp/d344-perf'); w=pathlib.Path('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b')
qualification=json.loads((p/'baseline-qualification.json').read_text()); timings=json.loads((p/'baseline.json').read_text()); actual=json.loads(pathlib.Path('/tmp/d344-kernel/input-brep.json').read_text())
def clean(x):
 if isinstance(x,dict): return {k:clean(v) for k,v in x.items() if k not in ('id','name')}
 if isinstance(x,list): return [clean(v) for v in x]
 return x
comparison={}
fixture=json.loads((p/'tiny-input-brep.json').read_text())
for kind,key in [('faces','surface'),('edges','curve'),('vertices','point')]:
 a=sorted(json.dumps(clean(x[key]),sort_keys=True) for x in actual[kind]);b=sorted(json.dumps(clean(x[key]),sort_keys=True) for x in fixture[kind]);comparison[kind+'GeometryExactIgnoringIdsNames']=a==b
assert all(comparison.values())
refs={}
for name,q in qualification.items():
 lo,hi=q['geometry']['bounds'][2]; width=Fraction(hi)-Fraction(lo); mid=(Fraction(hi)+Fraction(lo))/2
 guide=3.141592653589793*9*float(width); v=q['nativeMass']['volume']; center=q['nativeMass']['centroid']
 refs[name]={'representedSpan':{'numerator':str(width.numerator),'denominator':str(width.denominator)},'representedMidpoint':{'numerator':str(mid.numerator),'denominator':str(mid.denominator)},'roundedNormalMidpoint':float(mid),'normalCentroidWithinStoredInterval':lo<=center[2]<=hi,'tangentCenterInput':[.1234567,-.2345678],'nativeTangentCenterObserved':center[:2],'roundedPiVolumeGuide':guide,'nativeVolumeObserved':v,'nativeRelativeDifferenceFromRoundedGuide':v/guide-1,'guideScope':'Python stdlib Fraction endpoints and rounded math.pi circle volume guide; not exact rational-native-circle integration'}
manifest={str(f.relative_to(w)):hashlib.sha256(f.read_bytes()).hexdigest() for f in [w/'packages/barocss-cad/scripts/perf-bench.mjs',w/'packages/barocss-cad/src/brep/brep-mass-quadrature.ts',w/'packages/barocss-cad/src/brep/solid-mass.ts',w/'packages/barocss-cad/src/features/prismatic-solid.ts',w/'packages/barocss-cad/dist/brep/brep-mass-quadrature.js',w/'packages/barocss-cad/dist/brep/solid-mass.js']}
report={'status':'BASELINE_CAPTURED_CANDIDATE_NOT_RUN','publishedBase':'c0fea1174f71fc4f9e83ac4f53978d09884e0ef1','heavyGate':'RELEASED; holder none observed','node':(p/'node-version.txt').read_text().strip(),'cpu':(p/'cpu.txt').read_text().strip(),'os':(p/'os.txt').read_text().strip(),'conditions':{'runs':7,'warmup':3,'batch':32,'unit':'ms','density':1,'quadratureSegments':8,'uncachedQueriesPerMeasuredBatch':32,'uncachedMeasuredQueriesPerCase':224,'warmupFreshQueriesPerCase':96,'timed':'map of first mass calls, result-array allocation and one receipt WeakMap store','untimed':'fixture construction, clones, fingerprint, strict geometry classification and references','perQuery':'batch median /32; not individually timed queries','broadPerformanceClaim':False},'timing':timings,'geometry':qualification,'actualD343Comparison':comparison,'independentContext':refs,'sourceHashes':manifest,'measuredBenchmarkSha256':'37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9','finalBenchmarkDifference':'Final old-algorithm baseline rerun after unused XZ cleanup. Baseline and candidate must use this exact frozen benchmark byte sequence. Earlier baselines preserved separately.','checks':{'syntax':'PASS','narrowLint':'PASS 0 errors, 5 existing console warnings','newRuntimeCases':'2 completed','geometryStrictValid':'both','existingCasesRuntime':'NOT_RUN','fullKernel':'NOT_RUN by this lane','candidate':'NOT_RUN'},'preservedFailures':[{'phase':'initial syntax command','classification':'wrong duplicated package-relative path; MODULE_NOT_FOUND; command corrected, no product failure'},{'phase':'first narrow lint','classification':'pre-existing unused XZ error and 5 console warnings; unused constant removed, final lint exit0'}]}
(p/'baseline-report.json').write_text(json.dumps(report,indent=2)+'\n')
(p/'independent-context.json').write_text(json.dumps({'references':refs,'actualD343Comparison':comparison},indent=2)+'\n')
(p/'source-frozen.json').write_text(json.dumps({'status':'BENCHMARK_SOURCE_FROZEN','hashes':manifest,'baselineMeasuredBenchmarkSha256':report['measuredBenchmarkSha256'],'difference':report['finalBenchmarkDifference']},indent=2)+'\n')
