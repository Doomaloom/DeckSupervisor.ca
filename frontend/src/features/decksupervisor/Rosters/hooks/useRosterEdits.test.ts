import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import {
    applySavedLevelEditsToStoredRoster,
    deleteRosterStudentLevelEdit,
    setRosterClassLevel,
    upsertRosterStudentLevelEdit,
} from "../../../../lib/rosterEditsApi";
import { getStudentsForDay, setStudentsForDay } from "../../../../lib/storage";
import { installLocalStorage } from "../../../../test/storage";
import type { Student } from "../../../../types/app";
import { useRosterEdits } from "./useRosterEdits";

vi.mock("../../../../lib/rosterEditsApi", () => ({
    applySavedLevelEditsToStoredRoster: vi.fn(),
    deleteRosterStudentLevelEdit: vi.fn(),
    setRosterClassLevel: vi.fn(),
    upsertRosterStudentLevelEdit: vi.fn(),
}));

const SESSION = "session-1";

const student = (
    id: string,
    name: string,
    extra: Partial<Student> = {},
): Student => ({
    id,
    service_name: "Splash 4",
    code: "1001",
    day: "Th",
    time: "09:00-09:30",
    location: "Pool A",
    schedule: "Morning",
    name,
    phone: "",
    instructor: "Coach Amy",
    level: "Splash 4",
    registered_level: "Splash 4",
    waitlist: false,
    ...extra,
});

function setup(
    initial: Student[],
    options: { signedIn?: boolean; canEdit?: boolean } = {},
) {
    const { signedIn = true, canEdit = true } = options;
    setStudentsForDay("Th", initial, SESSION);
    return renderHook(() => {
        const [students, setStudents] = useState(initial);
        const edits = useRosterEdits({
            selectedDay: "Th",
            students,
            setStudents,
            sessionId: SESSION,
            currentUserId: signedIn ? "user-1" : undefined,
            canEdit,
        });
        return { students, ...edits };
    });
}

const levelOf = (list: Student[], id: string) =>
    list.find((item) => item.id === id)?.level;
const cached = (id: string) => levelOf(getStudentsForDay("Th", SESSION), id);

beforeEach(() => {
    installLocalStorage();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(upsertRosterStudentLevelEdit).mockResolvedValue(undefined);
    vi.mocked(deleteRosterStudentLevelEdit).mockResolvedValue(undefined);
    vi.mocked(setRosterClassLevel).mockResolvedValue(undefined);
    vi.mocked(applySavedLevelEditsToStoredRoster).mockResolvedValue(undefined);
});

it("keeps a swimmer's level on screen but out of the cache when the save fails (R2-W80)", async () => {
    vi.mocked(upsertRosterStudentLevelEdit).mockRejectedValue(
        new Error("offline"),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada"), student("b", "Ben")]);

    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));

    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(1)
    );
    expect(levelOf(result.current.students, "a")).toBe("Splash 6");
    expect(cached("a")).toBe("Splash 4");
    expect(result.current.saveStates["1001"].failures[0]).toEqual({
        target: "a",
        message:
            "Couldn't save Ada's level (Splash 6). Check your connection, then press Retry.",
    });
    expect(result.current.saveStates["1001"].status).toBe("");
});

it("Retry repeats the failed save and clears the failure once it works", async () => {
    vi.mocked(upsertRosterStudentLevelEdit).mockRejectedValueOnce(
        new Error("offline"),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada")]);
    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(1)
    );

    act(() => result.current.retrySave("1001", "a"));

    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(0)
    );
    expect(upsertRosterStudentLevelEdit).toHaveBeenCalledTimes(2);
    expect(cached("a")).toBe("Splash 6");
    expect(result.current.saveStates["1001"].status).toBe("saved");
});

it("writes the cache only after the server confirms, and reports Saving then Saved", async () => {
    let confirm: () => void = () => undefined;
    vi.mocked(upsertRosterStudentLevelEdit).mockReturnValue(
        new Promise<undefined>((resolve) => {
            confirm = () => resolve(undefined);
        }) as ReturnType<typeof upsertRosterStudentLevelEdit>,
    );
    const { result } = setup([student("a", "Ada")]);

    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    expect(result.current.saveStates["1001"].status).toBe("saving");
    expect(cached("a")).toBe("Splash 4");

    await act(async () => confirm());
    await waitFor(() =>
        expect(result.current.saveStates["1001"].status).toBe("saved")
    );
    expect(cached("a")).toBe("Splash 6");
});

it("a failed save does not undo or store another change that saved", async () => {
    vi.mocked(upsertRosterStudentLevelEdit)
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada"), student("b", "Ben")]);

    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(1)
    );
    act(() => result.current.handleStudentLevelChange("b", "Splash 5"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].status).toBe("saved")
    );

    expect(cached("b")).toBe("Splash 5");
    expect(cached("a")).toBe("Splash 4");
    expect(levelOf(result.current.students, "a")).toBe("Splash 6");
    expect(result.current.saveStates["1001"].failures).toHaveLength(1);
});

it("guests save to the browser cache only", () => {
    const { result } = setup([student("a", "Ada")], { signedIn: false });

    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    act(() => result.current.handleClassLevelChange("1001", "Splash 3"));

    expect(upsertRosterStudentLevelEdit).not.toHaveBeenCalled();
    expect(setRosterClassLevel).not.toHaveBeenCalled();
    expect(cached("a")).toBe("Splash 3");
    expect(result.current.saveStates["1001"]).toBeUndefined();
});

it("does nothing for someone who cannot edit rosters", () => {
    const { result } = setup([student("a", "Ada")], { canEdit: false });
    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    act(() => result.current.handleClassLevelChange("1001", "Splash 3"));
    expect(upsertRosterStudentLevelEdit).not.toHaveBeenCalled();
    expect(setRosterClassLevel).not.toHaveBeenCalled();
    expect(levelOf(result.current.students, "a")).toBe("Splash 4");
});

it("a class change moves every swimmer, waitlisted too, and saves one whole class request", async () => {
    const { result } = setup([
        student("a", "Ada", { level: "Splash 6" }),
        student("b", "Ben"),
        student("c", "Cy", { waitlist: true }),
    ]);

    act(() => result.current.handleClassLevelChange("1001", "Splash 3"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].status).toBe("saved")
    );

    expect(setRosterClassLevel).toHaveBeenCalledWith(
        SESSION,
        "1001",
        "Splash 3",
    );
    expect(result.current.students.map((item) => item.level)).toEqual([
        "Splash 3",
        "Splash 3",
        "Splash 3",
    ]);
    expect(
        result.current.students.every((item) => item.class_level === "Splash 3"),
    ).toBe(true);
    expect(getStudentsForDay("Th", SESSION).map((item) => item.class_level))
        .toEqual(["Splash 3", "Splash 3", "Splash 3"]);
});

it("resetting the class to its registered level removes the class edit", async () => {
    const { result } = setup([
        student("a", "Ada", { level: "Splash 3", class_level: "Splash 3" }),
    ]);
    act(() => result.current.handleClassLevelChange("1001", "Splash 4"));
    await waitFor(() =>
        expect(setRosterClassLevel).toHaveBeenCalledWith(SESSION, "1001", "")
    );
    expect(result.current.students[0].level).toBe("Splash 4");
    expect(result.current.students[0]).not.toHaveProperty("class_level");
});

it("a class that arrived mixed keeps a class edit even at its registered level", async () => {
    const { result } = setup([
        student("a", "Ada"),
        student("b", "Ben", { level: "Splash 6", registered_level: "Splash 6" }),
    ]);
    act(() => result.current.handleSetAllToLevel("1001", "Splash 4"));
    await waitFor(() =>
        expect(setRosterClassLevel).toHaveBeenCalledWith(
            SESSION,
            "1001",
            "Splash 4",
        )
    );
    expect(result.current.students.map((item) => item.level)).toEqual([
        "Splash 4",
        "Splash 4",
    ]);
});

it("Set all failing says so and keeps the change on screen", async () => {
    vi.mocked(setRosterClassLevel).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada", { level: "Splash 6" })]);
    act(() => result.current.handleSetAllToLevel("1001", "Splash 4"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures[0]?.message).toBe(
            "Couldn't set all swimmers to Splash 4. Check your connection, then press Retry.",
        )
    );
    expect(levelOf(result.current.students, "a")).toBe("Splash 4");
    expect(cached("a")).toBe("Splash 6");
});

it("resetting a swimmer to the class level deletes their edit", async () => {
    const { result } = setup([student("a", "Ada", { level: "Splash 6" })]);
    act(() => result.current.handleStudentLevelChange("a", "Splash 4"));
    await waitFor(() =>
        expect(deleteRosterStudentLevelEdit).toHaveBeenCalledWith(
            SESSION,
            "1001",
            "Ada",
        )
    );
    expect(upsertRosterStudentLevelEdit).not.toHaveBeenCalled();
});

it("resetting a swimmer whose file level differs, in a class with no class edit, saves an edit equal to the class level", async () => {
    const { result } = setup([
        student("a", "Ada"),
        student("b", "Ben", { level: "Splash 6", registered_level: "Splash 6" }),
    ]);
    act(() => result.current.handleStudentLevelChange("b", "Splash 4"));
    await waitFor(() =>
        expect(upsertRosterStudentLevelEdit).toHaveBeenCalledWith(
            SESSION,
            "user-1",
            "1001",
            "Ben",
            "Splash 4",
        )
    );
    expect(deleteRosterStudentLevelEdit).not.toHaveBeenCalled();
});

it("resetting a swimmer in a class with a class edit deletes their edit", async () => {
    const { result } = setup([
        student("a", "Ada", { level: "Splash 3", class_level: "Splash 3" }),
        student("b", "Ben", {
            level: "Splash 6",
            registered_level: "Splash 6",
            class_level: "Splash 3",
        }),
    ]);
    act(() => result.current.handleStudentLevelChange("b", "Splash 3"));
    await waitFor(() =>
        expect(deleteRosterStudentLevelEdit).toHaveBeenCalledWith(
            SESSION,
            "1001",
            "Ben",
        )
    );
});

// RL-6: saves for one class run in the order they were made.
it("sends two changes to the same swimmer one after the other, in order", async () => {
    let finishFirst: () => void = () => undefined;
    vi.mocked(upsertRosterStudentLevelEdit)
        .mockReturnValueOnce(
            new Promise<undefined>((resolve) => {
                finishFirst = () => resolve(undefined);
            }) as ReturnType<typeof upsertRosterStudentLevelEdit>,
        )
        .mockResolvedValue(undefined);
    const { result } = setup([student("a", "Ada")]);

    act(() => result.current.handleStudentLevelChange("a", "Splash 5"));
    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    await act(async () => {
        await Promise.resolve();
    });
    expect(upsertRosterStudentLevelEdit).toHaveBeenCalledTimes(1);

    await act(async () => finishFirst());
    await waitFor(() =>
        expect(upsertRosterStudentLevelEdit).toHaveBeenCalledTimes(2)
    );
    expect(
        vi.mocked(upsertRosterStudentLevelEdit).mock.calls.map((call) =>
            call[4]
        ),
    ).toEqual(["Splash 5", "Splash 6"]);
    await waitFor(() => expect(cached("a")).toBe("Splash 6"));
});

// RL-6: a failed class save must not later undo a newer swimmer change.
it("sends a failed class save again before a later swimmer change", async () => {
    vi.mocked(setRosterClassLevel).mockRejectedValueOnce(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada"), student("b", "Ben")]);
    act(() => result.current.handleClassLevelChange("1001", "Splash 3"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(1)
    );

    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    await waitFor(() =>
        expect(upsertRosterStudentLevelEdit).toHaveBeenCalledTimes(1)
    );

    expect(setRosterClassLevel).toHaveBeenCalledTimes(2);
    expect(
        vi.mocked(setRosterClassLevel).mock.invocationCallOrder[1],
    ).toBeLessThan(
        vi.mocked(upsertRosterStudentLevelEdit).mock.invocationCallOrder[0],
    );
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(0)
    );
    expect(levelOf(result.current.students, "a")).toBe("Splash 6");
    expect(levelOf(result.current.students, "b")).toBe("Splash 3");
    expect(cached("a")).toBe("Splash 6");
    expect(cached("b")).toBe("Splash 3");
});

it("Retry on a class save also sends the swimmer changes made after it", async () => {
    vi.mocked(setRosterClassLevel).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada"), student("b", "Ben")]);
    act(() => result.current.handleClassLevelChange("1001", "Splash 3"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(1)
    );
    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    await waitFor(() =>
        expect(upsertRosterStudentLevelEdit).toHaveBeenCalledTimes(1)
    );
    vi.mocked(setRosterClassLevel).mockResolvedValue(undefined);
    vi.mocked(upsertRosterStudentLevelEdit).mockClear();

    act(() => result.current.retrySave("1001", "class"));

    await waitFor(() =>
        expect(upsertRosterStudentLevelEdit).toHaveBeenCalledTimes(1)
    );
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(0)
    );
    const classCalls = vi.mocked(setRosterClassLevel).mock.invocationCallOrder;
    expect(classCalls[classCalls.length - 1]).toBeLessThan(
        vi.mocked(upsertRosterStudentLevelEdit).mock.invocationCallOrder[0],
    );
});

// RL-5: after a failed class save the cache is rebuilt from the server.
it("reloads the saved edits into the cache, not the screen, after a failed class save", async () => {
    vi.mocked(setRosterClassLevel).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada")]);

    act(() => result.current.handleClassLevelChange("1001", "Splash 3"));

    await waitFor(() =>
        expect(applySavedLevelEditsToStoredRoster).toHaveBeenCalledWith(
            "Th",
            SESSION,
            expect.any(Function),
            { silent: true },
        )
    );
    expect(levelOf(result.current.students, "a")).toBe("Splash 3");
});

it("does not reload edits after a failed swimmer save", async () => {
    vi.mocked(upsertRosterStudentLevelEdit).mockRejectedValue(
        new Error("offline"),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup([student("a", "Ada")]);
    act(() => result.current.handleStudentLevelChange("a", "Splash 6"));
    await waitFor(() =>
        expect(result.current.saveStates["1001"].failures).toHaveLength(1)
    );
    expect(applySavedLevelEditsToStoredRoster).not.toHaveBeenCalled();
});
