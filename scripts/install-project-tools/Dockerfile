FROM golang:1.24-bookworm AS builder

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

ENTRYPOINT ["/install-project-tools"]
