FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS builder

WORKDIR /src
COPY tooling/install-project-tools/go.mod tooling/install-project-tools/go.sum ./
COPY tooling/install-project-tools/*.go ./
COPY tooling/scripts/upgrade_project_tools /fixture/tooling/scripts/upgrade_project_tools
COPY tooling/project-tools /fixture/tooling/project-tools
COPY tooling/install-project-tools/testdata ./testdata
RUN DOCUMENTATION_REPOSITORY_ROOT=/fixture go test -count=1 ./... \
    && go vet ./... \
    && CGO_ENABLED=0 go build \
        -trimpath \
        -ldflags="-s -w" \
        -o /out/install-project-tools \
        .

FROM scratch

COPY --from=builder /out/install-project-tools /install-project-tools

USER 65532:65532

ENTRYPOINT ["/install-project-tools"]
