import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { webcrypto } from "node:crypto";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { setCurrentSessionId } from "../../../lib/sessionStorage";
import { setStorageScope } from "../../../lib/storageScope";
import { installLocalStorage } from "../../../test/storage";
import DeviceExportPage from "./DeviceExport.component";
import { classes, session, students } from "./fixtures";
import type { ExportCourse } from "./services/exportPackage";
import { buildCourses, newRegistry } from "./services/exportPackage";
import { loadRegistry } from "./services/exportStorage";
import { loadExportCourses } from "./services/loadExportCourses";
const mocks = vi.hoisted(() => ({
    isGuest: true,
    recover: vi.fn(),
    register: vi.fn(),
    current: vi.fn(),
    download: vi.fn(),
    createShare: vi.fn(),
    heartbeatShare: vi.fn(),
    closeShare: vi.fn(),
}));
vi.mock(
    "../../../app/useCurrentSession",
    () => ({ useCurrentSession: mocks.current }),
);
vi.mock(
    "../../../app/AuthContext",
    () => ({ useAuth: () => ({ isGuest: mocks.isGuest }) }),
);
vi.mock("./services/loadExportCourses", () => ({ loadExportCourses: vi.fn() }));
vi.mock(
    "./services/exportStorage",
    async (original) => ({
        ...await original<typeof import("./services/exportStorage")>(),
        downloadJSON: mocks.download,
    }),
);
vi.mock("../../../lib/serverApi", async (original) => ({
    ...await original<typeof import("../../../lib/serverApi")>(),
    createDeviceShare: mocks.createShare,
    fetchDeviceLessonPlans: vi.fn().mockResolvedValue({ plans: [] }),
    heartbeatDeviceShare: mocks.heartbeatShare,
    closeDeviceShare: mocks.closeShare,
}));
vi.mock("./services/resultRegistry", () => ({ recoverRegistry: mocks.recover, registerResults: mocks.register, assertRegisteredRoster: vi.fn().mockResolvedValue(undefined) }));
const show = () =>
    render(
        <MemoryRouter>
            <DeviceExportPage />
        </MemoryRouter>,
    );
beforeEach(() => {
    mocks.isGuest = true;
    mocks.recover.mockReset().mockResolvedValue(newRegistry(session.id));
    mocks.register.mockReset().mockResolvedValue({});
    vi.stubGlobal("crypto", webcrypto);
    installLocalStorage();
    window.localStorage.clear();
    window.sessionStorage.clear();
    setStorageScope("export-test");
    setCurrentSessionId(session.id);
    mocks.current.mockReturnValue({
        session,
        sessionId: session.id,
        loading: false,
    });
    mocks.download.mockReset();
    mocks.createShare.mockReset().mockResolvedValue({
        id: "share-1",
        hostToken: "host-token",
        expiresAt: "2026-09-22T12:00:00Z",
        codes: [{ instructor: "Alex", code: "001234" }, {
            instructor: "Sam",
            code: "987654",
        }],
    });
    mocks.heartbeatShare.mockReset().mockResolvedValue({
        expiresAt: "2026-09-22T12:01:00Z",
    });
    mocks.closeShare.mockReset().mockResolvedValue(undefined);
    vi.mocked(loadExportCourses).mockReset().mockResolvedValue(
        buildCourses(session, classes, students),
    );
});
it("downloads only the chosen instructor with edited dates without a review confirmation", async () => {
    const user = userEvent.setup();
    show();
    await user.selectOptions(await screen.findByRole("combobox"), "Alex");
    const download = screen.getByRole("button", {
        name: "Download instructor classes",
    });
    expect(download).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Lesson dates for 004201"), {
        target: { value: "2026-09-04\n2026-09-18" },
    });
    await user.click(download);
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    expect(mocks.download.mock.calls[0][0].courses[0].lessonDates).toEqual([
        "2026-09-04",
        "2026-09-18",
    ]);
    expect(mocks.download.mock.calls[0][0].courses).toHaveLength(2);
    expect(loadRegistry(session.id)?.dates?.["004201"]).toEqual([
        "2026-09-04",
        "2026-09-18",
    ]);
    await user.click(
        screen.getByRole("button", { name: "Download ID backup" }),
    );
    expect(mocks.download.mock.calls[1][0].kind).toBe("rec-tablet-export-ids");
    await user.selectOptions(screen.getByRole("combobox"), "Sam");
    expect(download).toBeEnabled();
});
it("clears old instructor choices and suppresses old async results when session changes", async () => {
    let finish!: (value: ExportCourse[]) => void;
    vi.mocked(loadExportCourses).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    const view = show();
    const next = { ...session, id: "other-session", session_day: "Mo" };
    mocks.current.mockReturnValue({
        session: next,
        sessionId: next.id,
        loading: false,
    });
    setCurrentSessionId(next.id);
    vi.mocked(loadExportCourses).mockResolvedValue([]);
    view.rerender(
        <MemoryRouter>
            <DeviceExportPage />
        </MemoryRouter>,
    );
    finish(buildCourses(session, classes, students));
    await screen.findByText(/No classes are available/);
    expect(screen.queryByRole("option", { name: "Alex" })).not
        .toBeInTheDocument();
    expect(mocks.download).not.toHaveBeenCalled();
});
it("does not download if browser persistence fails", async () => {
    const user = userEvent.setup();
    show();
    await user.selectOptions(await screen.findByRole("combobox"), "Alex");
    const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(
        () => {
            throw new Error("Storage is full");
        },
    );
    await user.click(
        screen.getByRole("button", { name: "Download instructor classes" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Storage is full",
    );
    expect(mocks.download).not.toHaveBeenCalled();
    spy.mockRestore();
});
it("shows a retryable error instead of enabling exports with a failed load", async () => {
    vi.mocked(loadExportCourses).mockRejectedValue(
        new Error("Unable to load saved assignments"),
    );
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to load saved assignments",
    );
    expect(screen.getByRole("button", { name: "Download instructor classes" }))
        .toBeDisabled();
    vi.mocked(loadExportCourses).mockResolvedValue(
        buildCourses(session, classes, students),
    );
    await userEvent.click(
        screen.getByRole("button", { name: "Refresh loaded data" }),
    );
    await screen.findByRole("option", { name: "Alex" });
});
it("requires a selected session and never uses a stale session record", () => {
    mocks.current.mockReturnValue({
        session: null,
        sessionId: "",
        loading: false,
    });
    const view = show();
    expect(screen.getByText(/Select a session and load/)).toBeInTheDocument();
    expect(loadExportCourses).not.toHaveBeenCalled();
    mocks.current.mockReturnValue({
        session,
        sessionId: "new-session",
        loading: false,
    });
    view.rerender(
        <MemoryRouter>
            <DeviceExportPage />
        </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
        "Loading selected session",
    );
    expect(loadExportCourses).not.toHaveBeenCalled();
});

it("starts temporary sharing without requiring every instructor to be reviewed", async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole("option", { name: "Alex" });
    const start = screen.getByRole("button", {
        name: "Start Session and Create Codes",
    });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(start).toBeEnabled();
    await user.click(start);
    await waitFor(() => expect(mocks.createShare).toHaveBeenCalledTimes(1));
    const packages = mocks.createShare.mock.calls[0][0];
    expect(packages.map((item: { instructor: string }) => item.instructor))
        .toEqual(["Alex", "Sam"]);
    expect(screen.getByText("001234")).toBeInTheDocument();
    expect(screen.getByText("987654")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "End Sharing" }))
        .toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "End Sharing" }));
    await waitFor(() =>
        expect(mocks.closeShare).toHaveBeenCalledWith("share-1", "host-token")
    );
});

it("binds authenticated shares only after registering canonical identities", async () => {
    mocks.isGuest = false;
    const user = userEvent.setup();
    show();
    const start = await screen.findByRole("button", {name: "Start Session and Create Codes"});
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    await waitFor(() => expect(mocks.createShare).toHaveBeenCalledTimes(1));
    expect(mocks.register).toHaveBeenCalled();
    expect(mocks.register.mock.invocationCallOrder[0]).toBeLessThan(mocks.createShare.mock.invocationCallOrder[0]);
    expect(mocks.createShare.mock.calls[0][1]).toBe(session.id);
});

// Completion-audit regressions: guest/legacy sharing stays import-only and bound shares need a registry.
it("keeps guest sharing and guest downloads unbound, without any results registration", async () => {
    const user = userEvent.setup();
    show();
    await user.selectOptions(await screen.findByRole("combobox"), "Alex");
    await user.click(
        screen.getByRole("button", { name: "Download instructor classes" }),
    );
    await waitFor(() => expect(mocks.download).toHaveBeenCalledTimes(1));
    await user.click(
        screen.getByRole("button", { name: "Start Session and Create Codes" }),
    );
    await waitFor(() => expect(mocks.createShare).toHaveBeenCalledTimes(1));
    expect(mocks.createShare.mock.calls[0][1]).toBeUndefined();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.recover).not.toHaveBeenCalled();
    const packages = [
        mocks.download.mock.calls[0][0],
        ...mocks.createShare.mock.calls[0][0].map((
            item: { package: unknown },
        ) => item.package),
    ];
    for (const pkg of packages) {
        expect(pkg.schemaVersion).toBe(1);
        expect(pkg.kind).toBe("rec-tablet-classes");
        expect(Object.keys(pkg).sort()).toEqual([
            "courses",
            "datasetId",
            "instructor",
            "kind",
            "schemaVersion",
        ]);
        expect(JSON.stringify(pkg)).not.toMatch(/"sync"|Token|enrollmentId/);
    }
});

it("does not create an authenticated share when identities cannot be registered", async () => {
    mocks.isGuest = false;
    mocks.register.mockRejectedValue(
        new Error("Class 004201 needs one saved instructor assignment before sharing."),
    );
    const user = userEvent.setup();
    show();
    const start = await screen.findByRole("button", {
        name: "Start Session and Create Codes",
    });
    await waitFor(() => expect(start).toBeEnabled());
    await user.click(start);
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "needs one saved instructor assignment before sharing",
    );
    expect(mocks.createShare).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "End Sharing" })).not
        .toBeInTheDocument();
    expect(loadRegistry(session.id)).toBeNull();
});

it("sends the session binding in the share request only for authenticated sharing", async () => {
    const actual = await vi.importActual<typeof import("../../../lib/serverApi")>(
        "../../../lib/serverApi",
    );
    const bodies: unknown[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init: RequestInit) => {
            bodies.push(JSON.parse(String(init.body)));
            return new Response(
                JSON.stringify({ id: "s", hostToken: "t", codes: [], expiresAt: "" }),
                { status: 200 },
            );
        }),
    );
    const packages = [{ instructor: "Alex", package: { schemaVersion: 1 } }];
    await actual.createDeviceShare(packages);
    await actual.createDeviceShare(packages, session.id);
    expect(bodies).toEqual([{ packages }, { packages, sessionId: session.id }]);
    expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual([
        "/api/device-shares",
        "/api/device-shares",
    ]);
    vi.unstubAllGlobals();
});
