import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { installLocalStorage } from "../../../test/storage";
import ReportCards from "./ReportCards.component";
const state = vi.hoisted(() => ({ accountType: "part_time", currentTeamId: "", currentTerm: null as {
        label: string;
    } | null, fetchReportCardTotals: vi.fn() }));
vi.mock("../../../app/AuthContext", () => ({ useAuth: () => ({ accountType: state.accountType, isGuest: true, user: null }) }));
vi.mock("../../../app/DayContext", () => ({ useDay: () => ({ selectedDay: "Mo" }) }));
vi.mock("../../../app/useCurrentSession", () => ({ useCurrentSession: () => ({ access: { mode: "none" }, session: null, sessionId: "" }) }));
vi.mock("../../../app/useCurrentTeam", () => ({ useCurrentTeam: () => ({ currentTeamId: state.currentTeamId, currentTeam: { name: "Aquatics" } }) }));
vi.mock("../../../app/useCurrentTerm", () => ({ useCurrentTerm: () => ({ currentTerm: state.currentTerm }) }));
vi.mock("../../../lib/serverApi", () => ({ fetchReportCardTotals: state.fetchReportCardTotals }));
beforeEach(() => { installLocalStorage(); state.accountType = "part_time"; state.currentTeamId = ""; state.currentTerm = null; state.fetchReportCardTotals.mockReset().mockResolvedValue({ totals: [] }); });
it("shows the empty day roster without fetching employee totals", () => { render(<ReportCards />); expect(screen.getByRole("heading", { name: "Report Cards" })).toBeVisible(); expect(screen.getByText(/No students/)).toBeVisible(); expect(state.fetchReportCardTotals).not.toHaveBeenCalled(); });
it("requires a selected team for employee totals", () => { state.accountType = "full_time"; render(<ReportCards />); expect(screen.getByText(/Select a team on the home page/)).toBeVisible(); });
it("loads totals for the selected team and term", async () => { state.accountType = "full_time"; state.currentTeamId = "team"; state.currentTerm = { label: "Fall 2026" }; render(<ReportCards />); expect(await screen.findByText(/No report card totals found/)).toBeVisible(); expect(state.fetchReportCardTotals).toHaveBeenCalledWith("team", "Fall 2026"); });
