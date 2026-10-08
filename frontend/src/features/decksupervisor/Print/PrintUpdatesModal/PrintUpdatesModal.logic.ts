import { useEffect, useState } from "react";

import { fetchRosterPrintUpdates, resolveRosterPrintUpdates } from "../../../../lib/serverApi";

import { loadUploadedPrintRosters } from "../../../../lib/rosterPrintUpdates";

import type { RosterPrintUpdate, UploadedPrintRoster } from "../../../../lib/rosterPrintUpdates";

import { openAttendancePrintWindow } from "../../../../shared/attendance-print/openAttendancePrintWindow";

import { buildUpdatePrintItems } from "../services/updatePrintRosters";

export type Props = {
    sessionId: string | null;
    sessionTitle: string;
    isGuest: boolean;
    onClose: () => void;
};

export const actionClass = "rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryClass = "rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50";
export function usePrintUpdatesModalLogic({ sessionId, sessionTitle, isGuest, onClose }: Props) {
    const [updates, setUpdates] = useState<RosterPrintUpdate[]>([]);
    const [snapshots, setSnapshots] = useState<Record<string, UploadedPrintRoster>>({});
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(Boolean(sessionId && !isGuest));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [printedRows, setPrintedRows] = useState<RosterPrintUpdate[] | null>(null);
    const controlsDisabled = busy || printedRows !== null;

    useEffect(() => {
        if (!sessionId || isGuest) return;
        let active = true;
        fetchRosterPrintUpdates(sessionId).then(({ updates: rows }) => {
            if (!active) return;
            setUpdates(rows);
            setSelected(rows.map((row) => row.code));
            setSnapshots(loadUploadedPrintRosters(sessionId));
        }).catch((cause) => {
            if (active) setError(cause instanceof Error ? cause.message : "Unable to load print updates.");
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [sessionId, isGuest]);

    const refresh = async () => {
        if (!sessionId) return;
        const { updates: rows } = await fetchRosterPrintUpdates(sessionId);
        setUpdates(rows);
        setSelected((codes) => codes.filter((code) => rows.some((row) => row.code === code)));
        setSnapshots(loadUploadedPrintRosters(sessionId));
    };

    const ready = (row: RosterPrintUpdate) => snapshots[row.code]?.hash === row.roster_hash;
    const selectedUpdates = updates.filter((row) => selected.includes(row.code));

    const resolve = async (rows: RosterPrintUpdate[], printed: boolean) => {
        if (!sessionId) return;
        const { removed } = await resolveRosterPrintUpdates(sessionId, rows);
        setMessage(removed.length < rows.length
            ? "Some classes changed again during this action and remain queued."
            : `${removed.length} ${removed.length === 1 ? "class" : "classes"} ${printed ? "printed" : "dismissed"}.`);
        setUpdates((current) => current.filter((row) => !removed.includes(row.code)
            || !rows.some((resolved) => resolved.code === row.code && resolved.revision === row.revision)));
        setSelected((codes) => codes.filter((code) => !removed.includes(code)));
        try {
            await refresh();
        } catch {
            setError("The selected updates were resolved, but the queue could not be refreshed. Use Refresh to check for newer changes.");
        }
    };

    const dismiss = async (rows: RosterPrintUpdate[]) => {
        if (!sessionId || rows.length === 0 || controlsDisabled) return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await resolve(rows, false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to dismiss updates.");
        } finally {
            setBusy(false);
        }
    };

    const print = async (rows: RosterPrintUpdate[]) => {
        if (!sessionId || rows.length === 0 || controlsDisabled) return;
        setError("");
        setMessage("");
        let rosters;
        try {
            rosters = buildUpdatePrintItems(sessionId, rows, snapshots);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to prepare updates.");
            return;
        }
        // Open synchronously from the click so browsers allow the print popup.
        const printWindow = openAttendancePrintWindow("Print Updates");
        if (!printWindow) {
            setError("The print popup was blocked. Allow popups for this site, then try again. These classes remain queued.");
            return;
        }
        setBusy(true);
        try {
            const { printAttendanceHtml } = await import("../../../../shared/attendance-print/printAttendanceHtml");
            const result = await printAttendanceHtml({ session: sessionTitle, title: "Print Updates", rosters }, printWindow);
            if (result.status === "failed") throw result.error;
            if (result.status !== "printed") throw new Error("Printing did not start. These classes remain queued.");
            setPrintedRows(rows);
        } catch (cause) {
            const detail = cause instanceof Error ? cause.message : "Unable to print updates.";
            setError(detail);
            printWindow.close();
        } finally {
            setBusy(false);
        }
    };

    const markPrinted = async () => {
        if (!printedRows || busy) return;
        setBusy(true);
        setError("");
        try {
            await resolve(printedRows, true);
            setPrintedRows(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to mark classes as printed. They remain queued.");
        } finally {
            setBusy(false);
        }
    };

    return {
        view: "ready" as const,
        onClose,
        busy,
        error,
        message,
        printedRows,
        markPrinted,
        setPrintedRows,
        isGuest,
        sessionId,
        loading,
        updates,
        controlsDisabled,
        setError,
        refresh,
        selectedUpdates,
        setSelected,
        snapshots,
        selected,
        ready,
        print,
        dismiss,
    };

}
