// Injected only by the local bundle server. Reports geometry, never feedback or executable commands.
(() => {
    const uiOrigin = new URL(document.currentScript.src).searchParams.get('uiOrigin');
    let nonce;
    let root;
    let scheduled = false;
    let lastReport;

    /** Coalesce DOM/resize notifications into one measurement per animation frame. */
    function schedule() {
        if (!nonce || scheduled) return;
        scheduled = true;
        requestAnimationFrame(report);
    }
    const observer = new ResizeObserver(schedule);

    /** Report only this document's marked root identity and bounded height to the expected parent. */
    function report() {
        scheduled = false;
        if (!nonce) return;
        let payload;
        let entry;
        try {
            if (!location.pathname.startsWith('/bundle/')) throw new Error('Not a bundle entry');
            entry = decodeURIComponent(location.pathname.slice('/bundle/'.length));
        } catch {
            payload = { type: 'esoul-preview:error', nonce, reason: 'entry' };
        }
        if (!payload) {
            const roots = document.querySelectorAll('[data-mockup-screen], [data-mockup-frame]');
            const nextRoot = roots.length === 1 ? roots[0] : undefined;
            if (root !== nextRoot) {
                observer.disconnect();
                root = nextRoot;
                if (root) observer.observe(root);
            }
            if (!root || !root.dataset.mockupScreen || !root.dataset.mockupFrame) {
                payload = { type: 'esoul-preview:error', nonce, reason: 'root' };
            } else {
                const height = Math.ceil(root.getBoundingClientRect().height);
                payload = !Number.isSafeInteger(height) || height < 1 || height > 65536
                    ? { type: 'esoul-preview:error', nonce, reason: 'height' }
                    : { type: 'esoul-preview:frame', nonce, entry, screenId: root.dataset.mockupScreen, frameId: root.dataset.mockupFrame, height };
            }
        }
        if (lastReport && payload.type === lastReport.type && payload.nonce === lastReport.nonce
            && payload.reason === lastReport.reason && payload.entry === lastReport.entry
            && payload.screenId === lastReport.screenId && payload.frameId === lastReport.frameId
            && payload.height === lastReport.height) return;
        lastReport = payload;
        parent.postMessage(payload, uiOrigin);
    }
    window.addEventListener('message', event => {
        if (event.source !== parent || event.origin !== uiOrigin) return;
        const data = event.data;
        if (!data || data.type !== 'esoul-preview:inspect' || typeof data.nonce !== 'string' || data.nonce.length > 64 || !data.nonce.length) return;
        nonce = data.nonce;
        lastReport = undefined;
        report();
    });
    new MutationObserver(schedule).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-mockup-screen', 'data-mockup-frame'],
    });
})();
