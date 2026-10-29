# Local review with the CodeRabbit CLI

Read this reference only when the local pass runs the CodeRabbit CLI. When `pre-pr-review` runs
instead, it resolves its own scope and scans for credentials.

1. Check the installed CLI version, official installation provenance, authentication, and
   `coderabbit review --help`. Agent mode requires at least v0.4.0. Prefer verified
   package-manager installation; never pipe a downloaded installer to a shell. Do not silently
   upgrade or sign the user in.
2. Inspect the full selected diff, including new files, for credentials and sensitive data
   **before** sending anything to CodeRabbit. Its CLI transmits code to an external service. Do
   the same before publishing commits. When `pre-pr-review` is installed, its scope script does
   this deterministically:
   `node "<pre-pr-review dir>/scripts/review-scope.mjs" --base <remote>/<branch>` (read `secrets`).
3. Run `coderabbit review --agent --base <actual-base-ref>` using a fetched, correct base. For a
   stacked layer use its immediate predecessor, not the stack trunk. Only use `--base-commit` with
   a verified comparison commit supported by the installed CLI.
4. Select the intended committed and uncommitted changes using flags the installed version
   actually supports. Older versions expose `-t all|committed|uncommitted`; newer versions expose
   `--committed`/`--uncommitted`. New untracked files may require `--include-untracked`;
   otherwise stage only owned new files before review. Never claim a file was reviewed if it was
   excluded.

Authentication failures, rate limits, unsupported options, billing confirmation, or incomplete
review output are not clean reviews; fall back to `pre-pr-review` rather than reporting them as
passed. Do not opt into paid credits automatically.
