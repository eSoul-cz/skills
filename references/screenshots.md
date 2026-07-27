# Screenshot Workflow

## Manifest and capture

Create `docs/user-guide/SCREENSHOTS.md` lazily from the bundled template. Require one entry per published screenshot with route/state, viewport, visible content, sample-data needs, capture status, suspected sensitivity, redaction decision, approval, and alt text.

Capture through available browser tooling when possible. Otherwise prepare exact human capture steps. Use only a local environment or an explicitly approved non-production environment by default. Obtain explicit approval before production capture or before starting/seeding an environment when that changes state.

Store raw captures only under:

```text
docs/.documentation-work/raw-screenshots/
```

Never place raw captures directly in the published images directory. Warn that deleting a file does not remove it from Git history if it was already committed.

## Sensitivity review

Inspect names, email addresses, credentials, tokens, secrets, payloads, errors, IDs, hostnames, browser chrome, avatars, notifications, and client-confidential data. Suggest precise regions and risk-appropriate treatments. The user may approve an unredacted image.

## Redaction plan

Create a JSON plan under the ignored work directory:

```json
{
  "source": "docs/.documentation-work/raw-screenshots/users.png",
  "output": "docs/.documentation-work/redacted-screenshots/users.png",
  "regions": [
    {"x": 120, "y": 220, "width": 420, "height": 42, "style": "mosaic", "block_size": 14},
    {"x": 800, "y": 30, "width": 320, "height": 50, "style": "solid", "color": "#111111"}
  ]
}
```

Run `docs/documentation redact <plan>`. The tool writes a new metadata-stripped image and never deletes the original.

- `solid` is the default and is recommended for credentials, tokens, and high-risk identifiers.
- `mosaic` is available only when explicitly selected; it uses deterministic downsampling and nearest-neighbor enlargement, normally with 14-pixel native blocks.
- Optional top-level `crop = {x, y, width, height}` trims the entire screenshot before region redaction.

Mosaic can reveal approximate length and visual density. Explain this limitation.

## Promotion

1. Show the redacted copy to the user at useful zoom.
2. Require human verification of every proposed redaction and the remaining image.
3. Copy only the approved image into the guide's published image directory.
4. Update the screenshot manifest and Markdown alt text.
5. Delete raw originals only after explicit confirmation. Do not claim secure deletion from Git history or backups.
