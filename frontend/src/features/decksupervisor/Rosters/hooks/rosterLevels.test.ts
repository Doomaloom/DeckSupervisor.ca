import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
    fetchRosterEdits,
    fetchSchematic,
    setRosterClassLevel,
    upsertRosterStudentLevelEdit,
} from "../../../../lib/serverApi";
import { getStudentsForDay, setStudentsForDay } from "../../../../lib/storage";
import { installLocalStorage } from "../../../../test/storage";
import type { Student } from "../../../../types/app";
import { useRosterData } from "./useRosterData";
import { useRosterEdits } from "./useRosterEdits";

vi.mock("../../../../lib/serverApi", () => ({
    fetchSchematic: vi.fn(),
    fetchRosterEdits: vi.fn(),
    upsertRosterStudentLevelEdit: vi.fn(),
    upsertRosterLevelEdit: vi.fn(),
    deleteRosterStudentLevelEdit: vi.fn(),
    setRosterClassLevel: vi.fn(),
}));

const SESSION = "session-1";
const student = (id: string, extra: Partial<Student> = {}): Student => ({
    id,
    service_name: "Splash 4",
    code: "1001",
    day: "Th",
    time: "09:00-09:30",
    location: "Pool A",
    schedule: "Morning",
    name: `Swimmer ${id}`,
    phone: "",
    instructor: "Coach Amy",
    level: "Splash 4",
    registered_level: "Splash 4",
    waitlist: false,
    ...extra,
});

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

function mountPage() {
    return renderHook(() => {
        const data = useRosterData("Th", SESSION, false);
        const edits = useRosterEdits({
            selectedDay: "Th",
            students: data.students,
            setStudents: data.setStudents,
            sessionId: SESSION,
            currentUserId: "user-1",
            canEdit: true,
        });
        return { data, edits };
    });
}

beforeEach(() => {
    installLocalStorage();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchSchematic).mockResolvedValue(
        { schematic: null } as Awaited<ReturnType<typeof fetchSchematic>>,
    );
    vi.mocked(upsertRosterStudentLevelEdit).mockResolvedValue(undefined);
    vi.mocked(setRosterClassLevel).mockResolvedValue(undefined);
});

// RL-2: the saved edits are fetched once when the page opens. If the user
// changes a level before that fetch answers, the answer replaces the change.
it("keeps a level the user picked while the first edits fetch was still running", async () => {
    setStudentsForDay("Th", [student("a")], SESSION);
    const edits = deferred<Awaited<ReturnType<typeof fetchRosterEdits>>>();
    vi.mocked(fetchRosterEdits).mockReturnValue(edits.promise);

    const { result } = mountPage();
    await waitFor(() => expect(result.current.data.students).toHaveLength(1));

    act(() => result.current.edits.handleStudentLevelChange("a", "Splash 5"));
    expect(result.current.data.students[0].level).toBe("Splash 5");

    await act(async () => {
        edits.resolve({ rosterEdits: [], studentEdits: [] });
        await Promise.resolve();
    });
    await waitFor(() => expect(fetchRosterEdits).toHaveBeenCalled());
    await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
    });
    // The save went through, so the screen should still show Splash 5.
    expect(upsertRosterStudentLevelEdit).toHaveBeenCalled();
    expect(result.current.data.students[0].level).toBe("Splash 5");
});

// RL-3: the instructor-assignment effect in useRosterData writes the
// on-screen students to the cache with a normal (non-silent) write, so a level
// that failed to save is stored.
it("does not store a level that failed to save when the schematic assigns an instructor", async () => {
    setStudentsForDay("Th", [student("a")], SESSION);
    vi.mocked(fetchRosterEdits).mockResolvedValue(
        { rosterEdits: [], studentEdits: [] },
    );
    const schematic = deferred<Awaited<ReturnType<typeof fetchSchematic>>>();
    vi.mocked(fetchSchematic).mockReturnValue(schematic.promise);
    vi.mocked(upsertRosterStudentLevelEdit).mockRejectedValue(
        new Error("offline"),
    );

    const { result } = mountPage();
    await waitFor(() => expect(result.current.data.students).toHaveLength(1));
    act(() => result.current.edits.handleStudentLevelChange("a", "Splash 5"));
    await waitFor(() =>
        expect(result.current.edits.saveStates["1001"]?.failures).toHaveLength(1)
    );

    await act(async () => {
        schematic.resolve({
            schematic: {
                data: { instructors: ["Coach Bo"], codes: ["1001"] },
            },
        } as Awaited<ReturnType<typeof fetchSchematic>>);
        await new Promise((r) => setTimeout(r, 50));
    });
    expect(
        getStudentsForDay("Th", SESSION).find((s) => s.id === "a")?.level,
    ).toBe("Splash 4");
});
