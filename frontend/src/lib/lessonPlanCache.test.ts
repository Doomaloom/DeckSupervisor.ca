import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLessonPlan, saveLessonPlan, type LessonPlan } from "./serverApi";
import { setStorageScope } from "./storageScope";

const args = ["session", "class", "2026-10-24"] as const;
const plan: LessonPlan = {
    session_id: args[0], class_id: args[1], week: args[2], updated_at: "now",
    rows: [{ skill: "Swim", activity: "Practice", location: "Lane", duration: 5 }],
};
const response = (value: unknown) => new Response(JSON.stringify(value));
const fetchMock = vi.fn<typeof fetch>();
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}
beforeEach(() => {
    setStorageScope("guest");
    setStorageScope("user-a");
    fetchMock.mockReset().mockImplementation(async () => response({ plan }));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setStorageScope("guest");
});
describe("lesson plan API cache", () => {
    it("shares simultaneous reads and returns independent copies", async () => {
        const [first, second] = await Promise.all([fetchLessonPlan(...args), fetchLessonPlan(...args)]);
        first.plan!.rows[0].activity = "Edited locally";
        expect(second.plan!.rows[0].activity).toBe("Practice");
        expect((await fetchLessonPlan(...args)).plan!.rows[0].activity).toBe("Practice");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    it("expires five minutes after a read completes", async () => {
        vi.useFakeTimers();
        const pending = deferred<Response>();
        fetchMock.mockReturnValueOnce(pending.promise);
        const reading = fetchLessonPlan(...args);
        await vi.advanceTimersByTimeAsync(60_000);
        pending.resolve(response({ plan }));
        await reading;
        await vi.advanceTimersByTimeAsync(299_999);
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it("caches missing plans but retries failed requests", async () => {
        fetchMock.mockResolvedValueOnce(new Response("Unavailable", { status: 500 }));
        await expect(fetchLessonPlan(...args)).rejects.toThrow("Unavailable");
        fetchMock.mockResolvedValueOnce(response({ plan: null }));
        expect(await fetchLessonPlan(...args)).toEqual({ plan: null });
        expect(await fetchLessonPlan(...args)).toEqual({ plan: null });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it("isolates session, class and date keys", async () => {
        await fetchLessonPlan(...args);
        await fetchLessonPlan("other", args[1], args[2]);
        await fetchLessonPlan(args[0], "other", args[2]);
        await fetchLessonPlan(args[0], args[1], "2026-10-25");
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
    it("preserves cache for the same user and clears on account changes and logout", async () => {
        await fetchLessonPlan(...args);
        setStorageScope("user-a");
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        setStorageScope("user-b");
        await fetchLessonPlan(...args);
        setStorageScope("user-a");
        await fetchLessonPlan(...args);
        setStorageScope("guest");
        setStorageScope("user-a");
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
    it("does not cache guest reads", async () => {
        setStorageScope("guest");
        await fetchLessonPlan(...args);
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it("updates from the save response and restarts expiration", async () => {
        vi.useFakeTimers();
        await fetchLessonPlan(...args);
        await vi.advanceTimersByTimeAsync(290_000);
        const saved = { ...plan, curriculum_level: "swimmer-1" };
        fetchMock.mockResolvedValueOnce(response({ plan: saved }));
        const result = await saveLessonPlan(...args, plan.rows, "swimmer-1");
        result.plan.rows[0].activity = "Local edit";
        await vi.advanceTimersByTimeAsync(20_000);
        expect(await fetchLessonPlan(...args)).toEqual({ plan: saved });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][1]?.method).toBe("PUT");
    });
    it("invalidates after a failed save", async () => {
        await fetchLessonPlan(...args);
        fetchMock.mockRejectedValueOnce(new Error("Offline"));
        await expect(saveLessonPlan(...args, plan.rows)).rejects.toThrow("Offline");
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    it("prevents older reads overwriting saves and waits for pending saves", async () => {
        const oldRead = deferred<Response>();
        const saving = deferred<Response>();
        fetchMock.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(saving.promise);
        const reading = fetchLessonPlan(...args);
        await Promise.resolve();
        const writing = saveLessonPlan(...args, plan.rows);
        const duringSave = fetchLessonPlan(...args);
        const saved = { ...plan, curriculum_level: "saved" };
        saving.resolve(response({ plan: saved }));
        await writing;
        expect(await duringSave).toEqual({ plan: saved });
        oldRead.resolve(response({ plan }));
        await reading;
        expect(await fetchLessonPlan(...args)).toEqual({ plan: saved });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    it.each(["read", "save"])("ignores an old %s completing after logout", async (operation) => {
        const pending = deferred<Response>();
        fetchMock.mockReturnValueOnce(pending.promise);
        const running = operation === "read" ? fetchLessonPlan(...args) : saveLessonPlan(...args, plan.rows);
        await Promise.resolve();
        setStorageScope("guest");
        setStorageScope("user-a");
        pending.resolve(response({ plan }));
        await running;
        await fetchLessonPlan(...args);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
