import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fetchSchematic } from "../../../../lib/serverApi";
import { useRosterData } from "./useRosterData";

vi.mock("../../../../lib/serverApi", () => ({ fetchSchematic: vi.fn() }));
vi.mock("../../../../lib/rosterEditsApi", () => ({
    applyPersistedLevelEdits: vi.fn(),
    fetchRosterLevelEdits: vi.fn(),
    fetchRosterStudentEdits: vi.fn(),
    hashStudentNames: vi.fn(),
}));

beforeEach(() => {
    window.sessionStorage.clear();
    vi.mocked(fetchSchematic).mockReset();
});

it("lists the session's instructors once its schematic loads, with no weekday list cached (R2-W7)", async () => {
    vi.mocked(fetchSchematic).mockResolvedValue({
        schematic: {
            data: {
                instructors: ["Jordan Rivers", "Priya Shah", "", "Jordan Rivers"],
                codes: ["98001", "98002", "98003", "98004"],
            },
        },
    } as Awaited<ReturnType<typeof fetchSchematic>>);

    const { result } = renderHook(() =>
        useRosterData("Th", "session-1", false)
    );

    expect(result.current.instructorOptions).toEqual([]);
    await waitFor(() =>
        expect(result.current.instructorOptions).toEqual([
            "Jordan Rivers",
            "Priya Shah",
        ])
    );
    expect(fetchSchematic).toHaveBeenCalledWith("session-1");
});
