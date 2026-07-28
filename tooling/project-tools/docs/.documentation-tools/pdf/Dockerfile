ARG EISVOGEL_PLATFORM=linux/amd64

FROM golang:1.26.5-bookworm@sha256:1ecb7edf62a0408027bd5729dfd6b1b8766e578e8df93995b225dfd0944eb651 AS go_builder

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

FROM rust:1.97.1-bookworm@sha256:77fac8b98f9f46062bb680b6d25d5bcaabfc400143952ebc572e924bcbedc3fa AS merman_builder

RUN cargo install \
    --locked \
    --root /out \
    --version 0.7.0 \
    merman-cli

FROM pandoc/core:3.6.2@sha256:2a15e4b953fe588c57db82cd920e4eec515bf788bc568ad55ed75a667ca77613 AS pandoc_assets

FROM scratch AS esoul_font_assets

ADD --checksum=sha256:7e65201e9b79159e2300267cc885e16c8dcef2424cdfa09a29bfb0980a94a7ba \
    https://raw.githubusercontent.com/google/fonts/7ff85c87f93ea6cca5f41c69f2e4edcb90240f26/ofl/poppins/Poppins-Regular.ttf \
    /fonts/Poppins-Regular.ttf
ADD --checksum=sha256:983676516167748b74de6f4771fb384c664fd913acb8b471122ecacf5da5ea6c \
    https://raw.githubusercontent.com/google/fonts/7ff85c87f93ea6cca5f41c69f2e4edcb90240f26/ofl/poppins/Poppins-Bold.ttf \
    /fonts/Poppins-Bold.ttf
ADD --checksum=sha256:4fa76ae75b40f926420514044722cb97f32186cafd3b38263cc34dad7174d46d \
    https://raw.githubusercontent.com/google/fonts/7ff85c87f93ea6cca5f41c69f2e4edcb90240f26/ofl/poppins/Poppins-Italic.ttf \
    /fonts/Poppins-Italic.ttf
ADD --checksum=sha256:3572ac8116a0ac7317d342262b29937bcbaf94d8f03f90df6fe666fa7e2fb43a \
    https://raw.githubusercontent.com/google/fonts/7ff85c87f93ea6cca5f41c69f2e4edcb90240f26/ofl/poppins/Poppins-BoldItalic.ttf \
    /fonts/Poppins-BoldItalic.ttf
COPY fonts/esoul/Syne-SemiBold.ttf /fonts/Syne-SemiBold.ttf
ADD --checksum=sha256:6be04893d770899a015649c7aa3b582f871b272f8747a92b78b17c3e5c8b2573 \
    https://raw.githubusercontent.com/google/fonts/7ff85c87f93ea6cca5f41c69f2e4edcb90240f26/ofl/poppins/OFL.txt \
    /licenses/Poppins-OFL.txt
ADD --checksum=sha256:cc43cdce6f91c57989af8459341c276655e34224e954fa69c2ad700831a742d8 \
    https://raw.githubusercontent.com/google/fonts/7ff85c87f93ea6cca5f41c69f2e4edcb90240f26/ofl/syne/OFL.txt \
    /licenses/Syne-OFL.txt

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
COPY --from=esoul_font_assets /fonts /usr/local/share/fonts/esoul
COPY --from=esoul_font_assets /licenses /usr/local/share/licenses/esoul-fonts

COPY --from=go_builder /out/documentation-renderer /usr/local/bin/documentation-renderer
COPY --from=merman_builder /out/bin/merman-cli /usr/local/bin/merman-cli
COPY filters /opt/documentation-tools/filters
COPY themes /opt/documentation-tools/themes
COPY header.tex mermaid-config.json /opt/documentation-tools/

ARG DOC_UID=1000
ARG DOC_GID=1000
RUN chmod 0644 /usr/local/share/fonts/esoul/*.ttf /usr/local/share/licenses/esoul-fonts/*.txt \
    && fc-cache --force \
    && mkdir -p /workspace \
    && chown "${DOC_UID}:${DOC_GID}" /workspace

WORKDIR /workspace

FROM runtime_base AS smoke_test

COPY testdata/smoke /workspace
RUN sh /workspace/assert-renderer \
    && sh /workspace/assert-visual-regression \
    && sh /workspace/assert-raster-cache

FROM runtime_base AS runtime

COPY --from=smoke_test /tmp/documentation-renderer-smoke-passed /opt/documentation-tools/smoke-passed

ARG DOC_UID=1000
ARG DOC_GID=1000
USER ${DOC_UID}:${DOC_GID}

ENTRYPOINT ["/usr/local/bin/documentation-renderer"]
