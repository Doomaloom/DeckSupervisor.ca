import { beforeEach, expect, it, vi } from "vitest";
import type { InstructorClass, InstructorSession } from "../../../lib/serverApi";
import { loadMarkingStudents } from "./loadMarkingStudents";

const local = vi.hoisted(() => ({ session: vi.fn(), students: vi.fn(), snapshots: vi.fn() }));
vi.mock("../../../lib/loadedRosterSession", () => ({ getLoadedRosterSession: local.session }));
vi.mock("../../../lib/storage", () => ({ getStudentsForDay: local.students }));
vi.mock("../../../lib/rosterPrintUpdates", () => ({ loadUploadedPrintRosters: local.snapshots }));
const session = { id: "session-a", session_day: "Mo" } as InstructorSession;
const course = { code: "123" } as InstructorClass;
beforeEach(() => {
    vi.clearAllMocks();
    local.session.mockReturnValue("session-a");
    local.students.mockReturnValue([]);
    local.snapshots.mockReturnValue({});
});

it("fills names from the current session's local class, excluding waitlisted and other classes", () => {
    local.students.mockReturnValue([
        { code: "123", name: "Avery", waitlist: false },
        { code: "123", name: "Waitlisted", waitlist: true },
        { code: "456", name: "Other class" },
    ]);
    expect(loadMarkingStudents(session, course)).toEqual([{ name: "Avery" }]);
    expect(local.session).toHaveBeenCalledWith("Mo");
    expect(local.snapshots).not.toHaveBeenCalled();
});

it("uses a session-scoped uploaded roster when that class is not loaded", () => {
    local.session.mockReturnValue("another-session");
    local.students.mockReturnValue([{ code: "123", name: "Wrong session" }]);
    local.snapshots.mockReturnValue({ "123": { roster: { code: "123", students: [{ name: "Blair" }, { name: "Waiting", waitlist: true }] } } });
    expect(loadMarkingStudents(session, course)).toEqual([{ name: "Blair" }]);
    expect(local.snapshots).toHaveBeenCalledWith("session-a");
    expect(local.students).not.toHaveBeenCalled();
});

it("leaves names blank when no matching session and class data exists", () => {
    local.session.mockReturnValue("another-session");
    local.snapshots.mockReturnValue({ "456": { roster: { code: "456", students: [{ name: "Other class" }] } } });
    expect(loadMarkingStudents(session, course)).toEqual([]);
});
