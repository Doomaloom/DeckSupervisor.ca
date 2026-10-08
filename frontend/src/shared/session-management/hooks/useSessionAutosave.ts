import { useEffect, useRef, useState } from "react";

// One outstanding save per editor; newer drafts remain dirty until their own save succeeds.
export function useSessionAutosave({ sessionId, enabled, snapshot, save }: {
    sessionId: string;
    enabled: boolean;
    snapshot: string;
    save: () => Promise<boolean>;
}) {
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const [revision, setRevision] = useState(0);
    const latest = useRef({ sessionId, enabled, snapshot, save });
    latest.current = { sessionId, enabled, snapshot, save };
    const scope = useRef("");
    const generation = useRef({ sessionId, value: 0 });
    if (generation.current.sessionId !== sessionId) {
        generation.current = { sessionId, value: generation.current.value + 1 };
    }
    const pending = useRef(false);
    const flushQueued = useRef(false);
    const failedSnapshot = useRef("");
    const mounted = useRef(false);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (scope.current === sessionId) return;
        scope.current = sessionId;
        setSavedSnapshot(null);
        setFailed(false);
        flushQueued.current = false;
    }, [sessionId]);
    useEffect(() => {
        if (enabled && savedSnapshot === null) setSavedSnapshot(snapshot);
    }, [enabled, savedSnapshot, snapshot]);
    useEffect(() => {
        if (failed && snapshot !== failedSnapshot.current) setFailed(false);
    }, [failed, snapshot]);
    const dirty = enabled && savedSnapshot !== null &&
        snapshot !== savedSnapshot;

    async function flush() {
        if (!latest.current.enabled) return;
        if (pending.current) {
            flushQueued.current = true;
            return;
        }
        const request = latest.current;
        const requestGeneration = generation.current.value;
        pending.current = true;
        setSaving(true);
        setFailed(false);
        let success = false;
        try {
            success = await request.save();
        } catch {
            success = false;
        }
        pending.current = false;
        if (!mounted.current) return;
        setSaving(false);
        if (generation.current.value === requestGeneration) {
            if (success) setSavedSnapshot(request.snapshot);
            failedSnapshot.current = success ? "" : request.snapshot;
            setFailed(!success);
        }
        if (flushQueued.current) {
            flushQueued.current = false;
            void flush();
        } else {
            // Wake a draft that changed while the previous request was pending.
            setRevision((value) => value + 1);
        }
    }
    const flushRef = useRef(flush);
    flushRef.current = flush;
    useEffect(() => {
        if (!dirty || saving || failed) return;
        const timer = window.setTimeout(() => {
            void flushRef.current();
        }, 800);
        return () => window.clearTimeout(timer);
    }, [dirty, snapshot, saving, failed, revision]);
    useEffect(() => {
        if (!dirty && !saving) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty, saving]);
    // The app uses BrowserRouter; protect its link navigations without a data-router blocker.
    useEffect(() => {
        if (!dirty && !saving) return;
        const warn = (event: MouseEvent) => {
            if (
                event.button !== 0 || event.metaKey || event.ctrlKey ||
                event.shiftKey || event.altKey
            ) return;
            const target = event.target instanceof Element
                ? event.target.closest("a[href]")
                : null;
            if (
                !target || target.getAttribute("target") === "_blank" ||
                target.getAttribute("href")?.startsWith("#")
            ) return;
            if (
                !window.confirm(
                    "There are unsaved session changes. Leave this page?",
                )
            ) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        document.addEventListener("click", warn, true);
        return () => document.removeEventListener("click", warn, true);
    }, [dirty, saving]);
    useEffect(() => {
        if (!dirty && !saving) return;
        const currentIndex = window.history.state?.idx;
        let restoring = false;
        const warn = (event: PopStateEvent) => {
            if (restoring) {
                restoring = false;
                event.stopImmediatePropagation();
                return;
            }
            if (
                window.confirm(
                    "There are unsaved session changes. Leave this page?",
                )
            ) return;
            const nextIndex = event.state?.idx;
            if (
                typeof currentIndex === "number" &&
                typeof nextIndex === "number" &&
                currentIndex !== nextIndex
            ) {
                event.stopImmediatePropagation();
                restoring = true;
                window.history.go(currentIndex - nextIndex);
            }
        };
        window.addEventListener("popstate", warn, true);
        return () => window.removeEventListener("popstate", warn, true);
    }, [dirty, saving]);
    return {
        flush,
        dirty,
        saving,
        status: saving
            ? "Saving..."
            : failed
                ? "Changes could not be saved. Use Save Changes to retry."
                : dirty
                    ? "Unsaved changes"
                    : enabled
                        ? "Saved"
                        : "Loading...",
    };
}
