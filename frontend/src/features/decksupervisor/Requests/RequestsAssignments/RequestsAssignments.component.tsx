import { useRequestsLogic } from "../Requests.logic";
type Props = { model: ReturnType<typeof useRequestsLogic> };
export default function RequestsAssignments({ model }: Props) {
    const {
        handleSaveAssignment,
        assignmentDraft,
        setAssignmentDraft,
        rosterFile,
        assignmentSaving,
        resetAssignmentDraft,
        assignments,
        assignmentsLoading,
        handleEditAssignment,
        handleDeleteAssignment,
    } = model;
    return (<section className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <form
            className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
            onSubmit={handleSaveAssignment}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                Assignment Editor
            </p>
            <h3 className="mt-2 text-xl font-semibold">
                {assignmentDraft.id
                    ? "Edit Assignment"
                    : "Add Assignment"}
            </h3>
            <p className="mt-2 text-sm text-secondary/70">
                Save a default instructor for an event ID, term,
                and location so future part-time roster imports
                can prefill it automatically.
            </p>

            <div className="mt-5 grid gap-4">
                <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Event ID
                    <input
                        className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={assignmentDraft.eventId}
                        onChange={(event) =>
                            setAssignmentDraft((current) => ({
                                ...current,
                                eventId: event.target.value,
                            }))}
                        placeholder="123456"
                    />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Term
                    <input
                        className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={assignmentDraft.term}
                        onChange={(event) =>
                            setAssignmentDraft((current) => ({
                                ...current,
                                term: event.target.value,
                            }))}
                        placeholder={rosterFile?.defaultTerm ||
                            "Spring 2026"}
                    />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Location
                    <input
                        className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={assignmentDraft.location}
                        onChange={(event) =>
                            setAssignmentDraft((current) => ({
                                ...current,
                                location: event.target.value,
                            }))}
                        placeholder="Pool / facility"
                    />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                    Instructor
                    <input
                        className="rounded-xl border border-secondary/30 bg-bg px-3 py-2 text-sm text-secondary"
                        value={assignmentDraft.instructor}
                        onChange={(event) =>
                            setAssignmentDraft((current) => ({
                                ...current,
                                instructor: event.target.value,
                            }))}
                        placeholder="Instructor name"
                    />
                </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
                <button
                    type="submit"
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={assignmentSaving}
                >
                    {assignmentSaving
                        ? "Saving..."
                        : assignmentDraft.id
                            ? "Update Assignment"
                            : "Save Assignment"}
                </button>
                <button
                    type="button"
                    className="rounded-2xl border border-secondary/30 bg-bg px-4 py-2 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                    onClick={resetAssignmentDraft}
                    disabled={assignmentSaving}
                >
                    Clear
                </button>
            </div>
        </form>

        <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                        Saved Assignments
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">
                        Assignment Table
                    </h3>
                </div>
                <p className="text-sm font-semibold text-secondary/70">
                    {assignments.length}{" "}
                    assignment{assignments.length === 1
                        ? ""
                        : "s"}
                </p>
            </div>

            {assignmentsLoading
                ? (
                    <p className="mt-4 text-sm text-secondary/70">
                        Loading assignments...
                    </p>
                )
                : assignments.length === 0
                    ? (
                        <p className="mt-4 text-sm text-secondary/70">
                            No saved assignments yet. Add one
                            manually or use the add button from the
                            summary tab.
                        </p>
                    )
                    : (
                        <div className="mt-5 overflow-hidden rounded-2xl border border-secondary/20">
                            <table className="min-w-full border-collapse text-left text-sm">
                                <thead className="bg-bg">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-secondary">
                                            Event ID
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-secondary">
                                            Term
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-secondary">
                                            Location
                                        </th>
                                        <th className="px-4 py-3 font-semibold text-secondary">
                                            Instructor
                                        </th>
                                        <th className="px-4 py-3 text-right font-semibold text-secondary">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignments.map((
                                        assignment,
                                    ) => (
                                        <tr
                                            key={assignment.id}
                                            className="border-t border-secondary/15"
                                        >
                                            <td className="px-4 py-3">
                                                {assignment.eventId}
                                            </td>
                                            <td className="px-4 py-3">
                                                {assignment.term}
                                            </td>
                                            <td className="px-4 py-3">
                                                {assignment
                                                    .location}
                                            </td>
                                            <td className="px-4 py-3">
                                                {assignment
                                                    .instructor}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        className="rounded-xl border border-secondary/30 bg-accent px-3 py-1.5 text-sm font-semibold text-secondary transition hover:-translate-y-0.5 hover:bg-primary/10"
                                                        onClick={() =>
                                                            handleEditAssignment(
                                                                assignment,
                                                            )}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger transition hover:-translate-y-0.5"
                                                        onClick={() =>
                                                            void handleDeleteAssignment(
                                                                assignment,
                                                            )}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </div>
    </section>);
}
