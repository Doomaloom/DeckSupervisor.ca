import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Student } from "../types/app";
import {
    applyPersistedLevelEdits,
    applySavedLevelEditsToStoredRoster,
    deleteRosterStudentLevelEdit,
    hashStudentNames,
    setRosterClassLevel,
} from "./rosterEditsApi";
import {
    deleteRosterStudentLevelEdit as deleteRosterStudentLevelEditRequest,
    fetchRosterEdits,
    setRosterClassLevel as setRosterClassLevelRequest,
} from "./serverApi";
import { getStudentsForDay, setStudentsForDay } from "./storage";

vi.mock("./serverApi", () => ({
    deleteRosterStudentLevelEdit: vi.fn(),
    setRosterClassLevel: vi.fn(),
    fetchRosterEdits: vi.fn(),
    upsertRosterLevelEdit: vi.fn(),
    upsertRosterStudentLevelEdit: vi.fn(),
}));

const students: Student[] = [
    {
        id: "1",
        service_name: "Splash 2A",
        code: "1001",
        day: "Mo",
        time: "09:00-09:30",
        location: "Pool A",
        schedule: "Morning",
        name: "Student One",
        phone: "5551111111",
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
        name: "Student Two",
        phone: "5551112222",
        instructor: "Coach Amy",
        level: "Splash 2A",
        waitlist: false,
    },
];

describe("rosterEditsApi", () => {
    it("applies roster-level edits when present", () => {
        const nameHashMap = new Map([
            ["Student One", "hash-one"],
            ["Student Two", "hash-two"],
        ]);

        expect(
            applyPersistedLevelEdits(
                students,
                [{ code: "1001", level: "Splash 3" }],
                [],
                nameHashMap,
            ),
        ).toEqual([
            { ...students[0], level: "Splash 3", class_level: "Splash 3", registered_level: "Splash 2A" },
            { ...students[1], level: "Splash 3", class_level: "Splash 3", registered_level: "Splash 2A" },
        ]);
    });

    it("lets student-level edits override roster-level edits", () => {
        const nameHashMap = new Map([
            ["Student One", "hash-one"],
            ["Student Two", "hash-two"],
        ]);

        expect(
            applyPersistedLevelEdits(
                students,
                [{ code: "1001", level: "Splash 3" }],
                [{
                    code: "1001",
                    student_name_hash: "hash-two",
                    level: "Splash 4",
                }],
                nameHashMap,
            ),
        ).toEqual([
            { ...students[0], level: "Splash 3", class_level: "Splash 3", registered_level: "Splash 2A" },
            { ...students[1], level: "Splash 4", class_level: "Splash 3", registered_level: "Splash 2A" },
        ]);
    });

    it("reads compact saved levels as the spaced name (R2-W4)", () => {
        const nameHashMap = new Map([
            ["Student One", "hash-one"],
            ["Student Two", "hash-two"],
        ]);

        expect(
            applyPersistedLevelEdits(
                students,
                [{ code: "1001", level: "LittleSplash1" }],
                [{
                    code: "1001",
                    student_name_hash: "hash-two",
                    level: "Splash5",
                }],
                nameHashMap,
            ),
        ).toEqual([
            {
                ...students[0],
                level: "Little Splash 1",
                class_level: "Little Splash 1",
                registered_level: "Splash 2A",
            },
            {
                ...students[1],
                level: "Splash 5",
                class_level: "Little Splash 1",
                registered_level: "Splash 2A",
            },
        ]);
    });

    it("sends each swimmer back to their own file level once their edit is gone", () => {
        const nameHashMap = new Map([
            ["Student One", "hash-one"],
            ["Student Two", "hash-two"],
        ]);
        const edited: Student[] = [
            {
                ...students[0],
                registered_level: "Splash 2A",
                level: "Splash 3",
                class_level: "Splash 3",
            },
            { ...students[1], registered_level: "Splash 1", level: "Splash 3" },
        ];

        const result = applyPersistedLevelEdits(edited, [], [], nameHashMap);

        expect(result.map((student) => student.level)).toEqual([
            "Splash 2A",
            "Splash 1",
        ]);
        expect(result[0]).not.toHaveProperty("class_level");
    });

    it("fills in the file level of a cache saved without one, so edits can be reset later (RL-4)", () => {
        const nameHashMap = new Map([
            ["Student One", "hash-one"],
            ["Student Two", "hash-two"],
        ]);
        const old: Student[] = [
            { ...students[0], level: "Splash 3" },
            { ...students[1], level: "Splash 1" },
        ];

        // Student One has a saved edit; Student Two was uploaded on Splash 1.
        const first = applyPersistedLevelEdits(
            old,
            [],
            [{
                code: "1001",
                student_name_hash: "hash-one",
                level: "Splash 3",
            }],
            nameHashMap,
        );
        expect(first.map((s) => [s.level, s.registered_level])).toEqual([
            ["Splash 3", "Splash 2A"],
            ["Splash 1", "Splash 1"],
        ]);

        // The edit is later removed elsewhere: the swimmer resets.
        const second = applyPersistedLevelEdits(first, [], [], nameHashMap);
        expect(second.map((s) => s.level)).toEqual(["Splash 2A", "Splash 1"]);
    });

    it("sends the delete and class save requests, hashing the swimmer's name", async () => {
        vi.stubGlobal("crypto", webcrypto);
        const hashes = await hashStudentNames(["Student Two"]);

        await deleteRosterStudentLevelEdit("session-1", "1001", "Student Two");
        expect(deleteRosterStudentLevelEditRequest).toHaveBeenCalledWith(
            "session-1",
            "1001",
            hashes.get("Student Two"),
        );
        expect(await deleteRosterStudentLevelEdit("session-1", "1001", " "))
            .toBeNull();

        await setRosterClassLevel("session-1", "1001", "Splash 4");
        expect(setRosterClassLevelRequest).toHaveBeenCalledWith({
            session_id: "session-1",
            code: "1001",
            level: "Splash 4",
        });
    });

    describe("applySavedLevelEditsToStoredRoster (R2-W6)", () => {
        beforeEach(() => {
            vi.stubGlobal("crypto", webcrypto);
            window.sessionStorage.clear();
            vi.mocked(fetchRosterEdits).mockReset();
        });

        it("writes saved level edits into the cached roster for the session", async () => {
            setStudentsForDay("Mo", students, "session-1");
            const hashes = await hashStudentNames(["Student Two"]);
            vi.mocked(fetchRosterEdits).mockResolvedValue({
                rosterEdits: [{ code: "1001", level: "Splash4" }],
                studentEdits: [{
                    code: "1001",
                    student_name_hash: hashes.get("Student Two")!,
                    level: "Splash 5",
                }],
            });

            await applySavedLevelEditsToStoredRoster("Mo", "session-1");

            expect(fetchRosterEdits).toHaveBeenCalledWith("session-1");
            expect(
                getStudentsForDay("Mo", "session-1").map((s) => s.level),
            ).toEqual(["Splash 4", "Splash 5"]);
        });

        it("does nothing when no roster is cached or the page has gone", async () => {
            await applySavedLevelEditsToStoredRoster("Mo", "session-1");
            expect(fetchRosterEdits).not.toHaveBeenCalled();

            setStudentsForDay("Mo", students, "session-1");
            vi.mocked(fetchRosterEdits).mockResolvedValue({
                rosterEdits: [{ code: "1001", level: "Splash 4" }],
                studentEdits: [],
            });
            await applySavedLevelEditsToStoredRoster(
                "Mo",
                "session-1",
                () => false,
            );
            expect(
                getStudentsForDay("Mo", "session-1").map((s) => s.level),
            ).toEqual(["Splash 2A", "Splash 2A"]);
        });
    });
});
