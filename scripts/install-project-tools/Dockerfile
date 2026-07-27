FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS builder

WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN go test ./... \
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
