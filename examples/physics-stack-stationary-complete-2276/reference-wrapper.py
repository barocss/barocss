"""New-profile additive world witness check; original prepared math and CLI remain unchanged."""
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]
KEY = 'stationaryNormalWitnessCheck'


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install(original, checker):
    """Install only after qualified PreparedReference.install has wrapped original.world."""
    evaluate = original.evaluate

    def dispatch(request):
        if type(request) is not dict or request.get('op') != 'world':
            return evaluate(request)
        witness = request.get(KEY)
        if type(witness) is not dict or set(witness) != {'problem', 'result', 'problemWordsF64leHex', 'resultWordsF64leHex'}:
            raise original.F.InputError(original.MESSAGE)
        base = dict(request)
        del base[KEY]
        # The SAME original dispatcher sees all old fields, with only the new key removed.
        reply = evaluate(base)
        # Default population8: no triangle solver, no optional1/2 harness mode, no solve.
        try:
            problem = checker.restore_words(witness['problem'], witness['problemWordsF64leHex'])
            result = checker.restore_words(witness['result'], witness['resultWordsF64leHex'])
        except (ValueError, TypeError):
            raise original.F.InputError(original.MESSAGE) from None
        exact = checker.verify(problem, result)
        return {**reply, KEY: exact}

    original.evaluate = dispatch
    return original


def main():
    prepared = load(ROOT / 'examples/physics-stack-reference-prepared-2276/candidate.py',
                    'stationary_complete_prepared_reference')
    prepared.authenticate()
    checker = load(ROOT / 'examples/physics-stack-stationary-witness-2276/checker.py',
                   'stationary_complete_independent_fraction_checker')
    original = prepared.PreparedReference(prepared.load_original()).install()
    # OLD main owns JSON parsing, known InputError handling, dispatch and compact serializer.
    install(original, checker).main()


if __name__ == '__main__':
    main()
