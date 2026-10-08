import { beforeEach, expect, it } from "vitest";
import { buildUpdatePrintItems } from "./updatePrintRosters";
import type { RosterPrintUpdate, UploadedPrintRoster } from "../../../lib/rosterPrintUpdates";
import { setLoadedRosterSession } from "../../../lib/loadedRosterSession";
import { setStudentsForDay } from "../../../lib/storage";
import { rosterToStudents } from "../../../lib/api";

const update: RosterPrintUpdate = { code: "A", roster_hash: "hash", revision: "revision", changed_at: "" };
const snapshot: UploadedPrintRoster = { hash: "hash", roster: {
    code: "A", serviceName: "Splash 1", day: "Mo", time: "09:00", location: "Pool", schedule: "Fall", instructor: "Original",
    students: [
        { name: "Alice", phone: "", instructor: "Original", level: "Splash 1" },
        { name: "Bob", phone: "", instructor: "Original", level: "Splash 1", waitlist: true },
    ],
} };
beforeEach(() => sessionStorage.clear());

it("uses matching upload students, omits waitlists, and applies current session assignments", () => {
    setLoadedRosterSession("Mo", "session-a");
    setStudentsForDay("Mo", rosterToStudents([{ ...snapshot.roster, students: [{ ...snapshot.roster.students[0], instructor: "Current" }] }]));
    expect(buildUpdatePrintItems("session-a", [update], { A: snapshot })[0].roster).toMatchObject({
        code: "A", instructor: "Current", students: [{ name: "Alice" }],
    });
    expect(buildUpdatePrintItems("other-session", [update], { A: snapshot })[0].roster.instructor).toBe("Original");
});

it("prints an empty instructor sheet when all students have been removed", () => {
    const empty = { ...snapshot, roster: { ...snapshot.roster, students: [] } };
    expect(buildUpdatePrintItems("session-a", [update], { A: empty })[0]).toMatchObject({ template: "Splash1", roster: { code: "A", students: [] } });
});

it("rejects missing or stale snapshots rather than printing another roster", () => {
    expect(() => buildUpdatePrintItems("session-a", [update], {})).toThrow(/latest roster/);
    expect(() => buildUpdatePrintItems("session-a", [update], { A: { ...snapshot, hash: "stale" } })).toThrow(/latest roster/);
});
