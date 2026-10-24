import type { LessonPlan } from "./serverApi";
import { getStorageScope, onStorageScopeChanged } from "./storageScope";

type PlanResponse = { plan: LessonPlan | null };
type Entry = {
    value?: PlanResponse;
    expiresAt: number;
    pending?: Promise<PlanResponse>;
};

const lifetime = 5 * 60 * 1000;
const entries = new Map<string, Entry>();
let scope = getStorageScope();

onStorageScopeChanged((nextScope) => {
    if (nextScope !== scope) {
        entries.clear();
        scope = nextScope;
    }
});

function keyFor(session: string, classId: string, week: string) {
    return JSON.stringify([scope, session, classId, week]);
}

export async function readLessonPlan(
    session: string,
    classId: string,
    week: string,
    load: () => Promise<PlanResponse>,
): Promise<PlanResponse> {
    if (scope === "guest") return load();
    const key = keyFor(session, classId, week);
    // Reclaim expired entries even when the user keeps opening different plans.
    for (const [entryKey, entry] of entries) {
        if (!entry.pending && entry.expiresAt <= Date.now()) entries.delete(entryKey);
    }
    const cached = entries.get(key);
    if (cached?.value) return structuredClone(cached.value);
    if (cached?.pending) return structuredClone(await cached.pending);

    const entry: Entry = { expiresAt: 0 };
    entries.set(key, entry);
    const pending = Promise.resolve().then(load).then((value) => {
        if (entries.get(key) === entry) {
            entry.value = structuredClone(value);
            entry.expiresAt = Date.now() + lifetime;
        }
        return value;
    }).finally(() => {
        entry.pending = undefined;
        if (!entry.value && entries.get(key) === entry) entries.delete(key);
    });
    entry.pending = pending;
    return structuredClone(await pending);
}

export async function writeLessonPlan(
    session: string,
    classId: string,
    week: string,
    save: () => Promise<{ plan: LessonPlan }>,
) {
    if (scope === "guest") return save();
    const key = keyFor(session, classId, week);
    const entry: Entry = { expiresAt: 0 };
    // Replacing the entry prevents earlier reads from caching stale data.
    // Readers arriving during a save wait for its server-confirmed result.
    entries.set(key, entry);
    const pending = Promise.resolve().then(save).then((result) => {
        if (entries.get(key) === entry) {
            entry.value = structuredClone(result);
            entry.expiresAt = Date.now() + lifetime;
        }
        return result;
    }).finally(() => {
        entry.pending = undefined;
        if (!entry.value && entries.get(key) === entry) entries.delete(key);
    });
    entry.pending = pending;
    return await pending;
}
