import { beforeEach, expect, it, vi } from "vitest";
import { loadUploadedPrintRosters, trackUploadedRosters, trackMatchedSessionRosters } from "./rosterPrintUpdates";
import type { ClassRoster, CsvSessionCandidate } from "../types/app";

const sync = vi.hoisted(() => vi.fn());
vi.mock("./serverApi", () => ({ syncRosterClassHashes: sync }));
const roster: ClassRoster = { code: "A", day: "Mo", serviceName: "Splash 1", time: "09:00", location: "Pool", schedule: "Fall", instructor: "Alex", students: [{ name: "Alice", phone: "", level: "Splash 1", instructor: "Alex" }] };
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks(); });

it("stores matching local snapshots and empty sheets for removed classes without mixing sessions", async () => {
    sync.mockResolvedValue({ classes: [
        { code: "A", roster_hash: "new", class_details: { ...roster, students: undefined } },
        { code: "B", roster_hash: "empty", class_details: { ...roster, code: "B", students: undefined } },
    ] });
    await trackUploadedRosters("session-a", [roster]);
    expect(loadUploadedPrintRosters("session-a").A.roster.students).toEqual(roster.students);
    expect(loadUploadedPrintRosters("session-a").B.roster.students).toEqual([]);
    expect(loadUploadedPrintRosters("session-b")).toEqual({});
    sync.mockRejectedValue(new Error("Sync failed"));
    await expect(trackUploadedRosters("session-a", [])).rejects.toThrow("Sync failed");
    expect(loadUploadedPrintRosters("session-a").A.hash).toBe("new");
});

it("does not silently treat a missing matched-session roster as an empty upload", async () => {
    const candidate = { sessionKey: "candidate", matchedSession: { session: { id: "session-a" } } } as CsvSessionCandidate;
    await expect(trackMatchedSessionRosters([candidate], {})).rejects.toThrow(/No roster data/);
    expect(sync).not.toHaveBeenCalled();
});

it("compares a saved session once even when the CSV matches several candidate blocks", async () => {
    const candidate = { sessionKey: "candidate-a", matchedSession: { session: { id: "session-a" } } } as CsvSessionCandidate;
    const other = { ...roster, code: "B" };
    sync.mockResolvedValue({ classes: [] });
    await trackMatchedSessionRosters([candidate, { ...candidate, sessionKey: "candidate-b" }], {
        "candidate-a": [roster], "candidate-b": [other],
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith("session-a", [roster, other]);
});
