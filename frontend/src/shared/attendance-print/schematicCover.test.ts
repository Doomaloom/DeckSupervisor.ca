import { describe, expect, it, vi } from "vitest";
import { buildSchematicCoverElement, prepareSchematicCoversForPrint } from "./schematicCover";
import type { SchematicPdfRequest } from "../pdf/types";

const request: SchematicPdfRequest = {
    instructors: ["Alex"],
    columns: [[{
        code: "100", level: "Splash 1", startMinutes: 540,
        durationMinutes: 30, studentCount: 4, capacity: 8,
    }]],
};

describe("schematic attendance cover sizing", () => {
    it("scales body text with the schematic and preserves portrait dimensions inside the landscape job", () => {
        const viewport = buildSchematicCoverElement(document, {
            ...request, orientation: "portrait", scalePercent: 60,
        });
        const rotated = viewport.firstElementChild as HTMLElement;
        const table = rotated.firstElementChild as HTMLElement;
        expect(rotated.style.flexShrink).toBe("0");
        expect(rotated.style.transform).toBe("translateY(8in) rotate(-90deg)");
        expect(table.style.width).toBe(`${576 * 0.6}pt`);
        expect(parseFloat(table.style.fontSize)).toBeCloseTo(6.6);
        expect(table.textContent).toContain("Splash 1");
        expect(table.querySelector('div')?.style.boxSizing).toBe("border-box");
    });

    it("counteracts attendance overflow without changing attendance or compounding on repeat print", () => {
        document.body.innerHTML = '<section data-page-kind="schematic-cover"></section><section data-page-kind="attendance-front"><table></table></section>';
        document.body.style.margin = "8px";
        const style = document.createElement("style");
        style.textContent = '@media screen { table { width: 1600px; } } @media print { body { padding: 0; } }';
        document.head.append(style);
        const screenRule = style.sheet!.cssRules[0] as CSSMediaRule;
        const printRule = style.sheet!.cssRules[1] as CSSMediaRule;
        const cover = document.querySelector<HTMLElement>('section')!;
        const viewport = buildSchematicCoverElement(document, { ...request, orientation: "landscape" });
        cover.append(viewport);
        const table = document.querySelector('table')!;
        vi.spyOn(document.body, "getBoundingClientRect").mockReturnValue({ left: 8 } as DOMRect);
        vi.spyOn(table, "getBoundingClientRect").mockImplementation(() => {
            expect(screenRule.media.mediaText).toBe("not all");
            expect(printRule.media.mediaText).toBe("all");
            return { left: 16, width: 1300 } as DOMRect;
        });
        prepareSchematicCoversForPrint(window);
        const transform = viewport.style.transform;
        expect(transform).toBe(`translateY(-8px) scale(${1316 / (10.6 * 96)})`);
        expect(table.getAttribute('style')).toBeNull();
        expect(screenRule.media.mediaText).toBe("screen");
        expect(printRule.media.mediaText).toBe("print");
        prepareSchematicCoversForPrint(window);
        expect(viewport.style.transform).toBe(transform);
        style.remove();
        document.body.innerHTML = '';
        document.body.removeAttribute('style');
    });
});
