ARG EISVOGEL_PLATFORM=linux/amd64

FROM golang:1.24-bookworm@sha256:1a6d4452c65dea36aac2e2d606b01b4a029ec90cc1ae53890540ce6173ea77ac AS go_builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY Dockerfile ./
COPY filters ./filters
COPY cmd ./cmd
RUN go test ./... \
    && go vet ./... \
    && CGO_ENABLED=0 go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/documentation-renderer \
    ./cmd/documentation-renderer

FROM rust:1.95-bookworm@sha256:6258907abe69656e41cd992e0b705cdcfabcbbe3db374f92ed2d47121282d4a1 AS merman_builder

RUN cargo install \
    --locked \
    --root /out \
    --version 0.7.0 \
    merman-cli

FROM pandoc/core:3.6.2@sha256:2a15e4b953fe588c57db82cd920e4eec515bf788bc568ad55ed75a667ca77613 AS pandoc_assets

# Eisvogel is a text asset, so it is safe to copy it from the pinned amd64-only
# extra image into both native runtime architectures.
FROM --platform=${EISVOGEL_PLATFORM} pandoc/extra:3.6.2@sha256:f0a02ba3e2287fc70a15cca12a32240bccf3d2c0a522da4147edfe3e64b321da AS eisvogel_assets

FROM debian:bookworm-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818 AS runtime_base

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
        fonts-noto-cjk \
        fonts-noto-core \
        fonts-noto-mono \
        imagemagick \
        librsvg2-bin \
        libstdc++6 \
        lmodern \
        poppler-utils \
        texlive-fonts-recommended \
        texlive-latex-extra \
        texlive-xetex \
    && rm -rf /var/lib/apt/lists/*

COPY --from=pandoc_assets /usr/local/bin/pandoc /usr/local/bin/pandoc
COPY --from=pandoc_assets /lib/ld-musl-*.so.1 /lib/
COPY --from=pandoc_assets /usr/lib/libz.so.1 /usr/lib/libz.so.1
COPY --from=pandoc_assets /usr/lib/libz.so.1.3.1 /usr/lib/libz.so.1.3.1
COPY --from=pandoc_assets /usr/lib/liblua-5.4.so.0 /usr/lib/liblua-5.4.so.0
COPY --from=pandoc_assets /usr/lib/lua5.4 /usr/lib/lua5.4
COPY --from=pandoc_assets /usr/lib/libgmp.so.10 /usr/lib/libgmp.so.10
COPY --from=pandoc_assets /usr/lib/libgmp.so.10.5.0 /usr/lib/libgmp.so.10.5.0
COPY --from=pandoc_assets /usr/lib/libffi.so.8 /usr/lib/libffi.so.8
COPY --from=pandoc_assets /usr/lib/libffi.so.8.1.4 /usr/lib/libffi.so.8.1.4
COPY --from=eisvogel_assets /usr/local/share/pandoc/templates/eisvogel.latex /opt/eisvogel.latex

COPY --from=go_builder /out/documentation-renderer /usr/local/bin/documentation-renderer
COPY --from=merman_builder /out/bin/merman-cli /usr/local/bin/merman-cli
COPY filters /opt/documentation-tools/filters
COPY header.tex mermaid-config.json /opt/documentation-tools/

ARG DOC_UID=1000
ARG DOC_GID=1000
RUN mkdir -p /workspace \
    && chown "${DOC_UID}:${DOC_GID}" /workspace

WORKDIR /workspace

FROM runtime_base AS smoke_test

COPY testdata/smoke /workspace
RUN /workspace/assert-renderer

FROM runtime_base AS runtime

COPY --from=smoke_test /tmp/documentation-renderer-smoke-passed /opt/documentation-tools/smoke-passed

ARG DOC_UID=1000
ARG DOC_GID=1000
USER ${DOC_UID}:${DOC_GID}

ENTRYPOINT ["/usr/local/bin/documentation-renderer"]
