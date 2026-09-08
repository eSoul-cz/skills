// Design-only DOM inspection. Deliberately not a copy or emulation of the application review bridge.
(async () => {
    const selector = document.querySelector('#frames');
    const iframe = document.querySelector('#design');
    const viewport = document.querySelector('#viewport');
    const stage = document.querySelector('#stage');
    const fit = document.querySelector('#fit');
    const status = document.querySelector('#status');
    const dimensions = document.querySelector('#dimensions');
    let observer;
    let current;
    let root;
    const manifest = await fetch('manifest.json').then(response => {
        if (!response.ok) throw new Error('Cannot read validated manifest.');
        return response.json();
    });
    document.querySelector('#title').textContent = `${manifest.title} — local design preview`;
    const frames = manifest.screens.flatMap(screen => screen.frames.map(frame => ({ ...frame, screenId: screen.id, screenTitle: screen.title })));
    for (const frame of frames) {
        const option = document.createElement('option');
        option.value = frame.entry;
        option.textContent = `${frame.screenTitle} / ${frame.title} (${frame.width}px)`;
        selector.append(option);
    }
    function measure() {
        if (!root || !current) return;
        const height = Math.ceil(root.getBoundingClientRect().height);
        const scale = fit.checked ? Math.min(1, Math.max(1, viewport.clientWidth - 48) / current.width) : 1;
        iframe.style.width = `${current.width}px`;
        iframe.style.height = `${height}px`;
        iframe.style.transform = `scale(${scale})`;
        stage.style.width = `${current.width * scale}px`;
        stage.style.height = `${height * scale}px`;
        dimensions.textContent = `${current.width} × ${height}px · ${Math.round(scale * 100)}%`;
    }
    function open(entry) {
        const frame = frames.find(candidate => candidate.entry === entry);
        if (!frame) return;
        observer?.disconnect();
        root = undefined;
        current = frame;
        selector.value = entry;
        iframe.style.width = `${frame.width}px`;
        iframe.src = `bundle/${entry}`;
        status.textContent = 'Loading frame…';
    }
    iframe.addEventListener('load', () => {
        try {
            const entry = decodeURIComponent(new URL(iframe.contentWindow.location.href).pathname.slice('/bundle/'.length));
            current = frames.find(candidate => candidate.entry === entry);
            if (!current) throw new Error('Navigation is not a declared frame entry. Choose a frame to continue.');
            selector.value = entry;
            iframe.style.width = `${current.width}px`;
            const roots = iframe.contentDocument.querySelectorAll('[data-mockup-screen][data-mockup-frame]');
            root = roots[0];
            if (roots.length !== 1 || root.dataset.mockupScreen !== current.screenId || root.dataset.mockupFrame !== current.id) throw new Error('Root identity does not match this declared frame.');
            observer?.disconnect();
            observer = new ResizeObserver(measure);
            observer.observe(root);
            measure();
            status.textContent = `Identity: ${current.screenId} / ${current.id}. Follow links in the design; comments must be tested in the real app.`;
        } catch (error) { root = undefined; status.textContent = error.message; }
    });
    selector.addEventListener('change', () => open(selector.value));
    fit.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    document.querySelector('#refresh').addEventListener('click', () => open(selector.value));
    open(frames.find(frame => frame.screenId === manifest.start.screen && frame.id === manifest.start.frame).entry);
})().catch(error => { document.querySelector('#status').textContent = error.message; });
