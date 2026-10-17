import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { registerStaleDeploymentRecovery } from "./recoverStaleDeployment";

let events: EventTarget;
let reload: ReturnType<typeof vi.fn>;
let storage: Storage;

beforeEach(() => {
    events = new EventTarget();
    reload = vi.fn();
    storage = window.sessionStorage;
    storage.clear();
    vi.stubGlobal("window", {
        addEventListener: events.addEventListener.bind(events),
        sessionStorage: storage,
        location: { reload },
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function preloadError() {
    const event = new Event("vite:preloadError", { cancelable: true });
    events.dispatchEvent(event);
    return event;
}

it("reloads the current app when a lazy chunk fails to load", () => {
    registerStaleDeploymentRecovery();

    expect(preloadError().defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
});

it("preserves the normal error path if this bundle fails again after reload", () => {
    registerStaleDeploymentRecovery();
    preloadError();

    // Simulate a fresh page using the same bundle and tab storage.
    events = new EventTarget();
    window.addEventListener = events.addEventListener.bind(events);
    registerStaleDeploymentRecovery();

    expect(preloadError().defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
});

it("preserves the normal error path when session storage is unavailable", () => {
    Object.defineProperty(window, "sessionStorage", {
        value: {
            getItem: () => null,
            setItem: () => { throw new Error("Storage disabled"); },
        },
        configurable: true,
    });
    registerStaleDeploymentRecovery();

    expect(preloadError().defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
});
