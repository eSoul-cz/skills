# Future Hosted Renderer Image

Do not create or publish a hosted image during the first implementation. The local Dockerfile is canonical until this plan is explicitly activated.

## Proposed repository

Create a separately owned repository containing the Dockerfile, renderer runtime, dependency pins, tests, and release automation. Keep project-specific titles, assets, templates, and configuration out of the image.

## Release requirements

1. Build linux/amd64 and linux/arm64 images.
2. Pin direct tool versions and record transitive package state.
3. Run sample Markdown, Mermaid, math, image, table, custom-template, redaction, and every-page rendering tests.
4. Generate an SBOM and provenance attestation.
5. Scan operating-system and language packages; define a vulnerability remediation policy.
6. Sign releases when organizational infrastructure supports it.
7. Publish semantic tags and immutable digests to the chosen public or private registry.
8. Retain a documented mapping from tool version to digest.

## Project migration

Add the published digest to `docs/documentation.toml`, switch `pdf.mode` from `local` to `remote`, authenticate with ordinary Docker/Jenkins mechanisms, and run the complete local-versus-remote fixture comparison. Keep the project-local Dockerfile and pins available for audit and fallback unless a later approved policy removes them.

