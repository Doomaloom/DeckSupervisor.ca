import { beforeEach, expect, it } from "vitest";
import { buildRosterGroups } from "../../../features/decksupervisor/Rosters/utils";
import { getStudentsForDay, setStudentsForDay } from "../../../lib/storage";
import { setStorageScope } from "../../../lib/storageScope";
import type { Student } from "../../../types/app";
import { restoreEditedStudentLevels } from "./useManageSessionForm";

const student = (id: string, extra: Partial<Student> = {}): Student => ({
    id,
    service_name: "Splash 2",
    code: "1001",
    day: "Th",
    time: "09:00-09:30",
    location: "Pool A",
    schedule: "Morning",
    name: id,
    phone: "",
    instructor: "",
    level: "Splash 2",
    registered_level: "Splash 2",
    waitlist: false,
    ...extra,
});

beforeEach(() => {
    window.sessionStorage.clear();
    setStorageScope("guest");
});

// RL-1: a guest applied a whole-class level (every swimmer level and
// class_level = Splash 4). The CSV rebuild stores fresh students, and the
// round-3 restore puts back only `level`. class_level is lost.
it("a guest's whole-class level is still a whole-class level after the restore", () => {
    const before = [
        student("a", { level: "Splash 4", class_level: "Splash 4" }),
        student("b", { level: "Splash 4", class_level: "Splash 4" }),
    ];
    setStudentsForDay("Th", [student("a"), student("b")], "s1");
    restoreEditedStudentLevels([["Th", before]], "s1");

    const group = buildRosterGroups(getStudentsForDay("Th", "s1"))[0];
    expect(group.level).toBe("Splash 4");
    expect(group.hasOwnLevels).toBe(false);
});
