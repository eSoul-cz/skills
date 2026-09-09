// Injected only by the local bundle server. Reports geometry and paints the authoring-only
// "show clickable" affordance. Never feedback, persistence, or executable commands.
(() => {
    const uiOrigin = new URL(document.currentScript.src).searchParams.get('uiOrigin');
    let nonce;
    let root;
    let style;
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
    /**
     * Outline what a reader can click, using paint-only properties.
     * `outline` and `box-shadow` sit outside the box model, so switching this on cannot move the
     * design or change the height this probe reports. Anything that reserved space would.
     * The tint is an inset shadow rather than a background so a coloured button keeps its colour.
     */
    function paintHints(on, scale) {
        const root = document.documentElement;
        if (!style) {
            style = document.createElement('style');
            style.setAttribute('data-esoul-preview-hints', '');
            style.textContent = `:root[data-esoul-preview-hints] [data-mockup-screen] :is(a[href], button, label[for], summary, [onclick]) {
    outline: var(--esoul-preview-hints-width, 2px) dashed rgba(226, 109, 92, 0.85) !important;
    outline-offset: var(--esoul-preview-hints-width, 2px) !important;
    box-shadow: inset 0 0 0 100vmax rgba(226, 109, 92, 0.1) !important;
}`;
            document.head.append(style);
        }
        // Counter the parent's fit zoom so the outline stays visible on a scaled-down desktop frame.
        root.style.setProperty('--esoul-preview-hints-width', `${(2 / scale).toFixed(2)}px`);
        if (on) root.setAttribute('data-esoul-preview-hints', '');
        else root.removeAttribute('data-esoul-preview-hints');
    }

    window.addEventListener('message', event => {
        if (event.source !== parent || event.origin !== uiOrigin) return;
        const data = event.data;
        if (!data || typeof data.nonce !== 'string' || data.nonce.length > 64 || !data.nonce.length) return;
        if (data.type === 'esoul-preview:hints') {
            if (data.nonce !== nonce || typeof data.on !== 'boolean' || !Number.isFinite(data.scale) || data.scale <= 0 || data.scale > 1) return;
            paintHints(data.on, data.scale);
            return;
        }
        if (data.type !== 'esoul-preview:inspect') return;
        nonce = data.nonce;
        lastReport = undefined;
        report();
    });
    new MutationObserver(schedule).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['data-mockup-screen', 'data-mockup-frame'],
    });
})();
