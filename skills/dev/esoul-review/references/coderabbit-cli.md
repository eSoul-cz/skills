# Local review with the CodeRabbit CLI

Read this reference only when the local pass runs the CodeRabbit CLI. When Path A's own review runs instead, it resolves its own scope and scans for credentials.

1. Check the installed CLI version, authentication and `coderabbit review --help`; agent mode is available when the help lists `--agent`. Install through the package manager and ask the user before upgrading the CLI or signing in.
2. Inspect the full selected diff, including new files, for credentials and sensitive data **before** sending anything to CodeRabbit: its CLI transmits code to an external service. Do the same before publishing commits. The scope script of this skill does this deterministically: `node "$SKILL_DIR/scripts/review-scope.mjs" --base <remote>/<branch>` (read `secrets`).
3. Run `coderabbit review --agent --base <actual-base-ref>` using a fetched, correct base. For a stacked layer use its immediate predecessor, not the stack trunk. Use `--base-commit` only with a verified comparison commit the installed CLI supports.
4. Select the intended committed and uncommitted changes using flags the installed version supports (`coderabbit review --help` lists `-t all|committed|uncommitted` or `--committed`/`--uncommitted`). New untracked files may need `--include-untracked`; otherwise stage only owned new files before review. A file the review excluded is not reported as reviewed.

Authentication failures, rate limits, unsupported options, billing confirmation or incomplete review output are not clean reviews; fall back to Path A's own review and report them as such. Paid credits are not opted into automatically.
