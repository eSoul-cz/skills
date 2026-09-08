// Local design measurement only; no application review or feedback protocol.
// The nonce binds reports to a load, not to our probe: bundle scripts can spoof declared identities
// and heights within the accepted bounds. These are untrusted layout hints, never trusted geometry.
(async () => {
    const selector = document.querySelector('#frames');
    const iframe = document.querySelector('#design');
    const viewport = document.querySelector('#viewport');
    const stage = document.querySelector('#stage');
    const fit = document.querySelector('#fit');
    const status = document.querySelector('#status');
    const dimensions = document.querySelector('#dimensions');
    const [manifest, config] = await Promise.all(['manifest.json', 'preview-config.json'].map(async path => {
        const response = await fetch(path);
        if (!response.ok) throw new Error('Cannot read preview configuration.');
        return response.json();
    }));
    const bundleOrigin = new URL(config.bundleOrigin).origin;
    if (bundleOrigin !== config.bundleOrigin || bundleOrigin === location.origin || new URL(bundleOrigin).hostname !== '127.0.0.1' || new URL(bundleOrigin).protocol !== 'http:') {
        throw new Error('Bundle origin must be a separate loopback HTTP origin.');
    }
    const frames = manifest.screens.flatMap(screen => screen.frames.map(frame => ({ ...frame, screenId: screen.id, screenTitle: screen.title })));
    let current;
    let height = 0;
    let nonce;
    document.querySelector('#title').textContent = `${manifest.title} — local design preview`;
    for (const frame of frames) {
        const option = document.createElement('option');
        option.value = frame.entry;
        option.textContent = `${frame.screenTitle} / ${frame.title} (${frame.width}px)`;
        selector.append(option);
    }

    /** Fit a bounded height report using the manifest's trusted design width, not a child-supplied width. */
    function measure() {
        if (!current || !height) return;
        const scale = fit.checked ? Math.min(1, Math.max(1, viewport.clientWidth - 48) / current.width) : 1;
        iframe.style.width = `${current.width}px`;
        iframe.style.height = `${height}px`;
        iframe.style.transform = `scale(${scale})`;
        stage.style.width = `${current.width * scale}px`;
        stage.style.height = `${height * scale}px`;
        dimensions.textContent = `${current.width} × ${height}px · ${Math.round(scale * 100)}%`;
    }

    /** Navigate only to a declared entry and invalidate reports from the previous document immediately. */
    function open(entry) {
        const frame = frames.find(candidate => candidate.entry === entry);
        if (!frame) return;
        nonce = undefined;
        current = frame;
        height = 0;
        dimensions.textContent = '';
        selector.value = entry;
        iframe.style.width = `${frame.width}px`;
        iframe.src = `${bundleOrigin}/bundle/${entry}`;
        status.textContent = 'Loading isolated frame…';
    }

    iframe.addEventListener('load', () => {
        nonce = crypto.randomUUID();
        current = undefined;
        height = 0;
        dimensions.textContent = '';
        status.textContent = 'Waiting for isolated frame measurement…';
        // Opaque origins cannot be addressed directly; only this exact iframe receives initialization.
        iframe.contentWindow.postMessage({ type: 'esoul-preview:inspect', nonce }, '*');
    });
    window.addEventListener('message', event => {
        if (event.source !== iframe.contentWindow || event.origin !== 'null' || !nonce) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.nonce !== nonce) return;
        if (data.type === 'esoul-preview:error') {
            const errors = {
                root: 'The frame must have exactly one marked root matching its declared identity.',
                entry: 'Navigation is not a bundle frame entry. Choose a frame to continue.',
                height: 'Frame height is outside the local preview range of 1–65,536px.',
            };
            if (typeof data.reason === 'string' && Object.hasOwn(errors, data.reason)) status.textContent = errors[data.reason];
            return;
        }
        if (data.type !== 'esoul-preview:frame' || !Number.isSafeInteger(data.height) || data.height < 1 || data.height > 65536) return;
        const frame = frames.find(candidate => candidate.entry === data.entry && candidate.screenId === data.screenId && candidate.id === data.frameId);
        if (!frame) return;
        current = frame;
        height = data.height;
        selector.value = frame.entry;
        measure();
        status.textContent = `Identity: ${frame.screenId} / ${frame.id}. Follow links in the design; comments must be tested in the real app.`;
    });
    selector.addEventListener('change', () => open(selector.value));
    fit.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    document.querySelector('#refresh').addEventListener('click', () => open(selector.value));
    open(frames.find(frame => frame.screenId === manifest.start.screen && frame.id === manifest.start.frame).entry);
})().catch(error => { document.querySelector('#status').textContent = error.message; });
