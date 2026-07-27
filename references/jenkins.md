# Optional Jenkins Integration

CI integration is never default. Inspect the repository's existing `Jenkinsfile`, shared libraries, agent capabilities, timeout, parallel layout, credential handling, and artifact/cleanup behavior. Offer either an adaptive approval-gated patch or a snippet-only handoff.

Prefer a documentation branch within the existing test structure when its runtime fits the pipeline. Keep validation independent of application test images. A portable baseline uses an explicit-version, digest-pinned Docker CLI image, installs Python 3.11+ and Git in its disposable filesystem, mounts the checkout read-only, and runs:

```groovy
stage('Documentation Validation') {
    steps {
        sh '''
            docker run --rm \
                --env HOME=/tmp \
                --volume "$WORKSPACE:$WORKSPACE:ro" \
                --workdir "$WORKSPACE" \
                "docker:<version>-cli@sha256:<digest>" \
                /bin/sh -c '
                    apk add --no-cache git python3 &&
                    git config --global --add safe.directory "$WORKSPACE" &&
                    python3 -m unittest discover -s docs/.documentation-tools/tests &&
                    docs/documentation validate
                '
        '''
    }
}
```

Run `docs/documentation build` only where Docker-daemon access is allowed. An in-repository `when` condition is scheduling logic, not a security boundary because change-request content can modify a repository-loaded `Jenkinsfile`. Enforce daemon trust through a target-branch/shared-library pipeline source, executors without daemon access for untrusted changes, or an explicit trusted-author policy. Record which external control applies.

Mount the checkout read-only when invoking the renderer. The project wrapper grants persistent writes only to its configured PDF/work directories and applies the renderer isolation documented in [pdf-pipeline.md](pdf-pipeline.md). Enumerate each configured guide PDF as a required artifact with `allowEmptyArchive: false`; archive review renders separately as optional artifacts. Runtime `apk add` packages remain mutable inputs even when the CLI base is digest-pinned. Record that residual risk until an approved, separately maintained, digest-pinned documentation runner replaces runtime installation.

Adapt syntax and placement to repository conventions. Do not add registry credentials in local-build mode. If a private remote image is later configured, reuse approved Jenkins credential patterns rather than inventing identifiers. CI can perform mechanical rendering and archive review pages; it does not replace the interactive semantic and every-page visual publication gate.
