import { beforeEach, describe, expect, it } from "vitest";
import type { ExtractedClass, Student } from "../types/app";
import { setExtractedClassesForSession } from "./extractedClassesStorage";
import { setLoadedRosterSession } from "./loadedRosterSession";
import { setCurrentSessionId } from "./sessionStorage";
import {
    getMasterlistDraftOptions,
    getStudentsForDay,
    setMasterlistDraftOptions,
    setStudentsForDay,
} from "./storage";
import { getScopedKey, setStorageScope } from "./storageScope";

describe("masterlist option storage", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        setStorageScope("guest");
    });

    it("normalizes legacy stored options to the class and time layout", () => {
        window.sessionStorage.setItem(
            getScopedKey("masterlistDraftOptions"),
            JSON.stringify({ time_headers: true, font_size: 12 }),
        );

        expect(getMasterlistDraftOptions()).toMatchObject({
            layout: "class-time",
            alphabetical_name_basis: "last-name",
            time_headers: true,
            font_size: 12,
        });
    });

    it("persists alphabetical layout choices within the active scope", () => {
        const options = getMasterlistDraftOptions();
        setMasterlistDraftOptions({
            ...options,
            layout: "alphabetical",
            alphabetical_name_basis: "first-name",
        });

        expect(getMasterlistDraftOptions()).toMatchObject({
            layout: "alphabetical",
            alphabetical_name_basis: "first-name",
        });
    });
});

function swimmer(name: string, code: string): Student {
    return {
        id: `${code}-${name}`,
        service_name: "Splash 1",
        code,
        day: "Tu",
        time: "09:00-09:30",
        location: "Pool",
        schedule: "Tu",
        name,
        phone: "",
        instructor: "",
        level: "Splash 1",
        waitlist: false,
    };
}

function classFor(code: string): ExtractedClass {
    return {
        sessionKey: "k",
        dayOfWeek: "Tu",
        sessionSeason: "Fall",
        sessionYear: 2026,
        courseCode: code,
        serviceName: "Splash 1",
        location: "Pool",
        startTime24: "09:00",
        endTime24: "09:30",
        durationMinutes: 30,
        studentCount: 1,
        waitlistCount: 0,
    };
}

function writeLegacyRoster(rows: Student[]) {
    window.sessionStorage.setItem(
        getScopedKey("studentsByDay"),
        JSON.stringify({ Tu: rows }),
    );
}

const legacyRoster = () =>
    JSON.parse(window.sessionStorage.getItem(getScopedKey("studentsByDay")) ?? "{}");

// Triage W10: the roster cache was keyed by weekday only.
describe("roster cache per session", () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        setStorageScope("user-1");
    });

    it("keeps two same-weekday sessions' rosters apart", () => {
        setStudentsForDay("Tu", [swimmer("Morning", "1")], "morning");
        setStudentsForDay("Tu", [swimmer("Evening", "2")], "evening");

        expect(getStudentsForDay("Tu", "morning").map((s) => s.name)).toEqual(["Morning"]);
        expect(getStudentsForDay("Tu", "evening").map((s) => s.name)).toEqual(["Evening"]);
    });

    it("reads and writes the current session when none is given", () => {
        setCurrentSessionId("morning");
        setStudentsForDay("Tu", [swimmer("Morning", "1")]);
        setCurrentSessionId("evening");

        expect(getStudentsForDay("Tu")).toEqual([]);
        setCurrentSessionId("morning");
        expect(getStudentsForDay("Tu").map((s) => s.name)).toEqual(["Morning"]);
    });

    it("moves a weekday-only roster to the session that uploaded it", () => {
        writeLegacyRoster([swimmer("Morning", "1")]);
        setLoadedRosterSession("Tu", "morning");

        expect(getStudentsForDay("Tu", "evening")).toEqual([]);
        expect(legacyRoster().Tu).toHaveLength(1);
        expect(getStudentsForDay("Tu", "morning").map((s) => s.name)).toEqual(["Morning"]);
        expect(window.sessionStorage.getItem(getScopedKey("studentsByDay"))).toBeNull();
        expect(getStudentsForDay("Tu", "evening")).toEqual([]);
    });

    it("without an upload record, moves it only to the session whose classes it matches", () => {
        writeLegacyRoster([swimmer("Morning", "1"), swimmer("Also morning", "3")]);
        setExtractedClassesForSession("morning", [classFor("1"), classFor("3")]);
        setExtractedClassesForSession("mixed", [classFor("1")]);

        expect(getStudentsForDay("Tu", "no-classes")).toEqual([]);
        expect(getStudentsForDay("Tu", "mixed")).toEqual([]);
        expect(getStudentsForDay("Tu", "morning")).toHaveLength(2);
        expect(getStudentsForDay("Tu", "mixed")).toEqual([]);
    });
});
