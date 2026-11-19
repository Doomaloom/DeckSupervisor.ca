import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setCurrentSessionId } from "../../../../lib/sessionStorage";
import { setStorageScope } from "../../../../lib/storageScope";
import { installLocalStorage } from "../../../../test/storage";
import DeviceExportPage from "../DeviceExport.component";
import { classes, session, students } from "../fixtures";
import { buildCourses } from "../services/exportPackage";
import { loadExportCourses } from "../services/loadExportCourses";
import { isShareGone } from "./ExportSession.logic";

// Heartbeat and end-sharing behaviour when the backend share is lost (expired after 60 s, closed, or restarted).
const mocks = vi.hoisted(() => ({
    current: vi.fn(),
    createShare: vi.fn(),
    heartbeatShare: vi.fn(),
    closeShare: vi.fn(),
}));
vi.mock("../../../../app/useCurrentSession", () => ({ useCurrentSession: mocks.current }));
vi.mock("../../../../app/AuthContext", () => ({ useAuth: () => ({ isGuest: true }) }));
vi.mock("../services/loadExportCourses", () => ({ loadExportCourses: vi.fn() }));
vi.mock("../../../../lib/serverApi", async (original) => ({
    ...await original<typeof import("../../../../lib/serverApi")>(),
    createDeviceShare: mocks.createShare,
    fetchDeviceLessonPlans: vi.fn().mockResolvedValue({ plans: [] }),
    heartbeatDeviceShare: mocks.heartbeatShare,
    closeDeviceShare: mocks.closeShare,
}));
vi.mock("../services/resultRegistry", () => ({
    recoverRegistry: vi.fn().mockResolvedValue(undefined),
    registerResults: vi.fn().mockResolvedValue({}),
    assertRegisteredRoster: vi.fn().mockResolvedValue(undefined),
}));

// Errors exactly as serverApi.request throws them for the backend's http.Error responses.
const gone = () => new Error("shared device session not found\n");
const forbidden = () => new Error("host token is invalid\n");
const offline = () => new TypeError("Failed to fetch");

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("crypto", webcrypto);
    installLocalStorage();
    window.localStorage.clear();
    window.sessionStorage.clear();
    setStorageScope("export-test");
    setCurrentSessionId(session.id);
    mocks.current.mockReturnValue({ session, sessionId: session.id, loading: false });
    mocks.createShare.mockReset().mockResolvedValue({
        id: "share-1",
        hostToken: "host-token",
        expiresAt: "2026-09-22T12:00:00Z",
        codes: [{ instructor: "Alex", code: "001234" }, { instructor: "Sam", code: "987654" }],
    });
    mocks.heartbeatShare.mockReset().mockResolvedValue({ expiresAt: "2026-09-22T12:01:00Z" });
    mocks.closeShare.mockReset().mockResolvedValue(undefined);
    vi.mocked(loadExportCourses).mockReset().mockResolvedValue(buildCourses(session, classes, students));
});
afterEach(() => {
    vi.useRealTimers();
});

const startSharing = async () => {
    const view = render(
        <MemoryRouter>
            <DeviceExportPage />
        </MemoryRouter>,
    );
    await screen.findByRole("option", { name: "Alex" });
    fireEvent.click(screen.getByRole("button", { name: "Start Session and Create Codes" }));
    await screen.findByText("001234");
    return view;
};
const tick = async (ms = 15_000) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};

it("recognises only the backend's expired-or-closed share responses as gone", () => {
    expect(isShareGone(gone())).toBe(true);
    expect(isShareGone(forbidden())).toBe(true);
    expect(isShareGone(offline())).toBe(false);
    expect(isShareGone(new Error("Bad Gateway"))).toBe(false);
    expect(isShareGone(new Error("Request failed"))).toBe(false);
});

it("clears dead codes and lets the user start again when the share expired", async () => {
    await startSharing();
    mocks.heartbeatShare.mockRejectedValueOnce(gone());
    await tick();
    await waitFor(() => expect(screen.queryByText("001234")).not.toBeInTheDocument());
    expect(screen.queryByText("987654")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "End Sharing" })).not.toBeInTheDocument();
    expect(screen.getByText(/Sharing ended because this page lost contact/)).toBeInTheDocument();
    expect(screen.queryByText(/Session sharing is active/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The share is already gone, so no close request is needed for it.
    expect(mocks.closeShare).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start Session and Create Codes" }));
    await waitFor(() => expect(mocks.createShare).toHaveBeenCalledTimes(2));
    await screen.findByText("001234");
    expect(screen.queryByText(/Sharing ended because/)).not.toBeInTheDocument();
});

it("treats a rejected host token as an ended share", async () => {
    await startSharing();
    mocks.heartbeatShare.mockRejectedValueOnce(forbidden());
    await tick();
    await waitFor(() => expect(screen.queryByText("001234")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Start Session and Create Codes" })).toBeInTheDocument();
});

it("keeps codes through a transient heartbeat failure and clears the reconnecting message on recovery", async () => {
    await startSharing();
    mocks.heartbeatShare.mockRejectedValueOnce(offline()).mockRejectedValueOnce(new Error("Bad Gateway"));
    await tick();
    await screen.findByText(/Reconnecting to the sharing service/);
    expect(screen.getByText("001234")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await tick();
    expect(screen.getByText("001234")).toBeInTheDocument();
    expect(screen.getByText(/Reconnecting to the sharing service/)).toBeInTheDocument();
    await tick();
    await waitFor(() => expect(screen.queryByText(/Reconnecting/)).not.toBeInTheDocument());
    expect(screen.getByText("001234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Sharing" })).toBeInTheDocument();
});

it("sends a heartbeat at once when the tab becomes visible or the browser comes back online", async () => {
    await startSharing();
    expect(mocks.heartbeatShare).not.toHaveBeenCalled();
    await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(mocks.heartbeatShare).toHaveBeenCalledTimes(1));
    await act(async () => {
        window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(mocks.heartbeatShare).toHaveBeenCalledTimes(2));
    expect(mocks.heartbeatShare).toHaveBeenCalledWith("share-1", "host-token");
});

it("returning to an expired share shows it ended instead of stale codes", async () => {
    await startSharing();
    mocks.heartbeatShare.mockRejectedValueOnce(gone());
    await act(async () => {
        window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(screen.queryByText("001234")).not.toBeInTheDocument());
    expect(screen.getByText(/Sharing ended because/)).toBeInTheDocument();
});

it("End Sharing succeeds when the share already expired", async () => {
    await startSharing();
    mocks.closeShare.mockRejectedValueOnce(gone());
    fireEvent.click(screen.getByRole("button", { name: "End Sharing" }));
    await waitFor(() => expect(screen.queryByText("001234")).not.toBeInTheDocument());
    expect(screen.getByText("Session sharing ended.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Session and Create Codes" })).toBeInTheDocument();
});

it("End Sharing keeps the share and reports a transient failure", async () => {
    await startSharing();
    mocks.closeShare.mockRejectedValueOnce(new Error("Bad Gateway"));
    fireEvent.click(screen.getByRole("button", { name: "End Sharing" }));
    await screen.findByRole("alert");
    expect(screen.getByText("001234")).toBeInTheDocument();
});

it("still ends the share when leaving the page", async () => {
    const view = await startSharing();
    view.unmount();
    expect(mocks.closeShare).toHaveBeenCalledWith("share-1", "host-token");
});
