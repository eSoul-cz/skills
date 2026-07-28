# Hosted Renderer Image

The hosted-image plan is active. The repository tooling tree remains the canonical source for the Dockerfile, renderer runtime, dependency pins, fixtures, release catalog, and release automation. Project-specific titles, assets, templates, and configuration values stay outside the images; the installer carries only a generic starter configuration.

## Public Scaleway release

The root Jenkins pipeline:

1. runs the Docker-first renderer, visual-regression, and bootstrap-installer tests;
2. builds native linux/amd64 and linux/arm64 images through the `dockerHelpers` shared library;
3. runs Go tests, vet checks, and the complete Markdown/Mermaid/math/table/landscape PDF smoke fixture inside each architecture build;
4. publishes the renderer and bootstrap installer with the semantic tool version, `latest`, and valid Git tags to the public `rg.fr-par.scw.cloud/esoul-internal-tools` registry;
5. resolves both merged manifest digests, archives a fingerprinted renderer catalog candidate, and archives the immutable installer reference separately.

The reviewed catalog under `tooling/project-tools/docs/.documentation-tools/releases/` is the durable authority and outlives Jenkins retention. Jenkins validates the existing catalog before building and emits a candidate entry after publication. Commit that entry and update `LATEST` in a reviewed follow-up change; registry publication alone does not make a version resolvable. Legacy `0.5.0` is recorded with explicit `unknown`/`unavailable` provenance fields rather than invented metadata.

Jenkins temporarily adds the generated candidate to the installer-image build context so a newly published installer can bootstrap its matching renderer immediately. The reviewed follow-up commit remains the durable catalog authority. The installer image contains the static Go installer, the default configuration template, and only the remote managed-file profile; it excludes renderer source, local Docker build inputs, fonts, and visual fixtures.

The renderer image keeps project configuration and authored documentation outside the runtime and continues to enforce the same read-only checkout, network isolation, dropped capabilities, and writable-directory boundaries as local mode.

## Remaining distribution hardening

Before treating the image as an externally governed distribution:

1. generate and retain an SBOM and provenance attestation;
2. scan operating-system and language packages and define a vulnerability-remediation policy;
3. sign releases when organizational infrastructure supports it;
4. record the approved version-to-digest mapping outside ephemeral build retention.

## Project migration

Run `tooling/scripts/upgrade_project_tools /absolute/project/root --to VERSION` from a trusted repository checkout to preview a migration. The Docker-first planner resolves the exact semantic version through the managed release catalog and then reuses the managed installer’s drift, collision, downgrade, profile, and configuration-schema checks. It mounts the project read-only and reports the exact `pdf.mode`, `pdf.image`, managed-file, and `DOCUMENTATION_REMOTE_RENDERER_IMAGE` changes without applying them. A catalog entry alone is insufficient: the selected tooling revision must contain the matching managed-tool bundle.

After reviewing and approving the plan, append `--apply`. The installer atomically migrates managed files to the remote profile and updates only `pdf.mode` and `pdf.image`; it validates the resulting manifest, checksums, retired-file set, and configuration before committing. Any validation failure restores the previous managed files, manifest, and project configuration. The command prints, but does not install, the required `DOCUMENTATION_REMOTE_RENDERER_IMAGE` value.

After commit, the upgrade wrapper temporarily supplies the planned allowlist value and runs `docs/documentation doctor`. A doctor failure returns a nonzero status but retains the internally validated transaction: external Docker, registry, authentication, or network readiness must not cause otherwise consistent project files to be rewritten again. Persist the printed value through trusted local and CI configuration and rerun doctor after correcting any readiness issue. The catalog supplies release metadata and compatibility status but deliberately does not replace the independent runtime allowlist. The remote profile is the normal installation target and retires the project-local Dockerfile, Go source, Lua filters, dependency manifests, and fixtures while retaining the wrapper, version marker, default header, catalog, and managed-file manifest. Keep `tooling/scripts/install_project_tools /absolute/project/root --upgrade --local` only as a renderer-development or emergency-recovery path; local-versus-hosted output equivalence is not a release gate.
