import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import Requests from "./Requests.component";
const api = vi.hoisted(() => ({ fetchRequestAssignments: vi.fn(), createRequestAssignment: vi.fn(), deleteRequestAssignment: vi.fn(), updateRequestAssignment: vi.fn(), fetchCsvAnalyze: vi.fn() }));
vi.mock("../../../lib/serverApi", () => api);
beforeEach(() => { Object.values(api).forEach(fn => fn.mockReset()); api.fetchRequestAssignments.mockResolvedValue({ assignments: [] }); });
it("requires both files before analysis and shows the empty assignment state", async () => {
    render(<Requests />);
    expect(screen.getByRole("button", { name: "Build Summary" })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole("button", { name: "Assignments" }));
    expect(await screen.findByText(/No saved assignments/)).toBeVisible();
});
it("surfaces assignment loading failures", async () => { api.fetchRequestAssignments.mockRejectedValue(new Error("Offline")); vi.spyOn(console, "error").mockImplementation(() => { }); render(<Requests />); expect(await screen.findByText("Offline")).toBeVisible(); });
it("creates an instructor assignment through the nested editor", async () => {
    api.createRequestAssignment.mockResolvedValue({ assignment: { id: "a", event_id: "1001", term: "Fall 2026", location: "Pool", instructor: "Alex" } });
    const user = userEvent.setup();
    render(<Requests />);
    await user.click(screen.getByRole("button", { name: "Assignments" }));
    await user.type(screen.getByLabelText("Event ID"), "1001");
    await user.type(screen.getByLabelText("Term"), "Fall 2026");
    await user.type(screen.getByLabelText("Location"), "Pool");
    await user.type(screen.getByLabelText("Instructor"), "Alex");
    await user.click(screen.getByRole("button", { name: /Save Assignment/i }));
    expect(api.createRequestAssignment).toHaveBeenCalledWith(expect.objectContaining({ eventId: "1001", instructor: "Alex" }));
});
