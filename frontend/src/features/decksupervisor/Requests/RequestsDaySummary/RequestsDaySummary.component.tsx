import { useRequestsLogic } from "../Requests.logic";
import { formatDayLabel } from "../utils/assignmentKeys";
type Props = { model: Omit<ReturnType<typeof useRequestsLogic>, "analysis"> & { analysis: NonNullable<ReturnType<typeof useRequestsLogic>["analysis"]> } };
export default function RequestsDaySummary({ model }: Props) {
    const { analysis, handleAddFromSummary } = model;
    return (<section className="flex flex-col gap-4">
        {analysis.days.length === 0
            ? (
                <div className="rounded-card border-2 border-secondary/20 bg-bg p-6 text-secondary">
                    No classes matched the uploaded
                    requests. Review the unmatched
                    section below to see which names
                    or days need cleanup.
                </div>
            )
            : null}

        {analysis.days.map((dayGroup) => (
            <div
                key={dayGroup.day}
                className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
            >
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                            {dayGroup.day}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold">
                            {formatDayLabel(
                                dayGroup.day,
                            )}
                        </h3>
                    </div>
                    <p className="text-sm font-semibold text-secondary/70">
                        {dayGroup.classes.length}
                        {" "}
                        class{dayGroup.classes
                            .length === 1
                            ? ""
                            : "es"}
                    </p>
                </div>

                <div className="mt-5 grid gap-4">
                    {dayGroup.classes.map((
                        classSummary,
                    ) => (
                        <article
                            key={`${dayGroup.day}-${classSummary.eventId}`}
                            className="rounded-2xl border border-secondary/20 bg-bg p-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                        Event ID
                                    </p>
                                    <h4 className="mt-2 text-lg font-semibold">
                                        {classSummary
                                            .eventId}
                                    </h4>
                                    <p className="mt-2 text-sm text-secondary/80">
                                        {classSummary
                                            .serviceName ||
                                            "Unknown level"}
                                        {" "}
                                        •{" "}
                                        {classSummary
                                            .time ||
                                            "No time"}
                                    </p>
                                    <p className="mt-1 text-sm text-secondary/70">
                                        {classSummary
                                            .location ||
                                            "No location"}
                                        {classSummary
                                            .schedule
                                            ? ` • ${classSummary.schedule}`
                                            : ""}
                                    </p>
                                </div>
                                <div className="grid gap-2 text-right text-sm font-semibold text-secondary/80">
                                    <p>
                                        {classSummary
                                            .matchedRequestCount}
                                        {" "}
                                        matched
                                        request
                                        entries
                                    </p>
                                    <p>
                                        {classSummary
                                            .uniqueStudentCount}
                                        {" "}
                                        unique
                                        students
                                    </p>
                                    <button
                                        type="button"
                                        className="rounded-xl border border-secondary/30 bg-accent px-3 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                                        onClick={() =>
                                            handleAddFromSummary(
                                                dayGroup
                                                    .day,
                                                classSummary,
                                            )}
                                    >
                                        Add
                                        Assignment
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 overflow-hidden rounded-2xl border border-secondary/20">
                                <table className="min-w-full border-collapse text-left text-sm">
                                    <thead className="bg-accent/70">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-secondary">
                                                Requested
                                                Instructor
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold text-secondary">
                                                Count
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classSummary
                                            .instructorCounts
                                            .map(
                                                (
                                                    entry,
                                                ) => (
                                                    <tr
                                                        key={`${classSummary.eventId}-${entry.instructor}`}
                                                        className="border-t border-secondary/15"
                                                    >
                                                        <td className="px-4 py-3">
                                                            {entry
                                                                .instructor}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold">
                                                            {entry
                                                                .count}
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        ))}
    </section>);
}
