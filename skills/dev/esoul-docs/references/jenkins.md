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

The project wrapper mounts the checkout read-only, grants persistent writes only to its configured PDF/work directories when required, and applies the renderer isolation documented in [pdf-pipeline.md](pdf-pipeline.md). Enumerate each configured guide PDF as a required artifact with `allowEmptyArchive: false`; archive review renders separately as optional artifacts. Pin and govern the agent's Docker tooling through the existing CI image or agent-management process.

Remote-profile projects (the installer default) pull the digest-pinned renderer image anonymously from the public Scaleway registry, so no pull credentials are needed. In CI, `DOCUMENTATION_REMOTE_RENDERER_IMAGE` must be set to the exact `pdf.image` digest of `docs/documentation.toml` through trusted pipeline configuration, not through the repository `Jenkinsfile`; without it the stage above fails. Local image build is the exception: it needs no registry credentials, but the build then trusts the agent's Docker tooling. If a private mirror is configured, reuse approved Jenkins credential patterns rather than inventing identifiers.

The documentation stage must fit the node's time limit. For the eSoul shared libraries and pipeline conventions use the `esoul-jenkins-libraries` skill when installed. A `Jenkinsfile` change is small administrative work: ask the user whether an issue or task exists for it (`docs/project_guidelines/workflow.md` › Tasking).

Adapt syntax and placement to repository conventions. CI can perform mechanical rendering and archive review pages; it does not replace the interactive semantic and every-page visual publication gate.
