FROM pandoc/extra:3.6.2 AS pandoc_assets

FROM node:22-bookworm-slim

ARG DOC_UID=1000
ARG DOC_GID=1000

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
        chromium \
        fonts-noto-cjk \
        fonts-noto-core \
        fonts-noto-mono \
        imagemagick \
        librsvg2-bin \
        lmodern \
        poppler-utils \
        python3 \
        texlive-fonts-recommended \
        texlive-latex-extra \
        texlive-xetex \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global @mermaid-js/mermaid-cli@11.4.3

COPY --from=pandoc_assets /usr/local/bin/pandoc /usr/local/bin/pandoc
COPY --from=pandoc_assets /lib/ld-musl-x86_64.so.1 /lib/ld-musl-x86_64.so.1
COPY --from=pandoc_assets /usr/lib/libz.so.1 /usr/lib/libz.so.1
COPY --from=pandoc_assets /usr/lib/libz.so.1.3.1 /usr/lib/libz.so.1.3.1
COPY --from=pandoc_assets /usr/lib/liblua-5.4.so.0 /usr/lib/liblua-5.4.so.0
COPY --from=pandoc_assets /usr/lib/lua5.4 /usr/lib/lua5.4
COPY --from=pandoc_assets /usr/lib/libgmp.so.10 /usr/lib/libgmp.so.10
COPY --from=pandoc_assets /usr/lib/libgmp.so.10.5.0 /usr/lib/libgmp.so.10.5.0
COPY --from=pandoc_assets /usr/lib/libffi.so.8 /usr/lib/libffi.so.8
COPY --from=pandoc_assets /usr/lib/libffi.so.8.1.4 /usr/lib/libffi.so.8.1.4
COPY --from=pandoc_assets /usr/local/share/pandoc/templates/eisvogel.latex /opt/eisvogel.latex
COPY renderer.py /opt/documentation-tools/renderer.py
COPY markdown_images.py /opt/documentation-tools/markdown_images.py
COPY header.tex /opt/documentation-tools/header.tex
COPY mermaid-config.json /opt/documentation-tools/mermaid-config.json
COPY puppeteer-config.json /opt/documentation-tools/puppeteer-config.json

RUN mkdir -p /workspace \
    && chown "${DOC_UID}:${DOC_GID}" /workspace

WORKDIR /workspace
USER ${DOC_UID}:${DOC_GID}

ENTRYPOINT ["python3", "/opt/documentation-tools/renderer.py"]
