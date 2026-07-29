FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS builder

ARG DOCUMENTATION_TOOLS_VERSION=0.0.0

WORKDIR /src
COPY tooling/install-project-tools/go.mod tooling/install-project-tools/go.sum ./
COPY tooling/install-project-tools/*.go ./
COPY tooling/scripts/upgrade_project_tools /fixture/tooling/scripts/upgrade_project_tools
COPY tooling/project-tools /fixture/tooling/project-tools
COPY tooling/project-templates /fixture/tooling/project-templates
RUN printf '%s\n' "${DOCUMENTATION_TOOLS_VERSION}" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
    && printf '%s\n' "${DOCUMENTATION_TOOLS_VERSION}" \
        > /fixture/tooling/project-tools/docs/.documentation-tools/VERSION \
    && DOCUMENTATION_REPOSITORY_ROOT=/fixture go test -count=1 ./... \
    && go vet ./... \
    && CGO_ENABLED=0 go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/install-project-tools \
        . \
    && mkdir -p /out/project-tools \
    && /out/install-project-tools \
        --asset-root /fixture/tooling/project-tools \
        --profile remote \
        /out/project-tools \
    && rm /out/project-tools/docs/.documentation-tools/managed-files.json

FROM scratch

COPY --from=builder /out/install-project-tools /install-project-tools
COPY --from=builder /out/project-tools /opt/documentation-tools/project-tools
COPY --from=builder /fixture/tooling/project-templates/docs/documentation.toml /opt/documentation-tools/documentation.toml

ENV DOCUMENTATION_INSTALLER_ASSET_ROOT=/opt/documentation-tools/project-tools

USER 65532:65532

ENTRYPOINT ["/install-project-tools"]
