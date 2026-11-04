"""Root-only exact source/receipt/canonical IO. No candidate/codec/build execution."""
import argparse
import hashlib
import json
from pathlib import Path

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
PROFILE = 'STATIONARY_NORMAL_EXACT_V1'
ADMISSION = 'ROOT_SAME32_SOURCE_NATIVE_FRACTION_FLOAT_CONFIRMED'
CAP = 2**21
# Explicit population selection: no arbitrary hash refresh of old pinned inputs.
OMIT_PREFIXES = (
    'examples/physics-stack-library-2276/evidence/canonical-opt',
    'examples/physics-stack-library-2276/evidence/runtime-opt',
    'examples/physics-stack-library-2276/evidence/run-',
    'examples/physics-stack-stream-brotli-2276/',
    'examples/physics-stack-stream-brotli-stateful-2276/',
    'examples/physics-stack-evidence-ref-codec-2276/',
    'examples/physics-stack-lexeme-archive-2276/',
)
OMIT_EXACT = ('examples/physics-stack-pipeline-2276/PINS.json',)
GUARDS = ('stationary-same32-02', 'stationary-protocol-node-01',
          'stationary-protocol-python-01', 'stationary-checker-bank-01',
          'stationary-authority-01')


def need(value, reason):
    if not value:
        raise ValueError(reason)


def pin(path):
    path = Path(path)
    need(path.is_file() and not path.is_symlink(), 'REGULAR_FILE:' + str(path))
    before = path.stat()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while block := stream.read(65536):
            h.update(block)
    after = path.stat()
    need((before.st_size, before.st_mtime_ns) == (after.st_size, after.st_mtime_ns), 'INPUT_CHANGED')
    return dict(bytes=after.st_size, sha256=h.hexdigest())


def bounded(path):
    need(path.stat().st_size <= CAP, 'METADATA_BOUND:' + str(path))
    blocks = []
    with path.open('rb') as stream:
        while block := stream.read(65536):
            blocks.append(block)
    return b''.join(blocks)


def read(path):
    return json.loads(bounded(path))


def relative(path):
    return Path(path).resolve().relative_to(ROOT).as_posix()


def write(path, value):
    raw = (json.dumps(value, sort_keys=True, indent=2)+'\n').encode()
    need(len(raw) <= CAP, 'OUTPUT_METADATA_BOUND')
    with path.open('xb') as stream:
        stream.write(raw)


def closed_guard(path):
    value = read(path)
    need(value['status'] == 'PASS' and value['processClosed'] is True and value['exit'] == 0 and value.get('finishedAt'), 'ACTUAL_CLOSED_GUARD:' + str(path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', required=True, type=Path)
    parser.add_argument('--canonical', required=True, type=Path)
    parser.add_argument('--base-pins', required=True, type=Path)
    args = parser.parse_args()
    run, canonical, base_path = args.run.resolve(), args.canonical.resolve(), args.base_pins.resolve()
    need(base_path == ROOT/'examples/physics-stack-complete-2276/PINS.json', 'IMMUTABLE_OLD_COMPLETE_BASE')
    need(not (HOME/'PINS.json').exists() and not (HOME/'SOURCE-SEAL.json').exists(), 'FRESH_NEW_PROFILE_PINS_REQUIRED')
    authority = read(HOME/'AUTHORITY.json')
    provenance = read(canonical)
    need(provenance.get('qualifiedRuntimeClosure') is True, 'QUALIFIED_AST_CANONICAL_REQUIRED')
    need(authority['canonicalProvenance'] == dict(path=relative(canonical), **pin(canonical)), 'SAME_CANONICAL_AUTHORITY')
    need(authority['providerDigest'] == provenance['providerDigest'] and authority['nativeRoot'] == relative(run/'native'), 'SAME_NEW_PROVIDER_RUN')
    rows = [dict(path=name, sha256=v['sha256']) for name, v in provenance['files'].items() if name.startswith('canonical-provider/')]
    need(provenance['aggregateAlgorithm'] == 'SHA256_UTF8_COMPACT_JSON_ORDERED_ARRAY_OF_PATH_AND_SHA256_PROVIDER_ONLY', 'AGGREGATE_FORMAT')
    need(hashlib.sha256(json.dumps(rows,separators=(',', ':'),ensure_ascii=False).encode()).hexdigest() == provenance['providerDigest'], 'ACTUAL_PROVIDER_DIGEST')
    actual_run = read(run/'result.json')
    need(actual_run['status'] == 'PASS_BOUNDED_EXACT_STATIONARY_PACKAGE_STACK_PHASE' and actual_run['parity'] is True and actual_run['firstFailure'] is None, 'ACTUAL_NEW_LIBRARY_PASS')
    frozen = read(run/'frozen-before.json')
    need(frozen == read(run/'frozen-after.json'), 'RUN_SOURCE_RECHECK')
    base = read(base_path)
    need(len(base['files']) == 723, 'EXACT_OLD723_BASE')
    base_pin = pin(base_path)
    baseline = HOME/'baseline'
    baseline.mkdir(exist_ok=True)
    for original, name in [(base_path,'old-complete-723-PINS.json'),
                           (base_path.parent/'SOURCE-SEAL.json','old-complete-SOURCE-SEAL.json')]:
        target = baseline/name
        if not target.exists():
            with target.open('xb') as stream:
                stream.write(bounded(original))
        need(pin(target) == pin(original), 'BYTE_EXACT_OLD_BASE_COPY')
    files, omitted, changes = {}, {}, {}
    current_sources = provenance['sources']
    for name, expected in base['files'].items():
        if name.startswith(OMIT_PREFIXES) or name in OMIT_EXACT:
            omitted[name] = dict(reason='EXPLICIT_OLD_PROVIDER_FUTURE_TRAJECTORY_GOLDEN_OR_ENDED_CODEC_FILTER', historicalPin=expected)
        elif name in current_sources:
            actual = current_sources[name]
            need(pin(ROOT/name) == actual and frozen.get(str((ROOT/name).resolve())) == actual['sha256'], 'EXPLICIT_CURRENT_GRAPH_SOURCE')
            files[name] = actual
            if actual != expected:
                changes[name] = dict(before=expected, after=actual, reason='ACTUAL_CANONICAL_SOURCE_MATCHES_QUALIFIED_NEW_RUN')
        else:
            need(pin(ROOT/name) == expected, 'OLD_PIN_DRIFT_NOT_AUTO_REFRESHED:' + name)
            files[name] = expected
    for name, expected in current_sources.items():
        need(pin(ROOT/name) == expected and frozen.get(str((ROOT/name).resolve())) == expected['sha256'], 'CURRENT_SOURCE_GRAPH_VS_RUN:' + name)
        files[name] = expected
    def add(path, expected=None):
        path = Path(path)
        name = str(path) if path.is_absolute() and not path.is_relative_to(ROOT) else relative(path)
        actual = pin(path)
        if expected is not None:
            need(actual == expected, 'EXACT_NEW_INPUT:' + name)
        if name in files:
            need(files[name] == actual, 'NO_IMPLICIT_OLD_PIN_REFRESH:' + name)
        files[name] = actual
    # Canonical copied code/helpers and original source/build/AST proof.
    for name, expected in provenance['files'].items():
        need(not Path(name).is_absolute() and '..' not in Path(name).parts, 'CANONICAL_RELATIVE_PATH')
        add(canonical.parent/name, expected)
    add(canonical)
    add(ROOT/provenance['buildReceipt'], provenance['buildReceiptPin'])
    closed_guard(ROOT/provenance['buildReceipt'])
    add(ROOT/provenance['libraryQualification'], provenance['libraryQualificationPin'])
    add(ROOT/provenance['originalCopyProvenance']['path'], {k:provenance['originalCopyProvenance'][k] for k in ('bytes','sha256')})
    add(ROOT/provenance['actualASTCopyGuard']['path'], {k:provenance['actualASTCopyGuard'][k] for k in ('bytes','sha256')})
    closed_guard(ROOT/provenance['actualASTCopyGuard']['path'])
    for name, expected in provenance['parserTools'].items():
        add(Path(name), expected)
    parity_path = canonical.parent/'emission-parity.json'
    add(parity_path)
    parity = read(parity_path)
    # Root review pins the complete unchanged module-byte proof; no numeric execution here.
    need(parity.get('status') == 'PASS_ALL28_CANONICAL_RUNTIME_MODULES_BYTE_IDENTICAL_TO_ACTUAL_PASSED_NODENEXT_PHASE' and parity['providerDigest'] == provenance['providerDigest'] and parity['phaseResult'] == relative(run/'result.json'), 'ACTUAL_EMISSION_BYTE_PROOF')
    # Every current record/wire descriptor selected by the actual authority is rehashed.
    for row in authority['records'].values():
        for desc in row.values():
            add(ROOT/desc['path'], {k:desc[k] for k in ('bytes','sha256')})
    for pair in authority['authority'].values():
        for desc in pair.values():
            add(ROOT/desc['path'], {k:desc[k] for k in ('bytes','sha256')})
    for name in ('result.json','source/result.json','native/result.json','frozen-before.json','frozen-after.json','tools.json'):
        add(run/name)
    # Direct foundation: candidate/checker hashes must match its actual first paid gate.
    foundation = ROOT/'examples/physics-stack-stationary-witness-2276/evidence/same32-02'
    need(read(foundation/'result.json')['status'] == 'PASS_STATIONARY_SAME32_SOURCE_NATIVE_FRACTION_FLOAT', 'ACTUAL_SAME32_FRACTION_FLOAT_SOURCE_NATIVE')
    foundation_before = read(foundation/'inputs-before.json')
    need(foundation_before == read(foundation/'inputs-after.json'), 'FOUNDATION_SOURCE_RECHECK')
    for name in ('packages/barocss-physics/src/stack/stationary-normal.ts',
                 'examples/physics-stack-stationary-witness-2276/checker.py'):
        need(foundation_before[str((ROOT/name).resolve())] == pin(ROOT/name)['sha256'], 'ACTUAL_FOUNDATION_CORE_SOURCE:' + name)
        add(ROOT/name)
    for name in ('result.json','inputs-before.json','inputs-after.json'):
        add(foundation/name)
    guard_receipts = {}
    for name in GUARDS:
        folder = ROOT/'examples/physics-world-p5-2276/evidence'/name
        closed_guard(folder/'result.json')
        for artifact in ('result.json','stdout.raw','stderr.raw'):
            path = folder/artifact
            if path.exists():
                add(path)
        guard_receipts[name] = dict(path=relative(folder/'result.json'), **pin(folder/'result.json'))
    # Current raw-word v2 qualification is protocol-node12 plus run02 IO7, not old wire-v1.
    for name in ('examples/physics-stack-stationary-library-2276/witness-wire.mjs',
                 'examples/physics-stack-stationary-complete-2276/reference-wrapper.py',
                 'examples/physics-stack-stationary-witness-2276/checker.py'):
        need(frozen.get(str((ROOT/name).resolve())) == pin(ROOT/name)['sha256'], 'ACTUAL_RUN_RUNTIME_WITNESS_SOURCE:' + name)
        add(ROOT/name)
    io_command = next(row for row in actual_run['commands'] if row['stage'] == 'io-controls')
    need(io_command['exit'] == 0 and io_command['signal'] is None and io_command['error'] is None, 'ACTUAL_CURRENT_IO7_WIRE5')
    add(run/'io-controls.stdout')
    add(run/'io-controls.stderr')
    # Own newly qualified source and pure transport; never replace arbitrary old source pins.
    library = ROOT/'examples/physics-stack-stationary-library-2276'
    for path in sorted(library.iterdir()):
        if path.is_file():
            add(path)
    for path in sorted((ROOT/'examples/physics-stack-stationary-witness-2276').iterdir()):
        if path.is_file():
            add(path)
    for path in sorted(HOME.iterdir()):
        if path.is_file() and path.name not in ('PINS.json','SOURCE-SEAL.json'):
            add(path)
    for path in sorted(baseline.iterdir()):
        if path.is_file():
            add(path)
    # Changed phase controls use historical paid fixtures ONLY for synthetic counter tests.
    for name in ('prefix-05','full-03'):
        add(ROOT/'examples/physics-stack-complete-2276/evidence'/name/'ALIGNED/host/result.json')
    selection = dict(status='EXPLICIT_NEW_PROFILE_INPUT_SELECTION', oldBase=base_pin,
        omittedByDeclaredFilters=omitted, explicitCurrentSourceChanges=changes,
        currentSourceGraph=provenance['sources'], oldBaseNotModified=True,
        oldRuntimeAndQROutputsAreNotAuthority=True)
    write(HOME/'INPUT-SELECTION.json', selection)
    add(HOME/'INPUT-SELECTION.json')
    pins = {k:v for k,v in base.items() if k not in ('files','runtimeFrames','historicalComponentPinsCompleteInput','providerMetadata')}
    pins.update(status='SOURCE_READY_FOR_ROOT_FRESH_STATIONARY_PREFIX', format='stationary-complete-pins-v1',
        profile=PROFILE, stationaryCandidateAdmission=ADMISSION, files=dict(sorted(files.items())),
        provider=provenance['provider'], native=provenance['native'], providerDigest=provenance['providerDigest'],
        providerMetadata=relative(canonical), authorityManifest=relative(HOME/'AUTHORITY.json'),
        authorityNativeRoot=authority['nativeRoot'], windowControlsReceipt='examples/physics-stack-complete-2276/CONTROLS-ROOT-RESULT.json',
        addendum='CONTRACT.md', revision='EXACT_STATIONARY_NEW_SOURCE_NATIVE_AUTHORITY_NATIVE_CRC_FULL_EVIDENCE',
        phaseCheckpointPrerequisite=dict(groups=4, guard=guard_receipts['stationary-protocol-node-01'], scope='NEW_COUNTER_SCHEMA_PROGRESS_NOT_GO'),
        stationaryProtocolPrerequisites=dict(guards=guard_receipts, wrapperGroups=6, phaseGroups=4, identityGroups=3, pureWireGroups=5, pureWireCurrentQualification='PROTOCOL_NODE12_PLUS_ACTUAL_RUN02_IO7_NOT_HISTORICAL_V1', checkerGroups=8),
        prerequisitesQualified=True, originalIndependentFullPhysics=False, API=False)
    need(relative(HOME/'PINS.json') not in files, 'NO_ACTIVE_PINS_SELF_REFERENCE')
    need(not any(name.startswith('examples/physics-stack-library-2276/evidence/runtime-opt') for name in files), 'NO_FUTURE_QR_TRAJECTORY_INPUT')
    write(HOME/'PINS.json', pins)
    seal_files = {path.name:pin(path)['sha256'] for path in sorted(HOME.iterdir())
                  if path.is_file() and path.name != 'SOURCE-SEAL.json'}
    write(HOME/'SOURCE-SEAL.json', dict(status='SOURCE_READY_ROOT_ACTUAL_PREREQUISITES_BOUND',
        profile=PROFILE, files=seal_files, pinnedFiles=len(files), providerDigest=provenance['providerDigest'],
        oldBasePin=base_pin, canonicalProvenancePin=pin(canonical), API=False, originalIndependentFullPhysics=False))
    need(pin(base_path) == base_pin, 'OLD_BASE_UNCHANGED')
    # Recheck every selected input against the committed exact pin, without recomputing a new baseline.
    for name, expected in files.items():
        need(pin(ROOT/name) == expected, 'POST_PREPARE_INPUT_DRIFT:' + name)
    print(json.dumps(dict(status='ROOT_STATIONARY_PINS_IO_CONFIRMED', pins=pin(HOME/'PINS.json'),
        seal=pin(HOME/'SOURCE-SEAL.json'), files=len(files), omitted=len(omitted),
        profile=PROFILE, solverCalls=0, codecCalls=0, oldBaseUnchanged=True)))

if __name__ == '__main__':
    main()
