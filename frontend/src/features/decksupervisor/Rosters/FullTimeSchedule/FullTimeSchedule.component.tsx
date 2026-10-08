import { dayNames } from "../../../../shared/schedule/constants";
import SchematicBoard from "../../Schematic/SchematicBoard/SchematicBoard.component";
import { useRostersLogic } from "../Rosters.logic";
type Props = { model: Extract<ReturnType<typeof useRostersLogic>, { view: "fullTime" }> };
export default function FullTimeSchedule({ model }: Props) {
    const {
        fullTimeSchematicDay,
        fullTimeUploadInputRef,
        fullTimeRosterDayOptions,
        setFullTimeDayFilter,
        fullTimeSchematicCourses,
        selectedFullTimeCourse,
        selectedFullTimeCourseRequests,
        handleMarkFullTimeRequestsConflicting,
        fullTimeColumns,
        fullTimeInstructors,
        fullTimeLockedInstructors,
        fullTimeSelectedCourseCodes,
        fullTimeSchematicTimeLabels,
        fullTimeSchematicHeight,
        fullTimeSchematicStartMinutes,
        fullTimeInstructorOptions,
        currentTeam,
        setFullTimeInstructorAt,
        toggleFullTimeCourseSelection,
        handleFullTimeDrop,
        handleFullTimeDropOnCourse,
        handleFullTimeDragStart,
        addFullTimeTemporaryColumn,
        removeFullTimeEmptyColumn,
    } = model;
    return (<div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                    Schematic Preview
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                    {fullTimeSchematicDay
                        ? dayNames[
                        fullTimeSchematicDay
                        ] ??
                        fullTimeSchematicDay
                        : "No day selected"}
                </h3>
            </div>
            <button
                type="button"
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-accent transition hover:-translate-y-0.5"
                onClick={() =>
                    fullTimeUploadInputRef
                        .current?.click()}
            >
                Upload Roster
            </button>
        </div>
        {fullTimeRosterDayOptions.length > 1
            ? (
                <div className="mt-4 flex flex-wrap gap-2">
                    {fullTimeRosterDayOptions
                        .map((day) => (
                            <button
                                key={day}
                                type="button"
                                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${fullTimeSchematicDay ===
                                    day
                                    ? "border-secondary bg-secondary text-accent"
                                    : "border-secondary/30 bg-bg text-secondary hover:bg-accent"
                                    }`}
                                onClick={() =>
                                    setFullTimeDayFilter(
                                        day,
                                    )}
                            >
                                {dayNames[
                                    day
                                ] ?? day}
                            </button>
                        ))}
                </div>
            )
            : null}

        {fullTimeSchematicCourses.length === 0
            ? (
                <p className="mt-4 text-sm text-secondary/70">
                    No uploaded classes are
                    available for this day.
                </p>
            )
            : (
                <div className="mt-5">
                    {selectedFullTimeCourse
                        ? (
                            <div className="mb-4 rounded-2xl border border-secondary/20 bg-bg p-4 text-secondary">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">
                                            Selected
                                            Class
                                            Requests
                                        </p>
                                        <h4 className="mt-2 text-lg font-semibold">
                                            {selectedFullTimeCourse
                                                .level}
                                            {" "}
                                            •
                                            {" "}
                                            {selectedFullTimeCourse
                                                .code}
                                        </h4>
                                        <p className="mt-1 text-sm text-secondary/70">
                                            {selectedFullTimeCourse
                                                .startTime}
                                            {" "}
                                            -
                                            {" "}
                                            {selectedFullTimeCourse
                                                .endTime}
                                            {selectedFullTimeCourse
                                                .assignedInstructor
                                                ? ` • Assigned to ${selectedFullTimeCourse.assignedInstructor}`
                                                : ""}
                                        </p>
                                    </div>
                                    {selectedFullTimeCourseRequests
                                        .some(
                                            (
                                                entry,
                                            ) => entry
                                                    .accommodated,
                                        )
                                        ? (
                                            <button
                                                type="button"
                                                className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20"
                                                onClick={() =>
                                                    handleMarkFullTimeRequestsConflicting(
                                                        selectedFullTimeCourseRequests
                                                            .filter(
                                                                (
                                                                    entry,
                                                                ) => entry
                                                                        .accommodated,
                                                            )
                                                            .map(
                                                                (
                                                                    entry,
                                                                ) => entry
                                                                        .id,
                                                            ),
                                                    )}
                                            >
                                                Mark
                                                All
                                                Conflicting
                                            </button>
                                        )
                                        : null}
                                </div>
                                {selectedFullTimeCourseRequests
                                    .length ===
                                    0
                                    ? (
                                        <p className="mt-3 text-sm text-secondary/70">
                                            No
                                            matched
                                            requests
                                            are
                                            linked
                                            to
                                            this
                                            class
                                            yet.
                                        </p>
                                    )
                                    : (
                                        <div className="mt-4 flex flex-col gap-3">
                                            {selectedFullTimeCourseRequests
                                                .map(
                                                    (
                                                        entry,
                                                    ) => (
                                                        <div
                                                            key={entry
                                                                .id}
                                                            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-secondary/15 bg-accent/60 px-4 py-3"
                                                        >
                                                            <div>
                                                                <p className="font-semibold text-secondary">
                                                                    {[
                                                                        entry
                                                                            .firstName,
                                                                        entry
                                                                            .lastName,
                                                                    ].filter(
                                                                        Boolean,
                                                                    ).join(
                                                                        " ",
                                                                    )}
                                                                </p>
                                                                <p className="text-sm text-secondary/75">
                                                                    {entry
                                                                        .phone}
                                                                    {entry
                                                                        .instructor
                                                                        ? ` • Requested: ${entry.instructor}`
                                                                        : ""}
                                                                    {entry
                                                                        .matchedBy
                                                                        ? ` • Matched by ${entry.matchedBy}`
                                                                        : ""}
                                                                </p>
                                                                {entry
                                                                    .requiresManualReview
                                                                    ? (
                                                                        <p className="mt-1 text-sm font-semibold text-danger">
                                                                            Manual
                                                                            review:
                                                                            {" "}
                                                                            {entry
                                                                                .manualReviewNote ||
                                                                                "This match should be reviewed manually."}
                                                                        </p>
                                                                    )
                                                                    : null}
                                                                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-secondary/60">
                                                                    {entry
                                                                        .accommodated
                                                                        ? "Accommodated"
                                                                        : entry
                                                                            .reason ===
                                                                            "conflicting_request"
                                                                            ? "Not accommodated: conflicting request"
                                                                            : entry
                                                                                .reason
                                                                                ? `Not accommodated: ${entry
                                                                                    .reason
                                                                                    .replace(/_/g, " ")
                                                                                }`
                                                                                : "Not accommodated"}
                                                                </p>
                                                                {!entry
                                                                    .accommodated &&
                                                                    entry
                                                                        .reason ===
                                                                    "other" &&
                                                                    entry
                                                                        .reasonNote
                                                                    ? (
                                                                        <p className="mt-1 text-sm text-secondary/75">
                                                                            Note:
                                                                            {" "}
                                                                            {entry
                                                                                .reasonNote}
                                                                        </p>
                                                                    )
                                                                    : null}
                                                            </div>
                                                            {entry
                                                                .accommodated
                                                                ? (
                                                                    <button
                                                                        type="button"
                                                                        className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/20"
                                                                        onClick={() =>
                                                                            handleMarkFullTimeRequestsConflicting(
                                                                                [
                                                                                    entry
                                                                                        .id,
                                                                                ],
                                                                            )}
                                                                    >
                                                                        Mark
                                                                        Conflicting
                                                                    </button>
                                                                )
                                                                : null}
                                                        </div>
                                                    ),
                                                )}
                                        </div>
                                    )}
                            </div>
                        )
                        : null}
                    <SchematicBoard
                        columns={fullTimeColumns}
                        instructors={fullTimeInstructors}
                        lockedInstructors={fullTimeLockedInstructors}
                        selectedCourseCodes={fullTimeSelectedCourseCodes}
                        timeLabels={fullTimeSchematicTimeLabels}
                        scheduleHeightRem={fullTimeSchematicHeight}
                        scheduleStartMinutes={fullTimeSchematicStartMinutes}
                        instructorOptions={fullTimeInstructorOptions}
                        sessionLabel={[
                            currentTeam?.name ??
                            "",
                            fullTimeSchematicDay
                                ? dayNames[
                                fullTimeSchematicDay
                                ] ??
                                fullTimeSchematicDay
                                : "",
                        ].filter(Boolean).join(
                            " | ",
                        )}
                        onInstructorChange={setFullTimeInstructorAt}
                        onCourseSelect={toggleFullTimeCourseSelection}
                        onColumnDrop={handleFullTimeDrop}
                        onCourseDrop={handleFullTimeDropOnCourse}
                        onCourseDragStart={handleFullTimeDragStart}
                        onAddColumn={addFullTimeTemporaryColumn}
                        onRemoveColumn={removeFullTimeEmptyColumn}
                    />
                </div>
            )}
    </div>);
}
