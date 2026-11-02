#!/usr/bin/env python3
"""Receipt/scope audit only. Does not import or run a numerical implementation."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASE = '7105c4755fcbf4f0cbc764b864a55bf550f741b3'
PREFIX = 'examples/physics-stack-solver-2276/'


def need(value, message):
    if not value:
        raise AssertionError(message)


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


def read(name):
    return json.loads((HERE / 'evidence' / name).read_text())


def main(output):
    need(not output.exists(), 'preserve previous audit')
    need(git('branch', '--show-current') == 'codex/physics-stack-solver-2276', 'branch ownership')
    need(git('rev-parse', 'HEAD') == BASE, 'precommit parent')
    need(git('config', 'user.name') == 'easylogic' and git('config', 'user.email') == 'cyberuls@gmail.com', 'Git identity')
    changed = set(git('diff', '--name-only', BASE).splitlines())
    changed.update(git('ls-files', '--others', '--exclude-standard').splitlines())
    need(changed and all(p.startswith(PREFIX) for p in changed), 'exclusive new directory scope')
    pins = {
        'examples/physics-motion-nogo-2276/stack-study.py': '70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2',
        'examples/physics-motion-nogo-2276/stack-equilibrium.py': '43918b579209d55d52991bb2f20da9612e8a7f97d5bbb735711bfb2c3b91dc8c',
        'examples/physics-motion-nogo-2276/evidence/stack-study-01/result.json': 'f8941733862d59a49730c5f5624d99186e7d9f8a1f307dda3026371efc2b89db',
        'examples/physics-motion-nogo-2276/evidence/equilibrium-study-01/result.json': 'e570e89c488bc89f6a22c5a34875156b1a43628f3af1312c9437826f3b8020f9',
        'examples/physics-rigid-full-pair-position-world/evidence/native-final-a1b9e0a5/manifest.json': 'b9f3a446022d8bedf65070f5ea43694fedcc7208b7de408c5067a6ce608cd42d',
    }
    for path, digest in pins.items():
        need(hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest, 'immutable prior input: ' + path)
    first_names = ['first-source-01', 'first-emitted-02', 'first-source-02', 'first-emitted-03']
    first = [read(n + '/result.json') for n in first_names]
    reference = first[0]['results'][0]
    need(sum(x['actualSolves'] for x in first) == 6, 'archive solve count')
    for receipt in first:
        need(receipt['status'] == 'FIRST_PATCH_SOLVER_AND_INDEPENDENT_ORACLE_PASS', 'first patch status')
        for result in receipt['results']:
            need(result == reference, 'first source/emission physical report differs')
    tests = []
    for name in ['source-tests-01', 'first-emitted-02', 'source-tests-02', 'first-emitted-03', 'error-tests-01']:
        commands = read(name + '/commands.json')['records']
        for command in commands:
            need(command['exit'] == 0, 'successful suite command')
        for path in sorted((HERE / 'evidence' / name).glob('*.stdout')):
            match = re.search(r'^# tests (\d+)$', path.read_text(), re.M)
            if match:
                need(re.search(r'^# fail 0$', path.read_text(), re.M), 'test failure')
                tests.append({'path': str(path.relative_to(ROOT)), 'passed': int(match[1])})
    need(sum(x['passed'] for x in tests) == 103, 'executed tests including staged repeats')
    source = read('world-source-03/result.json')
    emitted = read('world-emitted-03/result.json')
    need(emitted['candidateEmissionParity'] is True and source['reports'] == emitted['reports'], 'final World emission parity')
    need(source['reports'] == read('world-source-02/result.json')['reports'], 'error-path repair changed resolved results')
    need(source['reports'] == read('world-emitted-02/result.json')['reports'], 'prior final-type graph differs')
    for receipt in source['reports']:
        need(receipt['failure']['kind'] == 'independent-contact-geometry' and not receipt['privateTrajectoryGO'], 'preserved geometry NO_GO')
    need([r['independentlyAcceptedSteps'] for r in source['reports']] == [1, 0, 0], 'qualified prefixes')
    attempts = ['world-source-01', 'world-source-02', 'world-emitted-02', 'world-source-03', 'world-emitted-03']
    world_count = sum(sum(r['normalSolves'] for r in read(n + ('/execution-failure.json' if n == 'world-source-01' else '/result.json'))['reports']) for n in attempts)
    need(world_count == 17, 'all World candidate calls, including failed guard attempt')
    for name in ['first-emitted-01', 'world-source-01', 'world-emitted-01']:
        need((HERE / 'evidence' / name / ('failure.txt' if name == 'first-emitted-01' else 'execution-failure.json')).exists(), 'first failure missing')
    keys = ['work_id:', 'artifact_type:', 'status:', 'owner_role:', 'source_request:', 'last_updated:']
    markdown = []
    for path in sorted(HERE.glob('*.md')):
        text = path.read_text()
        need(text.startswith('---\n') and all(k in text.split('---', 2)[1] for k in keys), 'artifact metadata: ' + path.name)
        markdown.append(path.name)
    report = {'status': 'BOUNDED_RECEIPT_AND_SCOPE_AUDIT_PASS', 'parent': BASE, 'branch': git('branch', '--show-current'),
              'changedFileCountBeforeAudit': len(changed), 'onlyOwnedNewDirectory': True, 'priorPins': pins,
              'firstArchiveSolves': 6, 'worldCandidateSolvesAllAttempts': world_count,
              'candidateUnitCallsIncludedInThoseSolveCounts': False, 'uniqueCandidateAndVerifierTests': 27,
              'uniqueErrorPathTests': 3, 'stagedTestExecutions': sum(x['passed'] for x in tests), 'tests': tests,
              'firstPatchIndependentMaxima': reference['verification']['maxima'],
              'finalWorldReports': source['reports'], 'finalCandidateEmissionParity': True,
              'sourceVersionRefs': [str(p.relative_to(ROOT)) for p in sorted((HERE / 'evidence').glob('*/source.json'))],
              'markdownMetadataChecked': markdown, 'numericalImplementationsRunByAudit': 0,
              'legacyStructureCheck': {'command': ['python3', '-B', '.ai/check.py'], 'exit': 1,
                  'observedFailure': "ModuleNotFoundError: No module named 'yaml'", 'validationReached': False,
                  'newDependencyInstalled': False, 'evidenceOrigin': 'captured tool output; not a successful structural validation'},
              'publicApiIntegrated': False, 'heldWorkersResumed': False, 'hardwareValidated': False}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['status', 'stagedTestExecutions', 'firstArchiveSolves', 'worldCandidateSolvesAllAttempts']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    main(parser.parse_args().output.resolve())
