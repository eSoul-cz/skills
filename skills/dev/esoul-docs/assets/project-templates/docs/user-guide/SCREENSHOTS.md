# Screenshot Manifest

Raw captures belong in `raw-screenshots/` inside the configured `work_dir` (`docs/.documentation-work/raw-screenshots/` with the default). Only approved images belong in the published guide image directory.

Rules enforced by `docs/documentation validate`: the first column is a normalized project-relative path containing `/`; `Image dimensions` is `W×H`; `Approval` is `Approved` or `Not required` once the image is published. Replace the placeholder row before publishing.

| Filename | Route or state | Viewport | Image dimensions | Required visible content | Sample data | Capture status | Suspected sensitivity | Redaction decision | Approval | Alt text |
|---|---|---|---|---|---|---|---|---|---|---|
| `docs/user-guide/images/example.png` | Describe the exact screen state | Desktop 1440×900 | 1440×900 | List required UI | Safe fixture | Planned | None identified | Pending | Pending | Describe the screenshot's purpose |
