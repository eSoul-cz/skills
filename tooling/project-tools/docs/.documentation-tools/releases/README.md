# Documentation renderer release catalog

Each `<version>.env` file is an immutable, reviewable record mapping a semantic
renderer version to its multi-architecture manifest digest and release
metadata. `LATEST` names the newest non-revoked release recommended for new
installations.

The managed `release-catalog` command is the only parser used by project
wrappers, release automation, and tests:

```text
release-catalog validate
release-catalog latest
release-catalog resolve 0.5.0
release-catalog show 0.5.0
release-catalog contains-image registry/image@sha256:...
```

Catalog entries must record architectures, publication time, source commit,
required configuration schema, upgrade notes, and identifiers for the SBOM,
scan, provenance, and signature. `unknown` is permitted only when importing a
legacy release whose historical provenance cannot be recovered. `unavailable`
records that a security artifact was not produced; this remains explicit
release metadata until the distribution-hardening work makes those artifacts
mandatory.

Installer-enabled releases additionally record `INSTALLER_IMAGE` as an
immutable digest. The public bootstrap refuses to execute an installer when
that field is absent or mutable.

Publishing a registry image is not sufficient to make it resolvable. Commit
the generated release entry and updated `LATEST` in a reviewed follow-up change.
Revocation changes `RELEASE_STATUS` to `revoked`; never delete an entry that may
still be installed in a project.
