"""Root-only source/data hash seal. No numerical, candidate or checker imports."""
import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def require(ok, message):
    if not ok:
        raise ValueError(message)


def pin(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return dict(bytes=path.stat().st_size, sha256=digest.hexdigest())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate-directory', required=True)
    parser.add_argument('--reference-directory', required=True)
    parser.add_argument('--protocol', required=True)
    parser.add_argument('--reviewed-protocol-sha', required=True)
    args = parser.parse_args()
    files, external = {}, {}

    def add(path, expected=None):
        path = path if path.is_absolute() else ROOT / path
        path = path.resolve()
        if path.name.startswith(('WORKSTATUS', 'ROADMAP')) or path == ROOT / 'README.md':
            return  # Mutable coordination/main navigation is not execution authority.
        actual = pin(path)
        require(expected is None or actual == expected, 'FROZEN_INPUT_DRIFT:' + str(path))
        try:
            key = str(path.relative_to(ROOT))
        except ValueError:
            external[str(path)] = actual
        else:
            files[key] = actual

    def tree(directory):
        directory = directory.resolve()
        require(directory.is_relative_to(ROOT / 'examples'), 'OWNED_SOURCE_DIRECTORY_REQUIRED')
        for path in sorted(directory.rglob('*')):
            require(not path.is_symlink(), 'NO_SOURCE_SYMLINKS')
            if path.is_file():
                if 'evidence' in path.relative_to(directory).parts or '__pycache__' in path.parts:
                    continue
                if path.name != 'AUTHOR-FREEZE-01.json':
                    add(path)

    corpus_path = HERE / 'CORPUS.json'
    corpus = json.loads(corpus_path.read_bytes())
    for name, expected in corpus['authorities'].items():
        add(Path(name), expected)
    for frame in corpus['frames']:
        for name in ('request', 'currentOracle', 'positionV2Oracle'):
            item = frame[name]
            add(Path(item['path']), {key: item[key] for key in ('bytes', 'sha256')})
    # Authenticate original published manifest pins without importing their code.
    for manifest, field in [('examples/physics-p4-position-v2-2276/FREEZE-01.json', 'inputs'),
                            ('examples/physics-p4-position-v2-2276/dependencies.json', 'pins'),
                            ('examples/physics-p4-compact-v2-2276/dependencies.json', 'pins')]:
        path = ROOT / manifest
        add(path)
        for name, expected in json.loads(path.read_bytes())[field].items():
            add(Path(name), expected)
    tree(HERE)
    tree(ROOT / args.candidate_directory)
    tree(ROOT / args.reference_directory)
    reference_bank_path = ROOT / args.reference_directory / 'bank.json'
    reference_bank = json.loads(reference_bank_path.read_bytes())
    for name, expected in reference_bank['sourcePins'].items():
        add(ROOT / name, expected)
    core = ROOT / args.candidate_directory
    for name in ('candidate.mjs', 'smallworker.mjs', 'CONTRACT.md', 'ALLOCATION.md', 'GUARD-POLICY.md'):
        require((core / name).is_file(), 'REQUIRED_FINAL_NATIVE_SOURCE:' + name)
        add(core / name)
    for name in ('wrapper.py', 'node_bridge.py'):
        add(HERE / name)
    # Original immutable pricing, exact text and Python outer-layout authority.
    original = ROOT / 'examples/physics-p4-position-witness-v2-2276'
    approval = json.loads((original / 'ROOT-APPROVAL-01.json').read_bytes())
    require(approval['status'] == 'ROOT_CONTRACT_REVIEW_PASS_IMPLEMENTATION_AUTHORIZED', 'ACTUAL_ORIGINAL_ROOT_APPROVAL')
    add(original / 'ROOT-APPROVAL-01.json')
    add(original / 'METERING.md')
    add(original / 'ALLOCATION.md')
    for name, expected in approval['inputs'].items():
        add(original / name, expected)
    correction = json.loads((original / 'ROOT-FORMAT-CORRECTION-02.json').read_bytes())
    require(correction['status'] == 'ROOT_EXACT_TEXT_CORRECTION_BEFORE_IMPLEMENTATION_EXECUTION', 'ROOT_EXACT_TEXT_CORRECTION')
    add(original / 'ROOT-FORMAT-CORRECTION-02.json')
    require(pin(original / 'ROOT-APPROVAL-01.json') == correction['previousApprovalPin'], 'PRESERVED_PRIOR_ROOT_APPROVAL')
    for row in correction['observedAuthorities']:
        add(ROOT / row['path'], row['pin'])
    protocol_path = (ROOT / args.protocol).resolve()
    add(protocol_path)
    protocol = json.loads(protocol_path.read_bytes())
    require(protocol['status'] == 'AUTHORED_FOR_ROOT_REVIEW', 'FINAL_AUTHORED_PROTOCOL_REQUIRED')
    require(pin(protocol_path)['sha256'] == args.reviewed_protocol_sha, 'EXACT_ROOT_REVIEWED_PROTOCOL_HASH')
    def no_placeholders(value):
        if isinstance(value, str):
            require(not value.startswith('PENDING_'), 'NO_PENDING_PROTOCOL_FIELDS')
        elif isinstance(value, dict):
            for child in value.values():
                no_placeholders(child)
        elif isinstance(value, list):
            for child in value:
                no_placeholders(child)
    no_placeholders(protocol)
    source_snapshot_path = ROOT / protocol['sourcePinsFile']
    add(source_snapshot_path, protocol['sourcePinsPin'])
    source_snapshot = json.loads(source_snapshot_path.read_bytes())
    for name, expected in source_snapshot['files'].items():
        add(Path(name), expected)
    require(protocol['maxNumericalCandidateChecks'] == 10, 'TEN_CHECK_CAP')
    require(protocol['WorldCalls'] == 0 and protocol['baselineReruns'] == 0, 'NO_WORLD_OR_BASELINE')
    require(protocol['stages']['A']['maxCandidateChecks'] == 10 and protocol['stages']['A']['SATCalls'] == 0, 'STAGE_A_PURE_KERNEL')
    stage_b = protocol['stages']['B']
    require(stage_b['freshFullWrapperCommands'] == 1 and stage_b['frames'] == 6 and stage_b['compactCalls'] == 432, 'ONE_STAGE_B_SIX_FRAME_WRAPPER')
    require(stage_b['coldQpCalls'] == 0 and stage_b['engineWorldCalls'] == 0 and stage_b['duplicateSixFrameRuns'] == 0, 'NO_OLD_QP_WORLD_OR_DUPLICATE_COST_RUN')
    require(protocol['costDecisions'] == 1, 'ONE_POST_NUMERIC_COST_DECISION')
    require(protocol['costAuthority'] == 'SUM_PARENT_SIX_CONTEXT_PROCESS_CPU_PLUS_OWNED_NODE_ENTIRE_LIFETIME_RUSAGE_CHILDREN_AFTER_WAIT', 'CONSERVATIVE_NATIVE_CPU_AUTHORITY')
    require(protocol['savedBaselineCoreCpuNs'] == 773147000, 'FIXED_BASELINE')
    require(protocol['costRatioNumerator'] == 9 and protocol['costRatioDenominator'] == 10, 'FIXED_COST_GATE')
    bank_directory = (ROOT / protocol['bankDirectory']).resolve()
    require(bank_directory.is_relative_to((ROOT / args.reference_directory).resolve() / 'evidence'), 'OWNED_GENERATED_BANK')
    wrapper_manifest_path = ROOT / protocol['wrapperManifest']
    add(wrapper_manifest_path)
    wrapper_manifest = json.loads(wrapper_manifest_path.read_bytes())
    require((wrapper_manifest_path.parent / wrapper_manifest['bankDirectory']).resolve() == bank_directory, 'WRAPPER_SAME_GENERATED_BANK')
    original_b = json.loads((bank_directory / 'stage-b.json').read_bytes())
    require(wrapper_manifest['cases'] == original_b['cases'], 'ORIGINAL_WRAPPER_CASES_AND_PINS_UNCHANGED')
    for name, expected in wrapper_manifest['dependencyPins'].items():
        add(Path(name), expected)
    for manifest_name in ('stage-a.json', 'stage-b.json'):
        manifest = json.loads((bank_directory / manifest_name).read_bytes())
        require(manifest['bankPin'] == pin(reference_bank_path), 'MATERIALIZED_BANK_SOURCE_PIN')
        for case in manifest['cases']:
            require(Path(case['request']).name == case['request'], 'MATERIALIZED_REQUEST_FILENAME')
            add(bank_directory / case['request'], case['requestPin'])
    for bank_path in sorted(bank_directory.rglob('*')):
        require(not bank_path.is_symlink(), 'NO_GENERATED_BANK_SYMLINKS')
        if bank_path.is_file():
            add(bank_path)
    g0_reference = ROOT / protocol['g0']['referenceDirectory']
    tree(g0_reference)
    g0_pins = json.loads((g0_reference / 'PINS.json').read_bytes())
    for name, expected in g0_pins['sources'].items():
        add(g0_reference / name, expected)
    for name, expected in g0_pins['tools'].items():
        add(Path(name), expected)
    g0_bank = (ROOT / protocol['g0']['bankDirectory']).resolve()
    bank_authority = ROOT / protocol['g0']['bankAuthorityDirectory']
    require(g0_bank.is_relative_to(bank_authority.resolve() / 'evidence'), 'ORIGINAL_IMMUTABLE_G0_BANK')
    require((g0_reference / g0_pins['originalBank']).resolve() == g0_bank, 'SAME_ORIGINAL_G0_REQUEST_ORACLE_BYTES')
    for name, expected in g0_pins['bank'].items():
        add(g0_bank / name, expected)
    g0_manifest = json.loads((g0_bank / 'manifest.json').read_bytes())
    require(g0_manifest['caseCount'] == 32 and g0_manifest['candidateCalls'] == g0_manifest['WorldCalls'] == 0, 'EXACT_DATA_ONLY_G0_BANK')
    require(g0_manifest['sourcePins'] == json.loads((bank_authority / 'PINS.json').read_bytes()), 'ORIGINAL_M0_GENERATOR_SOURCE_INVARIANCE')
    for name, expected in g0_manifest['files'].items():
        require(Path(name).name == name, 'G0_BANK_FILENAME')
        add(g0_bank / name, expected)
    for path in sorted(g0_bank.iterdir()):
        if path.is_file():
            add(path)
    require(protocol['guardPolicy']['scope'] == 'GCD_REM_LOOP_ONLY_CHECKED_ENTRY_THEN_PROVEN_RANGE_INVARIANT' and protocol['guardPolicy']['allOldGuardChecksUnchanged'] is False and protocol['guardPolicy']['pricesAndCapsUnchanged'] is True, 'EXPLICIT_LOCAL_GCD_GUARD_OVERRIDE')
    add(ROOT / protocol['guardPolicy']['path'])
    for name in protocol['externalToolFiles']:
        require(Path(name).is_absolute(), 'TOOL_PATH_ABSOLUTE')
        add(Path(name), protocol['externalToolFiles'][name])
    output = dict(protocol='p4-position-witness-harness-author-freeze-v1', status='AUTHORED_NOT_EXECUTED',
                  files=files, externalToolFiles=external,
                  runProtocol=str(protocol_path.relative_to(ROOT)), rootReviewedProtocolSHA256=args.reviewed_protocol_sha,
                  archivePolicy='WORKSPACE_FILES_ONLY_EXTERNAL_TOOL_FILES_EXCLUDED',
                  authorNumericalCalls=0, authorCandidateCalls=0, authorReferenceCalls=0,
                  authorCheckerCalls=0, authorWorldCalls=0, authorCompilerCalls=0,
                  sealBoundary='Hash authentication only; no numerical or cost qualification')
    with (HERE / 'AUTHOR-FREEZE-01.json').open('x') as stream:
        json.dump(output, stream, indent=2)
        stream.write('\n')


if __name__ == '__main__':
    main()
