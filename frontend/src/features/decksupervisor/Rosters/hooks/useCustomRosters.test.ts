import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { showAppNotice } from "../../../../lib/appNotice";
import { saveCustomRoster } from "../../../../lib/customRostersApi";
import type { CustomRoster } from "../../../../types/app";
import { useCustomRosters } from "./useCustomRosters";

vi.mock("../../../../app/AuthContext", () => ({
    useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("../../../../lib/appNotice", () => ({ showAppNotice: vi.fn() }));
vi.mock("../../../../lib/customRostersApi", () => ({
    deleteCustomRoster: vi.fn(),
    resolveCustomRosters: vi.fn().mockResolvedValue([]),
    saveCustomRoster: vi.fn(),
}));

const roster: CustomRoster = {
    id: "custom-1",
    serviceName: "Splash 1",
    instructor: "Jordan Rivers",
    sourceCodes: ["98001"],
    studentIds: ["s1"],
} as CustomRoster;

beforeEach(() => {
    vi.mocked(showAppNotice).mockReset();
    vi.mocked(saveCustomRoster).mockReset();
});

it("tells the user when a custom roster could not be saved (R2-W81)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(saveCustomRoster).mockRejectedValue(new Error("Failed to fetch"));
    const { result } = renderHook(() => useCustomRosters("Th", [], "session-1"));
    await act(async () => {
        await result.current.saveCustomRosters([roster]);
    });
    expect(showAppNotice).toHaveBeenCalledWith(
        expect.stringContaining("not saved"),
        "error",
    );
});

it("shows no error when the save works", async () => {
    vi.mocked(saveCustomRoster).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useCustomRosters("Th", [], "session-1"));
    await act(async () => {
        await result.current.saveCustomRosters([roster]);
    });
    expect(showAppNotice).not.toHaveBeenCalled();
});
