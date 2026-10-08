import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import InstructorLayout from "../InstructorLayout/InstructorLayout.component";
import MyClasses from "../MyClasses/MyClasses.component";
const mock = vi.hoisted(() => ({
    auth: {
        user: { id: "account-a" } as { id: string } | null,
        loading: false,
        workflowCapabilities: { instructor: true, supervisor: true },
        signOut: vi.fn(),
    },
    fetchInstructorSessions: vi.fn(),
    fetchInstructorClasses: vi.fn(),
}));
vi.mock("../../../app/AuthContext", () => ({ useAuth: () => mock.auth }));
vi.mock(
    "../../../lib/serverApi",
    () => ({
        fetchInstructorSessions: mock.fetchInstructorSessions,
        fetchInstructorClasses: mock.fetchInstructorClasses,
    }),
);
const sessions = ["session-a", "session-b"].map((id) => ({
    id,
    session_day: "Mo",
    session_season: "Fall",
    session_year: 2026,
    start_date: "2026-10-05",
    end_date: "2026-10-26",
    location: id,
    weeks: ["2026-10-05"],
}));
const course = (id: string) => ({
    id,
    session_id: id,
    assignment_id: id,
    instructor: "Alex",
    code: id,
    level: id,
    start_time: "09:00:00",
    end_time: "09:30:00",
});
beforeEach(() => {
    mock.auth.user = { id: "account-a" };
    sessionStorage.clear();
    mock.fetchInstructorSessions.mockReset().mockResolvedValue({ sessions });
    mock.fetchInstructorClasses.mockReset().mockImplementation(async (
        id: string,
    ) => ({ classes: [course(id)] }));
});
function View() {
    return (
        <MemoryRouter initialEntries={["/instructor/my-classes"]}>
            <InstructorLayout>
                <MyClasses />
            </InstructorLayout>
        </MemoryRouter>
    );
}
it("keeps same-weekday sessions distinct, remembers selection on reload, and fetches metadata only", async () => {
    sessionStorage.setItem("instructor-session:account-a", "session-b");
    const view = render(<View />);
    await screen.findByRole("link", { name: /Plan session-b/ });
    view.unmount();
    render(<View />);
    await screen.findByRole("link", { name: /Plan session-b/ });
    expect(sessionStorage.getItem("instructor-session:account-a")).toBe(
        "session-b",
    );
});
it("remounts on account switch and rejects the previous account’s delayed class response", async () => {
    let finish: (value: unknown) => void = () => { };
    mock.fetchInstructorClasses.mockImplementationOnce(() =>
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    sessionStorage.setItem("instructor-session:account-a", "session-a");
    const view = render(<View />);
    await waitFor(() => expect(mock.fetchInstructorClasses).toHaveBeenCalled());
    mock.auth.user = { id: "account-b" };
    mock.fetchInstructorSessions.mockResolvedValue({ sessions: [] });
    view.rerender(<View />);
    await screen.findByRole("link", { name: "Choose a session" });
    await act(async () => finish({ classes: [course("private-account-a")] }));
    expect(screen.queryByRole("link", { name: /private-account-a/ })).not
        .toBeInTheDocument();
});
it("denies direct guest routes without instructor fetches", () => {
    mock.auth.user = null;
    render(<View />);
    expect(screen.getByText("Sign in to Instructor View")).toBeVisible();
    expect(mock.fetchInstructorClasses).not.toHaveBeenCalled();
    expect(mock.fetchInstructorSessions).not.toHaveBeenCalled();
});
