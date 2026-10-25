#!/bin/sh
# Installs the shared test queue for agent sessions on this machine:
#   - testq CLI          -> ~/.local/share/testq/testq, linked as ~/.local/bin/testq
#   - tuned limits       -> ~/.local/state/testq/config.json (existing values are kept)
#   - Claude Code hook   -> PreToolUse/Bash in ~/.claude/settings.json (backup next to it)
#   - menu bar widget    -> ~/Applications/TestQ.app + LaunchAgent cz.esoul.testq (macOS)
#
# Usage: install.sh [--no-hook] [--no-widget]
#        install.sh --uninstall [--purge]   (--purge also deletes queue state and history)
#
# Re-run after updating the skill: the copies here do not follow plugin updates.
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
SHARE="$HOME/.local/share/testq"
BIN="$HOME/.local/bin/testq"
STATE="$HOME/.local/state/testq"
SETTINGS="$HOME/.claude/settings.json"
APP="$HOME/Applications/TestQ.app"
LABEL="cz.esoul.testq"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

hook=1
widget=1
uninstall=0
purge=0
for arg in "$@"; do
	case "$arg" in
		--no-hook) hook=0 ;;
		--no-widget) widget=0 ;;
		--uninstall) uninstall=1 ;;
		--purge) purge=1 ;;
		-h|--help) sed -n '2,11p' "$0"; exit 0 ;;
		*) echo "unknown option: $arg" >&2; exit 2 ;;
	esac
done

if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 8))'; then
	echo "testq needs python3 3.8 or newer on PATH" >&2
	exit 1
fi

# Adds or removes the testq PreToolUse hook without touching other settings.
edit_hook() {
	python3 - "$SETTINGS" "$1" "$BIN" <<'EOF'
import json, os, shutil, sys

path, action, binary = sys.argv[1:4]
try:
    with open(path) as f:
        settings = json.load(f)
except FileNotFoundError:
    settings = {}
except ValueError as e:
    sys.exit(f"{path} is not valid JSON ({e}); fix it first, nothing was changed")

hooks = settings.setdefault("hooks", {})
entries = hooks.get("PreToolUse", [])
mine = lambda h: "testq hook" in h.get("command", "")
kept = []
for entry in entries:
    entry = dict(entry, hooks=[h for h in entry.get("hooks", []) if not mine(h)])
    if entry["hooks"]:
        kept.append(entry)
if action == "add":
    kept.append({"matcher": "Bash", "hooks": [{"type": "command", "command": f"{binary} hook", "timeout": 10}]})
if kept:
    hooks["PreToolUse"] = kept
else:
    hooks.pop("PreToolUse", None)
if not hooks:
    settings.pop("hooks", None)

if os.path.exists(path):
    shutil.copy2(path, path + ".bak-testq")
os.makedirs(os.path.dirname(path), exist_ok=True)
tmp = path + ".tmp-testq"
with open(tmp, "w") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")
os.replace(tmp, path)
print(f"{'added' if action == 'add' else 'removed'} the testq hook in {path} (backup: {path}.bak-testq)")
EOF
}

if [ "$uninstall" = 1 ]; then
	if [ "$(uname)" = Darwin ]; then
		launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
		rm -f "$PLIST"
		rm -rf "$APP"
	fi
	if [ -f "$SETTINGS" ]; then
		edit_hook remove
	fi
	rm -f "$BIN"
	rm -rf "$SHARE"
	if [ "$purge" = 1 ]; then
		rm -rf "$STATE"
	fi
	echo "testq uninstalled$( [ "$purge" = 1 ] && echo ' (state purged)' || echo "; state kept in $STATE")"
	exit 0
fi

mkdir -p "$SHARE" "$HOME/.local/bin" "$STATE/jobs"
cp "$HERE/testq" "$SHARE/testq"
chmod +x "$SHARE/testq"
ln -sf "$SHARE/testq" "$BIN"
"$BIN" init >/dev/null
echo "installed $BIN"

if [ "$hook" = 1 ]; then
	edit_hook add
fi

if [ "$widget" = 1 ] && [ "$(uname)" = Darwin ]; then
	if ! command -v swiftc >/dev/null 2>&1; then
		echo "skipping the menu bar widget: swiftc not found (install with: xcode-select --install)"
	else
		mkdir -p "$APP/Contents/MacOS" "$HOME/Library/LaunchAgents"
		echo "building the menu bar widget (takes up to a minute)..."
		swiftc -O -parse-as-library -o "$APP/Contents/MacOS/TestQ" "$HERE/menubar/TestQ.swift"
		cp "$HERE/menubar/Info.plist" "$APP/Contents/Info.plist"
		codesign --force --sign - "$APP" >/dev/null 2>&1 || true
		cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>$LABEL</string>
	<key>ProgramArguments</key><array><string>$APP/Contents/MacOS/TestQ</string></array>
	<key>RunAtLoad</key><true/>
	<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
	<key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
EOF
		launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
		launchctl bootstrap "gui/$(id -u)" "$PLIST"
		echo "menu bar widget running ($APP, starts at login)"
	fi
fi

case ":$PATH:" in
	*":$HOME/.local/bin:"*) ;;
	*) echo "note: add ~/.local/bin to PATH to call testq by name" ;;
esac
echo "new Claude Code sessions pick up the hook; restart running ones. Check with: testq doctor"
