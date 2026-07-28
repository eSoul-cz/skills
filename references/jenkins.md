# Optional Jenkins Integration

CI integration is never default. Inspect the repository's existing `Jenkinsfile`, shared libraries, agent capabilities, timeout, parallel layout, credential handling, and artifact/cleanup behavior. Offer either an adaptive approval-gated patch or a snippet-only handoff.

Prefer a documentation branch within the existing test structure when its runtime fits the pipeline. Keep validation independent of application test images. The documentation wrapper requires a Docker CLI with daemon access; it builds or pulls the configured renderer and then validates the read-only checkout inside that image. A baseline on an agent that already provides trusted Docker access is:

```groovy
stage('Documentation Validation') {
    steps {
        sh '''
            docs/documentation validate
        '''
    }
}
```

Run `docs/documentation build` only where Docker-daemon access is allowed. An in-repository `when` condition is scheduling logic, not a security boundary because change-request content can modify a repository-loaded `Jenkinsfile`. Enforce daemon trust through a target-branch/shared-library pipeline source, executors without daemon access for untrusted changes, or an explicit trusted-author policy. Record which external control applies.

The project wrapper mounts the checkout read-only, grants persistent writes only to its configured PDF/work directories when required, and applies the renderer isolation documented in [pdf-pipeline.md](pdf-pipeline.md). Enumerate each configured guide PDF as a required artifact with `allowEmptyArchive: false`; archive review renders separately as optional artifacts. Pin and govern the agent's Docker tooling through the existing CI image or agent-management process. Record that residual input until an approved, separately maintained, digest-pinned documentation runner replaces local image builds.

Adapt syntax and placement to repository conventions. Do not add registry credentials in local-build mode. If a private remote image is later configured, reuse approved Jenkins credential patterns rather than inventing identifiers. CI can perform mechanical rendering and archive review pages; it does not replace the interactive semantic and every-page visual publication gate.

## Hosted renderer release pipeline

This skill repository's root `Jenkinsfile` uses the `dockerHelpers` shared library. It runs the Docker-first renderer and installer gates, then uses `dockerBuildMultiArch` on `main` or `master` to publish `linux/amd64` and `linux/arm64` images to `rg.fr-par.scw.cloud/esoul-internal-tools/documentation-tools`. The semantic value in the managed `VERSION` file is the primary tag; `latest` and valid Git tags pointing at the commit are aliases.

After the helper merges the architecture manifests, the pipeline resolves the immutable manifest digest and archives a fingerprinted `documentation-renderer-<version>.env` mapping plus a validated `release-catalog-candidate/`. The entry includes architectures, UTC publication time, full source commit, configuration schema, compatibility notes, and placeholders for later SBOM, scan, provenance, and signature identifiers. Commit the reviewed candidate and update the durable catalog's `LATEST`; Jenkins artifacts alone are not authoritative after retention expires. Use its `DOCUMENTATION_REMOTE_RENDERER_IMAGE` value both in trusted runtime configuration and as the digest placed in project `documentation.toml`. Registry access reuses the established `scaleway_secret_key` credential and shared login/logout helpers.

The pipeline is suitable for the private internal registry. SBOM generation, vulnerability-policy enforcement, provenance attachment, and release signing remain required before treating the image as an externally governed distribution.
