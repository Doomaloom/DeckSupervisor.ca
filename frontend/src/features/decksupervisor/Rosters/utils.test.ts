import { describe, expect, it } from "vitest";
import type { CustomRoster, Student } from "../../../types/app";
import { buildAttendancePrintItems, buildAttendanceRosterStudents, buildCustomRosterGroups, buildRosterGroups, filterRosterItems, getEmptyMessage, getVisibleRosterStudents, sanitizeLevel, } from "./utils";

const students: Student[] = [
    {
        id: "1",
        service_name: "Splash 2A",
        code: "1001",
        day: "Mo",
        time: "09:00-09:30",
        location: "Pool A",
        schedule: "Morning",
        name: "Ben",
        phone: "5551113333",
        instructor: "Coach Amy",
        level: "Splash 2A",
        waitlist: false,
    },
    {
        id: "2",
        service_name: "Splash 2A",
        code: "1001",
        day: "Mo",
        time: "09:00-09:30",
        location: "Pool A",
        schedule: "Morning",
        name: "Alice",
        phone: "5551112222",
        instructor: "Coach Amy",
        level: "Splash 2A",
        waitlist: false,
    },
    {
        id: "3",
        service_name: "Little Splash 1",
        code: "1002",
        day: "Mo",
        time: "10:00-10:30",
        location: "Pool B",
        schedule: "Morning",
        name: "Cara",
        phone: "5551114444",
        instructor: "",
        level: "Little Splash 1",
        waitlist: false,
    },
];

describe("roster utils", () => {
    it("sanitizes representative level names", () => {
        expect(sanitizeLevel("Private Lesson")).toBe("SplashPrivate");
        expect(sanitizeLevel("Teen / Adult 2")).toBe("TeenAdult2");
        expect(sanitizeLevel("")).toBe("SplashFitness");
    });

    it("builds sorted roster groups and preserves instructors", () => {
        const groups = buildRosterGroups(students);

        expect(groups).toHaveLength(2);
        expect(groups[0].code).toBe("1001");
        expect(groups[0].students.map((student) => student.name)).toEqual([
            "Alice",
            "Ben",
        ]);
        expect(groups[0].instructor).toBe("Coach Amy");
    });

    it("builds custom roster groups and returns correct empty-state messages", () => {
        const baseGroups = buildRosterGroups(students);
        const customRosters: CustomRoster[] = [
            {
                id: "custom-1",
                serviceName: "Merged Class",
                instructor: "Coach Beth",
                sourceCodes: ["1001"],
                studentIds: ["2", "1"],
                createdAt: "2026-03-23T00:00:00.000Z",
            },
        ];

        const customGroups = buildCustomRosterGroups(
            customRosters,
            new Map(baseGroups.map((group) => [group.code, group])),
            new Map(students.map((student) => [student.id, student])),
        );

        expect(customGroups[0]).toMatchObject({
            code: "custom-custom-1",
            instructor: "Coach Beth",
            time: "09:00-09:30",
        });
        expect(customGroups[0].students.map((student) => student.name)).toEqual(
            [
                "Alice",
                "Ben",
            ],
        );
        expect(getEmptyMessage(0)).toBe(
            "No rosters loaded. Upload a CSV file to see rosters.",
        );
        expect(getEmptyMessage(3)).toBe(
            "No rosters match the current filters.",
        );
    });

    it("filters rosters by service name instead of edited level", () => {
        const rosterItems = [
            {
                roster: {
                    code: "1001",
                    serviceName: "Splash 2A",
                    level: "Splash 3",
                    time: "09:00-09:30",
                    instructor: "Coach Amy",
                    location: "Pool A",
                    schedule: "Morning",
                    students: students.slice(0, 2),
                },
            },
            {
                roster: {
                    code: "1002",
                    serviceName: "Little Splash 1",
                    level: "Little Splash 1",
                    time: "10:00-10:30",
                    instructor: "",
                    location: "Pool B",
                    schedule: "Morning",
                    students: [students[2]],
                },
            },
        ];

        expect(filterRosterItems(rosterItems, "", "Splash 2A", ""))
            .toHaveLength(1);
        expect(
            filterRosterItems(rosterItems, "", "Splash 2A", "")[0]?.roster.code,
        )
            .toBe("1001");
        expect(filterRosterItems(rosterItems, "", "Splash 3", "")).toHaveLength(
            0,
        );
    });

    it("excludes waitlisted students from visible roster and attendance payloads", () => {
        const rosterStudents = [
            ...students,
            {
                id: "4",
                service_name: "Splash 2A",
                code: "1001",
                day: "Mo",
                time: "09:00-09:30",
                location: "Pool A",
                schedule: "Morning",
                name: "Waitlisted Wendy",
                phone: "5551115555",
                instructor: "Coach Amy",
                level: "Splash 2A",
                waitlist: true,
            },
        ];

        expect(
            getVisibleRosterStudents(rosterStudents).map((student) =>
                student.name
            ),
        ).toEqual([
            "Ben",
            "Alice",
            "Cara",
        ]);
        expect(buildAttendanceRosterStudents(rosterStudents)).toEqual([
            { name: "Ben" },
            { name: "Alice" },
            { name: "Cara" },
        ]);
    });

    it("splits attendance print items by edited student level within a roster", () => {
        const mixedLevelRoster = {
            code: "1001",
            serviceName: "Splash 2A",
            level: "Splash 2A",
            time: "09:00-09:30",
            instructor: "Coach Amy",
            location: "Pool A",
            schedule: "Morning",
            students: [
                {
                    ...students[0],
                    name: "Student One",
                    level: "Splash 1",
                },
                {
                    ...students[1],
                    id: "2b",
                    name: "Student Two",
                    level: "Splash 2A",
                },
                {
                    ...students[1],
                    id: "2c",
                    name: "Student Three",
                    level: "Splash 1",
                },
            ],
        };

        expect(buildAttendancePrintItems(mixedLevelRoster)).toEqual([
            {
                template: "Splash1",
                roster: {
                    code: "1001",
                    level: "Splash 1",
                    serviceName: "Splash 1",
                    time: "09:00-09:30",
                    instructor: "Coach Amy",
                    location: "Pool A",
                    schedule: "Morning",
                    students: [{ name: "Student One" }, {
                        name: "Student Three",
                    }],
                },
            },
            {
                template: "Splash2A",
                roster: {
                    code: "1001",
                    level: "Splash 2A",
                    serviceName: "Splash 2A",
                    time: "09:00-09:30",
                    instructor: "Coach Amy",
                    location: "Pool A",
                    schedule: "Morning",
                    students: [{ name: "Student Two" }],
                },
            },
        ]);
    });

    it("shows compact saved levels with spaces and keeps the class on one sheet (R2-W4)", () => {
        const base = students[2];
        const mixed: Student[] = [
            { ...base, id: "a", name: "Ava", level: "LittleSplash1" },
            { ...base, id: "b", name: "Bo", level: "Little Splash 1" },
        ];
        const [group] = buildRosterGroups(mixed);
        expect(group.level).toBe("Little Splash 1");

        const items = buildAttendancePrintItems(group);
        expect(items).toHaveLength(1);
        expect(items[0].template).toBe("LittleSplash1");
        expect(items[0].roster.level).toBe("Little Splash 1");
        expect(items[0].roster.serviceName).toBe("Little Splash 1");
        expect(items[0].roster.students).toEqual([
            { name: "Ava" },
            { name: "Bo" },
        ]);

        const customRoster: CustomRoster = {
            id: "c1",
            serviceName: "Splash5",
            instructor: "",
            sourceCodes: ["1002"],
            studentIds: ["a"],
            createdAt: "2026-11-20T00:00:00Z",
        };
        const [custom] = buildCustomRosterGroups(
            [customRoster],
            new Map([[group.code, group]]),
            new Map(mixed.map((student) => [student.id, student])),
        );
        expect(custom.serviceName).toBe("Splash 5");
        expect(custom.level).toBe("Splash 5");
    });
});
