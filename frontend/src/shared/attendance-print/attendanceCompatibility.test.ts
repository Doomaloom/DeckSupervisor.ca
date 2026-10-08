import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_ATTENDANCE_TEMPLATE_KEYS, loadAttendanceTemplate, } from "./templateRegistry";

const compatibilityCss = readFileSync(
    resolve(
        process.cwd(),
        "src/shared/attendance-print/attendanceCompatibility.css",
    ),
    "utf8",
);

describe("attendance compatibility stylesheet", () => {
    it("defines every historical utility class locally or in template-owned CSS", async () => {
        const uncovered: string[] = [];
        for (const key of LEGACY_ATTENDANCE_TEMPLATE_KEYS) {
            const { html } = await loadAttendanceTemplate(key);
            const parsed = new DOMParser().parseFromString(html, "text/html");
            const localCss = Array.from(
                parsed.querySelectorAll("style"),
                (style) => style.textContent ?? "",
            ).join("\n").replace(/\\/g, "");
            const sharedCss = compatibilityCss.replace(/\\/g, "");
            const classes = new Set(
                Array.from(parsed.querySelectorAll("[class]")).flatMap((
                    element,
                ) => Array.from(element.classList)),
            );
            for (const token of classes) {
                const selector = `.${token}`;
                if (
                    !sharedCss.includes(selector) &&
                    !localCss.includes(selector)
                ) {
                    uncovered.push(`${key}:${token}`);
                }
            }
        }
        expect(uncovered).toEqual([]);
    });
});
