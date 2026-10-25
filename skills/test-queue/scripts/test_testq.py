"""Tests for testq. Run: python3 -m unittest discover -s skills/test-queue/scripts -p 'test_*.py'"""
import importlib.machinery
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
TESTQ = os.path.join(HERE, "testq")
HOME = tempfile.mkdtemp(prefix="testq-test-")
os.environ["TESTQ_HOME"] = HOME

_loader = importlib.machinery.SourceFileLoader("testq", TESTQ)
_spec = importlib.util.spec_from_loader("testq", _loader)
testq = importlib.util.module_from_spec(_spec)
_loader.exec_module(testq)

W = "~/.local/bin/testq run -c"


def rewrite(cmd):
    return testq.rewrite(cmd, 2)


class RewriteTest(unittest.TestCase):
    def test_wraps_test_and_build_commands(self):
        cases = {
            "php artisan test --compact": f"{W} medium -- php artisan test --compact",
            "OTEL=all php artisan test tests/Feature/FooTest.php":
                f"OTEL=all {W} light -- php artisan test tests/Feature/FooTest.php",
            'cd /x && docker compose exec app php artisan test 2>&1 | grep -E "FAIL"':
                f'cd /x && {W} medium -- docker compose exec app php artisan test 2>&1 | grep -E "FAIL"',
            "time docker compose exec app vendor/bin/infection --min-msi=80 > /tmp/i.log 2>&1":
                f"time {W} heavy -- docker compose exec app vendor/bin/infection --threads=2 --min-msi=80 > /tmp/i.log 2>&1",
            "E2E_PORT=1 pnpm exec playwright test a.spec.ts -g 'x'":
                f"E2E_PORT=1 {W} heavy -- pnpm exec playwright test --workers=2 a.spec.ts -g 'x'",
            "timeout 900 npx jest src/a.unit.spec.ts":
                f"{W} light -- timeout 900 npx jest --maxWorkers=2 src/a.unit.spec.ts",
            "pnpm test:e2e": f"{W} heavy -- pnpm test:e2e",
            "pnpm --filter web test": f"{W} medium -- pnpm --filter web test",
            "pnpm exec astro build": f"{W} medium -- pnpm exec astro build",
            "./vendor/bin/phpstan --memory-limit=2G": f"{W} light -- ./vendor/bin/phpstan --memory-limit=2G",
            "docker compose exec app php artisan test --parallel":
                f"{W} medium -- docker compose exec app php artisan test --parallel --processes=2",
            "nohup pnpm exec playwright test > /tmp/e.log 2>&1 &":
                f"nohup {W} heavy -- pnpm exec playwright test --workers=2 > /tmp/e.log 2>&1 &",
            'docker compose exec app sh -c "php artisan test"':
                f'{W} medium -- docker compose exec app sh -c "php artisan test"',
            "composer test": f"{W} medium -- composer test",
            "npm test": f"{W} medium -- npm test",
        }
        for cmd, expected in cases.items():
            with self.subTest(cmd=cmd):
                self.assertEqual(rewrite(cmd), expected)

    def test_leaves_everything_else_alone(self):
        for cmd in (
            'git commit -m "fix phpunit and playwright test"',
            "sed -n 60,110p vendor/infection/infection/src/Process/Factory.php",
            'tail -F /tmp/e2e.log | grep -E --line-buffered "passed|failed"',
            "pnpm add -D vitest",
            "pnpm preview --port 4392",
            "grep -rn phpunit composer.json",
            "docker compose up -d",
            "npx playwright test --ui",
            "vitest --watch",
            "TESTQ_BYPASS=1 pnpm test",
            "~/.local/bin/testq run -c heavy -- pnpm test:e2e",
        ):
            with self.subTest(cmd=cmd):
                self.assertEqual(rewrite(cmd), cmd)

    def test_heredoc_body_is_not_rewritten(self):
        cmd = 'python3 - <<EOF\nsubprocess.run(["pnpm", "test"])\nEOF\npnpm test'
        self.assertEqual(rewrite(cmd), 'python3 - <<EOF\nsubprocess.run(["pnpm", "test"])\nEOF\n'
                                       f"{W} medium -- pnpm test")

    def test_hook_output(self):
        payload = {"tool_name": "Bash", "tool_input": {"command": "pnpm test", "description": "Run", "timeout": 60}}
        out = subprocess.run([sys.executable, TESTQ, "hook"], input=json.dumps(payload),
                             capture_output=True, text=True, check=True).stdout
        updated = json.loads(out)["hookSpecificOutput"]["updatedInput"]
        self.assertEqual(updated, {"command": f"{W} medium -- pnpm test", "description": "Run", "timeout": 60})
        quiet = subprocess.run([sys.executable, TESTQ, "hook"], input='{"tool_name":"Bash","tool_input":{"command":"ls"}}',
                               capture_output=True, text=True, check=True).stdout
        self.assertEqual(quiet, "")


class TunedLimitsTest(unittest.TestCase):
    def test_limits_follow_ram_and_cores(self):
        self.assertEqual(testq.tuned_limits(8, 8), {"budget": 5, "max": {"light": 4, "medium": 1, "heavy": 1}, "workers": 2})
        self.assertEqual(testq.tuned_limits(16, 8), {"budget": 8, "max": {"light": 4, "medium": 2, "heavy": 1}, "workers": 2})
        self.assertEqual(testq.tuned_limits(32, 12), {"budget": 12, "max": {"light": 6, "medium": 3, "heavy": 2}, "workers": 3})
        self.assertEqual(testq.tuned_limits(64, 16), {"budget": 16, "max": {"light": 6, "medium": 4, "heavy": 2}, "workers": 4})


def job(jid, cls, state, queued, started=None):
    return {"id": jid, "class": cls, "state": state, "queued_at": queued, "started_at": started, "project": "p"}


class AdmissionTest(unittest.TestCase):
    cfg = dict(testq.DEFAULTS, budget=8, max={"light": 4, "medium": 2, "heavy": 1}, settle_seconds=0, mem_min_level=20)
    stats = {"mem_level": 50, "load": [1.0, 1.0, 1.0]}

    def admit(self, me, jobs, **overrides):
        return testq.admission(me, jobs, dict(self.cfg, **overrides), dict(self.stats), 100.0)

    def test_heavy_limit_and_budget(self):
        h1, h2 = job("a", "heavy", "running", 1, 1), job("b", "heavy", "waiting", 2)
        self.assertIn("limit", self.admit(h2, [h1, h2]))
        m = job("c", "medium", "waiting", 3)
        self.assertIsNone(self.admit(m, [h1, h2, m]))  # overtakes the class-blocked heavy, 5+3 fits
        m2 = job("d", "medium", "waiting", 4)
        running_m = dict(m, state="running", started_at=5)
        self.assertIn("budget", self.admit(m2, [h1, h2, running_m, m2]))

    def test_fifo_within_class(self):
        first, second = job("a", "medium", "waiting", 1), job("b", "medium", "waiting", 2)
        self.assertIsNotNone(self.admit(second, [first, second]))
        self.assertIsNone(self.admit(first, [first, second]))

    def test_memory_gate_only_when_something_runs(self):
        lone = job("a", "medium", "waiting", 1)
        self.assertIsNone(testq.admission(lone, [lone], self.cfg, {"mem_level": 5, "load": [1]}, 100.0))
        running = job("r", "medium", "running", 0, 0)
        self.assertIn("memory", testq.admission(lone, [running, lone], self.cfg, {"mem_level": 5, "load": [1]}, 100.0))

    def test_light_skips_queue_but_not_its_limit(self):
        waiting_heavy = job("h", "heavy", "waiting", 1)
        light = job("l", "light", "waiting", 2)
        self.assertIsNone(self.admit(light, [waiting_heavy, light]))
        lights = [job(f"x{i}", "light", "running", 0, 0) for i in range(4)]
        self.assertIn("limit", self.admit(light, lights + [light]))

    def test_paused_and_disabled(self):
        me = job("a", "medium", "waiting", 1)
        self.assertIn("paused", self.admit(me, [me], paused=True))
        self.assertIsNone(self.admit(me, [me], paused=True, enabled=False))


class ColimaTest(unittest.TestCase):
    YAML = "# Number of CPUs\ncpu: 4\n\ndisk: 60\n# Size of the VM in GiB\nmemory: 6\nprovision:\n  - mode: system\n    memory: 1\n"

    def setUp(self):
        self.home = tempfile.mkdtemp()
        os.environ["COLIMA_HOME"] = self.home
        os.makedirs(os.path.join(self.home, "default"))
        with open(testq.colima_config_path("default"), "w") as f:
            f.write(self.YAML)

    def tearDown(self):
        del os.environ["COLIMA_HOME"]

    def test_reads_and_rewrites_only_top_level_keys(self):
        self.assertEqual(testq.colima_settings("default"), {"cpu": 4, "memory": 6})
        updated = testq.set_yaml_scalar(self.YAML, "memory", 5)
        self.assertEqual(updated, self.YAML.replace("\nmemory: 6\n", "\nmemory: 5\n"))
        self.assertIn("    memory: 1", updated)
        with self.assertRaises(ValueError):
            testq.set_yaml_scalar("cpu: 2\n", "memory", 4)

    def test_restart_validates_before_touching_the_vm(self):
        env = dict(os.environ, PATH="/nonexistent")  # colima and docker must not be reached

        def run(*args):
            return subprocess.run([sys.executable, TESTQ, "vm", *args], capture_output=True, text=True, env=env)

        self.assertEqual(run("restart", "--memory", "999").returncode, 2)
        self.assertEqual(run("restart", "--profile", "missing").returncode, 1)
        status = json.loads(run("status").stdout)
        self.assertEqual((status["provider"], status["memory_gb"], status["cpus"]), ("colima", 6, 4))

    def test_restart_resizes_and_restarts_containers_that_fail_first(self):
        bin_dir = os.path.join(self.home, "bin")
        os.makedirs(bin_dir)
        log = os.path.join(self.home, "calls.log")
        # nginx (bbb) exits on its first start because its upstream is not up yet
        scripts = {
            "colima": 'echo "colima $*" >> "$LOG"',
            "docker": '''echo "docker $*" >> "$LOG"
case "$*" in
  "ps -q") echo aaa; echo bbb ;;
  "ps -q --no-trunc") echo aaa111; [ "$(grep -c '^docker start' "$LOG")" -ge 2 ] && echo bbb222 ;;
esac
exit 0''',
        }
        for name, body in scripts.items():
            path = os.path.join(bin_dir, name)
            with open(path, "w") as f:
                f.write("#!/bin/sh\n" + body + "\n")
            os.chmod(path, 0o755)
        env = dict(os.environ, PATH=bin_dir + os.pathsep + os.environ["PATH"], LOG=log)
        result = subprocess.run([sys.executable, TESTQ, "vm", "restart", "--memory", "5"],
                                capture_output=True, text=True, env=env, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        with open(log) as f:
            calls = f.read().splitlines()
        self.assertEqual([c for c in calls if c.startswith("colima")], ["colima stop -p default", "colima start -p default"])
        self.assertEqual([c for c in calls if c.startswith("docker start")], ["docker start aaa bbb", "docker start bbb"])
        self.assertEqual(testq.colima_settings("default"), {"cpu": 4, "memory": 5})
        state = testq.read_json(testq.VM_STATE_PATH)
        self.assertEqual((state["phase"], state["memory_gb"], state["containers"]), ("done", 5, 2))
        self.assertFalse(testq.load_config()["paused"])


class RunTest(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(HOME, "config.json"), "w") as f:
            json.dump({"settle_seconds": 0, "mem_min_level": 0, "max": {"heavy": 1}}, f)

    def run_cli(self, *args):
        return subprocess.run([sys.executable, TESTQ, *args], capture_output=True, text=True)

    def test_exit_code_and_history(self):
        result = self.run_cli("run", "-c", "medium", "--", "sh", "-c", "echo out; exit 3")
        self.assertEqual(result.returncode, 3)
        self.assertEqual(result.stdout, "out\n")
        last = testq.read_history(1)[0]
        self.assertEqual((last["class"], last["exit"]), ("medium", 3))
        self.assertEqual(os.listdir(os.path.join(HOME, "jobs")), [])

    def test_heavy_jobs_run_one_at_a_time(self):
        spans = []

        def worker():
            out = self.run_cli("run", "-c", "heavy", "--", sys.executable, "-c",
                               "import time; s=time.time(); time.sleep(1); print(s, time.time())").stdout
            spans.append(tuple(map(float, out.split())))

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for t in threads:
            t.start()
            time.sleep(0.2)
        for t in threads:
            t.join(30)
        self.assertEqual(len(spans), 2)
        (a_start, a_end), (b_start, b_end) = sorted(spans)
        self.assertGreaterEqual(b_start, a_end - 0.05)

    def test_stop_terminates_command_tree(self):
        proc = subprocess.Popen([sys.executable, TESTQ, "run", "-c", "heavy", "--", "sh", "-c", "sleep 30; echo never"],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        deadline = time.time() + 10
        while time.time() < deadline:
            jobs = json.loads(self.run_cli("status", "--json").stdout)["jobs"]
            if jobs and jobs[0].get("child_pid"):
                break
            time.sleep(0.2)
        self.assertEqual(self.run_cli("stop", jobs[0]["id"]).returncode, 0)
        out, _ = proc.communicate(timeout=15)
        self.assertEqual(proc.returncode, 143)
        self.assertNotIn("never", out)


if __name__ == "__main__":
    unittest.main()
