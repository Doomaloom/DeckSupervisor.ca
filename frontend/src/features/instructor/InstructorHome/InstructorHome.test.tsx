import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import InstructorHome from "./InstructorHome.component";
const state = vi.hoisted(() => ({ sessionsLoading: false, sessionError: "", sessions: [] as any[], sessionId: "", selectSession: vi.fn(), refresh: vi.fn() }));
vi.mock("../session/InstructorSessionContext", () => ({ useInstructorSession: () => state }));
beforeEach(() => { state.sessionsLoading = false; state.sessionError = ""; state.sessions = []; vi.clearAllMocks(); });
function Destination() { return <p>{useLocation().search}</p>; }
function setup() { render(<MemoryRouter initialEntries={["/instructor"]}><Routes><Route path="/instructor" element={<InstructorHome />}/><Route path="/instructor/my-classes" element={<Destination />}/></Routes></MemoryRouter>); }
it("shows loading and retries failed session retrieval", async () => {
    state.sessionsLoading = true;
    state.sessionError = "Offline";
    setup();
    expect(screen.getByRole("status")).toHaveTextContent("Loading sessions");
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry sessions" }));
    expect(state.refresh).toHaveBeenCalledOnce();
});
it("explains when no sessions are linked", () => { setup(); expect(screen.getByText(/No sessions are linked/)).toBeVisible(); });
it("selects a session and preserves it in the classes deep link", async () => {
    state.sessions = [{ id: "session a", session_day: "Mo", session_season: "Fall", session_year: 2026, start_date: "2026-10-05", end_date: "2026-12-14", location: "Pool A" }];
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: /Pool A/ }));
    expect(state.selectSession).toHaveBeenCalledWith("session a");
    expect(screen.getByText("?session=session%20a")).toBeVisible();
});
