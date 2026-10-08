import { useRequestsLogic } from "../Requests.logic";
import { formatDayLabel } from "../utils/assignmentKeys";
type Props = { model: Omit<ReturnType<typeof useRequestsLogic>, "analysis"> & { analysis: NonNullable<ReturnType<typeof useRequestsLogic>["analysis"]> } };
export default function RequestsUnmatched({ model }: Props) {
    const { analysis } = model;
    return (<section className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                    Cleanup Queue
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                    Unmatched Requests
                </h3>
            </div>
            <p className="text-sm font-semibold text-secondary/70">
                {analysis.unmatched.length}{" "}
                row{analysis.unmatched.length === 1
                    ? ""
                    : "s"}
            </p>
        </div>

        {analysis.unmatched.length === 0
            ? (
                <p className="mt-4 text-sm text-secondary/70">
                    Every uploaded request matched
                    at least one registered class on
                    its requested day.
                </p>
            )
            : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-secondary/20">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead className="bg-bg">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-secondary">
                                    Row
                                </th>
                                <th className="px-4 py-3 font-semibold text-secondary">
                                    Student
                                </th>
                                <th className="px-4 py-3 font-semibold text-secondary">
                                    Requested
                                    Instructor
                                </th>
                                <th className="px-4 py-3 font-semibold text-secondary">
                                    Day
                                </th>
                                <th className="px-4 py-3 font-semibold text-secondary">
                                    Reason
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {analysis.unmatched.map(
                                (entry) => (
                                    <tr
                                        key={`${entry.request.rowNumber}-${entry.requestedDay}-${entry.reason}`}
                                        className="border-t border-secondary/15"
                                    >
                                        <td className="px-4 py-3">
                                            {entry
                                                .request
                                                .rowNumber}
                                        </td>
                                        <td className="px-4 py-3">
                                            {entry
                                                .request
                                                .fullName ||
                                                "Missing name"}
                                        </td>
                                        <td className="px-4 py-3">
                                            {entry
                                                .request
                                                .requestedInstructor ||
                                                "Missing instructor"}
                                        </td>
                                        <td className="px-4 py-3">
                                            {entry
                                                .requestedDay
                                                ? formatDayLabel(
                                                    entry
                                                        .requestedDay,
                                                )
                                                : entry
                                                    .request
                                                    .originalDayValue ||
                                                "Missing day"}
                                        </td>
                                        <td className="px-4 py-3 text-secondary/80">
                                            {entry
                                                .reason}
                                        </td>
                                    </tr>
                                ),
                            )}
                        </tbody>
                    </table>
                </div>
            )}
    </section>);
}
