import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classes, session, students } from "../fixtures";
import { buildCourses, buildPackage, newRegistry, parseDates, readRegistry, startTime, suggestDates, } from "./exportPackage";

beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
});
describe("Rec Tablet class packages", () => {
    it("exports only the selected instructor, booked swimmers, and device fields", async () => {
        const courses = buildCourses(session, classes, students);
        const result = await buildPackage(
            session.id,
            "Alex",
            courses,
            newRegistry(session.id),
        );
        expect(result.package.courses).toHaveLength(2);
        expect(result.package.courses.map((course) => course.swimmers.length))
            .toEqual([2, 1]);
        expect(result.package.courses[0].startTime).toBe("16:00");
        expect(result.package.courses[0].lessonDates).toEqual([
            "2026-09-04",
            "2026-09-11",
            "2026-09-18",
            "2026-09-25",
        ]);
        expect(result.package.courses[1].swimmers[0].level).toBe("Splash2B");
        expect(JSON.stringify(result.package)).not.toMatch(
            /phone|email|555-|Waiting|Morgan|row-/,
        );
        const sam = await buildPackage(
            session.id,
            "Sam",
            courses,
            result.registry,
        );
        expect(sam.package.datasetId).toBe(result.package.datasetId);
        expect(sam.package.courses).toHaveLength(1);
    });
    it("exports private swimmers without an assigned level and preserves later assignments", async () => {
        const courses = buildCourses(session, classes, students);
        const privateCourses = structuredClone(courses);
        privateCourses.find((course) => course.code === "004202")!.students[0]
            .level = "";
        const first = await buildPackage(
            session.id,
            "Alex",
            privateCourses,
            newRegistry(session.id),
        );
        const privatePackage = first.package.courses.find((course) =>
            course.sourceId.endsWith(":004202")
        )!;
        expect(privatePackage.level).toBe("SplashPrivate");
        expect(privatePackage.swimmers[0]).not.toHaveProperty("level");

        const assigned = structuredClone(privateCourses);
        assigned.find((course) => course.code === "004202")!.students[0].level =
            "Splash 2B";
        const updated = await buildPackage(
            session.id,
            "Alex",
            assigned,
            first.registry,
        );
        const updatedPrivate = updated.package.courses.find((course) =>
            course.sourceId.endsWith(":004202")
        )!;
        expect(updatedPrivate.swimmers[0].sourceId).toBe(
            privatePackage.swimmers[0].sourceId,
        );
        expect(updatedPrivate.swimmers[0].level).toBe("Splash2B");
    });
    it("preserves IDs after row reorder, roster changes, level edits, removal and return", async () => {
        const first = await buildPackage(
            session.id,
            "Alex",
            buildCourses(session, classes, students),
            newRegistry(session.id),
        );
        const changed = students.filter((student) => student.name !== "Johnny")
            .reverse().map((student, i) => ({
                ...student,
                id: `new-${i}`,
                level: student.name === "Harrold" ? "Splash2A" : student.level,
            }));
        const second = await buildPackage(
            session.id,
            "Alex",
            buildCourses(session, classes, changed),
            first.registry,
        );
        const original = first.package.courses[0].swimmers.find((student) =>
            student.name === "Harrold"
        )!;
        expect(second.package.courses[0].swimmers[0]).toEqual({
            ...original,
            level: "Splash2A",
        });
        const returned = await buildPackage(
            session.id,
            "Alex",
            buildCourses(session, classes, students),
            second.registry,
        );
        expect(returned.package).toEqual(first.package);
        // Optional artifact gate: these exact TypeScript exports are imported by Go.
        const directory = process.env.REC_TABLET_EXPORT_FIXTURES;
        if (directory) {
            mkdirSync(directory, { recursive: true });
            for (
                const [name, value] of Object.entries({
                    initial: first.package,
                    updated: second.package,
                    returned: returned.package,
                })
            ) {
                writeFileSync(
                    join(directory, `${name}.json`),
                    JSON.stringify(value, null, 2),
                );
            }
        }
    });
    it("keeps course identity through instructor or schedule changes and scopes it to an offering", async () => {
        const registry = newRegistry(session.id);
        const courses = buildCourses(session, classes, students);
        const first = await buildPackage(session.id, "Alex", courses, registry);
        const second = await buildPackage(
            session.id,
            "Lee",
            courses.filter((course) => course.instructor === "Alex").map(
                (course) => ({
                    ...course,
                    instructor: "Lee",
                    startTime: "18:00",
                }),
            ),
            first.registry,
        );
        expect(second.package.courses[0].sourceId).toBe(
            first.package.courses[0].sourceId,
        );
        expect(second.package.courses[0].swimmers).toEqual(
            first.package.courses[0].swimmers,
        );
        const next = await buildPackage(
            "next-session",
            "Alex",
            courses,
            newRegistry("next-session"),
        );
        expect(next.package.courses[0].sourceId).not.toBe(
            first.package.courses[0].sourceId,
        );
        expect(next.package.datasetId).not.toBe(first.package.datasetId);
    });
    it("rejects ambiguous identities, changed source contact, generic levels and invalid dates", async () => {
        const courses = buildCourses(session, classes, students);
        const first = await buildPackage(
            session.id,
            "Alex",
            courses,
            newRegistry(session.id),
        );
        const duplicate = structuredClone(courses);
        duplicate[0].students.push(duplicate[0].students[0]);
        await expect(
            buildPackage(session.id, "Alex", duplicate, first.registry),
        )
            .rejects.toThrow("indistinguishable");
        const contact = structuredClone(courses);
        contact[0].students[0].phone = "changed";
        await expect(buildPackage(session.id, "Alex", contact, first.registry))
            .rejects.toThrow("Source details changed");
        const privateClass = structuredClone(courses);
        privateClass[1].students[0].level = "Splash2";
        await expect(
            buildPackage(session.id, "Alex", privateClass, first.registry),
        )
            .rejects.toThrow("actual level");
        const invalid = structuredClone(courses);
        invalid[0].lessonDates = ["2026-02-30"];
        await expect(buildPackage(session.id, "Alex", invalid, first.registry))
            .rejects.toThrow("Invalid lesson date");
        expect(Object.keys(first.registry.people)).toHaveLength(3);
    });
    it("allows distinguishable same-name students without merging them", async () => {
        const pupils = students.map((student) =>
            student.name === "Johnny"
                ? { ...student, name: "Harrold" }
                : student
        );
        const first = await buildPackage(
            session.id,
            "Alex",
            buildCourses(session, classes, pupils),
            newRegistry(session.id),
        );
        expect(
            new Set(
                first.package.courses[0].swimmers.map((student) =>
                    student.sourceId
                ),
            ).size,
        ).toBe(2);
        const repeated = await buildPackage(
            session.id,
            "Alex",
            buildCourses(session, classes, [...pupils].reverse()),
            first.registry,
        );
        expect(repeated.package).toEqual(first.package);
    });
    it("refuses wrong-session metadata, missing rosters, and conflicting assignments", () => {
        expect(() =>
            buildCourses({ ...session, session_day: "Mo" }, classes, students)
        ).toThrow("session day");
        expect(() => buildCourses(session, classes, [])).toThrow("not loaded");
        expect(() => buildCourses(session, [], students)).toThrow(
            "Load the CSV",
        );
        expect(() =>
            buildCourses(
                session,
                classes,
                students.map((student) =>
                    student.name === "Johnny"
                        ? { ...student, instructor: "Other" }
                        : student
                ),
            )
        ).toThrow("conflicting");
    });
    it("uses UTC dates across DST and requires explicit dates for unknown mini-session schedules", () => {
        expect(
            suggestDates({
                ...session,
                session_day: "Su",
                start_date: "2026-03-01",
                end_date: "2026-03-15",
            }),
        ).toEqual(["2026-03-01", "2026-03-08", "2026-03-15"]);
        expect(
            suggestDates({
                ...session,
                session_day: "Mo,Tu,We,Th,Fr",
                start_date: "2026-09-07",
                end_date: "2026-09-11",
            }),
        ).toHaveLength(5);
        expect(suggestDates({ ...session, session_day: "Mini Session 1" }))
            .toEqual(
                [],
            );
        expect(suggestDates(session, "Fr 2026-09-11 - 2026-09-18")).toEqual([
            "2026-09-11",
            "2026-09-18",
        ]);
        for (
            const date of [
                "0000-01-01",
                "2026-2-3",
                "2026-02-30",
                "2026-09-04,2026-09-04",
                "",
            ]
        ) expect(() => parseDates(date)).toThrow();
        expect(startTime("12:00 AM - 12:30 AM")).toBe("00:00");
        expect(startTime("12:00 PM - 12:30 PM")).toBe("12:00");
        for (const time of ["TBD", "25:00", "13:00 PM", "10:70"]) {
            expect(() => startTime(time)).toThrow();
        }
    });
    it("rejects a backup for another session or malformed IDs", () => {
        expect(() =>
            readRegistry(JSON.stringify(newRegistry("other")), session.id)
        )
            .toThrow("selected session");
        expect(() =>
            readRegistry(
                JSON.stringify({
                    ...newRegistry(session.id),
                    people: { bad: {} },
                }),
                session.id,
            )
        ).toThrow("Invalid");
    });
});
