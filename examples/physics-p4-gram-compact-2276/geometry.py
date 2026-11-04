"""Private one-function geometry namespace adapter; no producer or fallback."""
import hashlib
import importlib.util
from pathlib import Path
import sys
import types

_ROOT = Path(__file__).resolve().parents[2]
_GRAM_PATH = _ROOT / 'examples/physics-p4-gram-sat-2276/gram_sat.py'
_FROZEN = (
    ('examples/physics-p4-gram-sat-2276/gram_sat.py', '3e241cbce819f9e9d887737759914340b6821a6960eba1a00f16895f835e450b'),
    ('examples/physics-p4-gram-sat-2276/CONTRACT.md', '511470c76953d68fb91767477aa024631e8dceeec2da2345c4d1575dc9971f9d'),
    ('examples/physics-p4-gram-sat-2276/SCALING-NOTE.md', '0f787fb9df1255abcfa6f7e06a1f3f27070f4d804369f7df9c617d7fb2321e3f'),
    ('examples/physics-p4-radical-compact-2276/backend.py', '5fed3731c6b84d8563d8cd118912b34a0a1c3d711aed38ed2396d2b5fb1e3415'),
    ('examples/physics-p4-radical-grid-2276/radical_grid.py', 'f9a57fa5ed8aca0a671cbb4a49b0033bfcfdc89b45466320782f88ceb5169afc'),
    ('examples/physics-p4-radical-grid-2276/CONTRACT.md', '30fa88317f5b982b79f581648f00062c9c0d637ef1ee4c7eb61c169e291adad1'),
    ('examples/physics-p4-sat-2276/integer_sat.py', 'b1c2f4a4d291c52b9182864fea658381afd482aa34da7d300997a81bf45a3b1e'),
)


def _load_gram():
    for relative, expected in _FROZEN:
        data = (_ROOT / relative).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('FROZEN_GRAM_COMPONENT_DRIFT:' + relative)
    name = '_p4_gram_compact_frozen_model'
    spec = importlib.util.spec_from_file_location(name, _GRAM_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_GRAM = _load_gram()


def make_namespace(oldk):
    """Caller supplies the authenticated old module, never request data."""
    original = dict(vars(oldk))
    if not all(name in original for name in ('prepare', 'solve_model', 'MicroFailure')):
        raise ValueError('ORIGINAL_GEOMETRY_NAMESPACE_REQUIRED')
    if not callable(original['prepare']) or not callable(original['solve_model']):
        raise ValueError('ORIGINAL_GEOMETRY_FUNCTIONS_REQUIRED')
    error_class = original['MicroFailure']
    if not isinstance(error_class, type) or not issubclass(error_class, Exception):
        raise ValueError('ORIGINAL_GEOMETRY_ERROR_CLASS_REQUIRED')

    def solve_model(a, b, normalized, m):
        try:
            return _GRAM.solve_model(a, b, normalized, m)
        except _GRAM._K.MicroFailure as error:
            if isinstance(error, error_class):
                raise
            # Separate authenticated imports have different class identities.
            # Preserve reason and cause using the provided old component type.
            raise error_class(str(error)) from error

    copied = dict(original)
    copied['solve_model'] = solve_model
    return types.SimpleNamespace(**copied)
