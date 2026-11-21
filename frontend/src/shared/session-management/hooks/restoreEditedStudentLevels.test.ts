import { beforeEach, expect, it } from "vitest";
import { getStudentsForDay, setStudentsForDay } from "../../../lib/storage";
import { setStorageScope } from "../../../lib/storageScope";
import type { Student } from "../../../types/app";
import { restoreEditedStudentLevels } from "./useManageSessionForm";

const student = (id: string, level: string): Student => ({
    id,
    service_name: "Little Splash 1",
    code: "1001",
    day: "Th",
    time: "09:00-09:30",
    location: "Pool A",
    schedule: "Morning",
    name: id,
    phone: "",
    instructor: "",
    level,
} as Student);

beforeEach(() => {
    window.sessionStorage.clear();
    setStorageScope("guest");
});

it("puts a Class Level edit back after the roster is rebuilt from the CSV (R2-W10)", () => {
    const edited = [
        student("a", "Little Splash 2"),
        student("b", "Little Splash 1"),
    ];
    // The rebuild stores the CSV defaults.
    setStudentsForDay("Th", [
        student("a", "Little Splash 1"),
        student("b", "Little Splash 1"),
    ], "s1");
    restoreEditedStudentLevels([["Th", edited]], "s1");
    expect(getStudentsForDay("Th", "s1").map((s) => s.level)).toEqual([
        "Little Splash 2",
        "Little Splash 1",
    ]);
});

it("leaves unedited levels as the rebuild set them", () => {
    setStudentsForDay("Th", [student("a", "Little Splash 3")], "s1");
    restoreEditedStudentLevels([["Th", [student("a", "Little Splash 1")]]], "s1");
    expect(getStudentsForDay("Th", "s1")[0].level).toBe("Little Splash 3");
});
