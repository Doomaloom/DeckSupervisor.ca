import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureCachedSchematicPdf } from "./printPdfCache";

// Minimal hand-rolled IndexedDB: the project has no fake-indexeddb. Each open()
// reports the configured oldVersion on the upgradeneeded event (as browsers do);
// the request object itself carries no oldVersion.
type FakeState = {
    oldVersion: number;
    hasStore: boolean;
    clear: ReturnType<typeof vi.fn>;
    createObjectStore: ReturnType<typeof vi.fn>;
    entries: Map<string, unknown>;
};

function request<T>(result: T) {
    const req: { result?: T; onsuccess?: () => void; onerror?: () => void } = {};
    queueMicrotask(() => {
        req.result = result;
        req.onsuccess?.();
    });
    return req;
}

function installFakeIndexedDb(state: FakeState) {
    const store = {
        clear: state.clear,
        get: (key: string) => request(state.entries.get(key)),
        put: (entry: { key: string }) => {
            state.entries.set(entry.key, entry);
            return request(entry.key);
        },
    };
    const transaction = () => {
        const tx: { oncomplete?: () => void; objectStore: () => typeof store } = {
            objectStore: () => store,
        };
        queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
        return tx;
    };
    const db = {
        objectStoreNames: { contains: () => state.hasStore },
        createObjectStore: state.createObjectStore,
        transaction,
        close: () => {},
    };
    const indexedDB = {
        open: (_name: string, version: number) => {
            const req: Record<string, any> = {};
            queueMicrotask(() => {
                req.result = db;
                if (state.oldVersion < version) {
                    req.transaction = { objectStore: () => store };
                    req.onupgradeneeded?.({ oldVersion: state.oldVersion, newVersion: version });
                    req.transaction = null;
                    state.oldVersion = version;
                    state.hasStore = true;
                }
                req.onsuccess?.();
            });
            return req;
        },
    };
    vi.stubGlobal("indexedDB", indexedDB);
    Object.defineProperty(window, "indexedDB", { value: indexedDB, configurable: true });
}

let state: FakeState;
let counter = 0;
const pdf = () => Promise.resolve(new Blob(["pdf"]));

beforeEach(() => {
    state = {
        oldVersion: 0,
        hasStore: false,
        clear: vi.fn(() => request(undefined)),
        createObjectStore: vi.fn(),
        entries: new Map(),
    };
    installFakeIndexedDb(state);
    vi.stubGlobal("IDBKeyRange", { bound: () => ({}) });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("print PDF cache upgrade", () => {
    it("creates the store on a first-time open without clearing it", async () => {
        await ensureCachedSchematicPdf("session", `day-${counter++}`, "request", pdf);
        expect(state.createObjectStore).toHaveBeenCalledWith("printPdfs", { keyPath: "key" });
        expect(state.clear).not.toHaveBeenCalled();
        expect(state.entries.size).toBe(1);
    });

    it.each([1, 2])("clears entries left by cache version %i", async (oldVersion) => {
        state.oldVersion = oldVersion;
        state.hasStore = true;
        await ensureCachedSchematicPdf("session", `day-${counter++}`, "request", pdf);
        expect(state.createObjectStore).not.toHaveBeenCalled();
        expect(state.clear).toHaveBeenCalledTimes(1);
    });

    it("does not clear an already current cache", async () => {
        state.oldVersion = 3;
        state.hasStore = true;
        await ensureCachedSchematicPdf("session", `day-${counter++}`, "request", pdf);
        expect(state.clear).not.toHaveBeenCalled();
    });
});
