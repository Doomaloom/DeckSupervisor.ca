import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterPrintUpdate, UploadedPrintRoster } from "../../../../lib/rosterPrintUpdates";
import PrintUpdatesModal from "./PrintUpdatesModal.component";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), resolve: vi.fn(), load: vi.fn(), open: vi.fn(), print: vi.fn() }));
vi.mock("../../../../lib/serverApi", () => ({ fetchRosterPrintUpdates: mocks.fetch, resolveRosterPrintUpdates: mocks.resolve }));
vi.mock("../../../../lib/rosterPrintUpdates", () => ({ loadUploadedPrintRosters: mocks.load }));
vi.mock("../../../../shared/attendance-print/openAttendancePrintWindow", () => ({ openAttendancePrintWindow: mocks.open }));
vi.mock("../../../../shared/attendance-print/printAttendanceHtml", () => ({ printAttendanceHtml: mocks.print }));

const update: RosterPrintUpdate = { code: "A", roster_hash: "hash-a", revision: "revision-a", changed_at: "2026-10-08T12:00:00Z" };
const snapshot: UploadedPrintRoster = {
    hash: "hash-a", roster: {
        code: "A", serviceName: "Splash 1", day: "Mo", time: "09:00 - 09:30", location: "Pool", schedule: "8 weeks", instructor: "Alex",
        students: [{ name: "Alice", phone: "", level: "Splash 1", instructor: "Alex" }],
    }
};
const setup = () => render(<PrintUpdatesModal sessionId="session-a" sessionTitle="Fall session" isGuest={false} onClose={vi.fn()} />);

beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    mocks.fetch.mockResolvedValue({ updates: [update] });
    mocks.resolve.mockResolvedValue({ removed: ["A"] });
    mocks.load.mockReturnValue({ A: snapshot });
    mocks.open.mockReturnValue({ close: vi.fn() });
    mocks.print.mockResolvedValue({ status: "printed" });
});

describe("Print Updates", () => {
    it("prints the changed class and only clears it after explicit print confirmation", async () => {
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Print class A" }));
        const confirm = await screen.findByRole("button", { name: "Mark printed" });
        expect(mocks.resolve).not.toHaveBeenCalled();
        expect(mocks.print.mock.calls[0][0]).toMatchObject({
            title: "Print Updates", session: "Fall session", rosters: [{ roster: { code: "A", students: [{ name: "Alice" }] } }],
        });
        mocks.fetch.mockResolvedValue({ updates: [] });
        fireEvent.click(confirm);
        await waitFor(() => expect(mocks.resolve).toHaveBeenCalledWith("session-a", [update]));
        expect(await screen.findByText(/No classes are waiting/)).toBeInTheDocument();
    });

    it("keeps cancelled jobs in the queue", async () => {
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Print class A" }));
        fireEvent.click(await screen.findByRole("button", { name: "Keep queued" }));
        expect(mocks.resolve).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Print class A" })).toBeEnabled();
    });

    it.each(["blocked", "failed"])("does not clear a %s print job", async (failure) => {
        if (failure === "blocked") mocks.open.mockReturnValue(null);
        else mocks.print.mockResolvedValue({ status: "failed", error: new Error("Template failed") });
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Print class A" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(failure === "blocked" ? "popup was blocked" : "Template failed");
        expect(mocks.resolve).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Dismiss class A" })).toBeInTheDocument();
    });

    it("allows dismissing stale local data without allowing it to print", async () => {
        mocks.load.mockReturnValue({ A: { ...snapshot, hash: "old-hash" } });
        setup();
        expect(await screen.findByRole("button", { name: "Print class A" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Print selected" })).toBeDisabled();
        mocks.fetch.mockResolvedValue({ updates: [] });
        fireEvent.click(screen.getByRole("button", { name: "Dismiss class A" }));
        await waitFor(() => expect(mocks.resolve).toHaveBeenCalledWith("session-a", [update]));
        expect(mocks.print).not.toHaveBeenCalled();
    });

    it("shows a newer upload that survived acknowledgement of the old revision", async () => {
        setup();
        const dismiss = await screen.findByRole("button", { name: "Dismiss selected" });
        const newer = { ...update, roster_hash: "new-hash", revision: "new-revision" };
        mocks.resolve.mockResolvedValue({ removed: [] });
        mocks.fetch.mockResolvedValue({ updates: [newer] });
        fireEvent.click(dismiss);
        expect(await screen.findByText(/changed again during this action/)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Print class A" })).toBeDisabled());
        expect(screen.getByRole("button", { name: "Dismiss class A" })).toBeEnabled();
    });

    it("keeps entries available to retry when queue resolution fails", async () => {
        mocks.resolve.mockRejectedValue(new Error("Connection lost"));
        setup();
        fireEvent.click(await screen.findByRole("button", { name: "Dismiss selected" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
        await waitFor(() => expect(screen.getByRole("button", { name: "Dismiss class A" })).toBeEnabled());
    });

    it("does not request database tracking for guest sessions", () => {
        render(<PrintUpdatesModal sessionId="guest-session" sessionTitle="Session" isGuest onClose={vi.fn()} />);
        expect(screen.getByText(/Sign in to track/)).toBeInTheDocument();
        expect(mocks.fetch).not.toHaveBeenCalled();
    });

    it("shows a queue loading failure without claiming there are no updates", async () => {
        mocks.fetch.mockRejectedValue(new Error("Queue unavailable"));
        setup();
        expect(await screen.findByRole("alert")).toHaveTextContent("Queue unavailable");
        expect(screen.queryByText(/No classes are waiting/)).not.toBeInTheDocument();
    });

    it("does not offer an acknowledged class again if refreshing the queue fails", async () => {
        setup();
        const dismiss = await screen.findByRole("button", { name: "Dismiss class A" });
        mocks.fetch.mockRejectedValue(new Error("Refresh failed"));
        fireEvent.click(dismiss);
        expect(await screen.findByRole("alert")).toHaveTextContent("selected updates were resolved");
        expect(screen.queryByRole("button", { name: "Print class A" })).not.toBeInTheDocument();
    });
});
