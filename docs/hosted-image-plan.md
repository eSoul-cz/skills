# Hosted Renderer Image

The hosted-image plan is active. The repository tooling tree remains the canonical source for the Dockerfile, renderer runtime, dependency pins, fixtures, release catalog, and release automation. Project-specific titles, assets, templates, and configuration values stay outside the images; the installer carries only a generic starter configuration.

## Public Scaleway release

The root Jenkins pipeline:

1. runs the Docker-first renderer, visual-regression, and bootstrap-installer tests;
2. reviews the pinned Go and Rust builder versions and verifies replacement multi-architecture image digests before preparing each release;
3. requires the semantic tool version to be an existing Git tag on the build commit before starting release publication;
4. builds native linux/amd64 and linux/arm64 images with BuildKit SPDX and maximum provenance attestations through the `dockerHelpers` shared library;
5. runs Go tests, vet checks, and the complete Markdown/Mermaid/math/table/landscape PDF smoke fixture inside each architecture build;
6. publishes or reuses an attested renderer and bootstrap installer independently, so a retry can complete a partially published release, using the semantic tool version, `latest`, and valid Git tags in the public `rg.fr-par.scw.cloud/esoul-internal-tools` registry;
7. resolves both merged manifest digests, generates standalone SPDX, provenance, and Trivy reports, signs and verifies the images and reports with Cosign, and publishes the exact artifact set through a GitHub Release;
8. archives a fingerprinted catalog candidate containing the immutable renderer and installer references and the renderer's GitHub artifact URLs.

The reviewed catalog under `tooling/project-tools/docs/.documentation-tools/releases/` is the durable authority and outlives Jenkins retention. Jenkins validates the existing catalog before building and emits a candidate entry after publication. Commit that entry and update `LATEST` in a reviewed follow-up change; registry publication alone does not make a version resolvable. Legacy `0.5.0` is recorded with explicit `unknown`/`unavailable` provenance fields rather than invented metadata.

Jenkins temporarily adds the renderer candidate to the installer-image build context so a newly published installer can bootstrap its matching renderer immediately, then publishes the signed release artifacts and adds the installer digest and artifact URLs to the final archived candidate. Only this unpublished intermediate candidate may use `unavailable` supply-chain fields; the final active candidate must contain HTTPS artifact URLs. The reviewed follow-up commit and immutable semantic release tag remain the durable catalog and bootstrap authority. The installer image contains the static Go installer, the default configuration template, and only the remote managed-file profile; it excludes renderer source, local Docker build inputs, fonts, and visual fixtures.

The renderer image keeps project configuration and authored documentation outside the runtime and continues to enforce the same read-only checkout, network isolation, dropped capabilities, and writable-directory boundaries as local mode.

## Supply-chain publication

The shared-library publication step uses portable GitHub-hosted Sigstore bundles by default, so image signatures do not depend on Scaleway supporting OCI Referrers. Jenkins must provide the exact pinned Cosign, Syft, GitHub CLI, and Trivy versions required by the installed `dockerHelpers` library, a repository-scoped GitHub release token, and an encrypted Cosign key and password through credentials.

GitHub Release publication is resumable: matching draft assets are verified and reused, incomplete or invalid drafts remain unpublished, and an already-published release is accepted only when its tag, commit, images, checksums, public key, and signatures match exactly. Enabling immutable GitHub Releases provides an additional repository-side control.

The remaining organizational task is to define a vulnerability-remediation policy for the generated Trivy reports. Scaleway registry-backed Cosign signatures can be tested separately against a disposable repository; they are not required by the default bundle workflow.

## Project migration

Run `tooling/scripts/upgrade_project_tools /absolute/project/root --to VERSION` from a trusted repository checkout to preview a migration. The Docker-first planner resolves the exact semantic version through the managed release catalog and then reuses the managed installer’s drift, collision, downgrade, profile, and configuration-schema checks. It mounts the project read-only and reports the exact `pdf.mode`, `pdf.image`, managed-file, and `DOCUMENTATION_REMOTE_RENDERER_IMAGE` changes without applying them. A catalog entry alone is insufficient: the selected tooling revision must contain the matching managed-tool bundle.

After reviewing and approving the plan, append `--apply`. The installer atomically migrates managed files to the remote profile and updates only `pdf.mode` and `pdf.image`; it validates the resulting manifest, checksums, retired-file set, and configuration before committing. Any validation failure restores the previous managed files, manifest, and project configuration. The command prints, but does not install, the required `DOCUMENTATION_REMOTE_RENDERER_IMAGE` value.

After commit, the upgrade wrapper temporarily supplies the planned allowlist value and runs `docs/documentation doctor`. A doctor failure returns a nonzero status but retains the internally validated transaction: external Docker, registry, authentication, or network readiness must not cause otherwise consistent project files to be rewritten again. Persist the printed value through trusted local and CI configuration and rerun doctor after correcting any readiness issue. The catalog supplies release metadata and compatibility status but deliberately does not replace the independent runtime allowlist. The remote profile is the normal installation target and retires the project-local Dockerfile, Go source, Lua filters, dependency manifests, and fixtures while retaining the wrapper, version marker, default header, catalog, and managed-file manifest. Keep `tooling/scripts/install_project_tools /absolute/project/root --upgrade --local` only as a renderer-development or emergency-recovery path; local-versus-hosted output equivalence is not a release gate.
