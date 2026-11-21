import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import SchematicPage from "./Schematic.component";
const state = vi.hoisted(() => ({
    owner: "owner",
    accountType: "full_time",
    schedule: {} as Record<string, unknown>,
}));
vi.mock(
    "../../../app/AuthContext",
    () => ({
        useAuth: () => ({
            accountType: state.accountType,
            user: { id: "owner" },
        }),
    }),
);
vi.mock(
    "../../../app/DayContext",
    () => ({ useDay: () => ({ selectedDay: "Mo", setSelectedDay: vi.fn() }) }),
);
vi.mock(
    "../../../app/useCurrentSession",
    () => ({
        useCurrentSession: () => ({ access: { mode: "none" }, session: null }),
    }),
);
vi.mock(
    "../../../app/useCurrentTeam",
    () => ({
        useCurrentTeam: () => ({
            currentTeam: { name: "Synthetic team" },
            currentTeamId: "team",
        }),
    }),
);
vi.mock(
    "../../../app/useCurrentTerm",
    () => ({ useCurrentTerm: () => ({ currentTerm: { label: "Fall 2026" } }) }),
);
vi.mock(
    "./hooks/useSchematicSchedule",
    () => ({ useSchematicSchedule: () => state.schedule }),
);
vi.mock(
    "./SchematicBoard/SchematicBoard.component",
    () => ({ default: () => <p>Schematic board</p> }),
);
vi.mock("./hooks/useFullTimeSchematicView", () => ({
    useFullTimeSchematicView: () => ({
        columns: [],
        instructors: [],
        timeLabels: [],
        scheduleHeightRem: 0,
        scheduleStartMinutes: 0,
        instructorOptions: [],
        selectedLocationKey: "",
        selectedDay: "Mo",
        days: [],
        locationOptions: [],
        termSessions: [{}],
        selectedSession: { id: "selected-session", created_by: state.owner },
        hasDbSchematic: false,
    }),
}));
afterEach(() => {
    state.accountType = "full_time";
    state.schedule = {};
    vi.restoreAllMocks();
});
function renderPage() {
    const router = createMemoryRouter([
        { path: "/schematic", element: <SchematicPage /> },
        { path: "/rosters", element: <p>Rosters page</p> },
    ], { initialEntries: ["/schematic"] });
    render(<RouterProvider router={router} />);
    return router;
}
function sessionSchedule(hasUnsavedChanges: boolean) {
    state.accountType = "part_time";
    state.schedule = {
        columns: [],
        instructors: [],
        instructorIds: [],
        lockedInstructors: [],
        timeLabels: [],
        hasUnsavedChanges,
        isSaving: false,
        handleSaveSchedule: vi.fn(),
    };
}
it("asks before leaving the schematic with unsaved board changes", async () => {
    sessionSchedule(true);
    const router = renderPage();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await router.navigate("/rosters");
    await waitFor(() =>
        expect(confirm).toHaveBeenCalledWith(
            "Discard unsaved schematic changes?",
        )
    );
    expect(screen.getByText("Schematic board")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await router.navigate("/rosters");
    expect(await screen.findByText("Rosters page")).toBeInTheDocument();
});
it("warns before a refresh or close only while board changes are unsaved", () => {
    sessionSchedule(true);
    renderPage();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
});
it("leaves the schematic without asking when nothing has changed", async () => {
    sessionSchedule(false);
    const router = renderPage();
    const confirm = vi.spyOn(window, "confirm");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await router.navigate("/rosters");
    expect(await screen.findByText("Rosters page")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
});
it("does not show account link controls on the schematic for owners", () => {
    state.owner = "owner";
    renderPage();
    expect(screen.queryByRole("region", { name: "Instructor account links" }))
        .not
        .toBeInTheDocument();
});
it("preserves full-time view-only privileges for other owners’ sessions", () => {
    state.owner = "other-owner";
    renderPage();
    expect(screen.queryByText("Link controls for selected-session")).not
        .toBeInTheDocument();
});
