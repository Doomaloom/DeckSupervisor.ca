import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import MyClasses from "./MyClasses.component";
const state = vi.hoisted(() => ({
    sessions: [{
        id: "session-a",
        session_day: "Monday",
        session_season: "Fall",
        session_year: 2026,
        location: "Pool",
        start_date: "2026-10-05",
        end_date: "2026-10-26",
        weeks: ["2026-10-05"],
    }],
    sessionId: "session-a",
    session: { session_day: "Monday" },
    classes: [{
        id: "class-a",
        session_id: "session-a",
        assignment_id: "column-a",
        instructor: "Alex",
        code: "A",
        level: "Swimmer 1",
        start_time: "09:00:00",
        end_time: "09:30:00",
    }],
    loading: false,
    error: "",
    selectSession: vi.fn(),
    refresh: vi.fn(),
}));
vi.mock("../session/useInstructorClasses", async () => {
    const actual = await vi.importActual("../session/useInstructorClasses");
    return { ...actual, default: () => state };
});
it("renders class metadata and an accessible stable-ID lesson link without roster counts", () => {
    render(
        <MemoryRouter>
            <MyClasses />
        </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Plan Swimmer 1/ }))
        .toHaveAttribute(
            "href",
            "/instructor/lesson-plans?session=session-a&class=class-a",
        );
    expect(screen.getByText("Alex")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Session" })).not
        .toBeInTheDocument();
    expect(screen.queryByText(/students|capacity|registered/i)).not
        .toBeInTheDocument();
});
it("explains unlinked assignments", () => {
    state.classes = [];
    render(
        <MemoryRouter>
            <MyClasses />
        </MemoryRouter>,
    );
    expect(screen.getByText(/No classes are linked/)).toBeVisible();
});
