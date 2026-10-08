import { PageShell } from "../../../general-components";

import { useReportCardsLogic } from "./ReportCards.logic";
function ReportCardsPage() {
    const viewModel = useReportCardsLogic();
    const {
        accountType,
        currentTeamId,
        currentTerm,
        employeeTotalsLoading,
        employeeTotals,
        currentTeam,
        totalEmployeeReportCards,
        selectedDay,
        students,
        syncWarning,
        totalStudents,
        lessonBlockTotals,
        instructorSummaries,
    } = viewModel;
    return (
        <PageShell
            id="report-cards-page"
            data-component="report-cards-page"
            className="min-w-0"
        >
            <header>
                <h2 className="text-2xl font-semibold text-secondary">
                    Report Cards
                </h2>
            </header>

            {accountType === "full_time"
                ? (
                    !currentTeamId
                        ? (
                            <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                                Select a team on the home page to view employee
                                report card totals.
                            </div>
                        )
                        : !currentTerm
                            ? (
                                <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                                    Select a session term on the home page to view
                                    employee report card totals.
                                </div>
                            )
                            : employeeTotalsLoading
                                ? (
                                    <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                                        Loading employee report card totals...
                                    </div>
                                )
                                : employeeTotals.length === 0
                                    ? (
                                        <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                                            No report card totals found for{" "}
                                            {currentTeam?.name ?? "this team"} in{" "}
                                            {currentTerm.label}.
                                        </div>
                                    )
                                    : (
                                        <section className="flex flex-col gap-4">
                                            <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                                                <div className="flex flex-wrap items-baseline justify-between gap-3">
                                                    <h3 className="text-lg font-semibold">
                                                        Employee Report Card Totals
                                                    </h3>
                                                    <span className="text-sm font-semibold text-secondary/80">
                                                        Session total:{" "}
                                                        {totalEmployeeReportCards}
                                                    </span>
                                                </div>
                                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                    {employeeTotals.map((employee) => (
                                                        <div
                                                            key={`employee-total-${employee.name}`}
                                                            className="rounded-2xl border border-secondary/20 bg-bg px-4 py-3"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-semibold text-secondary">
                                                                    {employee.name}
                                                                </span>
                                                                <span className="text-sm font-semibold text-secondary">
                                                                    {employee.total}
                                                                </span>
                                                            </div>
                                                            {employee.levels.length > 0
                                                                ? (
                                                                    <p className="mt-2 text-xs text-secondary/70">
                                                                        {employee.levels
                                                                            .map((level) =>
                                                                                `${level.level} (${level.count})`
                                                                            ).join(" • ")}
                                                                    </p>
                                                                )
                                                                : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>
                                    )
                )
                : !selectedDay
                    ? (
                        <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                            Select a day to see report card counts.
                        </div>
                    )
                    : students.length === 0
                        ? (
                            <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                                No students found for this day.
                            </div>
                        )
                        : (
                            <>
                                {syncWarning
                                    ? (
                                        <div className="rounded-card border-2 border-danger/40 bg-accent p-4 text-sm font-semibold text-danger shadow-md">
                                            {syncWarning}
                                        </div>
                                    )
                                    : null}
                                <section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                                        <h3 className="text-lg font-semibold">
                                            Lesson Block Overview
                                        </h3>
                                        <span className="text-sm font-semibold text-secondary/80">
                                            Total students: {totalStudents}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {lessonBlockTotals.map((entry) => (
                                            <div
                                                key={`total-${entry.level}`}
                                                className="rounded-2xl border border-secondary/20 bg-bg px-4 py-3"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-sm font-semibold text-secondary">
                                                        {entry.level}
                                                    </span>
                                                    <span className="text-sm font-semibold text-secondary">
                                                        {entry.count}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="flex flex-col gap-4">
                                    <h3 className="text-lg font-semibold text-secondary">
                                        Instructor Report Card Needs
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {instructorSummaries.map((summary) => (
                                            <div
                                                key={`instructor-${summary.name}`}
                                                className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
                                            >
                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                    <h4 className="text-base font-semibold">
                                                        {summary.name}
                                                    </h4>
                                                    <span className="text-sm font-semibold text-secondary/80">
                                                        Total: {summary.total}
                                                    </span>
                                                </div>
                                                <div className="mt-4 grid gap-3">
                                                    {summary.levels.map((level) => (
                                                        <div
                                                            key={`${summary.name}-${level.level}`}
                                                            className="rounded-2xl border border-secondary/20 bg-bg px-4 py-2"
                                                        >
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span className="text-sm font-semibold text-secondary">
                                                                    {level.level}
                                                                </span>
                                                                <span className="text-sm font-semibold text-secondary">
                                                                    {level.count}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}
        </PageShell>
    );
}

export default ReportCardsPage;

