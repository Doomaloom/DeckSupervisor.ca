import { useRequestsLogic } from "../Requests.logic";
type Props = { model: ReturnType<typeof useRequestsLogic> };
export default function RequestsUpload({ model }: Props) {
    const {
        handleAnalyze,
        requestsFile,
        rosterFile,
        isLoading,
        handleRequestsUpload,
        handleRosterUpload,
        status,
        error,
    } = model;
    return (<section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                    Import Files
                </p>
                <h3 className="mt-2 text-lg font-semibold">
                    Two-file workflow
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-secondary/70">
                    The requests file needs first name, last name,
                    instructor requested, and day of week. The
                    roster/export file should be the regular
                    registration CSV with student names, event IDs, and
                    class details.
                </p>
            </div>
            <button
                type="button"
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleAnalyze}
                disabled={!requestsFile || !rosterFile || isLoading}
            >
                {isLoading ? "Loading..." : "Build Summary"}
            </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="relative flex min-h-[8rem] cursor-pointer flex-col justify-between rounded-2xl border-2 border-dashed border-secondary/30 bg-bg p-5 transition hover:-translate-y-0.5 hover:border-primary">
                <div>
                    <p className="text-sm font-semibold text-secondary">
                        Requests CSV
                    </p>
                    <p className="mt-2 text-sm text-secondary/70">
                        Upload the spreadsheet export containing the
                        student request rows.
                    </p>
                </div>
                <p className="mt-4 text-sm font-semibold text-primary">
                    {requestsFile
                        ? requestsFile.file.name
                        : "Choose requests CSV"}
                </p>
                <input
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    type="file"
                    accept=".csv"
                    onChange={(event) => {
                        void handleRequestsUpload(
                            event.target.files?.[0] ?? null,
                        );
                        event.target.value = "";
                    }}
                />
            </label>

            <label className="relative flex min-h-[8rem] cursor-pointer flex-col justify-between rounded-2xl border-2 border-dashed border-secondary/30 bg-bg p-5 transition hover:-translate-y-0.5 hover:border-primary">
                <div>
                    <p className="text-sm font-semibold text-secondary">
                        Roster / Export CSV
                    </p>
                    <p className="mt-2 text-sm text-secondary/70">
                        Upload the registration export that includes
                        student names and class assignments.
                    </p>
                </div>
                <p className="mt-4 text-sm font-semibold text-primary">
                    {rosterFile
                        ? rosterFile.file.name
                        : "Choose roster/export CSV"}
                </p>
                <input
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    type="file"
                    accept=".csv"
                    onChange={(event) => {
                        void handleRosterUpload(
                            event.target.files?.[0] ?? null,
                        );
                        event.target.value = "";
                    }}
                />
            </label>
        </div>

        {status
            ? (
                <p className="mt-4 text-sm font-semibold text-secondary/80">
                    {status}
                </p>
            )
            : null}
        {error
            ? (
                <div className="mt-4 rounded-card border-2 border-danger/40 bg-danger/10 p-4 text-sm font-semibold text-danger">
                    {error}
                </div>
            )
            : null}
    </section>);
}
