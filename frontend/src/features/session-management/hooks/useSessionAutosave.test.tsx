import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useSessionAutosave } from "./useSessionAutosave";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});
async function advance(ms = 800) {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}
it("waits for hydration, debounces edits, and saves immediately on explicit flush", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
        (props) => useSessionAutosave({ ...props, save }),
        { initialProps: { sessionId: "a", enabled: false, snapshot: "empty" } },
    );
    rerender({ sessionId: "a", enabled: true, snapshot: "loaded" });
    await advance();
    expect(save).not.toHaveBeenCalled();
    rerender({ sessionId: "a", enabled: true, snapshot: "edit1" });
    await advance(400);
    rerender({ sessionId: "a", enabled: true, snapshot: "edit2" });
    await advance(799);
    expect(save).not.toHaveBeenCalled();
    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("Saved");
    rerender({ sessionId: "a", enabled: true, snapshot: "edit3" });
    await act(async () => {
        await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(2);
});
it("serializes requests and keeps newer edits dirty until saved", async () => {
    let resolve!: (ok: boolean) => void;
    const firstSave = vi.fn(() =>
        new Promise<boolean>((done) => {
            resolve = done;
        })
    );
    const secondSave = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
        (props) => useSessionAutosave(props),
        {
            initialProps: {
                sessionId: "a",
                enabled: true,
                snapshot: "loaded",
                save: firstSave,
            },
        },
    );
    rerender({
        sessionId: "a",
        enabled: true,
        snapshot: "first",
        save: firstSave,
    });
    await advance();
    rerender({
        sessionId: "a",
        enabled: true,
        snapshot: "second",
        save: secondSave,
    });
    await advance();
    expect(secondSave).not.toHaveBeenCalled();
    await act(async () => {
        resolve(true);
    });
    expect(result.current.dirty).toBe(true);
    await advance();
    expect(secondSave).toHaveBeenCalledTimes(1);
    expect(result.current.dirty).toBe(false);
});
it("retains failed edits, pauses automatic retries, and supports explicit retry", async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { result, rerender } = renderHook(
        (props) => useSessionAutosave({ ...props, save }),
        { initialProps: { sessionId: "a", enabled: true, snapshot: "loaded" } },
    );
    rerender({ sessionId: "a", enabled: true, snapshot: "edited" });
    await advance();
    expect(result.current.dirty).toBe(true);
    expect(result.current.status).toContain("retry");
    await advance(5000);
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
        await result.current.flush();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("Saved");
});
it("does not mark a new session dirty or saved from an old outstanding request", async () => {
    let resolve!: (ok: boolean) => void;
    const saveA = vi.fn(() =>
        new Promise<boolean>((done) => {
            resolve = done;
        })
    );
    const saveB = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(
        (props) => useSessionAutosave(props),
        {
            initialProps: {
                sessionId: "a",
                enabled: true,
                snapshot: "a-loaded",
                save: saveA,
            },
        },
    );
    rerender({
        sessionId: "a",
        enabled: true,
        snapshot: "a-edit",
        save: saveA,
    });
    await advance();
    rerender({
        sessionId: "b",
        enabled: false,
        snapshot: "b-loading",
        save: saveB,
    });
    rerender({
        sessionId: "b",
        enabled: true,
        snapshot: "b-loaded",
        save: saveB,
    });
    await act(async () => {
        resolve(true);
    });
    await advance();
    expect(saveB).not.toHaveBeenCalled();
    expect(result.current.status).toBe("Saved");
});

it("warns before link navigation and canceled Back navigation while edits are unsaved", () => {
    const save = vi.fn().mockResolvedValue(true);
    const oldState = window.history.state;
    window.history.replaceState({ idx: 2 }, "");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    const { rerender, unmount } = renderHook(
        (props) => useSessionAutosave({ ...props, save }),
        { initialProps: { sessionId: "a", enabled: true, snapshot: "loaded" } },
    );
    rerender({ sessionId: "a", enabled: true, snapshot: "edited" });
    const link = document.createElement("a");
    link.href = "/schematic";
    document.body.append(link);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 1 } }));
    expect(go).toHaveBeenCalledWith(1);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 2 } }));
    expect(confirm).toHaveBeenCalledTimes(2);
    link.remove();
    unmount();
    window.history.replaceState(oldState, "");
});
it("ignores an earlier save after switching away and back to the same session", async () => {
    let resolve!: (ok: boolean) => void;
    const save = vi.fn(() =>
        new Promise<boolean>((done) => {
            resolve = done;
        })
    );
    const { result, rerender } = renderHook(
        (props) => useSessionAutosave({ ...props, save }),
        { initialProps: { sessionId: "a", enabled: true, snapshot: "loaded" } },
    );
    rerender({ sessionId: "a", enabled: true, snapshot: "old-draft" });
    await advance();
    rerender({ sessionId: "b", enabled: true, snapshot: "b-loaded" });
    rerender({ sessionId: "a", enabled: true, snapshot: "newly-loaded-a" });
    await act(async () => {
        resolve(true);
    });
    await advance();
    expect(result.current.dirty).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
});
