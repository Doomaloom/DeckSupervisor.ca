import { expect, it } from "vitest";
import { reconcileGuestInstructorRoster } from "./guestInstructorRoster";
it("renames stable guest instructors and leaves removed columns unnamed without moving classes", () => {
    const old = [{ id: "a", name: "Alex" }, { id: "b", name: "Blair" }];
    const schedule = {
        instructors: ["Alex", "Blair"],
        codes: ["A,B", "C"],
        assignmentIds: ["col-a", "col-b"],
    };
    const next = reconcileGuestInstructorRoster(schedule, old, [{
        id: "a",
        name: "Renamed",
    }]);
    expect(next).toEqual({
        ...schedule,
        instructors: ["Renamed", ""],
        instructorIds: ["a", null],
    });
});
it("does not merge duplicate names into an account identity", () => {
    const old = [{ id: "a", name: "Alex" }, { id: "b", name: "Alex" }];
    const next = reconcileGuestInstructorRoster(
        { instructors: ["Alex"], codes: ["A"] },
        old,
        old,
    );
    expect(next.instructorIds).toEqual([null]);
});
