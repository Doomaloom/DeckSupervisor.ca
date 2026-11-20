// Mirrors @page in attendanceCompatibility.css: 11in x 8.5in with 0.2in margins, in CSS px (96 per inch).
const PRINTABLE_WIDTH_PX = (11 - 0.4) * 96;
const PRINTABLE_HEIGHT_PX = (8.5 - 0.4) * 96;
// Leaves room for table borders and rounding so a fitted sheet never spills a sliver onto another page.
const HEIGHT_SAFETY_PX = 6;

// The compatibility CSS keeps its Tailwind replacements screen-only, so the popup's screen layout
// is not the printed one. Measure with those rules switched off, then restore them.
function suspendScreenOnlyRules(document: Document) {
    const suspended: { rule: CSSMediaRule; media: string }[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
            rules = sheet.cssRules;
        } catch {
            continue;
        }
        for (const rule of Array.from(rules)) {
            if (!(rule instanceof document.defaultView!.CSSMediaRule)) continue;
            const media = rule.media.mediaText;
            if (/\bscreen\b/.test(media) && !/\bprint\b/.test(media)) {
                suspended.push({ rule, media });
                rule.media.mediaText = "not all";
            }
        }
    }
    return () => suspended.forEach(({ rule, media }) => {
        rule.media.mediaText = media;
    });
}

/**
 * Completed sheets keep a whole class on one page. Chrome already shrinks the wide level
 * templates to the paper width; this applies that same shrink as CSS zoom and, only for a
 * page still taller than the paper, shrinks it further so its last rows are not pushed onto
 * another sheet. Blank Print-page documents are left to the browser's own shrink-to-fit.
 */
export function fitCompletedAttendancePages(document: Document) {
    const view = document.defaultView;
    const pages = Array.from(document.querySelectorAll<HTMLElement>(".print-page"));
    if (!view || !pages.length || pages.some((page) => page.dataset.completed !== "true")) return;
    const restore = suspendScreenOnlyRules(document);
    try {
        pages.forEach((page) => page.style.removeProperty("zoom"));
        const contentWidths = pages.map((page) => {
            const padding = parseFloat(view.getComputedStyle(page).paddingLeft) || 0;
            const tables = Array.from(page.querySelectorAll("table"), (table) => table.offsetWidth);
            return padding + Math.max(0, ...tables);
        });
        const body = view.getComputedStyle(document.body);
        const availableWidth = PRINTABLE_WIDTH_PX - (parseFloat(body.marginLeft) || 0) - (parseFloat(body.marginRight) || 0);
        const availableHeight = PRINTABLE_HEIGHT_PX - (parseFloat(body.marginTop) || 0) - HEIGHT_SAFETY_PX;
        const widthZoom = Math.min(1, availableWidth / Math.max(availableWidth, ...contentWidths));
        // Lay each page out at the width it will have once zoomed, then measure its height.
        pages.forEach((page) => { page.style.width = `${availableWidth / widthZoom}px`; });
        const heights = pages.map((page) => page.offsetHeight);
        pages.forEach((page, index) => {
            const zoom = Math.min(widthZoom, availableHeight / heights[index]);
            if (zoom < 1) page.style.zoom = String(Math.floor(zoom * 1000) / 1000);
        });
    } finally {
        pages.forEach((page) => page.style.removeProperty("width"));
        restore();
    }
}
