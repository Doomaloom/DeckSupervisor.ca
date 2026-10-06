import { expect, it } from "vitest";
import { lessonPlanHeading, textSegments } from "./LessonPlanDocument";
it("uses the session week number in the lesson plan heading", () => {
    expect(lessonPlanHeading(
        { weeks: ["2026-10-05", "2026-10-12"] } as any,
        { code: "A1", level: "Swimmer 2" } as any,
        { week: "2026-10-12" } as any,
    )).toBe("A1 Swimmer 2 Week 2 Plan");
});
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
