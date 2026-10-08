import { useEffect, useState } from "react";
import { fetchRosterPrintUpdates, resolveRosterPrintUpdates } from "../../../lib/serverApi";
import { loadUploadedPrintRosters } from "../../../lib/rosterPrintUpdates";
import type { RosterPrintUpdate, UploadedPrintRoster } from "../../../lib/rosterPrintUpdates";
import { openAttendancePrintWindow } from "../../attendance-print/openAttendancePrintWindow";
import { buildUpdatePrintItems } from "../utils/updatePrintRosters";
import PrintModalShell from "./PrintModalShell";

type Props = {
    sessionId: string | null;
    sessionTitle: string;
    isGuest: boolean;
    onClose: () => void;
};

const actionClass = "rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-accent transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50";

function PrintUpdatesModal({ sessionId, sessionTitle, isGuest, onClose }: Props) {
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
            const { printAttendanceHtml } = await import("../../attendance-print/printAttendanceHtml");
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

    return (
        <PrintModalShell
            title="Print Updates"
            description="Classes whose students changed since the previous roster upload. Print their updated instructor sheets or dismiss them."
            onClose={() => { if (!busy) onClose(); }}
            panelClassName="max-h-[90vh] overflow-y-auto"
        >
            {error && <p role="alert" className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {message && <p role="status" className="mt-4 text-sm text-secondary">{message}</p>}
            {printedRows && <div className="mt-4 rounded-2xl border border-secondary/30 bg-bg p-4">
                <p className="text-sm font-semibold">Did the {printedRows.length === 1 ? "selected class sheet" : "selected class sheets"} print?</p>
                <p className="mt-1 text-sm text-secondary/70">Mark them as printed to clear these updates. If you cancelled printing, keep them queued.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={actionClass} disabled={busy} onClick={() => void markPrinted()}>Mark printed</button>
                    <button type="button" className={secondaryClass} disabled={busy} onClick={() => setPrintedRows(null)}>Keep queued</button>
                </div>
            </div>}
            {isGuest
                ? <p className="mt-6">Sign in to track roster changes and print updates for a saved session.</p>
                : !sessionId
                ? <p className="mt-6">Select a session to view its print updates.</p>
                : loading
                ? <p role="status" className="mt-6">Loading updates...</p>
                : <>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{updates.length} {updates.length === 1 ? "class" : "classes"} to print</p>
                        <button type="button" className={secondaryClass} disabled={controlsDisabled} onClick={() => { setError(""); void refresh().catch((cause) => setError(String(cause))); }}>Refresh</button>
                    </div>
                    {updates.length === 0
                        ? !error && <p className="mt-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-sm">No classes are waiting to be printed. The first roster upload establishes the baseline; later student changes appear here.</p>
                        : <div className="mt-4 space-y-3">
                            <label className="flex items-center gap-3 text-sm font-semibold">
                                <input type="checkbox" checked={selectedUpdates.length === updates.length} disabled={controlsDisabled} onChange={(event) => setSelected(event.target.checked ? updates.map((row) => row.code) : [])} />
                                Select all
                            </label>
                            {updates.map((row) => {
                                const roster = snapshots[row.code]?.roster;
                                return <div key={row.code} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-secondary/20 bg-bg p-4">
                                    <label className="flex min-w-0 items-start gap-3">
                                        <input type="checkbox" aria-label={`Select class ${row.code}`} checked={selected.includes(row.code)} disabled={controlsDisabled} onChange={(event) => setSelected((codes) => event.target.checked ? [...codes, row.code] : codes.filter((code) => code !== row.code))} className="mt-1" />
                                        <span>
                                            <span className="block font-semibold">{row.code}{roster ? ` · ${roster.serviceName}` : ""}</span>
                                            {roster && <span className="block text-sm text-secondary/70">{[roster.day, roster.time, roster.location].filter(Boolean).join(" · ")}</span>}
                                            {!ready(row) && <span className="block text-sm text-secondary/70">Upload the latest roster on this device to print this class.</span>}
                                        </span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button type="button" aria-label={`Print class ${row.code}`} className={actionClass} disabled={controlsDisabled || !ready(row)} onClick={() => void print([row])}>Print</button>
                                        <button type="button" aria-label={`Dismiss class ${row.code}`} className={secondaryClass} disabled={controlsDisabled} onClick={() => void dismiss([row])}>Dismiss</button>
                                    </div>
                                </div>;
                            })}
                            <div className="flex flex-wrap justify-end gap-3 border-t border-secondary/20 pt-4">
                                <button type="button" className={secondaryClass} disabled={controlsDisabled || selectedUpdates.length === 0} onClick={() => void dismiss(selectedUpdates)}>Dismiss selected</button>
                                <button type="button" className={actionClass} disabled={controlsDisabled || selectedUpdates.length === 0 || !selectedUpdates.every(ready)} onClick={() => void print(selectedUpdates)}>{busy ? "Processing..." : "Print selected"}</button>
                            </div>
                        </div>}
                </>}
        </PrintModalShell>
    );
}

export default PrintUpdatesModal;
