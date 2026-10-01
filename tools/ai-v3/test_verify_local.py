"""Exercise verification gates without downloads, package builds or repository mutations."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("verify_local", Path(__file__).with_name("verify-local.py"))
verify_local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_local)
BODY = "```verify\nprintf 'Issue acceptance\\n'\n```"


class LocalVerificationTests(unittest.TestCase):
    def plan(self, paths, full=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for path in paths:
                if path.startswith("packages/"):
                    package = root / "/".join(path.split("/")[:2])
                    package.mkdir(parents=True, exist_ok=True)
                    (package / "package.json").write_text(json.dumps({"scripts": {"lint": "eslint", "type-check": "tsc"}}))
            result = subprocess.CompletedProcess([], 0, "\0".join(paths))
            with patch.object(verify_local, "ROOT", root), patch.object(verify_local.subprocess, "run", return_value=result):
                return verify_local.commands("base", BODY, full)

    def test_empty_verification_blocks(self):
        with self.assertRaisesRegex(ValueError, "nonempty"):
            verify_local.commands("base", "```verify\n# comment\n```")

    def test_docs_only_uses_acceptance_and_pipefail(self):
        checks = self.plan(["docs/autonomy-v3.md"])
        self.assertEqual(len(checks), 1)
        self.assertEqual(checks[0][:5], ["bash", "-e", "-o", "pipefail", "-c"])

    def test_runtime_preserves_package_and_fuzz_gates(self):
        checks = self.plan(["packages/barocss-browser/src/browser-runtime.ts"])
        for command in (["pnpm", "-C", "packages/barocss-browser", "lint"],
                        ["pnpm", "-C", "packages/barocss-browser", "type-check"],
                        ["pnpm", "build:library"], ["node", ".github/scripts/check-packages.mjs"],
                        ["node", "scripts/fuzz/browser-ratchet.mjs"]):
            self.assertIn(command, checks)

    def test_cross_package_or_explicit_full_runs_full_check(self):
        self.assertIn(["pnpm", "check"], self.plan(["packages/barocss/src/index.ts", "packages/barocss-server/src/index.ts"]))
        self.assertIn(["pnpm", "check"], self.plan(["docs/autonomy-v3.md"], full=True))

    def test_failure_stops_before_later_commands(self):
        with patch.object(verify_local.subprocess, "run", side_effect=subprocess.CalledProcessError(1, "first")) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                verify_local.run([["first"], ["must-not-run"]])
            self.assertEqual(run.call_count, 1)


if __name__ == "__main__":
    unittest.main()
