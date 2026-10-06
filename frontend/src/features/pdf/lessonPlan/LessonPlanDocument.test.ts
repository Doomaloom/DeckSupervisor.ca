import { expect, it } from "vitest";
import { textSegments } from "./LessonPlanDocument";
it("preserves all long text and bounds segments, including many newlines", () => {
    for (
        const text of [
            "Long activity ".repeat(700),
            "a\n".repeat(500),
            "x".repeat(10000),
        ]
    ) {
        const parts = textSegments(text, 38);
        expect(parts.join("")).toBe(text);
        expect(Math.max(...parts.map((p) => p.length))).toBeLessThanOrEqual(
            304,
        );
        expect(Math.max(...parts.map((p) => p.split("\n").length)))
            .toBeLessThanOrEqual(9);
    }
});
