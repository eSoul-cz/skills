# Helper CLI details

Read when the default bundle, app root, PHP runtime, ports or preview behavior matter.

Omitting the bundle path selects `example/` relative to this skill, not the current directory. The app root defaults to `ESOUL_MOCKUP_APP_ROOT` or the current working directory, never the skill's install location. Explicit bundle/app-root paths are resolved from the current directory. `--php /path/to/php` or `PHP_BINARY` selects the runtime; use the application's PHP version rather than bypassing Composer's platform check. `--help` explains the complete CLI. The application also exposes `php bin/console mockups:validate DIRECTORY --json` for callers already running its CLI environment.

The preview UI serves only on `http://127.0.0.1:8731/` by default; use the exact printed URL. Bundle assets are served on a separate, automatically allocated loopback port, but executable documents receive an opaque sandbox origin. Both listeners stop with Ctrl+C. When an agent harness manages long-running processes, start the command through its managed-process tool rather than a blocking shell invocation. Refresh after asset changes; restart after manifest changes to revalidate and reload identities.
