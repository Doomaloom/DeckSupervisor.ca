import RequestsAssignments from "./RequestsAssignments/RequestsAssignments.component";
import RequestsDaySummary from "./RequestsDaySummary/RequestsDaySummary.component";
import RequestsUnmatched from "./RequestsUnmatched/RequestsUnmatched.component";
import RequestsUpload from "./RequestsUpload/RequestsUpload.component";

import { tabButtonClass, useRequestsLogic } from "./Requests.logic";
import { formatDayLabel } from "./utils/assignmentKeys";
function RequestsPage() {
    const viewModel = useRequestsLogic();
    const {
        activeTab,
        setActiveTab,
        analysis,
        autoAssignmentCandidates,
        handleAutoAssignMissing,
        assignmentSaving,
        availableDays,
    } = viewModel;
    return (
        <div
            id="requests-page"
            data-component="requests-page"
            className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        >
            <div className="relative overflow-hidden rounded-card border-2 border-secondary/20 bg-accent p-8 text-secondary shadow-md">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-secondary/15" />
                <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-secondary/10" />
                <div className="relative">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary/70">
                        Requests
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold">
                        Instructor Request Summary
                    </h2>
                    <p className="mt-2 max-w-3xl text-secondary/80">
                        Upload the requests CSV and the registered-class roster
                        export, then save event ID to instructor assignments
                        that can autofill future part-time roster imports.
                    </p>
                </div>
            </div>

            <section className="sticky top-4 z-10 rounded-card border-2 border-secondary/20 bg-accent p-4 text-secondary shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                            Page View
                        </p>
                        <p className="mt-1 text-sm text-secondary/80">
                            Switch between the request summary and saved
                            instructor assignments.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={tabButtonClass(activeTab === "summary")}
                            onClick={() => setActiveTab("summary")}
                        >
                            Summary
                        </button>
                        <button
                            type="button"
                            className={tabButtonClass(
                                activeTab === "assignments",
                            )}
                            onClick={() => setActiveTab("assignments")}
                        >
                            Assignments
                        </button>
                    </div>
                </div>
            </section>

            <RequestsUpload model={viewModel} />

            {activeTab === "summary"
                ? (
                    analysis
                        ? (
                            <>
                                <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                                Assignment Automation
                                            </p>
                                            <h3 className="mt-2 text-lg font-semibold">
                                                Auto-save missing assignments
                                            </h3>
                                            <p className="mt-2 text-sm text-secondary/70">
                                                Save every matched class to the
                                                assignments table using its top
                                                requested instructor, while
                                                skipping rows that already
                                                exist.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm font-semibold text-secondary/70">
                                                {autoAssignmentCandidates
                                                    .length}{" "}
                                                missing
                                                assignment{autoAssignmentCandidates
                                                    .length === 1
                                                    ? ""
                                                    : "s"}
                                            </p>
                                            <button
                                                type="button"
                                                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                                                onClick={() =>
                                                    void handleAutoAssignMissing()}
                                                disabled={assignmentSaving ||
                                                    autoAssignmentCandidates
                                                        .length === 0}
                                            >
                                                {assignmentSaving
                                                    ? "Saving..."
                                                    : "Auto Assign Missing"}
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Rows
                                        </p>
                                        <p className="mt-3 text-3xl font-semibold">
                                            {analysis.totalRequests}
                                        </p>
                                        <p className="mt-2 text-sm text-secondary/70">
                                            Request rows loaded from the
                                            requests CSV.
                                        </p>
                                    </div>
                                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Day Entries
                                        </p>
                                        <p className="mt-3 text-3xl font-semibold">
                                            {analysis.totalDayEntries}
                                        </p>
                                        <p className="mt-2 text-sm text-secondary/70">
                                            Expanded request entries after
                                            splitting multi-day values.
                                        </p>
                                    </div>
                                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Matched
                                        </p>
                                        <p className="mt-3 text-3xl font-semibold">
                                            {analysis.matchedDayEntries}
                                        </p>
                                        <p className="mt-2 text-sm text-secondary/70">
                                            Request/day entries that mapped to
                                            at least one class.
                                        </p>
                                    </div>
                                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Unmatched
                                        </p>
                                        <p className="mt-3 text-3xl font-semibold">
                                            {analysis.unmatched.length}
                                        </p>
                                        <p className="mt-2 text-sm text-secondary/70">
                                            Rows needing cleanup or manual
                                            review.
                                        </p>
                                    </div>
                                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-5 text-secondary shadow-md">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Days
                                        </p>
                                        <p className="mt-3 text-3xl font-semibold">
                                            {analysis.days.length}
                                        </p>
                                        <p className="mt-2 text-sm text-secondary/70">
                                            {availableDays.length > 0
                                                ? availableDays.map(
                                                    formatDayLabel,
                                                ).join(", ")
                                                : "No matched days"}
                                        </p>
                                    </div>
                                </section>

                                <RequestsDaySummary model={{ ...viewModel, analysis }} />

                                <RequestsUnmatched model={{ ...viewModel, analysis }} />
                            </>
                        )
                        : (
                            <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                                Upload both CSV files, then build the summary to
                                review request counts by class.
                            </div>
                        )
                )
                : (
                    <RequestsAssignments model={viewModel} />
                )}
        </div>
    );
}

export default RequestsPage;

