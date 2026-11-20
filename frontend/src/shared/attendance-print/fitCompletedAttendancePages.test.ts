import { describe, expect, it } from "vitest";
import { fitCompletedAttendancePages } from "./fitCompletedAttendancePages";

// jsdom has no layout, so give each page a measured table width and page height.
function sheet(pages: { height: number; tableWidth: number; completed?: boolean }[]) {
    // An iframe document has a window, as the print popup does.
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const doc = frame.contentDocument!;
    doc.body.style.margin = "8px";
    const style = doc.createElement("style");
    style.textContent = "@media screen { .text-small { font-size: 10px; } }";
    doc.head.append(style);
    for (const { height, tableWidth, completed = true } of pages) {
        const page = doc.createElement("section");
        page.className = "print-page";
        page.style.paddingLeft = "8px";
        if (completed) page.dataset.completed = "true";
        const table = doc.createElement("table");
        Object.defineProperty(table, "offsetWidth", { get: () => tableWidth });
        Object.defineProperty(page, "offsetHeight", { get: () => height });
        page.append(table);
        doc.body.append(page);
    }
    return doc;
}

const zooms = (doc: Document) => Array.from(doc.querySelectorAll<HTMLElement>(".print-page"), (page) => page.style.zoom);

describe("fitCompletedAttendancePages", () => {
    it("applies the browser's paper-width shrink to every page and shrinks only a page taller than the paper", () => {
        const doc = sheet([{ height: 1200, tableWidth: 1400 }, { height: 700, tableWidth: 1100 }]);
        fitCompletedAttendancePages(doc);
        // Width: (10.6in - 16px body margin) / (1400px table + 8px padding). Height: (8.1in - 8px - 6px) / 1200px.
        expect(zooms(doc)).toEqual(["0.636", "0.711"]);
        expect(Array.from(doc.querySelectorAll<HTMLElement>(".print-page"), (page) => page.style.width)).toEqual(["", ""]);
    });

    it("restores the screen-only rules it switches off while measuring", () => {
        const doc = sheet([{ height: 600, tableWidth: 1400 }]);
        fitCompletedAttendancePages(doc);
        const rule = doc.styleSheets[0].cssRules[0] as CSSMediaRule;
        expect(rule.media.mediaText).toBe("screen");
    });

    it("leaves blank Print-page sheets to the browser", () => {
        const doc = sheet([{ height: 1200, tableWidth: 1400, completed: false }, { height: 700, tableWidth: 1400, completed: false }]);
        fitCompletedAttendancePages(doc);
        expect(zooms(doc)).toEqual(["", ""]);
    });
});
