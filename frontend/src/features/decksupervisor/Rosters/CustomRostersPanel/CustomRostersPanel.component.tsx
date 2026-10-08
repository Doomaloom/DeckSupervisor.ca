import { buildCustomRosterGroups } from "../utils";

import InstructorSelect from "../InstructorSelect/InstructorSelect.component";

import LevelSelect from "../LevelSelect/LevelSelect.component";
import { CustomRostersPanelProps, useCustomRostersPanelLogic } from "./CustomRostersPanel.logic";
function CustomRostersPanel(props: CustomRostersPanelProps) {
    const viewModel = useCustomRostersPanelLogic(props);
    const {
        isCreating,
        resetEditor,
        setIsCreating,
        customRosters,
        rosterByCode,
        studentsById,
        onPrintRoster,
        handleEditRoster,
        handleDeleteRoster,
        editingRosterId,
        newLevel,
        setNewLevel,
        newInstructor,
        instructorOptions,
        setNewInstructor,
        handleClearSelection,
        selectedSourceCodes,
        selectedTimeLabel,
        availableSourceRosters,
        handleToggleSourceCode,
        selectedRosters,
        handleSelectAll,
        selectedStudentIds,
        handleToggleStudent,
        handleCreateCustomRoster,
    } = viewModel;
    return (
        <div
            id="custom-rosters-panel"
            data-component="custom-rosters-panel"
            className="flex flex-col gap-6"
        >
            <div
                data-component="custom-rosters-panel-card"
                className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Custom Rosters</h2>
                    <button
                        type="button"
                        className="rounded-2xl bg-secondary px-4 py-2 text-accent transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                        onClick={() => (isCreating
                            ? resetEditor()
                            : setIsCreating(true))}
                    >
                        {isCreating
                            ? "Close Editor"
                            : "Create New Custom Roster"}
                    </button>
                </div>
                {customRosters.length === 0
                    ? (
                        <p className="mt-3 text-secondary">
                            No custom rosters created yet.
                        </p>
                    )
                    : (
                        <div className="mt-4 flex flex-col gap-3">
                            {customRosters.map((roster) => {
                                const sourceTimes = roster.sourceCodes
                                    .map((code) => rosterByCode.get(code)?.time)
                                    .filter(Boolean);
                                const timeLabel = sourceTimes[0] ??
                                    "Time unknown";
                                const rosterGroup = buildCustomRosterGroups(
                                    [roster],
                                    rosterByCode,
                                    studentsById,
                                )[0];
                                return (
                                    <div
                                        key={roster.id}
                                        className="rounded-2xl border border-secondary/20 bg-bg p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-secondary">
                                                    {roster.serviceName}
                                                </p>
                                                <p className="text-sm text-secondary">
                                                    {roster.instructor
                                                        ? roster.instructor
                                                        : "No instructor assigned"}
                                                </p>
                                            </div>
                                            <div className="text-sm text-secondary">
                                                {timeLabel}
                                            </div>
                                        </div>
                                        <div className="mt-2 text-sm text-secondary">
                                            {roster.studentIds.length}{" "}
                                            students from{" "}
                                            {roster.sourceCodes.length} classes
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="rounded-lg border border-secondary/40 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                                onClick={() =>
                                                    rosterGroup &&
                                                    onPrintRoster(rosterGroup)}
                                            >
                                                Print
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-lg border border-secondary/40 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                                onClick={() =>
                                                    handleEditRoster(roster)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                className="rounded-lg border border-danger/60 px-3 py-1 text-sm text-danger transition hover:-translate-y-0.5 hover:bg-danger hover:text-accent"
                                                onClick={() =>
                                                    handleDeleteRoster(
                                                        roster.id,
                                                    )}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
            </div>

            {isCreating
                ? (
                    <div className="rounded-card border-2 border-secondary/20 bg-accent p-6 text-secondary shadow-md">
                        <h3 className="text-lg font-semibold">
                            {editingRosterId
                                ? "Edit Custom Roster"
                                : "Create Custom Roster"}
                        </h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <LevelSelect
                                value={newLevel}
                                onChange={setNewLevel}
                                placeholder="Select Level"
                            />
                            <InstructorSelect
                                value={newInstructor}
                                options={instructorOptions}
                                placeholder="Select Instructor"
                                onChange={setNewInstructor}
                            />
                        </div>

                        <div className="mt-6">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="font-semibold">
                                    Select Source Classes
                                </h4>
                                <button
                                    type="button"
                                    className="rounded-lg border border-secondary/40 px-3 py-1 text-sm transition hover:-translate-y-0.5 hover:bg-bg"
                                    onClick={handleClearSelection}
                                >
                                    Clear Selection
                                </button>
                            </div>
                            <p className="mt-1 text-sm text-secondary">
                                {selectedSourceCodes.length === 0
                                    ? "Pick a class to lock the time slot."
                                    : `Locked to ${selectedTimeLabel}.`}
                            </p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {availableSourceRosters.map((roster) => (
                                    <label
                                        key={roster.code}
                                        className="flex items-center gap-2 rounded-lg border border-secondary/20 bg-bg px-3 py-2 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedSourceCodes
                                                .includes(roster.code)}
                                            onChange={() =>
                                                handleToggleSourceCode(
                                                    roster.code,
                                                )}
                                        />
                                        <span className="font-semibold">
                                            {roster.serviceName}
                                        </span>
                                        <span className="text-secondary">
                                            ({roster.time})
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="font-semibold">Select Students</h4>
                            {selectedRosters.length === 0
                                ? (
                                    <p className="mt-2 text-sm text-secondary">
                                        Choose source classes to see students.
                                    </p>
                                )
                                : (
                                    <div className="mt-3 flex flex-col gap-3">
                                        {selectedRosters.map((roster) => (
                                            <div
                                                key={roster.code}
                                                className="rounded-lg border border-secondary/20 bg-bg p-3"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="text-sm font-semibold text-secondary">
                                                        {roster.serviceName}
                                                        {" "}
                                                        ({roster.time})
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="rounded-lg border border-secondary/40 px-2 py-1 text-xs transition hover:-translate-y-0.5 hover:bg-accent hover:text-secondary"
                                                        onClick={() =>
                                                            handleSelectAll(
                                                                roster,
                                                            )}
                                                    >
                                                        Select All
                                                    </button>
                                                </div>
                                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                    {roster.students.map((
                                                        student,
                                                    ) => (
                                                        <label
                                                            key={student.id}
                                                            className="flex items-center gap-2 text-sm"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedStudentIds
                                                                    .includes(
                                                                        student
                                                                            .id,
                                                                    )}
                                                                onChange={() =>
                                                                    handleToggleStudent(
                                                                        student
                                                                            .id,
                                                                    )}
                                                            />
                                                            <span>
                                                                {student.name
                                                                    .replace(/"/g, "")}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                        </div>

                        <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                className="rounded-2xl bg-primary px-5 py-2 text-white transition hover:-translate-y-0.5 hover:bg-secondary"
                                onClick={handleCreateCustomRoster}
                            >
                                {editingRosterId
                                    ? "Save Changes"
                                    : "Create Custom Roster"}
                            </button>
                            <button
                                type="button"
                                className="rounded-2xl border border-secondary/60 px-5 py-2 text-secondary transition hover:-translate-y-0.5 hover:bg-bg"
                                onClick={resetEditor}
                            >
                                Cancel
                            </button>
                            <span className="text-sm text-secondary">
                                {selectedStudentIds.length} students selected
                            </span>
                        </div>
                    </div>
                )
                : null}
        </div>
    );
}

export default CustomRostersPanel;

