import PrintModalShell from "../PrintModalShell/PrintModalShell.component";
import { Props, actionClass, secondaryClass, usePrintUpdatesModalLogic } from "./PrintUpdatesModal.logic";
function PrintUpdatesModal(props: Props) {
    const viewModel = usePrintUpdatesModalLogic(props);
    const {
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
    } = viewModel;
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

