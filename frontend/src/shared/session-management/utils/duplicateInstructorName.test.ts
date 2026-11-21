import { expect, it } from "vitest";
import { findDuplicateInstructorName } from "./duplicateInstructorName";

it("finds an instructor name used twice, ignoring surrounding spaces (R2-C9)", () => {
    expect(
        findDuplicateInstructorName([
            { name: "Jordan Rivers" },
            { name: "Priya Shah" },
            { name: " Jordan Rivers " },
        ]),
    ).toBe("Jordan Rivers");
});

it("ignores blank names and names that differ", () => {
    expect(
        findDuplicateInstructorName([
            { name: "" },
            { name: "  " },
            { name: "Jordan Rivers" },
            { name: "Jordan Rivera" },
        ]),
    ).toBeNull();
});
