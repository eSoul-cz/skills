# Hosted Renderer Image

The hosted-image plan is active. The skill repository remains the canonical source for the Dockerfile, renderer runtime, dependency pins, fixtures, release catalog, and release automation. Project-specific titles, assets, templates, and configuration stay outside the image.

## Initial private-registry release

The root Jenkins pipeline:

1. runs the Docker-first renderer smoke test and installer test image;
2. builds native linux/amd64 and linux/arm64 images through the `dockerHelpers` shared library;
3. runs Go tests, vet checks, and the complete Markdown/Mermaid/math/table/landscape PDF smoke fixture inside each architecture build;
4. publishes the semantic tool version, `latest`, and valid Git tags to `rg.fr-par.scw.cloud/esoul-internal-tools/documentation-tools`;
5. resolves the merged manifest digest and archives a fingerprinted catalog candidate containing the digest, architectures, publication time, source commit, configuration schema, compatibility notes, and security-artifact identifiers.

The reviewed catalog under `assets/project-tools/docs/.documentation-tools/releases/` is the durable authority and outlives Jenkins retention. Jenkins validates the existing catalog before building and emits a candidate entry after publication. Commit that entry and update `LATEST` in a reviewed follow-up change; registry publication alone does not make a version resolvable. Legacy `0.5.0` is recorded with explicit `unknown`/`unavailable` provenance fields rather than invented metadata.

The image keeps project configuration and authored documentation outside the runtime and continues to enforce the same read-only checkout, network isolation, dropped capabilities, and writable-directory boundaries as local mode.

## Remaining distribution hardening

Before treating the image as an externally governed distribution:

1. generate and retain an SBOM and provenance attestation;
2. scan operating-system and language packages and define a vulnerability-remediation policy;
3. sign releases when organizational infrastructure supports it;
4. record the approved version-to-digest mapping outside ephemeral build retention.

## Project migration

Run `scripts/upgrade_project_tools /absolute/project/root --to VERSION` from the skill repository to preview a migration. The Docker-first planner resolves the exact semantic version through the managed release catalog and then reuses the managed installer’s drift, collision, downgrade, profile, and configuration-schema checks. It mounts the project read-only and reports the exact `pdf.mode`, `pdf.image`, managed-file, and `DOCUMENTATION_REMOTE_RENDERER_IMAGE` changes without applying them. A catalog entry alone is insufficient: the selected skill revision must contain the matching managed-tool bundle.

After reviewing the plan, add its immutable image to `docs/documentation.toml`, switch `pdf.mode` from `local` to `remote`, and provide the same value through trusted `DOCUMENTATION_REMOTE_RENDERER_IMAGE` runtime configuration. Run `docs/documentation doctor`, then complete a local-versus-remote comparison. The catalog supplies release metadata and compatibility status but deliberately does not replace the independent runtime allowlist.

After that comparison passes, run `scripts/install_project_tools /absolute/project/root --upgrade --remote`. The remote profile retires the project-local Dockerfile, Go source, Lua filters, dependency manifests, and fixtures while retaining the wrapper, version marker, default header, and managed-file manifest. A project can explicitly return to the complete local profile with `--upgrade --local` if an offline or repository-local build fallback is required.
