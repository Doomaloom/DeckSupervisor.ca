import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { installLocalStorage } from "../../../test/storage";
import { setLoadedRosterSession } from "../../../lib/loadedRosterSession";
import { setStudentsForDay } from "../../../lib/storage";
import type { Student } from "../../../types/app";
import ReportCards from "./ReportCards.component";

const api = vi.hoisted(() => ({ fetchSchematic: vi.fn(), syncReportCards: vi.fn(), fetchReportCardTotals: vi.fn() }));
vi.mock("../../../app/AuthContext", () => ({ useAuth: () => ({ accountType: "part_time", isGuest: false, user: { id: "u1" } }) }));
vi.mock("../../../app/DayContext", () => ({ useDay: () => ({ selectedDay: "Thursday" }) }));
vi.mock("../../../app/useCurrentSession", () => ({ useCurrentSession: () => ({ access: { mode: "owner" }, session: { team_id: null, session_season: "Fall", session_year: 2026, start_date: "2026-09-17" }, sessionId: "thu" }) }));
vi.mock("../../../app/useCurrentTeam", () => ({ useCurrentTeam: () => ({ currentTeamId: "", currentTeam: null }) }));
vi.mock("../../../app/useCurrentTerm", () => ({ useCurrentTerm: () => ({ currentTerm: null }) }));
vi.mock("../../../lib/serverApi", () => api);
vi.mock("../../../lib/rosterEditsApi", () => ({
    fetchRosterLevelEdits: vi.fn().mockResolvedValue([]), fetchRosterStudentEdits: vi.fn().mockResolvedValue([]),
    hashStudentNames: vi.fn().mockResolvedValue(new Map()), applyPersistedLevelEdits: (students: Student[]) => students,
}));

const student = (name: string, code: string, waitlist = false): Student => ({
    id: name, service_name: "Splash 7", code, day: "Thursday", time: "16:00-16:30", location: "Lakeside Demo Pool",
    schedule: "", name, phone: "", instructor: "", level: code === "98007" ? "Splash 7" : "Splash 6", waitlist,
});

beforeEach(() => {
    installLocalStorage();
    api.fetchSchematic.mockReset().mockResolvedValue({ schematic: { session_id: "thu", data: { codes: ["98007", "98006"], instructors: ["Sam Taylor", "Jordan Rivers"] } } });
    api.syncReportCards.mockReset().mockResolvedValue({ status: "synced" });
    // A fresh browser that has only uploaded the roster: no instructors stored locally.
    setLoadedRosterSession("Thursday", "thu");
    setStudentsForDay("Thursday", [student("A", "98007"), student("B", "98007"), student("C", "98006"), student("Wait", "98007", true)]);
});

it("uses the saved schematic and leaves waitlisted swimmers out", async () => {
    render(<ReportCards />);
    expect(await screen.findByText("Sam Taylor")).toBeVisible();
    expect(screen.getByText("Jordan Rivers")).toBeVisible();
    expect(screen.queryByText("Unassigned")).toBeNull();
    expect(screen.getByText("Total students: 3")).toBeVisible();
    await waitFor(() => expect(api.syncReportCards).toHaveBeenCalledTimes(1));
    const body = api.syncReportCards.mock.calls[0][0];
    expect(body.students.map((s: Student) => s.instructor)).toEqual(["Sam Taylor", "Sam Taylor", "Jordan Rivers"]);
    expect(screen.queryByText(/missing instructor assignments/)).toBeNull();
});
