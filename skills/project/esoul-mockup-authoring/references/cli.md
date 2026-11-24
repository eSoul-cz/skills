# Helper CLI details

Read when the default bundle, app root, PHP runtime, ports or preview behavior matter.

Omitting the bundle path selects `example/` relative to this skill, not the current directory. The app root defaults to `ESOUL_MOCKUP_APP_ROOT` or the current working directory, never the skill's install location; the checkout and the PHP binary are trusted inputs ([security.md](security.md#validator-and-trusted-checkout)). Explicit bundle/app-root paths are resolved from the current directory. `--php /path/to/php` or `PHP_BINARY` selects the runtime; use the application's PHP version rather than bypassing Composer's platform check. `--help` explains the complete CLI. The application also exposes `php bin/console mockups:validate DIRECTORY --json` for callers already running its CLI environment.

**Standalone preview.** When the app root has no `vendor/autoload.php` and `config/mockups/manifest.schema.json` (no application checkout), `preview` skips PHP, reads `mockup.json` structurally (title, screens, frame entries exist) and prints `Standalone preview ... UNVALIDATED`. Use it to look at a bundle; run `validate --app-root` against the application checkout before any publish, because only that is validation.

The preview UI serves only on `http://127.0.0.1:8731/` by default; use the exact printed URL. Bundle assets are served on a separate, automatically allocated loopback port, but executable documents receive an opaque sandbox origin. Both listeners stop with Ctrl+C. `preview` keeps running until stopped, so when an agent harness manages long-running processes, start it through its managed-process tool rather than a blocking shell invocation. Refresh after asset changes; restart after manifest changes to revalidate and reload identities.
