/**
 * eSoul UAT layout audit. Read-only; evaluate in the page and use the returned JSON.
 *
 * Playwright: await page.evaluate(`(${source})(${JSON.stringify({ touch: true })})`)
 * Chrome extension (JavaScript tool): paste the file content followed by
 *   ;(__esoulLayoutAudit)({ touch: false })
 *
 * Returns { url, viewport, findings: [{ check, element, detail, rect }] }. Findings are
 * candidates: confirm each on a screenshot before reporting it as a bug.
 */
function __esoulLayoutAudit(options = {}) {
    const touch = Boolean(options.touch);
    const limit = options.limit ?? 25;
    const findings = [];
    // Mobile emulation widens the layout viewport to fit overflowing content, so compare
    // against the device width the caller configured, not window.innerWidth.
    const vw = options.viewportWidth ?? window.innerWidth;
    const vh = options.viewportHeight ?? window.innerHeight;
    const INTERACTIVE = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [role=switch], [tabindex]:not([tabindex="-1"])';

    const describe = (el) => {
        if (!el || !el.tagName) return String(el);
        let s = el.tagName.toLowerCase();
        if (el.id) s += `#${el.id}`;
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
        if (cls.length) s += `.${cls.join('.')}`;
        const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        return label ? `${s} „${label}“` : s;
    };
    const rectOf = (el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + window.scrollX), y: Math.round(r.top + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const visible = (el) => {
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const push = (check, el, detail) => {
        if (findings.filter((f) => f.check === check).length >= limit) return;
        findings.push({ check, element: describe(el), detail, rect: el && el.getBoundingClientRect ? rectOf(el) : null });
    };
    const inScrollContainer = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true;
        }
        return false;
    };
    const isFixedLike = (el) => {
        for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
            const pos = getComputedStyle(p).position;
            if (pos === 'fixed' || pos === 'sticky') return true;
        }
        return false;
    };

    // 1. Page overflow
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    if (docWidth > vw + 1) {
        const culprits = [...document.body.querySelectorAll('*')]
            .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !inScrollContainer(el))
            .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)
            .slice(0, 3);
        findings.push({ check: 'page-overflow', element: culprits.map(describe).join(' | ') || 'document', detail: `šířka dokumentu ${docWidth} px > viewport ${vw} px`, rect: null });
    }

    const all = [...document.body.querySelectorAll('*')].filter(visible);

    for (const el of all) {
        const style = getComputedStyle(el);
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const overflowX = el.scrollWidth - el.clientWidth;
        const overflowY = el.scrollHeight - el.clientHeight;
        // 2. Element overflow: content spills out of a box that does not scroll or clip
        if (el.clientWidth > 0 && overflowX > 1 && style.overflowX === 'visible' && !['HTML', 'BODY'].includes(el.tagName) && !inScrollContainer(el)) {
            push('element-overflow', el, `obsah přetéká o ${overflowX} px do šířky`);
        }
        // 3. Clipped text without a way to read it
        if (hasText && (/(hidden|clip)/.test(style.overflowX) || /(hidden|clip)/.test(style.overflowY))) {
            const clippedX = overflowX > 1 && /(hidden|clip)/.test(style.overflowX);
            const clippedY = overflowY > 2 && /(hidden|clip)/.test(style.overflowY) && style.webkitLineClamp === 'none';
            if ((clippedX || clippedY) && !el.title && !el.getAttribute('aria-label')) {
                push('clipped-text', el, clippedX ? `text oříznut o ${overflowX} px${style.textOverflow === 'ellipsis' ? ' (výpustka bez title)' : ''}` : `text oříznut o ${overflowY} px na výšku`);
            }
        }
        // 4. Fixed overlays covering a large part of a small screen
        if (touch && (style.position === 'fixed' || style.position === 'sticky')) {
            const r = el.getBoundingClientRect();
            const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
            if (area > 0.3 * vw * vh && r.height < vh * 0.98) push('fixed-overlay', el, `pevný prvek kryje ${Math.round((100 * area) / (vw * vh))} % obrazovky`);
        }
    }

    const interactive = [...document.querySelectorAll(INTERACTIVE)].filter(visible);
    for (const el of interactive) {
        const r = el.getBoundingClientRect();
        // 5. Off-screen interactive elements
        if ((r.left < -1 || r.right > vw + 1) && !inScrollContainer(el) && !isFixedLike(el)) {
            push('off-screen', el, `prvek mimo obrazovku (left ${Math.round(r.left)}, right ${Math.round(r.right)})`);
        }
        // 6. Tap targets
        const min = touch ? 44 : 24;
        const inlineLink = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /^(P|LI|SPAN|TD)$/.test(el.parentElement.tagName);
        if (!inlineLink && (r.width < min || r.height < min) && el.type !== 'checkbox' && el.type !== 'radio') {
            push('tap-target', el, `${Math.round(r.width)}×${Math.round(r.height)} px < ${min} px`);
        }
    }

    // 7. Overlaps: check the centre of interactive elements, page by page
    const startY = window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    const reported = new Set();
    for (let y = 0; y < pageHeight; y += Math.max(200, vh - 100)) {
        window.scrollTo(0, y);
        for (const el of interactive) {
            if (reported.has(el)) continue;
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
            const hit = document.elementFromPoint(cx, cy);
            if (!hit || hit === el || el.contains(hit) || hit.contains(el)) continue;
            if (hit.closest('label') && hit.closest('label').contains(el)) continue;
            if (y > 0 && isFixedLike(hit)) continue; // sticky header over scrolled content
            reported.add(el);
            push('overlap', el, `střed prvku je zakrytý prvkem ${describe(hit)}`);
        }
        if (findings.filter((f) => f.check === 'overlap').length >= limit) break;
    }
    window.scrollTo(0, startY);

    // 8. Broken images
    for (const img of document.images) {
        if (img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src) && visible(img)) push('broken-image', img, img.currentSrc || img.src);
    }

    // 9. Web fonts that failed to load
    if (document.fonts) {
        for (const face of document.fonts) if (face.status === 'error') findings.push({ check: 'font-fallback', element: face.family, detail: `font ${face.family} ${face.weight} se nenačetl`, rect: null });
    }

    return { url: location.href, viewport: { width: vw, height: vh, layoutWidth: window.innerWidth, touch }, findings };
}
