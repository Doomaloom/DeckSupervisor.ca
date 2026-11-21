import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useSchematicSchedule } from "./useSchematicSchedule";

const mocks = vi.hoisted(() => {
    const ownerSession = {
        id: "s1",
        instructors: [{ id: "i1", name: "Synthetic Instructor" }],
    };
    return {
        courses: [{
            code: "A",
            level: "Swimmer 1",
            startTime: "09:00",
            endTime: "09:30",
            startMinutes: 540,
            endMinutes: 570,
            runningTime: 30,
            studentCount: 2,
        }],
        current: {
            access: { mode: "guest" },
            session: null as typeof ownerSession | null,
            sessionId: null as string | null,
            loading: false,
        },
        ownerSession,
        showAppNotice: vi.fn(),
        fetchSchematic: vi.fn(),
        upsertSchematic: vi.fn(),
        setScheduleForDay: vi.fn(),
    };
});

vi.mock("../../../../app/useCurrentSession", () => ({
    useCurrentSession: () => mocks.current,
}));
vi.mock("../utils/courses", () => ({ buildCourses: () => mocks.courses }));
vi.mock("../../../../lib/appNotice", () => ({
    showAppNotice: mocks.showAppNotice,
}));
vi.mock("../../../../lib/serverApi", () => ({
    fetchSchematic: mocks.fetchSchematic,
    upsertSchematic: mocks.upsertSchematic,
}));
vi.mock("../../../../lib/printPdfCache", () => ({
    invalidateCachedSchematicPdfs: vi.fn(async () => { }),
}));
vi.mock("../../Print/services/printCachePrefetch", () => ({
    prefetchSchematicPdfs: vi.fn(),
}));
vi.mock("../../../../lib/storage", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    setScheduleForDay: mocks.setScheduleForDay,
}));

beforeEach(() => {
    mocks.current = {
        access: { mode: "guest" },
        session: null,
        sessionId: null,
        loading: false,
    };
    mocks.showAppNotice.mockReset();
    mocks.fetchSchematic.mockReset().mockResolvedValue({ schematic: null });
    mocks.upsertSchematic.mockReset().mockResolvedValue({});
    mocks.setScheduleForDay.mockReset();
});

it("reports unsaved board changes until the schedule is saved", async () => {
    const { result } = renderHook(() => useSchematicSchedule("Mo"));
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.addTemporaryColumn());
    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(() => result.current.handleSaveSchedule());
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(mocks.showAppNotice).toHaveBeenLastCalledWith(
        "Schedule saved successfully!",
        "success",
    );
});

it("blocks board edits while a save is running and keeps the board", async () => {
    mocks.current = {
        access: { mode: "owner" },
        session: mocks.ownerSession,
        sessionId: "s1",
        loading: false,
    };
    let finishSave = () => { };
    mocks.upsertSchematic.mockImplementation(() =>
        new Promise<void>((resolve) => {
            finishSave = resolve;
        })
    );
    const { result } = renderHook(() => useSchematicSchedule("Mo"));
    await waitFor(() => expect(mocks.fetchSchematic).toHaveBeenCalled());
    act(() => result.current.addTemporaryColumn());
    const columnCount = result.current.columns.length;

    let saving = Promise.resolve();
    act(() => {
        saving = result.current.handleSaveSchedule();
    });
    expect(result.current.isSaving).toBe(true);

    act(() => result.current.handleDragStart(mocks.courses[0], 0));
    act(() => result.current.addTemporaryColumn());
    expect(result.current.draggedCourseCodes).toEqual([]);
    expect(result.current.columns).toHaveLength(columnCount);
    expect(mocks.showAppNotice).toHaveBeenCalledWith(
        "Please wait for the schedule to finish saving.",
        "info",
    );

    await act(async () => {
        finishSave();
        await saving;
    });
    expect(mocks.upsertSchematic).toHaveBeenCalledTimes(1);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasUnsavedChanges).toBe(false);
    expect(result.current.columns).toHaveLength(columnCount);
});

it("shows an error instead of success when no session is loaded", async () => {
    mocks.current = {
        access: { mode: "none" },
        session: null,
        sessionId: "s1",
        loading: false,
    };
    const { result } = renderHook(() => useSchematicSchedule("Mo"));
    act(() => result.current.addTemporaryColumn());

    await act(() => result.current.handleSaveSchedule());
    expect(mocks.showAppNotice).toHaveBeenCalledWith(
        "No session is loaded, so the schedule was not saved. Reload the page and try again.",
        "error",
    );
    expect(mocks.showAppNotice).not.toHaveBeenCalledWith(
        "Schedule saved successfully!",
        "success",
    );
    expect(mocks.setScheduleForDay).not.toHaveBeenCalled();
    expect(mocks.upsertSchematic).not.toHaveBeenCalled();
    expect(result.current.hasUnsavedChanges).toBe(true);
});
