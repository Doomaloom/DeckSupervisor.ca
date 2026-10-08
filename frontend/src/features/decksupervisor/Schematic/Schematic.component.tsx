import { dayNames } from "../../../shared/schedule/constants";

import SchematicBoard from "./SchematicBoard/SchematicBoard.component";

import { pageWidthForSchematic, useSchematicLogic } from "./Schematic.logic";
function SchematicPage() {
    const viewModel = useSchematicLogic();
    if (viewModel.view === "fullTime") {
        const { fullTimeView, tabButtonClass, setSelectedDay, currentTeam, currentTerm, currentTeamId } = viewModel;
        return (
            <div
                className="relative left-1/2 flex -translate-x-1/2 flex-col gap-6"
                style={{
                    width: pageWidthForSchematic(
                        fullTimeView.columns.length,
                    ),
                }}
            >
                <header className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-secondary">
                        Team Schematic View
                    </h2>
                    <p className="text-sm text-secondary/75">
                        View saved schematics by day and location for the
                        selected team and session term.
                    </p>
                </header>

                <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">

                    <div className="mt-4 flex flex-wrap gap-2">
                        {fullTimeView.days.map((day) => {
                            const isActive =
                                fullTimeView.selectedDay === day.key;
                            const isDisabled = day.count === 0;
                            return (
                                <button
                                    key={day.key}
                                    type="button"
                                    className={tabButtonClass(
                                        isActive,
                                        isDisabled,
                                    )}
                                    disabled={isDisabled}
                                    onClick={() => {
                                        fullTimeView.setSelectedDay(day.key);
                                        setSelectedDay(day.key);
                                    }}
                                >
                                    {day.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:max-w-sm">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-secondary">
                            Location
                            <select
                                className="rounded-2xl border-2 border-secondary bg-bg px-3 py-2 text-sm text-secondary"
                                value={fullTimeView.selectedLocationKey}
                                onChange={(event) =>
                                    fullTimeView.setSelectedLocationKey(
                                        event.target.value,
                                    )}
                                disabled={fullTimeView.locationOptions
                                    .length === 0}
                            >
                                {fullTimeView.locationOptions.length === 0
                                    ? (
                                        <option value="">
                                            No locations available
                                        </option>
                                    )
                                    : null}
                                {fullTimeView.locationOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-secondary/80 md:grid-cols-2">
                        <p>
                            Team:{" "}
                            <span className="font-semibold">
                                {currentTeam?.name ?? "No team selected"}
                            </span>
                        </p>
                        <p>
                            Session Term:{" "}
                            <span className="font-semibold">
                                {currentTerm?.label ?? "No term selected"}
                            </span>
                        </p>
                    </div>
                </div>

                {!currentTeamId
                    ? (
                        <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                            Select a team on the home page to view schematics.
                        </div>
                    )
                    : !currentTerm
                        ? (
                            <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                Select a session term on the home page to view
                                schematics.
                            </div>
                        )
                        : fullTimeView.loadingSessions
                            ? (
                                <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                    Loading team sessions...
                                </div>
                            )
                            : fullTimeView.termSessions.length === 0
                                ? (
                                    <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                        No sessions found for{" "}
                                        {currentTeam?.name ?? "this team"} in{" "}
                                        {currentTerm.label}.
                                    </div>
                                )
                                : !fullTimeView.selectedDay
                                    ? (
                                        <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                            No session days are available for this team term.
                                        </div>
                                    )
                                    : fullTimeView.locationOptions.length === 0
                                        ? (
                                            <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                No locations found for{" "}
                                                {dayNames[fullTimeView.selectedDay] ??
                                                    fullTimeView.selectedDay} in this term.
                                            </div>
                                        )
                                        : !fullTimeView.selectedSession
                                            ? (
                                                <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                    No session was found for the selected day and
                                                    location.
                                                </div>
                                            )
                                            : fullTimeView.loadingSchematics
                                                ? (
                                                    <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                        Loading saved schematic...
                                                    </div>
                                                )
                                                : !fullTimeView.hasDbSchematic
                                                    ? (
                                                        <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                            No saved schematic entry exists in the database for
                                                            this team term day and location.
                                                        </div>
                                                    )
                                                    : !fullTimeView.hasExtractedClassesForLocation
                                                        ? (
                                                            <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                                No extracted local classes found for this day and
                                                                location. Upload the roster CSV for this team term.
                                                            </div>
                                                        )
                                                        : !fullTimeView.hasMappedSchematicColumns
                                                            ? (
                                                                <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                                    Saved schematic course IDs do not match extracted
                                                                    local class course IDs for this location.
                                                                </div>
                                                            )
                                                            : !fullTimeView.canRenderBoard
                                                                ? (
                                                                    <div className="rounded-card border-2 border-secondary/30 bg-bg p-4 text-sm font-semibold text-secondary">
                                                                        Unable to render schematic until both database and
                                                                        local storage requirements are met.
                                                                    </div>
                                                                )
                                                                : (
                                                                    <SchematicBoard
                                                                        columns={fullTimeView.columns}
                                                                        instructors={fullTimeView.instructors}
                                                                        timeLabels={fullTimeView.timeLabels}
                                                                        scheduleHeightRem={fullTimeView.scheduleHeightRem}
                                                                        scheduleStartMinutes={fullTimeView
                                                                            .scheduleStartMinutes}
                                                                        instructorOptions={[]}
                                                                        sessionLabel={fullTimeView.schematicSessionLabel}
                                                                        readOnly
                                                                        onInstructorChange={(_columnIndex, _value) => { }}
                                                                        onCourseSelect={(_course, _columnIndex) => { }}
                                                                        onColumnDrop={(_columnIndex) => { }}
                                                                        onCourseDrop={(_course, _columnIndex) => { }}
                                                                        onCourseDragStart={(
                                                                            _course,
                                                                            _columnIndex,
                                                                        ) => { }}
                                                                    />
                                                                )}
            </div>
        );
    }
    const {
        columns,
        instructors,
        instructorIds,
        lockedInstructors,
        selectedCourseCodes,
        draggedCourseCodes,
        draggedColumnIndex,
        timeLabels,
        scheduleHeightRem,
        scheduleStartMinutes,
        instructorOptions,
        sessionLabel,
        isReadOnly,
        addTemporaryColumn,
        removeEmptyColumn,
        setInstructorAt,
        toggleCourseSelection,
        handleDrop,
        handleDropOnCourse,
        handleDragStart,
        handleSaveSchedule,
    } = viewModel;
    return (
        <div
            id="schematic-page"
            data-component="schematic-page"
            className="relative left-1/2 flex -translate-x-1/2 flex-col gap-6"
            style={{ width: pageWidthForSchematic(columns.length) }}
        >
            <SchematicBoard
                columns={columns}
                instructors={instructors}
                instructorIds={instructorIds}
                lockedInstructors={lockedInstructors}
                selectedCourseCodes={selectedCourseCodes}
                draggedCourseCodes={draggedCourseCodes}
                draggedColumnIndex={draggedColumnIndex}
                timeLabels={timeLabels}
                scheduleHeightRem={scheduleHeightRem}
                scheduleStartMinutes={scheduleStartMinutes}
                instructorOptions={instructorOptions}
                sessionLabel={sessionLabel}
                readOnly={isReadOnly}
                onAddColumn={isReadOnly ? undefined : addTemporaryColumn}
                onRemoveColumn={isReadOnly ? undefined : removeEmptyColumn}
                onInstructorChange={isReadOnly ? () => { } : setInstructorAt}
                onCourseSelect={isReadOnly ? () => { } : toggleCourseSelection}
                onColumnDrop={isReadOnly ? () => { } : handleDrop}
                onCourseDrop={isReadOnly ? () => { } : handleDropOnCourse}
                onCourseDragStart={isReadOnly ? () => { } : handleDragStart}
            />

            <div className="flex justify-center">
                <button
                    className="rounded-2xl bg-primary px-6 py-3 text-white transition hover:-translate-y-0.5 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleSaveSchedule}
                    disabled={isReadOnly}
                >
                    {isReadOnly ? "View Only" : "Save Schedule"}
                </button>
            </div>
        </div>
    );
}

export default SchematicPage;

