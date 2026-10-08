import { getScopedKey } from "../../../../lib/storageScope";
import { type ExportRegistry, readRegistry } from "./exportPackage";

function persistentStorage() {
    const storage = window.localStorage;
    if (!storage) {
        throw new Error(
            "This browser cannot save export IDs. Enable local storage before exporting.",
        );
    }
    return storage;
}
const key = (sessionId: string) =>
    getScopedKey(`rec-tablet-export:${sessionId}`);
export function loadRegistry(sessionId: string): ExportRegistry | null {
    const text = persistentStorage().getItem(key(sessionId));
    return text ? readRegistry(text, sessionId) : null;
}
export function saveRegistry(registry: ExportRegistry) {
    readRegistry(JSON.stringify(registry), registry.sessionId);
    const existing = loadRegistry(registry.sessionId);
    if (existing && existing.datasetId !== registry.datasetId) {
        throw new Error(
            "This browser already has different export IDs for the session. Use its existing ID backup.",
        );
    }
    for (
        const [fingerprint, person] of Object.entries(existing?.people ?? {})
    ) {
        const next = registry.people[fingerprint];
        if (!next || JSON.stringify(next) !== JSON.stringify(person)) {
            throw new Error(
                "Export IDs changed in another tab. Reload the page before exporting.",
            );
        }
    }
    // Persist before downloading. A storage failure must never produce an export
    // whose identities will be forgotten when the page closes.
    persistentStorage().setItem(
        key(registry.sessionId),
        JSON.stringify(registry),
    );
}
export function restoreRegistry(text: string, sessionId: string) {
    const incoming = readRegistry(text, sessionId);
    const existing = loadRegistry(sessionId);
    if (existing && existing.datasetId !== incoming.datasetId) {
        throw new Error(
            "This session already has different export IDs. Restore this backup in the original browser profile or a fresh profile before making exports.",
        );
    }
    for (
        const [fingerprint, person] of Object.entries(existing?.people ?? {})
    ) {
        if (
            incoming.people[fingerprint] &&
            JSON.stringify(incoming.people[fingerprint]) !==
            JSON.stringify(person)
        ) throw new Error("The backup conflicts with existing swimmer IDs.");
    }
    saveRegistry({
        ...incoming,
        people: { ...existing?.people, ...incoming.people },
    });
}
export function downloadJSON(value: unknown, filename: string) {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2) + "\n"], {
            type: "application/json",
        }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    try {
        anchor.click();
    } finally {
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
export function exportFilename(instructor: string, sessionId: string) {
    const safe = (text: string) =>
        text.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 70);
    return `rec-tablet-${safe(instructor)}-${safe(sessionId)}.json`;
}
